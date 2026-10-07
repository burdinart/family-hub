// src/App.tsx — корень приложения: роутинг (React Router v6) + инициализация авторизации.
// UI-компоненты не содержат бизнес-логики (см. правила кода).

import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './config/supabase';

import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { CalendarPage } from './pages/CalendarPage';
import { TasksPage } from './pages/TasksPage';
import { MarksPage } from './pages/MarksPage';
import { VaultPage } from './pages/VaultPage';

export default function App() {
  const [initError, setInitError] = useState<string | null>(null);

  // Глобальная инициализация Supabase Auth один раз на старте приложения
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    useAuthStore
      .getState()
      .initialize()
      .then((unsub) => {
        if (cancelled) unsub(); // StrictMode двойной mount — отписываемся сразу
        else unsubscribe = unsub;
      })
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // Дружелюбная ошибка вместо белого экрана при отсутствии env-ключей
  if (!isSupabaseConfigured() || initError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
        <p className="max-w-md text-center text-gray-700">
          {initError ?? (
            <>
              Supabase не настроен. Скопируйте <code>.env.example</code> в{' '}
              <code>.env.local</code> и заполните ключи.
            </>
          )}
        </p>
      </main>
    );
  }

  // basename = папка деплоя из Vite base; начальный путь читаем из hash-редиректа 404.html
  const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {/* Публичный маршрут: вход */}
        <Route path="/login" element={<LoginPage />} />

        {/* Приватные маршруты под защитой ProtectedRoute + общим Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/marks" element={<MarksPage />} />
            <Route path="/vault" element={<VaultPage />} />
          </Route>
        </Route>

        {/* Всё остальное — на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
