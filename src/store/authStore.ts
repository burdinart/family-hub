// Глобальный store авторизации.
// Хранит Firebase User, профиль (UserProfile) и статус подписки на auth-состояние.

import { create } from 'zustand';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/auth';
import { getAuthInstance } from '../config/firebase';
import type { UserProfile } from '../types';

interface AuthState {
  /** Текущий Firebase пользователь (null — не залогинен) */
  user: User | null;
  /** Профиль пользователя из Firestore */
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;

  // --- Actions ---
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  /** Подписка на изменения состояния авторизации (real-time first). */
  initAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  logout: async () => {
    try {
      await fbSignOut(getAuthInstance());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-out failed';
      console.error('Auth logout error:', err);
      set({ error: message });
    }
  },

  initAuthListener: () => {
    const unsubscribe: Unsubscribe = onAuthStateChanged(
      getAuthInstance(),
      (user) => {
        // Профиль подтягивает familyStore через подписку на users/{uid}
        set({ user, loading: false, error: null });
        if (!user) {
          set({ profile: null });
        }
      },
      (err) => {
        console.error('Auth listener error:', err);
        set({ loading: false, error: err.message });
      },
    );
    // Возвращаем функцию отписки для использования в useEffect
    return unsubscribe;
  },
}));
