// src/services/familyService.ts — сервис данных модуля «Семья».
// Единственная точка обращения к таблице families (Supabase) для онбординга:
//   1. создать новую семью → автоматически получить код приглашения;
//   2. присоединиться к существующей семье по коду приглашения.
// Компоненты не пишут запросы напрямую — только через этот сервис.

import { supabase } from '@/config/supabase';
import type { Family } from '@/types';

/** Длина кода приглашения (символы A–Z0–9, см. CHECK-ограничение в schema.sql) */
const INVITE_CODE_LENGTH = 6;

/**
 * Сгенерировать код приглашения: 6 заглавных букв/цифр.
 * crypto.getRandomValues предпочтительнее Math.random (лучшее распределение);
 * алфавит без неоднозначных символов (0/O, 1/I) — код продиктовывают голосом.
 */
function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

/** Нормализация введённого кода: верхний регистр, только A–Z0–9 */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Приведение строки БД к доменному Family без any: unknown + явные поля */
function toFamily(row: Record<string, unknown>): Family {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    invite_code: (row.invite_code as string | null | undefined) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

/** Понятная человеку ошибка из ошибки Supabase (без сырых SQL-текстов) */
function friendlyDbError(error: { message: string; code?: string }, fallback: string): Error {
  // 23505 unique_violation — коллизия invite_code (редко, но возможно)
  if (error.code === '23505') {
    return new Error('Код приглашения уже занят. Попробуйте создать семью ещё раз.');
  }
  if (/row-level security|permission denied/i.test(error.message)) {
    return new Error('Недостаточно прав для этого действия. Проверьте, что вы вошли в аккаунт.');
  }
  return new Error(fallback);
}

export const familyService = {
  /**
   * Создать семью с автоматически сгенерированным кодом приглашения
   * и привязать к ней профиль пользователя (создателя).
   *
   * Порядок операций важен из-за RLS (supabase/schema.sql):
   *  1. INSERT в families разрешён любому авторизованному (families_insert).
   *  2. SELECT семьи проверяет членство (families_select → is_family_member),
   *     поэтому читаем семью ПОСЛЕ привязки профиля, а не сразу после вставки.
   *  3. UPDATE своего профиля разрешён политикой profiles_update (id = auth.uid()).
   *
   * @param name      Название семьи (обрезается вызывающей стороной)
   * @param profileId id профиля создателя (== auth.users.id)
   * @returns созданная семья с invite_code
   */
  async createFamily(name: string, profileId: string): Promise<Family> {
    // Коллизию кодов ловим повтором (до 3 попыток): unique-индекс на invite_code.
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const inviteCode = generateInviteCode();

      // Шаг 1: вставляем семью. .select() без .single() — защита от того,
      // что политики чтения ещё не «видят» новую строку.
      const { data: inserted, error: insertError } = await supabase
        .from('families')
        .insert([{ name, invite_code: inviteCode }])
        .select();

      if (insertError) {
        lastError = friendlyDbError(insertError, 'Не удалось создать семью. Попробуйте ещё раз.');
        // Повторяем только при коллизии кода; другие ошибки — сразу наружу
        if (insertError.code !== '23505') throw lastError;
        continue;
      }

      const familyId = inserted?.[0]?.id as string | undefined;
      if (!familyId) {
        throw new Error('Не удалось получить данные созданной семьи');
      }

      // Шаг 2: привязываем профиль — пользователь становится участником семьи.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ family_id: familyId })
        .eq('id', profileId);

      if (profileError) throw friendlyDbError(profileError, 'Не удалось привязать вас к семье.');

      // Шаг 3: читаем семью целиком (членство есть → SELECT пройдёт).
      // Если чтение не удалось — возвращаем то, что известно из вставки.
      const { data: familyRow } = await supabase
        .from('families')
        .select('*')
        .eq('id', familyId)
        .maybeSingle();

      if (familyRow) return toFamily(familyRow as Record<string, unknown>);

      return { id: familyId, name, invite_code: inviteCode, created_at: new Date().toISOString() };
    }

    throw lastError ?? new Error('Не удалось создать семью. Попробуйте ещё раз.');
  },

  /**
   * Присоединиться к существующей семье по коду приглашения.
   *
   * Примечание про RLS: политика families_select пускает только участников,
   * поэтому саму семью мы НЕ читаем — находим её id через security definer
   * функцию public.find_family_by_invite_code (см. supabase/schema.sql),
   * которой разрешено смотреть invite_code до вступления.
   *
   * @param inviteCode Код приглашения (регистр и пробелы не важны)
   * @param profileId  id профиля вошедшего (== auth.users.id)
   * @returns название семьи, к которой удалось присоединиться
   */
  async joinFamilyByCode(
    inviteCode: string,
    profileId: string,
  ): Promise<{ id: string; name: string }> {
    const code = normalizeInviteCode(inviteCode);
    if (code.length < INVITE_CODE_LENGTH) {
      throw new Error('Код приглашения должен содержать 6 символов.');
    }

    // Шаг 1: ищем семью по коду через RPC (обходит ограничение families_select).
    const { data: rpcData, error: rpcError } = await supabase.rpc('find_family_by_invite_code', {
      code,
    });

    const found = (rpcData ?? null) as { id: string; name: string } | null;
    if (rpcError || !found?.id) {
      throw new Error('Семья с таким кодом не найдена. Проверьте правильность кода.');
    }

    // Шаг 2: привязываем свой профиль к найденной семье.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ family_id: found.id })
      .eq('id', profileId);

    if (profileError) throw friendlyDbError(profileError, 'Не удалось присоединиться к семье.');

    return { id: found.id, name: found.name };
  },

  /**
   * Получить код приглашения семьи (для отображения в интерфейсе участников).
   * @returns код либо null, если прочитать не удалось (старая семья без кода / нет доступа)
   */
  async getFamilyInviteCode(familyId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('families')
      .select('invite_code')
      .eq('id', familyId)
      .maybeSingle();

    if (error || !data) return null;
    return (data as Record<string, unknown>).invite_code
      ? String((data as Record<string, unknown>).invite_code)
      : null;
  },
};
