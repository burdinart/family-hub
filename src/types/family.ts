// Доменные модели Firestore-коллекций

import type { TimestampedDoc, FamilyRole } from './common';

/** Цвет метки участника семьи (Tailwind-совместимый ключ палитры) */
export type MemberColor = 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'violet';

/** Участник семьи (вложенный документ внутри family) */
export interface FamilyMember {
  userId: string;
  role: FamilyRole;
  nickname: string;
  color: MemberColor;
  joinedAt: Date | null;
}

/** Семья — корневая сущность, к которой привязаны все данные */
export interface Family extends TimestampedDoc {
  id: string;
  name: string;
  /** Firebase UID владельца семьи */
  ownerId: string;
  /** Инвайт-код для присоединения новых участников */
  inviteCode: string;
  members: FamilyMember[];
}

/** Профиль пользователя (коллекция users, сопоставлен по Firebase UID) */
export interface UserProfile extends TimestampedDoc {
  id: string; // == Firebase Auth UID
  email: string;
  displayName: string;
  photoURL: string | null;
  /** ID семьи, к которой принадлежит пользователь (null — ещё не в семье) */
  familyId: string | null;
}
