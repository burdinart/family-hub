// Глобальный store авторизации (Supabase Auth).
// Хранит Session/профиль, слушает auth.stateChange, содержит базовые экшены.
// Компоненты НЕ обращаются к Supabase напрямую — только через store/сервисы.

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import type { UserProfile } from '../types';

interface AuthState {
  /** Текущий Supabase пользователь (null — не залогинен) */
  user: User | null;
  session: Session | null;
  /** Профиль из таблицы public.profiles */
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;

  // --- Actions ---
  setProfile: (profile: UserProfile | null) => void;
  setError: (error: string | null) => void;

  signUp: (email: string, password: string, fullName: string) => Promise<{ ok: boolean; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean }>;
  signOut: () => Promise<void>;

  /** Подписка на изменения состояния авторизации. Возвращает отписку. */
  initAuthListener: () => () => void;
}

/** Извлечение понятной ошибки из ответа Supabase */
function fail(err: unknown): { message: string } {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Auth error:', err);
  return { message };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  error: null,

  setProfile: (profile) => set({ profile }),
  setError: (error) => set({ error }),

  signUp: async (email, password, fullName) => {
    try {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      // Если в проекте включено подтверждение email — сессии сразу нет
      return { ok: true, needsConfirmation: !data.session };
    } catch (err) {
      const { message } = fail(err);
      set({ error: message });
      return { ok: false, needsConfirmation: false };
    }
  },

  signIn: async (email, password) => {
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      set({ error: null });
      return { ok: true };
    } catch (err) {
      const { message } = fail(err);
      set({ error: message });
      return { ok: false };
    }
  },

  signOut: async () => {
    try {
      await getSupabaseClient().auth.signOut();
    } catch (err) {
      const { message } = fail(err);
      set({ error: message });
    }
  },

  initAuthListener: () => {
    const supabase = getSupabaseClient();

    // Первичное восстановление сессии из хранилища
    supabase.auth
      .getSession()
      .then(({ data }) => {
        set({
          session: data.session,
          user: data.session?.user ?? null,
          loading: false,
        });
      })
      .catch((err) => {
        const { message } = fail(err);
        set({ loading: false, error: message });
      });

    // Реакция на login/logout/refresh token
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        ...(session ? {} : { profile: null }),
      });
    });

    return () => sub.subscription.unsubscribe();
  },
}));
