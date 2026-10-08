// src/features/schedule/services/scheduleService.ts — сервис данных модуля «Расписание».
// Единственная точка обращения к таблице schedule (Supabase). Компоненты и store
// не пишут запросы напрямую. Realtime-подписка: при любом изменении строк расписания
// семьи перезагружаем полный список (источник истины — БД, просто и надёжно).

import { supabase } from '@/config/supabase';
import type { Schedule, ScheduleColor } from '@/types';

/** Payload для создания занятия (id/created_at генерирует БД) */
export type NewSchedule = Omit<Schedule, 'id' | 'created_at'>;

/** Допустимые цвета занятия (совпадают с CHECK в БД) */
const VALID_COLORS: readonly ScheduleColor[] = [
  'blue',
  'green',
  'red',
  'yellow',
  'purple',
  'pink',
];

/** Приведение строки БД к доменному Schedule без any: unknown + явные поля */
function toSchedule(row: Record<string, unknown>): Schedule {
  // Цвет из БД может быть любым (если чек-констрейнт меняли) — канонизируем к safe-значению
  const rawColor = String(row.color ?? 'blue');
  const color: ScheduleColor = (VALID_COLORS as readonly string[]).includes(rawColor)
    ? (rawColor as ScheduleColor)
    : 'blue';

  return {
    id: String(row.id),
    family_id: String(row.family_id),
    title: String(row.title),
    day_of_week: Number(row.day_of_week),
    // Postgres time приходит как "HH:mm:ss" — храним как есть, UI нормализует
    start_time: String(row.start_time ?? ''),
    end_time: String(row.end_time ?? ''),
    participant_id: (row.participant_id as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    color,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

export const scheduleService = {
  /** Подписка на изменения таблицы schedule данной семьи. Возвращает функцию отписки. */
  subscribeToSchedule(familyId: string, callback: (schedule: Schedule[]) => void): () => void {
    const channel = supabase
      .channel(`schedule-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // insert / update / delete
          schema: 'public',
          table: 'schedule',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          // Перезагружаем данные при любом изменении
          this.getScheduleByFamily(familyId)
            .then(callback)
            .catch(console.error);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  /** Всё расписание семьи: сначала дни недели, внутри дня — по времени начала */
  async getScheduleByFamily(familyId: string): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from('schedule')
      .select('*')
      .eq('family_id', familyId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => toSchedule(row as Record<string, unknown>));
  },

  /** Создание занятия */
  async createSchedule(schedule: NewSchedule): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedule')
      .insert([schedule])
      .select()
      .single();

    if (error) throw error;
    return toSchedule(data as Record<string, unknown>);
  },

  /** Частичное обновление занятия (используется для редактирования в модалке) */
  async updateSchedule(id: string, updates: Partial<NewSchedule>): Promise<void> {
    const { error } = await supabase.from('schedule').update(updates).eq('id', id);
    if (error) throw error;
  },

  /** Удаление занятия */
  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (error) throw error;
  },
};
