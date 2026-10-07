// Общие типы, используемые во всём приложении

/** Роли участника семьи */
export type FamilyRole = 'owner' | 'admin' | 'member';

/** Приоритет задачи */
export type TaskPriority = 'low' | 'medium' | 'high';

/** Статус задачи */
export type TaskStatus = 'todo' | 'in-progress' | 'done';

/** Категория документа в хранилище (Vault) */
export type DocumentCategory =
  | 'passport'
  | 'insurance'
  | 'medical'
  | 'education'
  | 'contract'
  | 'other';

/** Статус загрузки данных для real-time подписок */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Базовые поля Firestore-документа с временными метками */
export interface TimestampedDoc {
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Пользовательские настройки приложения */
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  defaultView: 'calendar' | 'tasks';
  notificationsEnabled: boolean;
}
