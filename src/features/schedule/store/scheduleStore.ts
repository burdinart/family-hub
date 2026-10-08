// src/features/schedule/store/scheduleStore.ts — Zustand store модуля «Расписание».
// Паттерн тот же, что у tasksStore: мутации идут ЧЕРЕЗ сервис (БД — источник истины),
// затем realtime-событие перезагружает список. Оптимистичные обновления с откатом
// при ошибке дают мгновенный отклик UI на мобильных.

import { create } from 'zustand';
import { scheduleService } from '../services/scheduleService';
import type { NewSchedule } from '../services/scheduleService';
import type { Schedule } from '@/types';

interface ScheduleState {
  schedule: Schedule[];
  isLoading: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;

  setSchedule: (schedule: Schedule[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  /** Создание занятия в БД + оптимистичное добавление в список */
  addSchedule: (schedule: NewSchedule) => Promise<void>;
  /** Обновление занятия в БД + оптимистичное слияние полей */
  updateSchedule: (id: string, updates: Partial<NewSchedule>) => Promise<void>;
  /** Удаление занятия из БД + оптимистичное удаление из списка */
  deleteSchedule: (id: string) => Promise<void>;

  subscribeToFamilySchedule: (familyId: string) => Promise<void>;
  unsubscribeFromSchedule: () => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedule: [],
  isLoading: false,
  error: null,
  unsubscribe: null,

  setSchedule: (schedule) => set({ schedule }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  addSchedule: async (schedule) => {
    // Временный id для оптимистичного элемента; реальный придёт из БД/realtime
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Schedule = { ...schedule, id: tempId, created_at: new Date().toISOString() };
    set((state) => ({ schedule: [...state.schedule, optimistic] }));
    try {
      await scheduleService.createSchedule(schedule);
      // Realtime-подписка перезагрузит список с настоящими id
    } catch (err) {
      console.error('Ошибка создания занятия:', err);
      // Откат оптимистичной записи
      set((state) => ({
        schedule: state.schedule.filter((s) => s.id !== tempId),
        error: 'Не удалось создать занятие',
      }));
      throw err;
    }
  },

  updateSchedule: async (id, updates) => {
    const prev = get().schedule;
    set((state) => ({
      schedule: state.schedule.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
    try {
      await scheduleService.updateSchedule(id, updates);
    } catch (err) {
      console.error('Ошибка обновления занятия:', err);
      set({ schedule: prev, error: 'Не удалось обновить занятие' });
      throw err;
    }
  },

  deleteSchedule: async (id) => {
    const prev = get().schedule;
    set((state) => ({ schedule: state.schedule.filter((s) => s.id !== id) }));
    try {
      await scheduleService.deleteSchedule(id);
    } catch (err) {
      console.error('Ошибка удаления занятия:', err);
      set({ schedule: prev, error: 'Не удалось удалить занятие' });
      throw err;
    }
  },

  subscribeToFamilySchedule: async (familyId: string) => {
    const { unsubscribe } = get();

    // Отписываемся от предыдущей подписки, если есть (смена семьи / повторный вход)
    if (unsubscribe) {
      unsubscribe();
    }

    set({ isLoading: true, error: null });

    try {
      // 1. Загружаем текущее расписание
      const schedule = await scheduleService.getScheduleByFamily(familyId);
      set({ schedule, isLoading: false });

      // 2. Подписываемся на изменения (INSERT/UPDATE/DELETE -> перезагрузка списка)
      const unsubscribeFn = scheduleService.subscribeToSchedule(familyId, (newSchedule) => {
        set({ schedule: newSchedule });
      });

      set({ unsubscribe: unsubscribeFn });
    } catch (error) {
      set({ error: 'Ошибка загрузки расписания', isLoading: false });
      console.error('Schedule subscription error:', error);
    }
  },

  unsubscribeFromSchedule: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },
}));
