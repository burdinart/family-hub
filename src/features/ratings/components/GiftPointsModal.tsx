// src/features/ratings/components/GiftPointsModal.tsx — модалка «Подарить баллы».
// Выбор получателя из членов семьи, целое число баллов (1..баланс) и сообщение.
// Списание/начисление выполняет ratingsService.giftPoints() через add_points().
// Mobile-first: bottom-sheet на узких экранах, кнопки с зоной касания ≥44px.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Gift, Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useRatingsStore } from '../store/ratingsStore';
import { ratingsService } from '../services/ratingsService';

interface GiftPointsModalProps {
  onClose: () => void;
  /** Успешная отправка подарка (обычно закрытие модалки) */
  onGifted: () => void;
}

export function GiftPointsModal({ onClose, onGifted }: GiftPointsModalProps) {
  const { user: profile } = useAuth();
  // Перечитать profiles.points после списания: баланс в authStore должен быть актуальным
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const familyRating = useRatingsStore((s) => s.familyRating);
  const refreshAfterAction = useRatingsStore((s) => s.refreshAfterAction);

  const [toUserId, setToUserId] = useState('');
  const [points, setPoints] = useState(1);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Получатель — любой член семьи, кроме себя
  const otherMembers = familyRating.filter((m) => m.id !== profile?.id);
  const myPoints = profile?.points ?? 0;
  // Валидность формы: выбран получатель, баллов >= 1 и не больше баланса
  const isValid =
    toUserId !== '' && Number.isInteger(points) && points >= 1 && points <= myPoints;

  const handleGift = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile?.family_id || !isValid || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const receiver = otherMembers.find((m) => m.id === toUserId);
      await ratingsService.giftPoints(
        profile.family_id,
        profile.id,
        toUserId,
        points,
        message,
        receiver?.full_name,
        profile.full_name,
      );
      // Обновляем рейтинг/историю в ratingsStore и баланс в authStore
      await Promise.all([
        refreshAfterAction(profile.family_id, profile.id),
        refreshProfile(),
      ]);
      onGifted();
    } catch (err) {
      console.error('Ошибка при отправке подарка:', err);
      setError(err instanceof Error ? err.message : 'Не удалось подарить баллы. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
        {/* Шапка */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Gift size={22} className="text-pink-600" aria-hidden="true" />
            Подарить баллы
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-2 min-h-[44px] min-w-[44px] rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Текущий баланс: <b className="text-gray-900">{myPoints} б.</b>
        </p>

        {/* Инлайн-ошибка вместо alert(): доступно для скринридеров */}
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {otherMembers.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
            В вашей семье пока нет других участников — дарить баллы некому.
            Пригласите близких кодом семьи!
          </p>
        ) : (
          <form onSubmit={handleGift} className="space-y-4">
            <div>
              <label htmlFor="gift-to" className="mb-1 block text-sm font-medium text-gray-700">
                Кому <span className="text-red-500">*</span>
              </label>
              <select
                id="gift-to"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:ring-2 focus:ring-pink-500 focus:outline-none"
                required
              >
                <option value="">Выберите члена семьи</option>
                {otherMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.rank.emoji} {m.full_name || 'Без имени'} ({m.points} б.)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="gift-points" className="mb-1 block text-sm font-medium text-gray-700">
                Сколько баллов <span className="text-red-500">*</span>
                <span className="ml-1 text-xs font-normal text-gray-500">(макс. {myPoints})</span>
              </label>
              <input
                id="gift-points"
                type="number"
                inputMode="numeric"
                min={1}
                max={myPoints}
                step={1}
                value={points}
                onChange={(e) => setPoints(Math.trunc(Number(e.target.value) || 0))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:ring-2 focus:ring-pink-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="gift-message" className="mb-1 block text-sm font-medium text-gray-700">
                Сообщение <span className="text-xs font-normal text-gray-500">(необязательно)</span>
              </label>
              <input
                id="gift-message"
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={100}
                placeholder="Например: Спасибо за помощь!"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
            </div>

            {/* Кнопки: на мобильных столбиком (отмена под действием), на sm+ — в ряд */}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="min-h-[44px] w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 sm:flex-1"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isLoading || !isValid}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50 sm:flex-1"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {isLoading ? 'Отправка…' : 'Подарить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
