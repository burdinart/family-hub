// src/types/app.ts — доменные интерфейсы приложения по ТЗ «Промпт 0 (Supabase)».
// Имена совпадают с полями таблиц Supabase; значения jsonb парсятся в типизированные массивы.

import type { DocumentCategory, TaskPriority, TaskStatus } from './index';


/** Профиль пользователя (таблица profiles, id == auth.users.id) */
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  family_id: string | null;
  points: number;
  created_at: string;
}

/** Семья (таблица families) */
export interface Family {
  id: string;
  name: string;
  created_at: string;
}

/** Категория события (совпадает с чек-листом в БД) */
export type EventCategory =
  | 'event'
  | 'birthday'
  | 'school'
  | 'sports'
  | 'medical'
  | 'family'
  | 'other';

/** Событие (таблица events). attendees/reminders парсятся из jsonb. */
export interface Event {
  id: string;
  family_id: string;
  title: string;
  /** ISO date: YYYY-MM-DD */
  date: string;
  /** HH:mm или null (событие весь день) */
  time: string | null;
  category: EventCategory;
  /** jsonb: id участников семьи (string[]) */
  attendees: string[];
  /** jsonb: напоминания за N минут до начала (number[]) */
  reminders: number[];
  created_by: string;
  created_at: string;
}

/** Задача (таблица tasks) */
export interface Task {
  id: string;
  family_id: string;
  title: string;
  assignee_id: string | null;
  status: TaskStatus;
  /** ISO date: YYYY-MM-DD или null */
  due_date: string | null;
  priority: TaskPriority;
  category: string;
  created_by: string;
  created_at: string;
}

/** Geo-метка (таблица marks) */
export interface Mark {
  id: string;
  family_id: string;
  name: string;
  lat: number;
  lng: number;
  /** радиус геозоны в метрах */
  radius: number;
  category: string;
  created_by: string;
  created_at: string;
}

/** Документ в сейфе (таблица documents) */
export interface Document {
  id: string;
  family_id: string;
  name: string;
  file_url: string;
  category: DocumentCategory;
  /** срок действия документа (ISO date) или null */
  expiry_date: string | null;
  uploaded_by: string;
  created_at: string;
}

/** Позиция участника семьи (таблица family_members, для ролей/цветов) */
