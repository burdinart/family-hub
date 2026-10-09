// src/components/Layout.tsx — каркас приложения: контент + нижняя навигация (mobile-first).
// Навигация: Главная, Календарь, Задачи, Расписание, Чат, Сейф, Настройки (иконки lucide-react).

import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Home, Lock, ListChecks, CalendarClock, MessageCircle, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/tasks', label: 'Задачи', icon: ListChecks },
  { to: '/schedule', label: 'Распис.', icon: CalendarClock },
  { to: '/chat', label: 'Чат', icon: MessageCircle },
  { to: '/vault', label: 'Сейф', icon: Lock },
  { to: '/settings', label: 'Настр.', icon: Settings },
];

export function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      {/* Шапка: логотип и выход из аккаунта */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-emerald-600">Family Hub</h1>
        {user && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Выйти
          </button>
        )}
      </header>

      {/* Основной контент страниц */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      {/* Нижняя навигация (Bottom Navigation) */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-lg justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-2 py-2 text-[11px] sm:text-xs transition-colors ${
                    isActive ? 'font-semibold text-emerald-600' : 'text-gray-500 hover:text-gray-800'
                  }`
                }
              >
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
