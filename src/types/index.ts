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

/** Категория начисления баллов (совпадает с CHECK в supabase/schema.sql, points_log) */
export type PointsCategory =
  | 'task'        // выполнение задачи
  | 'task_create' // создание (делегирование) задачи
  | 'shopping'    // отмеченный товар в списке покупок
  | 'document'    // загруженный документ в сейф
  | 'gift'        // подарок баллов между членами семьи
  | 'bonus';      // служебные/ручные начисления

/** Запись истории баллов (таблица points_log) */
export interface PointsLog {
  id: string;
  family_id: string;
  user_id: string;
  /** Положительное — начисление, отрицательное — списание (например, подарок) */
  points: number;
  /** Человекочитаемая причина («Выполнена задача: Помыть посуду») */
  reason: string;
  category: PointsCategory;
  /** id связанной сущности (задача/товар/документ) или null */
  reference_id: string | null;
  created_at: string;
}

/** Информация о звании пользователя и прогрессе до следующего уровня */
export interface RankInfo {
  /** Название звания («Помощник») */
  title: string;
  /** Эмодзи звания (⭐) */
  emoji: string;
  /** Нижняя граница баллов текущего звания */
  minPoints: number;
  /** Верхняя граница (для максимального звания = текущие баллы) */
  maxPoints: number;
  /** Название следующего звания или null (максимальный уровень) */
  nextRank: string | null;
  /** Сколько баллов осталось до следующего звания (0 — максимум достигнут) */
  pointsToNext: number;
}

