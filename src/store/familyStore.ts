// Глобальный store семьи (Supabase).
// Real-time подписка через channel postgres_changes на таблицы
// families + family_members; данные загружаются через familyService.
// Компоненты НЕ обращаются к Supabase напрямую — только через этот store/сервисы.

import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import { fetchFamily } from '../features/family/services/familyService';
import { TABLES } from '../types/database';
import type { Family, FamilyMember, LoadStatus } from '../types';

interface FamilyState {
  /** Активная семья пользователя */
  family: Family | null;
  /** Статус загрузки/подписки */
  status: LoadStatus;
  error: string | null;

  // --- Selectors-хелперы ---
  getMemberById: (userId: string) => FamilyMember | undefined;

  // --- Actions ---
  setError: (error: string | null) => void;
  clearFamily: () => void;
  /** Загрузить семью один раз (без realtime) */
  loadFamily: (familyId: string) => Promise<void>;
  /**
   * Подписка на real-time изменения семьи по id.
   * Возвращает функцию отписки (вызывать в cleanup useEffect).
   */
  subscribeToFamily: (familyId: string) => () => void;
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family: null,
  status: 'idle',
  error: null,

  getMemberById: (userId) => {
    const family = get().family;
    return family?.members.find((m) => m.userId === userId);
  },

  setError: (error) => set({ error }),
  clearFamily: () => set({ family: null, status: 'idle', error: null }),

  loadFamily: async (familyId) => {
    set({ status: 'loading' });
    try {
      const family = await fetchFamily(familyId);
      set({ family, status: 'ready', error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load family';
      console.error('Family load error:', err);
      set({ family: null, status: 'error', error: message });
    }
  },

  subscribeToFamily: (familyId) => {
    if (!familyId) {
      set({ family: null, status: 'ready' });
      return () => undefined;
    }

    void get().loadFamily(familyId);

    const supabase = getSupabaseClient();

    // Real-time First: любые изменения у других участников мгновенно видны здесь.
    // При любом событии в таблицах семьи перезагружаем агрегированную модель
    // (проще и надёжнее, чем инкрементально мержить rows).
    const channel: RealtimeChannel = supabase
      .channel(`family:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.families, filter: `id=eq.${familyId}` },
        () => void get().loadFamily(familyId),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.familyMembers, filter: `family_id=eq.${familyId}` },
        () => void get().loadFamily(familyId),
      )
      .subscribe((state, err) => {
        if (state === 'CHANNEL_ERROR') {
          console.error('Family realtime channel error:', err);
          set({ status: 'error', error: err?.message ?? 'Realtime connection failed' });
        }
      });

    // Функция отписки для useEffect cleanup
    return () => {
      void supabase.removeChannel(channel);
    };
  },
}));
