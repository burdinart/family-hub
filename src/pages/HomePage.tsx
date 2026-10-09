// src/pages/HomePage.tsx — главный экран: приветствие, баллы, код приглашения семьи
// и живая сводка. При первом входе (family_id = null) автоматически открывается
// модалка онбординга: «Создать семью» или «Присоединиться по коду».

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Copy, ListChecks, Loader2, LogOut, Star, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { familyService } from '../services/familyService';
import { CreateFamilyModal } from '../components/CreateFamilyModal';

interface Summary {
  activeTasks: number;
  upcomingEvents: number;
}

export function HomePage() {
  const { user, needsFamily, refreshProfile, signOut } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  // Код приглашения семьи (подтягиваем сервисом: profile содержит только family_id)
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  // Флаг «скопировано» для инлайн-подтверждения вместо alert()
  const [codeCopied, setCodeCopied] = useState(false);
  // Управляемое открытие модалки онбординга:
  // - автоматически при первом входе (профиль загружен и family_id === null);
  // - по кнопке «Начать», если пользователь закрыл её ранее.
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Автопоказ модалки при онбординге
  useEffect(() => {
    if (needsFamily) setShowOnboarding(true);
  }, [needsFamily]);

  // Загрузка кода приглашения текущей семьи (участник видит SELECT по RLS)
  useEffect(() => {
    const familyId = user?.family_id;
    if (!familyId) {
      setInviteCode(null);
      return;
    }
    let cancelled = false;
    void familyService.getFamilyInviteCode(familyId).then((code) => {
      if (!cancelled) setInviteCode(code);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const today = format(new Date(), 'EEEE, d MMMM', { locale: ru });

  // Все хуки объявлены до ранних return'ов — правила React Hooks соблюдены.

  // Модалка показывается поверх главной (а не вместо неё): доступны приветствие
  // и «Выйти». После создания/входа refreshProfile() → needsFamily=false,
  // модалка закрывается, сводка и код перезагружаются.
  const showOnboardingModal = needsFamily && showOnboarding;

  // Имя для приветствия: профиль из БД → иначе данные сессии Supabase (fallback)
  const authUser = useAuthStore((s) => s.session?.user ?? null);
  const displayName =
    user?.full_name || user?.email || authUser?.user_metadata?.full_name || authUser?.email || 'друг';

  // Копирование кода в буфер обмена (graceful fallback без clipboard API)
  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      setCodeCopied(false);
    }
  };

  // Реальная статистика: активные задачи (todo/doing — см. TaskStatus) и события
  // с датой >= сегодня. Запросы идут только через таблицу + фильтры (RLS на стороне БД).
  useEffect(() => {
    if (!user?.family_id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const todayIso = format(new Date(), 'yyyy-MM-dd');
        const [tasksRes, eventsRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('family_id', user.family_id)
            .in('status', ['todo', 'doing']),
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
      {/* Модалка онбординга: открыта автоматически при family_id === null */}
      {showOnboardingModal && (
        <CreateFamilyModal
          onClose={() => setShowOnboarding(false)}
          onFamilyCreated={() => void refreshProfile()}
        />
      )}

      {/* Приветствие */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">
          Привет, {displayName.split(' ')[0]}! 👋
        </h2>
        <p className="mt-1 text-sm capitalize text-gray-500">{today}</p>

        {user && !user.family_id && (
          /* Семья ещё не создана — кнопка повторного открытия модалки онбординга */
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
          >
            <Users size={16} aria-hidden="true" />
            Создать или найти семью
          </button>
        )}

        {user && user.family_id && (
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

      {/* Карточка приглашения: код семьи для добавления новых членов.
          Mobile-first: блоки в столбик, кнопка во всю ширину касания. */}
      {user?.family_id && inviteCode && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Users size={16} className="text-emerald-600" aria-hidden="true" />
            Код приглашения в семью
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            Передайте этот код близким — они присоединятся к вашей семье при первом входе.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono text-2xl font-bold tracking-wider text-emerald-700 select-all">
              {inviteCode}
            </span>
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 sm:self-auto"
            >
              <Copy size={14} aria-hidden="true" />
              {codeCopied ? 'Скопировано ✓' : 'Скопировать'}
            </button>
          </div>
        </section>
      )}

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
