// src/pages/HomePage.tsx — главный экран: приветствие, баллы и живая сводка семьи.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ListChecks, Loader2, LogOut, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';

interface Summary {
  activeTasks: number;
  upcomingEvents: number;
}

export function HomePage() {
  const { user, signOut } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const today = format(new Date(), 'EEEE, d MMMM', { locale: ru });

  // Имя для приветствия: профиль из БД → иначе данные сессии Supabase (fallback)
  const authUser = useAuthStore((s) => s.session?.user ?? null);
  const displayName =
    user?.full_name || user?.email || authUser?.user_metadata?.full_name || authUser?.email || 'друг';

  // Реальная статистика: задачи в статусе todo/in_progress и события с датой >= сегодня.
  // count-запрос безопасен при отсутствии family_id (фильтр is.null вернёт 0).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const todayIso = format(new Date(), 'yyyy-MM-dd');
        const [tasksRes, eventsRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('family_id', user.family_id)
            .in('status', ['todo', 'in_progress']),
          supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('family_id', user.family_id)
            .gte('date', todayIso),
        ]);
        if (cancelled) return;
        setSummary({
          activeTasks: tasksRes.count ?? 0,
          upcomingEvents: eventsRes.count ?? 0,
        });
      } catch {
        // Ошибку счётчиков не считаем критичной: показываем нули
        if (!cancelled) setSummary({ activeTasks: 0, upcomingEvents: 0 });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="flex flex-col gap-6">
      {/* Приветствие */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">
          Привет, {displayName.split(' ')[0]}! 👋
        </h2>
        <p className="mt-1 text-sm capitalize text-gray-500">{today}</p>
        {user && (
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <Star size={16} className="text-amber-500" aria-hidden="true" />
            <span>
              <b>{user.points}</b> баллов
            </span>
          </p>
        )}
        {/* Если профиля в БД ещё нет — подсказка (например, триггер не применён) */}
        {!user && (
          <p className="mt-3 text-xs text-gray-400">
            Профиль не найден в базе — выполните supabase/schema.sql в SQL Editor.
          </p>
        )}
        {/* Выход из аккаунта: signOut очистит сессию, ProtectedRoute редиректит на /login */}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-red-600"
        >
          <LogOut size={16} aria-hidden="true" />
          Выйти
        </button>
      </section>

      {/* Карточка-статистика */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          to="/tasks"
          className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-emerald-200"
        >
          <ListChecks size={20} className="text-emerald-600" aria-hidden="true" />
          <span className="text-2xl font-bold text-gray-900">
            {summary ? summary.activeTasks : <Loader2 size={24} className="animate-spin text-gray-400" />}
          </span>
          <span className="text-xs text-gray-500">Активных задач</span>
        </Link>
        <Link
          to="/calendar"
          className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-emerald-200"
        >
          <CalendarDays size={20} className="text-emerald-600" aria-hidden="true" />
          <span className="text-2xl font-bold text-gray-900">
            {summary ? summary.upcomingEvents : <Loader2 size={24} className="animate-spin text-gray-400" />}
          </span>
          <span className="text-xs text-gray-500">Предстоящих событий</span>
        </Link>
      </section>
    </div>
  );
}
