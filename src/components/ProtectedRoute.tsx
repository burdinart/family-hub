// src/components/ProtectedRoute.tsx — защита приватных маршрутов.
// Неавторизованных перенаправляет на /login, во время загрузки показывает spinner.

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Сессия ещё восстанавливается из хранилища — не редиректим раньше времени
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50" role="status" aria-label="Загрузка">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  // Пускаем и по сессии, даже если профиль ещё не создан триггером БД
  // (иначе вход через Google «зависал» на /login при пустой таблице profiles)
  if (!user && !session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
