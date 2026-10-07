// Доменные модели приложения (данные из Supabase/PostgreSQL)

import type { TimestampedDoc, FamilyRole } from './common';

/** Цвет метки участника семьи (Tailwind-совместимый ключ палитры) */
export type MemberColor = 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'violet';

/** Минимальные данные профиля участника (из join с profiles) */
export interface MemberProfileSummary {
  email: string;
  displayName: string;
  photoURL: string | null;
}

/** Участник семьи (строка family_members + профиль из join) */
export interface FamilyMember {
  userId: string;
  role: FamilyRole;
  nickname: string;
  color: MemberColor;
  joinedAt: Date | null;
  /** Данные профиля участника (заполняются сервисом при join-запросе) */
  profile?: MemberProfileSummary;
}

/** Семья — корневая сущность, к которой привязаны все данные */
export interface Family extends TimestampedDoc {
  id: string;
  name: string;
  /** UUID владельца семьи (auth.users.id) */
  ownerId: string;
  /** Инвайт-код для присоединения новых участников */
  inviteCode: string;
  members: FamilyMember[];
}

/** Профиль пользователя (таблица profiles, сопоставлен с auth.users по id) */
export interface UserProfile extends TimestampedDoc {
  id: string; // == Supabase auth.users.id
  email: string;
  displayName: string;
  photoURL: string | null;
  /** ID семьи, к которой принадлежит пользователь (null — ещё не в семье) */
  familyId: string | null;
}
