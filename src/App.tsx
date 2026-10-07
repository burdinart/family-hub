// Корневой компонент: инициализирует real-time связку auth -> profile -> family.
// UI-компоненты не содержат бизнес-логики (см. .ai-rules).

import { Users } from 'lucide-react';
import { isSupabaseConfigured } from './config/supabase';
import { useFamilySync } from './hooks/useFamilySync';
import { useAuthStore } from './store/authStore';
import { useFamilyStore } from './store/familyStore';

/** Карточка статуса подключения к Supabase (до появления роутинга) */
export default function App() {
  const isConfigured = isSupabaseConfigured();

  // Подписки на auth/profile/family (создают Supabase realtime listeners)
  useFamilySync();

  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const authError = useAuthStore((s) => s.error);
  const signOut = useAuthStore((s) => s.signOut);
  const family = useFamilyStore((s) => s.family);
  const familyStatus = useFamilyStore((s) => s.status);

  if (!isConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-700">
          Supabase is not configured. Copy <code>.env.example</code> to{' '}
          <code>.env.local</code> and fill in the keys.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-emerald-600">
        <Users size={32} aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Family Hub</h1>
      </div>

      {/* Loading state per .ai-rules */}
      {loading && (
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" role="status" aria-label="Loading" />
      )}

      {!loading && !user && (
        <p className="text-gray-600">Not signed in. Auth screens come in the next prompts.</p>
      )}

      {!loading && user && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-gray-800">Signed in as {user.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800 hover:bg-gray-300"
          >
            Sign out
          </button>
        </div>
      )}

      {familyStatus === 'ready' && family && (
        <p className="text-gray-800">
          Family: {family.name} ({family.members.length} members)
        </p>
      )}

      {(authError || familyStatus === 'error') && (
        <p className="text-red-600">Something went wrong. Please try again later.</p>
      )}
    </main>
  );
}
