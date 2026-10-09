// src/pages/SettingsPage.tsx — страница «Настройки»: управление push-уведомлениями и аккаунтом.
// Mobile-first: вертикальный стек карточек, крупные touch-кнопки.

import { Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PushSettings } from '@/components/PushSettings';

export function SettingsPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      {/* Заголовок страницы */}
      <div className="flex items-center gap-2">
        <Settings size={24} className="text-blue-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
      </div>

      {/* Push-уведомления: подписка/отписка со всеми статусами */}
      <PushSettings />

      {/* Информация об аккаунте */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-2 font-bold text-gray-900">Аккаунт</h3>
        {profile ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Имя</dt>
              <dd className="truncate font-medium text-gray-900">{profile.full_name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Email</dt>
              <dd className="truncate font-medium text-gray-900">{profile.email || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Баллы</dt>
              <dd className="font-medium text-gray-900">{profile.points ?? 0} б.</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Профиль не загружен</p>
        )}
      </div>

      {/* Выход из аккаунта */}
      <button
        type="button"
        onClick={() => void signOut()}
        className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Выйти из аккаунта
      </button>
    </div>
  );
}
