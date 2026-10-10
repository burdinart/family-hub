// src/services/familyMembersService.ts — краткие карточки членов семьи.
// Используется: селектом «Исполнитель» в модалке задачи и fallback-отображением
// имени исполнителя в TaskCard, если embed assignee недоступен.
// RLS profiles_select разрешает читать профили своей семьи — запрос безопасен.

import { supabase } from '@/config/supabase';
import type { TaskAssignee } from '@/types';

/**
 * Получить всех членов семьи (id, имя, аватар) по алфавиту.
 * Ошибку не пробрасываем: отсутствие списка — деградация UI, а не блокировка.
 */
export async function getFamilyMembers(familyId: string): Promise<TaskAssignee[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('family_id', familyId)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Не удалось загрузить членов семьи:', error);
    return [];
  }

  // Нормализация без any: unknown → явные поля
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      full_name: String(r.full_name ?? ''),
      avatar_url: (r.avatar_url as string | null) ?? null,
    };
  });
}
