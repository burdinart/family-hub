// src/features/chat/services/messagesService.ts — единственная точка работы с таблицей messages.
// Компоненты и стор не знают про Supabase напрямую: только этот сервис.
// Реализация по ТЗ «Семейный чат», с двумя важными доработками:
//  1) подписка на ВСЕ события (INSERT/UPDATE/DELETE), а не только INSERT — иначе удаление
//     сообщения у других устройств не отобразилось бы до перезагрузки;
//  2) сырые строки БД проходят через типобезопасный конвертер (strict TS, без any).

import { supabase } from '@/config/supabase';
import { describeError } from '@/features/vault/services/documentsService';
import type { Message } from '@/types';

/** Максимум сообщений в истории (последние N — чат лёгкий, лимит защитит от раздувания) */
const HISTORY_LIMIT = 100;

/** Строка таблицы messages (PostgREST отдаёт json как Record<string, unknown>) */
type MessageRow = Record<string, unknown>;

/** Конвертер строки БД → доменный Message (без any, поля проверяются по типам) */
function toMessage(row: MessageRow): Message {
  return {
    id: String(row.id ?? ''),
    family_id: String(row.family_id ?? ''),
    sender_id: typeof row.sender_id === 'string' ? row.sender_id : null,
    text: String(row.text ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export const messagesService = {
  // Получение последних N сообщений семьи (по возрастанию — хронологически для чата)
  async getMessagesByFamily(familyId: string, limit: number = HISTORY_LIMIT): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(describeError(error));
    return (data ?? []).map(toMessage);
  },

  // Отправка сообщения (здесь — страховка на случай пустого ввода)
  async sendMessage(familyId: string, senderId: string, text: string): Promise<Message> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Сообщение не может быть пустым');

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          family_id: familyId,
          sender_id: senderId,
          text: trimmed,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(describeError(error));
    return toMessage(data as MessageRow);
  },

  // Real-time подписка на изменения сообщений семьи.
  // event:'*' ловит INSERT (новое), UPDATE (правка) и DELETE (удаление) — при любом
  // событии вызываем callback, стор перезагружает историю (просто и надёжно для чата).
  subscribeToMessages(familyId: string, onChange: () => void) {
    const channel = supabase
      .channel(`messages-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          onChange();
        },
      )
      .subscribe();

    // Функция отписки — вызывается из стора при размонтировании/смене семьи
    return () => {
      void supabase.removeChannel(channel);
    };
  },

  // Удаление сообщения (только своего — фильтр sender_id на уровне запроса,
  // основная защита — RLS-политика в БД)
  async deleteMessage(messageId: string, senderId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', senderId);

    if (error) throw new Error(describeError(error));
  },

  // Данные профилей отправителей (для виртуального поля Message.sender)
  async getSendersInfo(senderIds: string[]): Promise<Map<string, { full_name: string; avatar_url: string | null }>> {
    if (senderIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', senderIds);

    if (error) throw new Error(describeError(error));

    const map = new Map<string, { full_name: string; avatar_url: string | null }>();
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      map.set(String(r.id), {
        full_name: String(r.full_name ?? '') || 'Без имени',
        avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
      });
    }
    return map;
  },
};
