// src/pages/LoginPage.tsx — экран входа: Google OAuth или magic link по email.

import { useEffect, useState } from 'react';
import { Loader2, Mail, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { signIn, signInWithEmail, error: authError } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Ошибки инициализации сессии (getSession/onAuthStateChange из authStore)
  // показываем прямо на экране логина понятным сообщением
  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const handleSignIn = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await signIn();
      if (!result.ok && result.error !== 'google_not_configured') {
        setError('Не удалось начать вход через Google. Попробуйте email ниже.');
      }
      // При успехе браузер редиректит на accounts.google.com; после возврата
      // сессию подхватит onAuthStateChange и ProtectedRoute пустит на "/"
    } finally {
      setPending(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await signInWithEmail(email.trim());
      if (result.ok) {
        setEmailSent(true);
      } else {
        setError(result.error ?? 'Не удалось отправить письмо');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-emerald-50 to-gray-50 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
          <Users size={36} aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-bold text-gray-900">Family Hub</h1>
        <p className="max-w-xs text-gray-600">
          Семейный календарь, задачи, заметки и сейф документов — в одном приложении
        </p>
      </div>

      {/* Ошибка входа (например, провайдер Google не настроен в Supabase) */}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={pending}
        className="flex w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 font-semibold text-gray-800 shadow-md ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            Перенаправляем в Google…
          </>
        ) : (
          <>
            {/* Иконка G (логотип Google рисуем текстом, чтобы не тянуть внешние ассеты) */}
            <span className="font-serif text-lg font-bold text-[#4285F4]" aria-hidden="true">G</span>
            Войти через Google
          </>
        )}
      </button>

      {/* Вход по email (magic link) — работает при включённом провайдере Email в Supabase */}
      {emailSent ? (
        <p className="max-w-xs rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
          Письмо со ссылкой для входа отправлено на {email}. Проверьте почту.
        </p>
      ) : (
        <form
          onSubmit={(e) => void handleEmailSignIn(e)}
          className="flex w-full max-w-xs flex-col gap-2"
        >
          <label htmlFor="login-email" className="text-left text-sm text-gray-600">
            или войдите по email
          </label>
          <div className="flex gap-2">
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="submit"
              disabled={pending || !email.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Mail size={16} aria-hidden="true" />
              Войти
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
