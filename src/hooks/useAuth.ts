// src/hooks/useAuth.ts — фасад аутентификации для UI-компонентов.
// Возвращает user/isLoading из authStore + экшены signIn/signInWithEmail/signOut.
// Компоненты не знают про Supabase — только про этот хук.

import { useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import type { Profile } from '../types';

interface UseAuthResult {
  /** Профиль пользователя из таблицы profiles (null — профиль не загружен/не найден) */
  user: Profile | null;
  /** Алиас для user — то же самое, удобнее читать в компонентах онбординга */
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Онбординг: профиль загружен, но семья ещё не подключена (family_id = null).
   * UI показывает модалку выбора: «Создать семью» или «Присоединиться по коду»
   * (CreateFamilyModal).
   */
  needsFamily: boolean;
  /** Перечитать текущий профиль из БД (после создания семьи / присоединения по коду) */
  refreshProfile: () => Promise<void>;
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
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  // Онбординг: нужен только когда профиль точно загружен и семьи нет.
  // Пока user === null (загрузка / профиль не найден) — false, чтобы
  // не мигать модалкой до готовности данных.
  const needsFamily = user ? !user.family_id : false;

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
      // ТЗ требует redirectTo = origin + '/' — но на GitHub Pages origin это домен
      // github.io БЕЗ папки приложения, поэтому добавляем BASE_URL (папку деплоя).
      const base = import.meta.env.BASE_URL ?? '/';
      const redirectTo = `${window.location.origin}${base === '/' ? '' : base.replace(/\/+$/, '')}/`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      // Если Supabase вернул URL авторизации, но браузер сам не редиректил
      // (такое бывает в некоторых webview/строгой политике CSP) — редиректим вручную.
      if (!oauthError && data.url) window.location.assign(data.url);
      if (oauthError) {
        // 400 validation_failed "Unsupported provider / provider is not enabled" —
        // значит провайдер Google выключен в Supabase Studio → даём понятную инструкцию.
        if (/provider|not enabled|unsupported/i.test(oauthError.message)) {
          setError(
            'Вход через Google отключён на стороне Supabase. Включите его: Supabase Studio → Authentication → Sign In / Up → Providers → Google → Enable, и добавьте Redirect URL приложения. Либо войдите по email ниже.',
          );
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

  return { user, profile: user, isLoading, error, needsFamily, refreshProfile, signIn, signInWithEmail, signOut };
}
