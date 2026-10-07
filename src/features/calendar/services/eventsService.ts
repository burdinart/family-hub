// src/features/calendar/services/eventsService.ts — сервис данных модуля «Календарь».
// Единственная точка обращения к таблице events (Supabase). Компоненты и store
// не пишут запросы напрямую. Realtime-подписка: при любом изменении строки
// события семьи перезагружаем полный список (источник истины — БД).

import { supabase } from '@/config/supabase';
import type { Event, EventCategory } from '@/types';

/** Payload для создания события (id/created_at генерирует БД) */
export type NewEvent = Omit<Event, 'id' | 'created_at'>;
/** Частичное обновление события (family_id/created_by не меняем) */
export type EventPatch = Partial<Omit<Event, 'id' | 'family_id' | 'created_by' | 'created_at'>>;

/** Строка таблицы events в том виде, в котором её отдаёт Supabase.
 *  jsonb-поля клиент уже распарсил в unknown (массивы), time/date — строки.
 *  Описываем явно, чтобы не использовать any. */
interface EventRow {
  id: string;
  family_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm:ss или null
  category: string;
  attendees: unknown; // jsonb: массив id участников
  reminders: unknown; // jsonb: массив минут до начала
  created_by: string;
  created_at: string;
}

/** Безопасное приведение jsonb-значения к string[] (attendees).
 *  Если в БД оказался мусор — возвращаем пустой массив, а не роняем приложение. */
function parseAttendees(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  // Фолбэк: значение могло сохраниться как JSON-строка — пробуем распарсить
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      /* невалидный JSON — считаем, что участников нет */
    }
  }
  return [];
}

/** Безопасное приведение jsonb-значения к number[] (reminders, минуты до начала) */
function parseReminders(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      }
    } catch {
      /* невалидный JSON — напоминаний нет */
    }
  }
  return [];
}

const EVENT_CATEGORIES: readonly EventCategory[] = [
  'event',
  'birthday',
  'school',
  'sports',
  'medical',
  'family',
  'other',
];

/** Валидация категории: неизвестное значение из БД → 'other' (не роняем UI) */
function toCategory(raw: string): EventCategory {
  return (EVENT_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as EventCategory)
    : 'other';
}

/** Приведение строки БД к доменной модели Event (jsonb → типизированные массивы) */
function toEvent(row: EventRow): Event {
  return {
    id: row.id,
    family_id: row.family_id,
    title: row.title,
    date: row.date,
    // time приходит как 'HH:mm:ss' — оставляем 'HH:mm' для отображения
    time: row.time ? row.time.slice(0, 5) : null,
    category: toCategory(row.category),
    attendees: parseAttendees(row.attendees),
    reminders: parseReminders(row.reminders),
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export const eventsService = {
  /** Подписка на изменения таблицы events данной семьи. Возвращает функцию отписки. */
  subscribeToEvents(familyId: string, callback: (events: Event[]) => void): () => void {
    const channel = supabase
      .channel(`events-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // insert / update / delete
          schema: 'public',
          table: 'events',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          // Перезагружаем данные при любом изменении
          this.getEventsByFamily(familyId)
            .then(callback)
            .catch(console.error);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  /** Все события семьи, ближайшие — первыми */
  async getEventsByFamily(familyId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('family_id', familyId)
      .order('date', { ascending: true })
      .order('time', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return ((data ?? []) as EventRow[]).map(toEvent);
  },

  /** События за конкретный месяц (оптимизация: не тянем всё). Месяц: 1-12. */
  async getEventsByMonth(familyId: string, year: number, month: number): Promise<Event[]> {
    // Границы месяца в ISO-формате YYYY-MM-DD
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate(); // 0-й день след. месяца = последний день текущего
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('family_id', familyId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('time', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return ((data ?? []) as EventRow[]).map(toEvent);
  },

  /** Создание события. attendees/reminders уходят в jsonb как массивы нативно
   *  (клиент Supabase сам сериализует их через JSON.stringify). */
  async createEvent(eventData: NewEvent): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData })
      .select()
      .single();

    if (error) throw error;
    return toEvent(data as EventRow);
  },

  /** Частичное обновление события по id */
  async updateEvent(eventId: string, patch: EventPatch): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .update({ ...patch })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return toEvent(data as EventRow);
  },

  /** Удаление события по id */
  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) throw error;
  },
};
