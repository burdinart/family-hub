// src/types/app.ts — доменные интерфейсы приложения по ТЗ «Промпт 0 (Supabase)».
// Имена совпадают с полями таблиц Supabase; значения jsonb парсятся в типизированные массивы.

import type { DocumentCategory, ScheduleColor, TaskPriority, TaskStatus } from './index';


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
  /** название документа (редактируется пользователем) */
  title: string;
  category: DocumentCategory;
  /** публичный URL файла в Supabase Storage */
  file_url: string;
  /** путь объекта в bucket 'documents' — нужен для удаления файла */
  file_path: string;
  /** исходное имя загруженного файла (null — для старых записей без колонки) */
  file_name: string | null;
  /** размер файла в байтах (null — если не сохранён) */
  file_size: number | null;
  /** MIME-тип (image/jpeg, image/png, application/pdf) или null */
  mime_type: string | null;
  /** срок действия документа (ISO date) или null */
  expiry_date: string | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Регулярное занятие (таблица schedule) — недельное расписание семьи */
export interface Schedule {
  id: string;
  family_id: string;
  title: string;
  /** 1=Пн, 2=Вт, ..., 7=Вс */
  day_of_week: number;
  /** Postgres time: "HH:mm:ss" (в UI нормализуем до HH:mm) */
  start_time: string;
  end_time: string;
  /** id профиля-участника занятия или null (вся семья) */
  participant_id: string | null;
  location: string | null;
  color: ScheduleColor;
  created_by: string | null;
  created_at: string;
}
