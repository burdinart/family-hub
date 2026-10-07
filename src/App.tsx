// Корневой компонент: инициализирует real-time связку auth -> profile -> family.
// UI-компоненты не содержат бизнес-логики (см. .ai-rules).

import { Users } from 'lucide-react';
import { isFirebaseConfigured } from './config/firebase';
import { useFamilySync } from './hooks/useFamilySync';
import { useAuthStore } from './store/authStore';
import { useFamilyStore } from './store/familyStore';

/** Карточка статуса подключения к Firebase (до появления роутинга) */
export default function App() {
  const isConfigured = isFirebaseConfigured();

  // Подписки на auth/profile/family (создают Firestore onSnapshot listeners)
  useFamilySync();

  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const authError = useAuthStore((s) => s.error);
  const family = useFamilyStore((s) => s.family);
  const familyStatus = useFamilyStore((s) => s.status);

  if (!isConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-700">
          Firebase is not configured. Copy <code>.env.example</code> to{' '}
          <code>.env.local</code> and fill in the keys.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-blue-600">
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
        <p className="text-gray-800">Signed in as {user.displayName || user.email}</p>
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
