// supabase/functions/send-push/index.ts — Edge Function отправки Web Push.
// Вызывается DB-триггером после вставки строки в public.notifications:
//   notifications -> pg_notify('send_push', notification_id) -> this function.
// Секреты берутся из `supabase secrets set` (см. .env.example):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// ── Читаем секреты (Deno env) ────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// PWA deployed на GitHub Pages в подпапке /family-hub/ — иконки и клики
// должны вести туда же, иначе push-иконка не найдётся (404).
const APP_BASE = '/family-hub/'

// CORS: фронтенд живёт на github.io, триггер вызывает функцию изнутри Supabase.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

/** JSON-ответ с CORS-заголовками */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// Валидируем VAPID при старте cold-start — понятная ошибка в логах вместо тихого сбоя
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('send-push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы (supabase secrets set ...)')
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Клиент с service_role — обходит RLS при чтении notifications/push_subscriptions.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(async (req: Request) => {
  // Preflight для ручных вызовов с фронтенда
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    // Источники вызова:
    // 1) pg_notify из триггера: {"notification_id": "<uuid>"}
    // 2) ручной вызов (тесты): {"user_id": "<uuid>", "title": "...", "body": "..."}
    const notificationId = typeof body.notification_id === 'string' ? body.notification_id : null

    let payloadTitle = 'Family Hub'
    let payloadBody = ''
    let payloadUrl = APP_BASE
    let userId = typeof body.user_id === 'string' ? body.user_id : null

    if (notificationId) {
      // 1. Получаем данные уведомления из таблицы notifications
      const { data: notification, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .maybeSingle()

      if (notifError || !notification) {
        return json({ error: 'Notification not found', detail: notifError?.message ?? null }, 404)
      }

      userId = notification.user_id as string
      payloadTitle = (notification.title as string) ?? 'Family Hub'
      payloadBody = (notification.body as string) ?? ''
      // notification.url может быть '/' или '/tasks' — склеиваем с базовым путём приложения
      payloadUrl = APP_BASE + String(notification.url ?? '').replace(/^\/+/, '')
    } else if (userId && typeof body.title === 'string') {
      // Ручной режим (для тестов из дашборда/CLI)
      payloadTitle = body.title
      payloadBody = typeof body.body === 'string' ? body.body : ''
    } else {
      return json({ error: 'Either notification_id or user_id+title is required' }, 400)
    }

    // 2. Все активные подписки получателя
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (subError) {
      return json({ error: 'Failed to read subscriptions', detail: subError.message }, 500)
    }
    if (!subscriptions || subscriptions.length === 0) {
      // Не ошибка: у пользователя просто нет браузера с включённым push
      return json({ message: 'No subscriptions found', sent_to: 0 }, 200)
    }

    // 3. Payload для service worker (public/sw.js читает title/body/icon/url/notificationId)
    const payload = JSON.stringify({
      title: payloadTitle,
      body: payloadBody,
      icon: `${APP_BASE}icons/icon-192.png`,
      url: payloadUrl,
      notificationId: notificationId ?? crypto.randomUUID(),
    })

    // 4. Отправка на каждое устройство; невалидные подписки (410 Gone) чистим
    let sent = 0
    let failed = 0

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint as string,
              keys: {
                p256dh: sub.p256dh_key as string,
                auth: sub.auth_key as string,
              },
            },
            payload,
          )
          sent += 1
        } catch (err) {
          // Ошибки типизированы как unknown — извлекаем statusCode безопасно (strict TS)
          const e = err as { statusCode?: number }
          if (e.statusCode === 410 || e.statusCode === 404) {
            // Подписка протухла (пользователь очистил данные браузера) — удаляем
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            failed += 1
            console.error(`Push failed for subscription ${sub.id}:`, err)
          }
        }
      }),
    )

    return json({ success: true, sent, failed, total: subscriptions.length }, 200)
  } catch (error) {
    console.error('Edge function error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})
