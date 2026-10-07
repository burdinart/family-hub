// src/hooks/useAuth.ts — фасад аутентификации для UI-компонентов.
// Возвращает user/isLoading из authStore + экшены signIn/signOut.
// Компоненты не знают про Supabase — только про этот хук.

import { useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import type { Profile } from '../types';

interface UseAuthResult {
  user: Profile | null;
  isLoading: boolean;
  error: string | null;
  /** OAuth-вход через Google (редирект на авторизацию Supabase) */
  signIn: () => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);

  const signIn = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      // OAuth Google: Supabase сам редиректит на accounts.google.com
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`, // после входа вернёмся в приложение
        },
      });
      if (oauthError) throw oauthError;
      return { ok: true };
    } catch (err) {
      // При ошибке показываем её в UI и возвращаем сообщение вызывающему коду
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return { ok: false, error: message };
    }
  }, [setError]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const { error: outError } = await supabase.auth.signOut();
      if (outError) throw outError;
      // Сброс состояния произойдёт автоматически через onAuthStateChange
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [setError]);

  return { user, isLoading, error, signIn, signOut };
}
