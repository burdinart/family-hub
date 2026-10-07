// src/pages/HomePage.tsx — главный экран: приветствие и краткая сводка.

import { CalendarDays, ListChecks, MapPin, Lock, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';

/** Плитки-ссылки на разделы (сводка «модуль в разработке» до реализации фич) */
const SUMMARY_TILES = [
  { label: 'Календарь', icon: CalendarDays },
  { label: 'Задачи', icon: ListChecks },
  { label: 'Метки', icon: MapPin },
  { label: 'Сейф', icon: Lock },
];

export function HomePage() {
  const { user } = useAuth();
  const today = format(new Date(), 'EEEE, d MMMM', { locale: ru });

  return (
    <div className="flex flex-col gap-6">
      {/* Приветствие */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">
          Привет, {user?.full_name || 'друг'}! 👋
        </h2>
        <p className="mt-1 text-sm capitalize text-gray-500">{today}</p>
        {user && (
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <Star size={16} className="text-amber-500" aria-hidden="true" />
            Баллы семьи: <b>{user.points}</b>
          </p>
        )}
      </section>

      {/* Краткая сводка по разделам */}
      <section className="grid grid-cols-2 gap-3">
        {SUMMARY_TILES.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
          >
            <Icon size={22} className="text-emerald-600" aria-hidden="true" />
            <span className="font-medium text-gray-800">{label}</span>
            <span className="text-xs text-gray-400">Данные появятся здесь</span>
          </div>
        ))}
      </section>
    </div>
  );
}
