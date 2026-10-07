// src/pages/LoginPage.tsx — экран входа через Google OAuth.

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await signIn();
      if (!result.ok) setError(result.error ?? 'Не удалось войти');
      // При успехе страница перезагрузится редиректом Supabase
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
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
        ) : (
          <>
            {/* Иконка G (логотип Google рисуем текстом, чтобы не тянуть ассеты) */}
            <span className="font-bold text-[#4285F4]" aria-hidden="true">G</span>
            Войти через Google
          </>
        )}
      </button>
    </main>
  );
}
