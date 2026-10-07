// src/features/calendar/components/CalendarGrid.tsx — сетка месяца (7 колонок).
// Навигация «назад/вперёд/сегодня», точки-индикаторы событий на днях,
// подсветка сегодняшнего и выбранного дня. Клик по дате выбирает день
// (список событий показывает страница CalendarPage).
// Все даты считаем через date-fns; неделя начинается с понедельника (locale ru).

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameDay,
  isToday,
  isSameMonth,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Event } from '@/types';
import { CATEGORY_STYLES } from './EventFormModal';

interface CalendarGridProps {
  /** Текущая отображаемая дата (её месяц показываем) */
  viewDate: Date;
  selectedDate: Date;
  events: Event[];
  onChangeMonth: (date: Date) => void;
  onSelectDate: (date: Date) => void;
}

/** ISO YYYY-MM-DD в локальной таймзоне (не UTC!) — ключ для Map событий по дням */
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export function CalendarGrid({ viewDate, selectedDate, events, onChangeMonth, onSelectDate }: CalendarGridProps) {
  // Карта «дата → события» строим один раз на изменение events (O(n))
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of events) {
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    return map;
  }, [events]);

  // Диапазон дней сетки: от начала недели первого дня месяца до конца недели последнего
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewDate]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4">
      {/* Шапка: навигация по месяцам */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onChangeMonth(subMonths(viewDate, 1))}
          aria-label="Предыдущий месяц"
          className="p-2.5 min-w-11 min-h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-600"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="text-center">
          <span className="font-semibold text-gray-900 capitalize">
            {format(viewDate, 'MMMM yyyy', { locale: ru })}
          </span>
          {/* Кнопка «Сегодня» — возврат к текущему месяцу и дню */}
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onChangeMonth(now);
              onSelectDate(now);
            }}
            className="block mx-auto mt-0.5 text-xs text-emerald-600 font-medium hover:underline"
          >
            Сегодня
          </button>
        </div>

        <button
          type="button"
          onClick={() => onChangeMonth(addMonths(viewDate, 1))}
          aria-label="Следующий месяц"
          className="p-2.5 min-w-11 min-h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-600"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Дни недели */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS_SHORT.map((wd) => (
          <div key={wd} className="text-center text-xs font-medium text-gray-400 py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Сетка дней 7xN */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(toLocalISO(day)) ?? [];
          const inMonth = isSameMonth(day, viewDate);
          const today = isToday(day);
          const selected = isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              aria-label={`${format(day, 'd MMMM yyyy', { locale: ru })}${dayEvents.length ? `, событий: ${dayEvents.length}` : ''}`}
              className={[
                'relative mx-auto flex flex-col items-center justify-start w-full max-w-14 min-h-14 py-1.5 rounded-xl transition-colors',
                // Выбранный день — заливка; сегодня — кольцо; дни соседних месяцев — тусклые
                selected
                  ? 'bg-emerald-600 text-white'
                  : today
                    ? 'ring-2 ring-emerald-500 text-emerald-700 font-semibold hover:bg-emerald-50'
                    : inMonth
                      ? 'text-gray-800 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              <span className={`text-sm leading-none ${selected ? 'font-semibold' : ''}`}>
                {format(day, 'd')}
              </span>

              {/* Индикаторы событий: цветные точки по категориям (до 3) */}
              {dayEvents.length > 0 && (
                <span className="flex gap-0.5 mt-1.5" aria-hidden>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className={`w-1.5 h-1.5 rounded-full ${
                        selected ? 'bg-white' : CATEGORY_STYLES[ev.category].dot
                      }`}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className={`text-[9px] leading-none ${selected ? 'text-white' : 'text-gray-400'}`}>
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
