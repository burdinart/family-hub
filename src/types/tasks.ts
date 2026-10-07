// Модели задач и списков покупок

import type { TimestampedDoc, TaskPriority, TaskStatus } from './common';

export interface Task extends TimestampedDoc {
  id: string;
  familyId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** UUID ответственного (auth.users.id; null — не назначен) */
  assigneeId: string | null;
  dueDate: Date | null;
  /** Порядок в колонке (для drag-and-drop через @dnd-kit) */
  order: number;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

export interface ShoppingList extends TimestampedDoc {
  id: string;
  familyId: string;
  name: string;
  items: ShoppingListItem[];
}
