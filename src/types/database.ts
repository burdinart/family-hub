// Типы строк Supabase (PostgreSQL) — соответствуют supabase/schema.sql.
// Domain-модели из family.ts/calendar.ts и т.д. конвертируются из этих строк
// в сервисах (src/features/*/services), компоненты с БД не контактируют.

import type { DocumentCategory, FamilyRole, TaskPriority, TaskStatus } from './common';
import type { MemberColor } from './family';
import type { EventType, RecurrenceRule } from './calendar';

/** Строка таблицы profiles */
export interface ProfileRow {
  id: string; // == auth.users.id (uuid)
  email: string;
  full_name: string;
  avatar_url: string | null;
  family_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Строка таблицы families */
export interface FamilyRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

/** Строка таблицы family_members */
export interface FamilyMemberRow {
  family_id: string;
  user_id: string;
  role: FamilyRole;
  nickname: string;
  color: MemberColor;
  joined_at: string;
}

/** Строка таблицы events */
export interface EventRow {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  type: EventType;
  recurrence: RecurrenceRule;
  participant_ids: string[];
  created_at: string;
  updated_at: string;
}

/** Строка таблицы tasks */
export interface TaskRow {
  id: string;
  family_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null; // ISO date (YYYY-MM-DD)
  position: number;
  created_at: string;
  updated_at: string;
}

/** Элемент items (jsonb) таблицы shopping_lists */
export interface ShoppingItemJson {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

/** Строка таблицы shopping_lists */
export interface ShoppingListRow {
  id: string;
  family_id: string;
  name: string;
  items: ShoppingItemJson[];
  created_at: string;
  updated_at: string;
}

/** Строка таблицы documents */
export interface DocumentRow {
  id: string;
  family_id: string;
  uploaded_by: string;
  name: string;
  category: DocumentCategory;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

/** Строка таблицы location_marks */
export interface LocationMarkRow {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  emoji: string;
  created_at: string;
  updated_at: string;
}

/** Имена таблиц — единый источник, чтобы не хардкодить строки в коде */
export const TABLES = {
  profiles: 'profiles',
  families: 'families',
  familyMembers: 'family_members',
  events: 'events',
  tasks: 'tasks',
  shoppingLists: 'shopping_lists',
  documents: 'documents',
  locationMarks: 'location_marks',
} as const;
