// src/features/calendar/components/EventCard.tsx — карточка события в списке дня.
// Отображает название, время, категорию (цветной бейдж), отметку напоминания;
// кнопки редактирования и удаления. Мутации — через eventsStore (realtime-синхронизация).

import { Pencil, Trash2, Bell } from 'lucide-react';
import type { Event } from '@/types';
import { useEventsStore } from '../store/eventsStore';
import { CATEGORY_STYLES } from './EventFormModal';

interface EventCardProps {
  event: Event;
  /** Открыть форму редактирования этого события */
  onEdit: (event: Event) => void;
}

export function EventCard({ event, onEdit }: EventCardProps) {
  const deleteEvent = useEventsStore((s) => s.deleteEvent);

  const style = CATEGORY_STYLES[event.category];
  const hasReminder = event.reminders.length > 0;

  const handleDelete = () => {
    // Подтверждение — удаление необратимо
    if (!window.confirm(`Удалить событие «${event.title}»?`)) return;
    void deleteEvent(event.id).catch(() => {
      /* ошибка уже показана через store.error */
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
      {/* Цветная полоска категории слева */}
      <div className={`w-1.5 self-stretch rounded-full ${style.dot}`} aria-hidden />

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Время или «весь день» */}
          <span className="text-sm text-gray-600 tabular-nums">
            {event.time ?? 'Весь день'}
          </span>

          {/* Бейдж категории */}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style.badge}`}>
            {style.label}
          </span>

          {/* Иконка напоминания, если включено */}
          {hasReminder && (
            <span className="text-xs text-gray-500 flex items-center gap-1" title="Напоминание включено">
              <Bell size={12} />
              {formatReminderLabel(event.reminders[0])}
            </span>
          )}
        </div>
      </div>

      {/* Действия: крупные тач-зоны (min 44px) */}
      <div className="flex flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(event)}
          aria-label="Редактировать"
          className="p-2.5 min-w-11 min-h-11 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
        >
          <Pencil size={18} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Удалить"
          className="p-2.5 min-w-11 min-h-11 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

/** Человекочитаемое описание напоминания по минутам до начала */
function formatReminderLabel(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `за ${days} дн.`;
  }
  if (minutes >= 60) return `за ${Math.round(minutes / 60)} ч.`;
  return `за ${minutes} мин.`;
}
