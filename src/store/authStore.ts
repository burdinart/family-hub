// src/store/authStore.ts — глобальный store авторизации (Zustand + Supabase Auth).
// Состояние: user (Profile | null), isLoading, error.
// Компоненты не обращаются к Supabase напрямую — только через store и хуки.

import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { Profile } from '../types';

interface AuthState {
  /** Профиль из таблицы public.profiles (null — не авторизован / профиль не найден) */
  user: Profile | null;
  /** Текущая auth-сессия Supabase (null — гость). Независима от наличия профиля. */
  session: Session | null;
  isLoading: boolean;
  error: string | null;

  // --- Actions ---
  setUser: (user: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  /**
   * Инициализация: getSession() + загрузка профиля + подписка на onAuthStateChange.
   * Возвращает функцию отписки (вызывается в cleanup эффекта).
   */
  initialize: () => Promise<() => void>;

  /** Загрузить профиль по id (используется при auth-событиях) */
  fetchProfile: (userId: string) => Promise<void>;

  /**
   * Перечитать текущий профиль из БД. Нужен после онбординга (создания семьи),
   * чтобы обновить family_id без полного reload страницы.
   */
  refreshProfile: () => Promise<void>;
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
  session: null,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  fetchProfile: async (userId) => {
    try {
      const load = async () =>
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(); // maybeSingle — не кидает ошибку, если профиля ещё нет

      let { data, error } = await load();
      if (error) throw error;

      // Самовосстановление: триггер handle_new_user мог не сработать (схема применена
      // уже после регистрации пользователя). Создаём профиль вручную — RLS-политика
      // "profiles_insert" разрешает вставку строки со своим id.
      if (!data) {
        const authUser = supabase.auth.getUser().then((r) => r.data.user);
        const u = await authUser;
        const fullName =
          (u?.user_metadata?.full_name as string | undefined) ??
          (u?.user_metadata?.name as string | undefined) ??
          (u?.email ? u.email.split('@')[0] : '');
        const insert = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: u?.email ?? '',
            full_name: fullName,
            avatar_url: (u?.user_metadata?.avatar_url as string | undefined) ?? null,
          })
          .select('*')
          .maybeSingle();
        if (insert.error) {
          // P23505/23505 unique_violation — гонка: строку создал триггер параллельно
          if (insert.error.code === '23505' || /duplicate key/i.test(insert.error.message)) {
            ({ data, error } = await load());
            if (error) throw error;
          } else {
            throw insert.error;
          }
        } else {
          data = insert.data;
        }
      }

      set({ user: data ? toProfile(data) : null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  refreshProfile: async () => {
    // id берём из актуальной сессии Supabase (профиль == auth.users.id)
    const userId = get().user?.id ?? get().session?.user?.id;
    if (!userId) return;
    await get().fetchProfile(userId);
  },

  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      // 1. Первичное восстановление сессии из хранилища
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      set({ session: data.session });

      if (data.session?.user) {
        await get().fetchProfile(data.session.user.id);
      } else {
        set({ user: null });
      }
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) });
    }

    // 2. Подписка на изменения состояния авторизации (login/logout/refresh).
    // При возврате с Google это событие SIGNED_IN — обновляем сессию и профиль,
    // ProtectedRoute в App.tsx сам перенаправит пользователя на "/".
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
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
