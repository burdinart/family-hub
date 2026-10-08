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

/** Категория документа в сейфе */
export type DocumentCategory =
  | 'passport'
  | 'insurance'
  | 'medical'
  | 'contract'
  | 'other';
