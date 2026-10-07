// src/features/calendar/components/EventFormModal.tsx — модалка создания/редактирования события.
// На мобильных занимает весь экран (bottom-sheet), на десктопе — карточка по центру.
// Все обращения к БД — через store (addEvent/updateEvent), компонент про Supabase не знает.

import { useState } from 'react';
import { X, Loader2, Bell } from 'lucide-react';
import type { Event, EventCategory } from '@/types';
import { useEventsStore } from '../store/eventsStore';
import { useAuth } from '@/hooks/useAuth';

/** Цветовые стили категорий (единый справочник для формы и карточки) */
export const CATEGORY_STYLES: Record<EventCategory, { label: string; badge: string; dot: string }> = {
  event:   { label: 'Событие',  badge: 'bg-blue-100 text-blue-700 border-blue-300',     dot: 'bg-blue-500' },
  birthday:{ label: 'День рождения', badge: 'bg-pink-100 text-pink-700 border-pink-300', dot: 'bg-pink-500' },
  school:  { label: 'Школа',    badge: 'bg-indigo-100 text-indigo-700 border-indigo-300',dot: 'bg-indigo-500' },
  sports:  { label: 'Спорт',    badge: 'bg-orange-100 text-orange-700 border-orange-300',dot: 'bg-orange-500' },
  medical: { label: 'Здоровье', badge: 'bg-red-100 text-red-700 border-red-300',         dot: 'bg-red-500' },
  family:  { label: 'Семья',    badge: 'bg-green-100 text-green-700 border-green-300',   dot: 'bg-green-500' },
  other:   { label: 'Прочее',   badge: 'bg-gray-100 text-gray-700 border-gray-300',      dot: 'bg-gray-500' },
};

const CATEGORY_ORDER: readonly EventCategory[] = [
  'family',
  'event',
  'birthday',
  'school',
  'sports',
  'medical',
  'other',
];

/** Варианты напоминаний: значение — минуты до начала события (jsonb number[]) */
const REMINDER_OPTIONS: readonly { label: string; minutes: number | null }[] = [
  { label: 'Нет',        minutes: null },
  { label: 'За час',     minutes: 60 },
  { label: 'За день',    minutes: 1440 },
  { label: 'За 3 дня',   minutes: 4320 },
];

interface EventFormModalProps {
  familyId: string;
  /** Дата, выбранная в календаре — подставляется по умолчанию */
  defaultDate: Date;
  /** Если передано — режим редактирования, иначе — создание */
  event?: Event | null;
  onClose: () => void;
}

/** Формат Date → YYYY-MM-DD для input[type=date] без учёта таймзоны */
function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function EventFormModal({ familyId, defaultDate, event, onClose }: EventFormModalProps) {
  const { user } = useAuth();
  const addEvent = useEventsStore((s) => s.addEvent);
  const updateEvent = useEventsStore((s) => s.updateEvent);

  const isEdit = Boolean(event);

  // Состояние формы — только нужные поля, типизированы строго
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? toInputDate(defaultDate));
  const [time, setTime] = useState(event?.time ?? '');
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'family');
  // Напоминание храним одним числом (мин.) или null — при сохранении обернём в массив
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    event?.reminders.length ? event.reminders[0] : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Укажите название события');
      return;
    }
    if (!user?.id) {
      setFormError('Профиль не загружен — подождите и попробуйте снова');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: title.trim(),
        date,
        time: time || null, // пустое время = событие на весь день
        category,
        attendees: event?.attendees ?? [user.id], // участники: при создании — автор
        reminders: reminderMinutes === null ? [] : [reminderMinutes],
      };

      if (isEdit && event) {
        await updateEvent(event.id, payload);
      } else {
        await addEvent({ ...payload, family_id: familyId, created_by: user.id });
      }
      onClose();
    } catch (err) {
      console.error('Ошибка сохранения события:', err);
      setFormError(isEdit ? 'Не удалось сохранить изменения' : 'Не удалось создать событие');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      {/* Мобильный: на всю ширину снизу; десктоп: карточка по центру */}
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Редактировать событие' : 'Новое событие'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 min-w-11 min-h-11 flex items-center justify-center"
          >
            <X size={22} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {/* Название */}
          <div>
            <label htmlFor="event-title" className="block text-sm font-medium mb-1 text-gray-700">
              Название *
            </label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Футбол Миши"
              className="w-full px-4 py-3 min-h-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              autoFocus
              required
            />
          </div>

          {/* Дата + время */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="event-date" className="block text-sm font-medium mb-1 text-gray-700">
                Дата *
              </label>
              <input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-3 min-h-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="event-time" className="block text-sm font-medium mb-1 text-gray-700">
                Время
              </label>
              <input
                id="event-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-3 min-h-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Пусто = весь день</p>
            </div>
          </div>

          {/* Категория — крупные чипы, удобные для пальца */}
          <div>
            <span className="block text-sm font-medium mb-2 text-gray-700">Категория</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ORDER.map((c) => {
                const style = CATEGORY_STYLES[c];
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-3 py-2 min-h-11 rounded-xl border text-sm font-medium transition-colors ${
                      active ? `${style.badge} ring-2 ring-offset-1 ring-gray-300` : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${style.dot}`} />
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Напоминание */}
          <div>
            <span className="block text-sm font-medium mb-2 text-gray-700">
              <Bell size={14} className="inline mr-1 -mt-0.5" />
              Напоминание
            </span>
            <div className="grid grid-cols-4 gap-2">
              {REMINDER_OPTIONS.map((opt) => {
                const active = reminderMinutes === opt.minutes;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setReminderMinutes(opt.minutes)}
                    className={`py-2.5 min-h-11 rounded-xl border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ошибка формы */}
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          {/* Кнопки */}
          <div className="flex gap-3 pt-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 min-h-11 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="flex-1 py-3 min-h-11 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 size={18} className="animate-spin" />}
              {isSaving ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
