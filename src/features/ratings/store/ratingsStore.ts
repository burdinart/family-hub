// src/features/ratings/store/ratingsStore.ts — Zustand store модуля «Рейтинги».
// Хранит рейтинг семьи, общий счёт и историю баллов текущего пользователя.
// Мутации (начисления) выполняет ratingsService; store только читает состояние,
// поэтому после чужих действий в семье данные обновляются через realtime-подписку
// либо явным refreshAfterAction().

import { create } from 'zustand';
import { supabase } from '@/config/supabase';
import { ratingsService, type FamilyRatingEntry } from '../services/ratingsService';
import type { PointsLog } from '@/types';

interface RatingsState {
  /** Члены семьи, отсортированные по баллам (убывание) */
  familyRating: FamilyRatingEntry[];
  /** Суммарные баллы семьи */
  familyTotalPoints: number;
  /** История начислений текущего пользователя */
  userHistory: PointsLog[];
  isLoading: boolean;
  error: string | null;
  /** Функция отписки от realtime-канала points_log (null — подписки нет) */
  unsubscribe: (() => void) | null;

  // --- Actions ---
  /** Загрузить рейтинг и общий счёт семьи */
  loadRatings: (familyId: string) => Promise<void>;
  /** Загрузить историю баллов пользователя */
  loadUserHistory: (userId: string) => Promise<void>;
  /** Перезагрузить всё (рейтинг + счёт + историю) — после своего действия с баллами */
  refreshAfterAction: (familyId: string, userId: string) => Promise<void>;
  /** Подписка на realtime-изменения points_log семьи: обновляет рейтинг/счёт/историю */
  subscribeToFamilyPoints: (familyId: string, userId: string) => Promise<void>;
  /** Отписка (при размонтировании страницы / смене семьи) */
  unsubscribeFromPoints: () => void;
}

/** Строка WAL-события / SELECT → доменный PointsLog без any */
function toPointsLog(row: Record<string, unknown>): PointsLog {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    user_id: String(row.user_id),
    points: Number(row.points ?? 0),
    reason: String(row.reason ?? ''),
    category: String(row.category ?? 'bonus') as PointsLog['category'],
    reference_id: (row.reference_id as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

export const useRatingsStore = create<RatingsState>((set, get) => ({
  familyRating: [],
  familyTotalPoints: 0,
  userHistory: [],
  isLoading: false,
  error: null,
  unsubscribe: null,

  loadRatings: async (familyId) => {
    set({ isLoading: true, error: null });
    try {
      const [rating, totalPoints] = await Promise.all([
        ratingsService.getFamilyRating(familyId),
        ratingsService.getFamilyTotalPoints(familyId),
      ]);
      set({ familyRating: rating, familyTotalPoints: totalPoints, isLoading: false });
    } catch (err) {
      console.error('Ошибка загрузки рейтинга:', err);
      set({ error: 'Не удалось загрузить рейтинг семьи.', isLoading: false });
    }
  },

  loadUserHistory: async (userId) => {
    try {
      const history = await ratingsService.getUserPointsHistory(userId);
      set({ userHistory: history });
    } catch (err) {
      // Историю считаем не критичной: логируем, но не портим основной экран
      console.error('Ошибка загрузки истории баллов:', err);
    }
  },

  refreshAfterAction: async (familyId, userId) => {
    try {
      const [rating, total, history] = await Promise.all([
        ratingsService.getFamilyRating(familyId),
        ratingsService.getFamilyTotalPoints(familyId),
        ratingsService.getUserPointsHistory(userId),
      ]);
      set({ familyRating: rating, familyTotalPoints: total, userHistory: history });
    } catch (err) {
      console.error('Ошибка обновления рейтинга:', err);
    }
  },

  subscribeToFamilyPoints: async (familyId, userId) => {
    // Одна активная подписка: при повторном вызове сначала отписываемся
    get().unsubscribe?.();
    await get().loadRatings(familyId);
    await get().loadUserHistory(userId);

    const channel = supabase
      .channel(`points-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // add_points() всегда вставляет строку в points_log
          schema: 'public',
          table: 'points_log',
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          // Оптимистично добавляем запись в историю своего пользователя…
          const row = payload.new as Record<string, unknown>;
          const log = toPointsLog(row);
          if (log.user_id === userId) {
            set((state) => ({ userHistory: [log, ...state.userHistory].slice(0, 50) }));
          }
          // …и полностью перезагружаем рейтинг/счёт (источник истины — БД)
          void ratingsService
            .getFamilyRating(familyId)
            .then((rating) =>
              set({
                familyRating: rating,
                familyTotalPoints: rating.reduce((sum, m) => sum + m.points, 0),
              }),
            )
            .catch(console.error);
        },
      )
      .subscribe();

    set({
      unsubscribe: () => {
        void supabase.removeChannel(channel);
      },
    });
  },

  unsubscribeFromPoints: () => {
    get().unsubscribe?.();
    set({ unsubscribe: null });
  },
}));
