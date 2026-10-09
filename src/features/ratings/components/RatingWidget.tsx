// src/features/ratings/components/RatingWidget.tsx — виджет рейтинга для главной страницы.
// Показывает моё звание с прогрессом до следующего, топ-3 семьи и кнопки
// «История» / «Подарить». Mobile-first: компактные строки, крупные зоны касания.
// Данные берутся из ratingsStore (realtime-подписка обновляет их автоматически).

import { useEffect } from 'react';
import { Gift, Loader2, TrendingUp, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRatingsStore } from '../store/ratingsStore';
import { getRankInfo } from '../services/ratingsService';

interface RatingWidgetProps {
  /** Открыть модалку истории баллов */
  onOpenHistory?: () => void;
  /** Открыть модалку подарка баллов */
  onOpenGift?: () => void;
}

/** Медальные эмодзи для первых трёх строк рейтинга */
const MEDALS = ['🥇', '🥈', '🥉'] as const;

export function RatingWidget({ onOpenHistory, onOpenGift }: RatingWidgetProps) {
  // profile — актуальный профиль из authStore (обновляется refreshProfile)
  const { user: profile } = useAuth();
  const familyRating = useRatingsStore((s) => s.familyRating);
  const familyTotalPoints = useRatingsStore((s) => s.familyTotalPoints);
  const isLoading = useRatingsStore((s) => s.isLoading);
  const subscribeToFamilyPoints = useRatingsStore((s) => s.subscribeToFamilyPoints);
  const unsubscribeFromPoints = useRatingsStore((s) => s.unsubscribeFromPoints);

  const familyId = profile?.family_id ?? null;
  const userId = profile?.id ?? null;

  // Подписываемся на points_log семьи: рейтинг живёт в реальном времени
  useEffect(() => {
    if (familyId && userId) {
      void subscribeToFamilyPoints(familyId, userId);
    }
    return () => {
      unsubscribeFromPoints();
    };
  }, [familyId, userId, subscribeToFamilyPoints, unsubscribeFromPoints]);

  if (!profile) return null;

  const myPoints = profile.points || 0;
  const myRank = getRankInfo(myPoints);
  // Моё место в рейтинге (1-based); -1 → ещё не загружен
  const myPosition = familyRating.findIndex((m) => m.id === profile.id) + 1;
  // Прогресс внутри текущего звания: от min до max. Для «Легенды» шкала не нужна.
  const rankSpan = Math.max(1, myRank.maxPoints - myRank.minPoints);
  const progressPct = myRank.nextRank
    ? Math.min(100, Math.round(((myPoints - myRank.minPoints) / rankSpan) * 100))
    : 100;

  return (
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
      {/* Заголовок + общий счёт семьи */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-gray-900">
          <Trophy size={20} className="text-amber-600" aria-hidden="true" />
          Рейтинг семьи
        </h3>
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <TrendingUp size={12} aria-hidden="true" />
          Общий счёт:&nbsp;<b className="text-amber-700">{familyTotalPoints}</b>
        </span>
      </div>

      {/* Моё звание и прогресс до следующего */}
      <div className="mb-3 rounded-xl border border-amber-100 bg-white p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-gray-900">
            {myRank.emoji} {myRank.title}
            {myPosition > 0 && (
              <span className="ml-1 text-xs text-gray-500">· место {myPosition}</span>
            )}
          </span>
          <span className="shrink-0 text-sm font-bold text-amber-700">{myPoints} б.</span>
        </div>

        {myRank.nextRank ? (
          <>
            {/* Полоса прогресса: height 8px, скругление, анимация ширины */}
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Прогресс до звания «${myRank.nextRank}»`}
            >
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              До звания «{myRank.nextRank}»: ещё {myRank.pointsToNext} б.
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs font-medium text-amber-700">
            Максимальное звание достигнуто 👑
          </p>
        )}
      </div>

      {/* Топ-3 семьи */}
      {isLoading && familyRating.length === 0 ? (
        <div className="mb-3 flex items-center justify-center py-4 text-amber-600">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <ol className="mb-3 space-y-1">
          {familyRating.slice(0, 3).map((member, index) => (
            <li
              key={member.id}
              className={`flex items-center justify-between gap-2 rounded-lg p-2 ${
                member.id === profile.id ? 'bg-amber-100' : 'bg-white/60'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-center text-sm" aria-hidden="true">
                  {MEDALS[index] ?? index + 1}
                </span>
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-bold text-gray-700">
                    {(member.full_name.charAt(0) || '?').toUpperCase()}
                  </span>
                )}
                <span className="truncate text-sm font-medium text-gray-900">
                  {member.full_name || 'Без имени'}
                  {member.id === profile.id && (
                    <span className="text-gray-500"> (вы)</span>
                  )}
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <span aria-hidden="true">{member.rank.emoji}</span>
                <b className="text-sm">{member.points}</b>
                <span className="text-xs text-gray-500">б.</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Действия: на мобильных — во всю ширину (min-h 44px — зона касания) */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <TrendingUp size={14} aria-hidden="true" />
          История
        </button>
        <button
          type="button"
          onClick={onOpenGift}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Gift size={14} aria-hidden="true" />
          Подарить
        </button>
      </div>
    </section>
  );
}
