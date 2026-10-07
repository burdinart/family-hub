// src/components/ProtectedRoute.tsx — защита приватных маршрутов.
// Неавторизованных перенаправляет на /login, во время загрузки показывает spinner.

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Сессия ещё восстанавливается из хранилища — не редиректим раньше времени
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50" role="status" aria-label="Загрузка">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
