// src/services/notificationHelper.ts — универсальный хелпер создания уведомлений.
// Пишет строку в public.notifications; DB-триггер dispatch_push (миграция
// 20261009000000) асинхронно вызывает Edge Function send-push → Web Push на все
// подписки получателя. Без try/catch здесь сбой уведомления сломал бы основное
// действие (создание задачи и т.п.) — поэтому ВСЕГДА глушим ошибки в лог.
//
// ВАЖНОЕ ПРАВИЛО проекта: мы НИКОГДА не уведомляем того, кто совершил действие.
// Адресат — исполнитель задачи или другие члены семьи (см. getOtherFamilyMembers).

import { supabase } from '@/config/supabase';

/** Тип уведомления (колонка notifications.type) */
export type NotificationType = 'task' | 'event' | 'document' | 'chat' | 'rating' | 'system';

interface CreateNotificationParams {
  /** id семьи — нужен RLS-политике для проверки membership */
  familyId: string;
  /** Кому адресовано (получатель) */
  userId: string;
  /** Кто инициировал событие (null — системное уведомление) */
  senderId: string | null;
  title: string;
  body: string;
  type: NotificationType;
  /** Куда вести при клике по push (относительный путь SPA, например '/tasks') */
  url?: string;
  /** id объекта-источника (задача/событие/документ/сообщение) */
  referenceId?: string | null;
  /** Тип источника: task | event | document | message ... */
  referenceType?: string | null;
}

/**
 * Создать одно уведомление. Ошибки НЕ пробрасываются наружу —
 * только console.error: уведомление не должно ломать бизнес-операцию.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').insert([
      {
        family_id: params.familyId,
        user_id: params.userId,
        sender_id: params.senderId,
        title: params.title,
        body: params.body,
        type: params.type,
        // url задаём явно: колонка NOT NULL DEFAULT '/', но при явном null БД упадёт
        url: params.url ?? defaultUrlByType(params.type),
        reference_id: params.referenceId ?? null,
        reference_type: params.referenceType ?? null,
      },
    ]);
    if (error) console.error('Ошибка создания уведомления:', error);
  } catch (error) {
    // Сетевые сбои Supabase тоже не должны влиять на основной поток
    console.error('Ошибка создания уведомления:', error);
  }
}

/** Разделитель «…» для тела push: не больше лимита, без обрезания слова посередине */
export function truncateText(text: string, max = 50): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Массовое уведомление нескольких получателей (последовательно, чтобы не спамить пул соединений) */
export async function createNotificationsForMany(
  base: Omit<CreateNotificationParams, 'userId'>,
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    // Защита от главного правила: отправитель никогда не получает своё уведомление
    if (userId === base.senderId) continue;
    await createNotification({ ...base, userId });
  }
}

/** Краткая карточка члена семьи (для рассылки уведомлений) */
export interface FamilyMemberLite {
  id: string;
  full_name: string;
}

/**
 * Получить всех членов семьи, КРОМЕ указанного пользователя.
 * При ошибке возвращаем пустой массив — вызывающий код просто не разошлёт
 * уведомления, но основное действие состоится.
 */
export async function getOtherFamilyMembers(
  familyId: string,
  excludeUserId: string,
): Promise<FamilyMemberLite[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('family_id', familyId)
      .neq('id', excludeUserId);

    if (error || !data) return [];
    return data.map((row) => {
      const r = row as Record<string, unknown>;
      return { id: String(r.id), full_name: String(r.full_name ?? '') };
    });
  } catch (error) {
    console.error('Не удалось получить членов семьи:', error);
    return [];
  }
}

/** Страница приложения, куда ведёт клик по push данного типа */
function defaultUrlByType(type: NotificationType): string {
  switch (type) {
    case 'task':
      return '/tasks';
    case 'event':
      return '/calendar';
    case 'document':
      return '/vault';
    case 'chat':
      return '/chat';
    case 'rating':
      return '/';
    case 'system':
    default:
      return '/';
  }
}
