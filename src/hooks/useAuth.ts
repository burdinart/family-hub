// src/hooks/useAuth.ts — фасад аутентификации для UI-компонентов.
// Возвращает user/isLoading из authStore + экшены signIn/signInWithEmail/signOut.
// Компоненты не знают про Supabase — только про этот хук.

import { useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import type { Profile } from '../types';

interface UseAuthResult {
  user: Profile | null;
  isLoading: boolean;
  error: string | null;
  /** OAuth-вход через Google (если провайдер включён в Supabase), иначе — email-ссылка */
  signIn: () => Promise<{ ok: boolean; error?: string }>;
  /** Вход по email: magic link (без пароля) */
  signInWithEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);

  const signInWithEmail = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        // Magic link: Supabase отправит письмо со ссылкой для входа.
        // Redirect URL строим так же, как для OAuth (с учётом папки деплоя на GitHub Pages)
        const base = import.meta.env.BASE_URL ?? '/';
        const emailRedirectTo = `${window.location.origin}${base === '/' ? '' : base.replace(/\/+$/, '')}/`;
        const { error: mailError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo },
        });
        if (mailError) throw mailError;
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return { ok: false, error: message };
      }
    },
    [setError],
  );

  const signIn = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      // OAuth Google: Supabase сам редиректит на accounts.google.com.
      // ВАЖНО для GitHub Pages: window.location.origin это домен github.io без папки
      // приложения, поэтому к origin добавляем BASE_URL (папку деплоя из vite.config).
      // После возврата от Google сессия подхватится onAuthStateChange и ProtectedRoute
      // пустит нас на "/" автоматически.
      const base = import.meta.env.BASE_URL ?? '/';
      const redirectTo = `${window.location.origin}${base === '/' ? '' : base.replace(/\/+$/, '')}/`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) {
        if (/provider|not enabled|unsupported/i.test(oauthError.message)) {
          setError('Вход через Google не настроен в Supabase. Используйте вход по email.');
          return { ok: false, error: 'google_not_configured' };
        }
        throw oauthError;
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return { ok: false, error: message };
    }
  }, [setError]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [setError]);

  return { user, isLoading, error, signIn, signInWithEmail, signOut };
}
