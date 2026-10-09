// src/components/PushSettings.tsx — виджет управления push-уведомлениями (страница настроек).
// Покрывает все состояния: неподдерживаемый браузер / заблокированное разрешение /
// не подписан / загрузка / подписан / ошибка. Mobile-first, строгий TS, комментарии на русском.

import { useEffect, useState } from 'react';
import { AlertCircle, Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react';
import { pushService } from '@/services/pushService';

/** Возможные состояния виджета */
type PushStatus = 'unsupported' | 'denied' | 'default' | 'loading' | 'subscribed' | 'error';

export function PushSettings() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [message, setMessage] = useState('');

  // Первичная проверка поддержки/разрешения/подписки
  useEffect(() => {
    void checkStatus();
  }, []);

  /** Определить актуальное состояние push без запроса разрешения */
  const checkStatus = async () => {
    if (!pushService.isPushSupported()) {
      setStatus('unsupported');
      return;
    }

    const permission = pushService.getPermissionStatus();
    if (permission === 'denied') {
      setStatus('denied');
      return;
    }

    const subscribed = await pushService.isSubscribed();
    setStatus(subscribed ? 'subscribed' : 'default');
  };

  /** Включить уведомления (запрос разрешения + подписка + сохранение в БД) */
  const handleSubscribe = async () => {
    setStatus('loading');
    setMessage('');

    const result = await pushService.subscribe();

    if (result.success) {
      setStatus('subscribed');
      setMessage('Уведомления успешно включены!');
    } else {
      // Если пользователь запретил на уровне браузера — показываем блок «заблокировано»
      setStatus(pushService.getPermissionStatus() === 'denied' ? 'denied' : 'error');
      setMessage(result.error ?? 'Не удалось включить уведомления');
    }
  };

  /** Отключить уведомления */
  const handleUnsubscribe = async () => {
    setStatus('loading');
    const result = await pushService.unsubscribe();
    setStatus(result.success ? 'default' : 'error');
    setMessage(result.success ? 'Уведомления отключены' : (result.error ?? 'Ошибка отписки'));
  };

  // ── Браузер не поддерживает push ────────────────────────────────────────────
  if (status === 'unsupported') {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-yellow-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-yellow-900">
              Push-уведомления не поддерживаются
            </p>
            <p className="mt-1 text-xs text-yellow-700">
              Используйте Chrome на Android/Desktop или Safari на iOS 16.4+ (добавив сайт на
              главный экран через «Поделиться» → «На экран Домой»).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Разрешение заблокировано пользователем ранее ────────────────────────────
  if (status === 'denied') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-red-900">Уведомления заблокированы</p>
            <p className="mt-1 text-xs text-red-700">
              Откройте настройки браузера → Сайт → Разрешения → Уведомления и включите их
              вручную.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Основной карточный виджет ───────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-blue-600" aria-hidden="true" />
          <h3 className="font-bold text-gray-900">Push-уведомления</h3>
        </div>
        {status === 'subscribed' && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
            <CheckCircle size={14} aria-hidden="true" />
            Активно
          </span>
        )}
      </div>

      <p className="mb-3 text-sm text-gray-600">
        Получайте уведомления о задачах, сообщениях и событиях, даже когда приложение закрыто.
      </p>

      {/* Инлайн-сообщение результата вместо alert() */}
      {message && (
        <div
          role="status"
          className={`mb-3 rounded-lg p-2 text-xs ${
            status === 'error'
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {message}
        </div>
      )}

      {/* Кнопка: крупная, на всю ширину (mobile-first touch target) */}
      {status === 'subscribed' ? (
        <button
          type="button"
          onClick={() => void handleUnsubscribe()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <BellOff size={16} aria-hidden="true" />
          Отключить уведомления
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleSubscribe()}
          disabled={status === 'loading'}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Bell size={16} aria-hidden="true" />
          )}
          {status === 'loading' ? 'Подключение…' : 'Включить уведомления'}
        </button>
      )}

      {status === 'default' && (
        <p className="mt-2 text-xs text-gray-500">
          После нажатия браузер запросит разрешение на показ уведомлений.
        </p>
      )}
    </div>
  );
}
