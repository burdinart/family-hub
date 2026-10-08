// src/features/chat/store/messagesStore.ts — Zustand-стор семейного чата.
// ШАГ 8 ТЗ: loadMessages обогащает сообщения данными отправителей из profiles
// (виртуальное поле sender). Realtime-события перезагружают историю целиком —
// это корректно обрабатывает INSERT/UPDATE/DELETE без ручного diff.

import { create } from 'zustand';
import { messagesService } from '../services/messagesService';
import { describeError } from '@/features/vault/services/documentsService';
import type { Message } from '@/types';

interface MessagesState {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;

  setMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  /** Загрузить историю + подгрузить профили отправителей (ШАГ 8) */
  loadMessages: (familyId: string) => Promise<void>;
  /** Отправить сообщение; realtime доставит его всем, включая нас (без оптимизма — дубликаты исключены) */
  sendMessage: (familyId: string, senderId: string, text: string) => Promise<boolean>;
  /** Удалить своё сообщение */
  deleteMessage: (messageId: string, senderId: string) => Promise<boolean>;

  subscribeToFamilyMessages: (familyId: string) => Promise<void>;
  unsubscribeFromMessages: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,
  unsubscribe: null,

  setMessages: (messages) => set({ messages }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  loadMessages: async (familyId: string) => {
    // Первичная загрузка показываем спиннер; фоновые realtime-обновления — молча
    if (get().messages.length === 0) set({ isLoading: true });
    set({ error: null });

    try {
      const messages = await messagesService.getMessagesByFamily(familyId);

      // ШАГ 8: получаем уникальные id отправителей и подтягиваем их профили одним запросом
      const senderIds = [...new Set(messages.map((m) => m.sender_id).filter((id): id is string => id !== null))];
      const sendersMap = await messagesService.getSendersInfo(senderIds);

      // Добавляем в каждое сообщение виртуальное поле sender
      const messagesWithSenders: Message[] = messages.map((m) => ({
        ...m,
        sender: m.sender_id ? sendersMap.get(m.sender_id) : undefined,
      }));

      set({ messages: messagesWithSenders, isLoading: false });
    } catch (err) {
      set({ error: `Ошибка загрузки сообщений: ${describeError(err)}`, isLoading: false });
      console.error('Messages load error:', err);
    }
  },

  sendMessage: async (familyId, senderId, text) => {
    set({ isSending: true, error: null });
    try {
      await messagesService.sendMessage(familyId, senderId, text);
      // Сообщество доставится через realtime-подписку; но если канал ещё не SUBSCRIBED —
      // страховочная перезагрузка истории гарантирует появление сообщения у автора.
      await get().loadMessages(familyId);
      set({ isSending: false });
      return true;
    } catch (err) {
      set({ isSending: false, error: `Не удалось отправить сообщение: ${describeError(err)}` });
      console.error('Message send error:', err);
      return false;
    }
  },

  deleteMessage: async (messageId, senderId) => {
    set({ error: null });
    try {
      await messagesService.deleteMessage(messageId, senderId);
      await get().loadMessages(get().messages[0]?.family_id ?? '');
      return true;
    } catch (err) {
      set({ error: `Не удалось удалить сообщение: ${describeError(err)}` });
      console.error('Message delete error:', err);
      return false;
    }
  },

  subscribeToFamilyMessages: async (familyId: string) => {
    const { unsubscribe } = get();

    // Отписываемся от предыдущей подписки, если есть (смена семьи/пере-монтирование)
    if (unsubscribe) unsubscribe();

    await get().loadMessages(familyId);

    // При любом изменении в таблице messages нашей семьи — перезагружаем историю
    const unsubscribeFn = messagesService.subscribeToMessages(familyId, () => {
      void get().loadMessages(familyId);
    });

    set({ unsubscribe: unsubscribeFn });
  },

  unsubscribeFromMessages: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },
}));
