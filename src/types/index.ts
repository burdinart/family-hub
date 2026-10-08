// src/types/index.ts — единая точка импорта доменных типов приложения.
// Использование: import type { Profile, Event, Task } from '@/types'

export * from './app';

/** Статусы загрузки данных (единый паттерн для всех модулей) */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Приоритет задачи */
export type TaskPriority = 'low' | 'medium' | 'high';

/** Статус задачи */
export type TaskStatus = 'todo' | 'doing' | 'done';

/** Цвет занятия в недельном расписании (совпадает с CHECK в БД) */
export type ScheduleColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'pink';

/** Категория документа в сейфе (совпадает с CHECK в supabase/schema.sql) */
export type DocumentCategory =
  | 'passport'
  | 'insurance'
  | 'auto'
  | 'medical'
  | 'education'
  | 'property'
  | 'other';

/** Сообщение семейного чата (таблица messages) */
export interface Message {
  id: string;
  family_id: string;
  /** uuid профиля отправителя (null — если профиль удалён) */
  sender_id: string | null;
  text: string;
  created_at: string;
  /**
   * Виртуальное поле для отображения (не колонка БД):
   * подгружается из таблицы profiles при загрузке истории.
   */
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}
