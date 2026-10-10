// public/sw.js — Service Worker Family Hub (PWA + Web Push).
// Регистрация выполняется из src/main.tsx через './sw.js' — относительные пути
// корректно работают при деплое в подпапку (base = '/family-hub/', GitHub Pages).
// ВАЖНО: это нативный JS без сборки — никаких import/ES-модулей, только self.*.

const CACHE_NAME = 'family-hub-v1';

// Установка: сразу активируемся (новая версия SW не ждёт закрытия вкладок)
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Активация: берём под контроль все открытые клиенты + чистим устаревшие кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Обработка Push-уведомлений (данные шлёт Edge Function send-push)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  // Ожидаем JSON {title, body, url, notificationId}; plain-text — фолбэк
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Family Hub', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './',
      notificationId: data.notificationId,
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' },
    ],
    tag: 'family-hub-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Family Hub', options));
});

// Клик по уведомлению: фокус существующей вкладки → иначе открыть новую
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Сначала ищем вкладку нашего приложения (учитываем base-путь /family-hub/),
      // иначе фокус уводился бы на любую вкладку того же домена (например, GitHub).
      const appPath = new URL('./', self.location).pathname;
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.location.origin + appPath)) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        // Относительный URL резолвим от адреса самого SW (учитывает папку деплоя)
        return self.clients.openWindow(new URL(event.notification.data?.url || './', self.location).href);
      }
    }),
  );
});
