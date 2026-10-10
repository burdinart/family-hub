// src/features/calendar/store/eventsStore.ts — Zustand store модуля «Календарь».
// Хранит события семьи, выбранную дату и статусы загрузки; инкапсулирует
// real-time подписку. Компоненты читают состояние и вызывают экшены,
// не зная про Supabase.

import { create } from 'zustand';
import { eventsService, type NewEvent, type EventPatch } from '../services/eventsService';
import { useAuthStore } from '@/store/authStore';
import { createNotification, getOtherFamilyMembers } from '@/services/notificationHelper';
import type { Event } from '@/types';

interface EventsState {
  events: Event[];
  /** Выбранная дата для просмотра списка событий дня */
  selectedDate: Date;
  isLoading: boolean;
  error: string | null;
  /** Функция отписки от realtime-канала (хранится, чтобы не «течь» при смене семьи) */
  unsubscribe: (() => void) | null;

  // Экшены состояния
  setEvents: (events: Event[]) => void;
  setSelectedDate: (date: Date) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Мутации (через сервис + оптимистичное обновление UI)
  addEvent: (eventData: NewEvent) => Promise<void>;
  updateEvent: (eventId: string, patch: EventPatch) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;

  // Realtime
  subscribeToFamilyEvents: (familyId: string) => Promise<void>;
  unsubscribeFromEvents: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  selectedDate: new Date(),
  isLoading: false,
  error: null,
  unsubscribe: null,

  setEvents: (events) => set({ events }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  /** Создание события: ждём ответ БД, добавляем в начало близко к реальному порядку.
   *  Дубликат исключает realtime-перезагрузка, но оптимистично показываем сразу. */
  addEvent: async (eventData) => {
    try {
      const created = await eventsService.createEvent(eventData);
      set((state) => ({ events: [...state.events, created] }));

      // Уведомления: всех членов семьи, КРОМЕ создателя (правило проекта).
      // createNotification сам глушит ошибки — сбой пуша не сломает создание события.
      const me = useAuthStore.getState().user;
      if (me) {
        const when = created.time ? `${created.date} ${created.time}` : created.date;
        const others = await getOtherFamilyMembers(created.family_id, me.id);
        for (const member of others) {
          await createNotification({
            familyId: created.family_id,
            userId: member.id,
            senderId: me.id,
            title: '📅 Новое событие',
            body: `${me.full_name ?? 'Кто-то'} добавил: «${created.title}» (${when})`,
            type: 'event',
            referenceId: created.id,
            referenceType: 'event',
          });
        }
      }
    } catch (err) {
      console.error('Ошибка создания события:', err);
      set({ error: 'Не удалось создать событие' });
      throw err; // отдаём ошибку наружу — форма покажет её пользователю
    }
  },

  /** Обновление события: оптимистично правим локальную копию, при ошибке — откат */
  updateEvent: async (eventId, patch) => {
    const prev = get().events;
    set({
      events: prev.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
    });
    try {
      const updated = await eventsService.updateEvent(eventId, patch);
      set((state) => ({
        events: state.events.map((e) => (e.id === eventId ? updated : e)),
      }));
    } catch (err) {
      console.error('Ошибка обновления события:', err);
      set({ events: prev, error: 'Не удалось обновить событие' });
      throw err;
    }
  },

  /** Удаление события: оптимистично убираем из списка, при ошибке — возвращаем */
  deleteEvent: async (eventId) => {
    const prev = get().events;
    set({ events: prev.filter((e) => e.id !== eventId) });
    try {
      await eventsService.deleteEvent(eventId);
    } catch (err) {
      console.error('Ошибка удаления события:', err);
      set({ events: prev, error: 'Не удалось удалить событие' });
      throw err;
    }
  },

  /** Подписка на события семьи: загрузка + realtime-канал.
   *  Повторный вызов сначала отписывает предыдущий канал. */
  subscribeToFamilyEvents: async (familyId) => {
    const { unsubscribe } = get();
    if (unsubscribe) unsubscribe(); // чистим старую подписку (смена семьи/размонтирование)

    set({ isLoading: true, error: null });

    try {
      // 1. Загружаем все события семьи
      const events = await eventsService.getEventsByFamily(familyId);
      set({ events, isLoading: false });

      // 2. Подписываемся на изменения (INSERT/UPDATE/DELETE → перезагрузка списка)
      const unsubscribeFn = eventsService.subscribeToEvents(familyId, (newEvents) => {
        set({ events: newEvents });
      });

      set({ unsubscribe: unsubscribeFn });
    } catch (err) {
      console.error('Ошибка подписки на события:', err);
      set({ error: 'Ошибка загрузки событий', isLoading: false });
    }
  },

  /** Явная отписка (вызывается при размонтировании страницы) */
  unsubscribeFromEvents: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },
}));

/** Селектор: события, отсортированные по дате и времени (ближайшие — первыми) */
export function sortEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
  });
}
