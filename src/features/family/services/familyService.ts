// Сервис данных семьи (Supabase). Единственная точка обращения к таблицам
// families / family_members / profiles. Stores и компоненты напрямую БД не трогают.

import { getSupabaseClient } from '../../../config/supabase';
import { TABLES, type FamilyMemberRow, type FamilyRow, type ProfileRow } from '../../../types/database';
import type { Family, FamilyMember, UserProfile } from '../../../types';

/** ISO-строка -> Date | null */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Строка profiles -> UserProfile */
export function mapProfile(
  row: ProfileRow,
  fallbackEmail?: string | null,
  fallbackName?: string | null,
): UserProfile {
  return {
    id: row.id,
    email: row.email || fallbackEmail || '',
    displayName: row.full_name || fallbackName || '',
    photoURL: row.avatar_url ?? null,
    familyId: row.family_id ?? null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

// --- Конвертация JOIN-строк (families + family_members + profiles) ---

interface JoinedMemberRow extends FamilyMemberRow {
  profiles: Pick<ProfileRow, 'id' | 'email' | 'full_name' | 'avatar_url'> | null;
}
type JoinedFamilyRow = FamilyRow & { family_members: JoinedMemberRow[] | null };

export function mapFamily(row: JoinedFamilyRow): Family {
  const members: FamilyMember[] = (row.family_members ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role,
    nickname: m.nickname || m.profiles?.full_name || '',
    color: m.color,
    joinedAt: toDate(m.joined_at),
    profile: m.profiles
      ? {
          email: m.profiles.email,
          displayName: m.profiles.full_name,
          photoURL: m.profiles.avatar_url ?? null,
        }
      : undefined,
  }));

  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    members,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/** Загрузить семью с участниками (один запрос с join) */
export async function fetchFamily(familyId: string): Promise<Family | null> {
  const { data, error } = await getSupabaseClient()
    .from(TABLES.families)
    .select('*, family_members(*, profiles(id, email, full_name, avatar_url))')
    .eq('id', familyId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapFamily(data as unknown as JoinedFamilyRow) : null;
}

/** Профиль пользователя по id (строка таблицы profiles) */
export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabaseClient()
    .from(TABLES.profiles)
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

/** Найти семью по инвайт-коду.
 * Примечание: до вступления в семью RLS не отдаёт строки families, поэтому
 * для присоединения используется RPC join_family (см. supabase/schema.sql). */
export async function findFamilyByInviteCode(code: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await getSupabaseClient()
    .from(TABLES.families)
    .select('id, name')
    .eq('invite_code', code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Создать семью: family + участник-owner + profile.family_id. Возвращает id семьи. */
export async function createFamily(name: string, ownerId: string, inviteCode: string): Promise<string> {
  const supabase = getSupabaseClient();

  const { data: family, error: famErr } = await supabase
    .from(TABLES.families)
    .insert({ name, owner_id: ownerId, invite_code: inviteCode })
    .select('id')
    .single();
  if (famErr) throw famErr;

  const { error: memErr } = await supabase
    .from(TABLES.familyMembers)
    .insert({ family_id: family.id, user_id: ownerId, role: 'owner' });
  if (memErr) throw memErr;

  const { error: profErr } = await supabase
    .from(TABLES.profiles)
    .update({ family_id: family.id })
    .eq('id', ownerId);
  if (profErr) throw profErr;

  return family.id;
}

/** Присоединиться к семье по инвайт-коду через RPC join_family
 * (SECURITY DEFINER — проходит RLS до появления членства). Возвращает id семьи. */
export async function joinFamilyByCode(code: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('join_family', { code });
  if (error) {
    if (/INVALID_CODE/.test(error.message)) throw new Error('INVALID_CODE');
    throw error;
  }
  return data as string;
}

/** Сгенерировать короткий человекочитаемый инвайт-код (без неоднозначных символов) */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
