// src/store/authStore.ts — глобальный store авторизации (Zustand + Supabase Auth).
// Состояние: user (Profile | null), isLoading, error.
// Компоненты не обращаются к Supabase напрямую — только через store и хуки.

import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { Profile } from '../types';

interface AuthState {
  /** Профиль из таблицы public.profiles (null — не авторизован / профиль не найден) */
  user: Profile | null;
  isLoading: boolean;
  error: string | null;

  // --- Actions ---
  setUser: (user: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  /**
   * Инициализация: getSession() + загрузка профиля + подписка на onAuthStateChange.
   * Возвращает функцию отписки (вызывается в cleanup эффекта).
   */
  initialize: () => Promise<() => void>;

  /** Загрузить профиль по id (используется при auth-событиях) */
  fetchProfile: (userId: string) => Promise<void>;
}

/** Приведение строки БД к доменному Profile (points может отсутствовать → 0) */
function toProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    full_name: String(row.full_name ?? ''),
    avatar_url: (row.avatar_url as string | null) ?? null,
    family_id: (row.family_id as string | null) ?? null,
    points: Number(row.points ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // maybeSingle — не кидает ошибку, если профиля ещё нет
      if (error) throw error;
      set({ user: data ? toProfile(data) : null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      // 1. Первичное восстановление сессии из хранилища
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session?.user) {
        await get().fetchProfile(data.session.user.id);
      } else {
        set({ user: null });
      }
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) });
    }

    // 2. Подписка на изменения состояния авторизации (login/logout/refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await get().fetchProfile(session.user.id);
      } else {
        set({ user: null }); // logout — чистим профиль
      }
      set({ isLoading: false });
    });

    // Возвращаем отписку для вызова в useEffect cleanup
    return () => sub.subscription.unsubscribe();
  },
}));
