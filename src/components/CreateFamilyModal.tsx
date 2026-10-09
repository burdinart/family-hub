// src/components/CreateFamilyModal.tsx — модалка онбординга «Создайте вашу семью».
// Показывается автоматически, когда у вошедшего пользователя profile.family_id === null
// (см. useAuth().needsFamily). Mobile-first: на узких экранах занимает почти всю ширину.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Users, X, Loader2 } from 'lucide-react';
import { familyService } from '@/services/familyService';
import { useAuth } from '@/hooks/useAuth';

interface CreateFamilyModalProps {
  /** Закрытие модалки (для онбординга необязательно — без семьи UI недоступен) */
  onClose: () => void;
  /** Вызывается после успешного создания семьи (обычно refreshProfile) */
  onFamilyCreated: () => void;
}

export function CreateFamilyModal({ onClose, onFamilyCreated }: CreateFamilyModalProps) {
  const { profile } = useAuth();
  const [familyName, setFamilyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Текст ошибки показываем внутри формы вместо alert() — нативный alert
  // блокирует JS-поток и плохо выглядит на мобильных.
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Защита от пустого имени и от отсутствия профиля (онбординг возможен только с профилем)
    if (!familyName.trim() || !profile) return;

    setIsLoading(true);
    setErrorText(null);
    try {
      await familyService.createFamily(familyName.trim(), profile.id);
      // Семья создана → родитель обновит профиль, needsFamily станет false
      onFamilyCreated();
    } catch (error) {
      console.error('Ошибка при создании семьи:', error);
      setErrorText(error instanceof Error ? error.message : 'Не удалось создать семью. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Overlay на весь экран: затемнение + центрирование карточки (z-50 — поверх Layout)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-family-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        {/* Шапка: иконка + заголовок + кнопка закрытия */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={24} className="text-emerald-600" aria-hidden="true" />
            <h2 id="create-family-title" className="text-xl font-bold text-gray-900">
              Создайте вашу семью
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Придумайте название для вашей семьи. После создания вы сможете приглашать
          близких и вести общие дела.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="family-name" className="mb-1 block text-sm font-medium text-gray-700">
              Название семьи <span className="text-red-500">*</span>
            </label>
            <input
              id="family-name"
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Например: Семья Ивановых"
              maxLength={80}
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          {/* Сообщение об ошибке (доступно для скринридеров) */}
          {errorText && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorText}
            </p>
          )}

          {/* Кнопки: на мобильных — в столбик (touch-friendly), на sm+ — в ряд */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 sm:flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading || !familyName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 sm:flex-1"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isLoading ? 'Создание…' : 'Создать семью'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
