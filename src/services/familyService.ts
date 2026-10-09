// src/services/familyService.ts — сервис данных модуля «Семья».
// Единственная точка обращения к таблице families (Supabase) для сценария
// онбординга: создание семьи первым пользователем и привязка его профиля.
// Компоненты не пишут запросы напрямую — только через этот сервис.

import { supabase } from '@/config/supabase';
import type { Family } from '@/types';

/** Приведение строки БД к доменному Family без any: unknown + явные поля */
function toFamily(row: Record<string, unknown>): Family {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    created_at: String(row.created_at ?? ''),
  };
}

export const familyService = {
  /**
   * Создать семью и привязать к ней профиль пользователя.
   *
   * Порядок операций важен из-за RLS (см. supabase/schema.sql):
   *  1. INSERT в families разрешён любому авторизованному пользователю
   *     (политика families_insert: `auth.uid() is not null`).
   *  2. После вставки пользователь ещё НЕ участник новой семьи, поэтому
   *     `.select().single()` может не вернуть строку (политика families_select
   *     проверяет членство). Fallback: возвращаем данные из RETURNING-подобного
   *     ответа либо читаем семью после привязки профиля (шаг 3) — тогда членство
   *     уже есть и SELECT пройдёт.
   *  3. UPDATE своего профиля (family_id) разрешён политикой profiles_update
   *     (`id = auth.uid()`) — так пользователь становится участником семьи.
   *
   * @param name      Название семьи (обрезается вызывающей стороной)
   * @param profileId id профиля создателя (== auth.users.id)
   * @returns созданная семья (доменный тип Family)
   */
  async createFamily(name: string, profileId: string): Promise<Family> {
    // Шаг 1: создаём семью. .select() без .single() — чтобы не упасть на 0 строк
    // из-за RLS-чтения; id получаем даже если read-back недоступен.
    const { data: inserted, error: insertError } = await supabase
      .from('families')
      .insert([{ name }])
      .select();

    if (insertError) throw insertError;

    const familyId = inserted?.[0]?.id as string | undefined;
    if (!familyId) {
      // Запись создана, но Supabase не вернул её из-за политики select.
      throw new Error('Не удалось получить данные созданной семьи');
    }

    // Шаг 2: привязываем профиль к семье — пользователь становится участником.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ family_id: familyId })
      .eq('id', profileId);

    if (profileError) throw profileError;

    // Шаг 3: читаем семью целиком (членство уже есть → SELECT пройдёт).
    // Если чтение по какой-то причине не удалось — собираем объект из вставки.
    const { data: familyRow } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .maybeSingle();

    if (familyRow) return toFamily(familyRow as Record<string, unknown>);

    return {
      id: familyId,
      name,
      created_at: new Date().toISOString(),
    };
  },
};
