// src/services/pushService.ts — клиентская часть Web Push (PWA).
// Полный цикл подписки: разрешение браузера → Service Worker → pushManager.subscribe()
// → сохранение подписки в таблицу Supabase push_subscriptions (RLS: только свои записи).
// Отправка уведомлений — зона Edge Function send-push (здесь не реализуется).
// Строгий TypeScript: без any, все ошибки возвращаются понятными сообщениями на русском.

import { supabase } from '@/config/supabase';

/** Публичный VAPID-ключ из .env.local (только он безопасен для фронтенда) */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Конвертация VAPID-ключа из base64url в Uint8Array (требование pushManager) */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  // Явный ArrayBuffer — совместимо с BufferSource в strict TS (lib DOM)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** ArrayBuffer ключей подписки → стандартный base64 (для хранения в БД) */
function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/** Результат операции подписки/отписки */
export interface PushResult {
  success: boolean;
  error?: string;
}

export const pushService = {
  /** Поддерживает ли браузер push (SW + PushManager + Notification) */
  isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  /** Текущий статус разрешения на уведомления */
  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  },

  /**
   * Включить push: запрос разрешения → подписка через Service Worker →
   * upsert подписки в push_subscriptions (onConflict по endpoint — перезапись
   * при переподключении того же браузера).
   */
  async subscribe(): Promise<PushResult> {
    if (!this.isPushSupported()) {
      return { success: false, error: 'Браузер не поддерживает push-уведомления' };
    }

    try {
      // 1. Разрешение пользователя (обязательно по gesture — клик по кнопке)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Разрешение на уведомления не выдано' };
      }

      // 2. Ждём готовности Service Worker (регистрируется в main.tsx)
      const registration = await navigator.serviceWorker.ready;

      // 3. Существующая браузерная подписка переиспользуется
      let subscription = await registration.pushManager.getSubscription();

      // 4. Новой подписке нужен публичный VAPID-ключ
      if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
          return { success: false, error: 'VAPID ключ не настроен (VITE_VAPID_PUBLIC_KEY)' };
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 5. Авторизованный пользователь — владелец подписки (RLS проверит сам)
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        return { success: false, error: 'Пользователь не авторизован' };
      }

      // 6. Извлекаем криптографические ключи подписки
      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');
      if (!p256dh || !auth) {
        return { success: false, error: 'Не удалось получить ключи подписки' };
      }

      // 7. Сохраняем в БД (таблица push_subscriptions, RLS: user_id === auth.uid())
      const { error: dbError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: authData.user.id,
          endpoint: subscription.endpoint,
          p256dh_key: arrayBufferToBase64(p256dh),
          auth_key: arrayBufferToBase64(auth),
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' },
      );

      if (dbError) {
        console.error('Ошибка сохранения подписки:', dbError);
        return { success: false, error: 'Не удалось сохранить подписку. Проверьте соединение.' };
      }

      return { success: true };
    } catch (error) {
      console.error('Ошибка подписки на push:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка подписки',
      };
    }
  },

  /** Отписаться: удалить браузерную подписку и все записи пользователя из БД */
  async unsubscribe(): Promise<PushResult> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { error: dbError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', authData.user.id);
        if (dbError) {
          console.error('Ошибка удаления подписки из БД:', dbError);
          return { success: false, error: 'Подписка удалена из браузера, но не из сервера' };
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Ошибка отписки:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Не удалось отключить уведомления',
      };
    }
  },

  /** Активна ли подписка (проверяем и браузер, и запись в БД) */
  async isSubscribed(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return false;

      // Сверка с БД: браузер может «помнить» подписку, удалённую на другом устройстве
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return false;
      const { count } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('endpoint', subscription.endpoint);
      return (count ?? 0) > 0;
    } catch {
      return false;
    }
  },
};
