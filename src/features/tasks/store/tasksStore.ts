// src/features/tasks/store/tasksStore.ts — Zustand store модуля «Задачи».
// Хранит список задач текущей семьи + статусы загрузки/ошибки + realtime-подписку.
// Оптимистичные обновления (UI меняется сразу), затем realtime из БД приводит
// состояние к истинному значению на всех устройствах семьи.

import { create } from 'zustand';
import { tasksService, type NewTask } from '../services/tasksService';
import type { Task, TaskStatus } from '@/types';

interface TasksState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  /** Функция отписки от realtime-канала (null — подписки нет) */
  unsubscribe: (() => void) | null;

  // --- Actions ---
  setTasks: (tasks: Task[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  /** Создание задачи через сервис (realtime сам обновит список) */
  addTask: (task: NewTask) => Promise<void>;
  /** Смена статуса с оптимистичным обновлением и откатом при ошибке */
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  /** Удаление с оптимистичным обновлением и откатом при ошибке */
  deleteTask: (taskId: string) => Promise<void>;

  /** Загрузка задач + подписка на realtime для семьи */
  subscribeToFamilyTasks: (familyId: string) => Promise<void>;
  /** Отписка (вызывается при размонтировании страницы / смене семьи) */
  unsubscribeFromTasks: () => void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  unsubscribe: null,

  setTasks: (tasks) => set({ tasks }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  addTask: async (task) => {
    try {
      await tasksService.createTask(task);
      // Список придёт через realtime-событие insert
    } catch (err) {
      console.error('Ошибка создания задачи:', err);
      set({ error: 'Не удалось создать задачу. Попробуйте ещё раз.' });
    }
  },

  updateTaskStatus: async (taskId, status) => {
    // Оптимистично меняем статус в локальном состоянии
    const prev = get().tasks;
    set({ tasks: prev.map((t) => (t.id === taskId ? { ...t, status } : t)) });
    try {
      await tasksService.updateTaskStatus(taskId, status);
    } catch (err) {
      console.error('Ошибка обновления статуса:', err);
      set({ tasks: prev, error: 'Не удалось изменить статус задачи.' }); // откат
    }
  },

  deleteTask: async (taskId) => {
    const prev = get().tasks;
    set({ tasks: prev.filter((t) => t.id !== taskId) });
    try {
      await tasksService.deleteTask(taskId);
    } catch (err) {
      console.error('Ошибка удаления задачи:', err);
      set({ tasks: prev, error: 'Не удалось удалить задачу.' }); // откат
    }
  },

  subscribeToFamilyTasks: async (familyId) => {
    // Отписываемся от предыдущей подписки, если она была
    get().unsubscribe?.();
    set({ isLoading: true, error: null });

    try {
      // 1. Начальная загрузка
      const tasks = await tasksService.getTasksByFamily(familyId);
      set({ tasks, isLoading: false });

      // 2. Realtime: любое изменение в tasks семьи → перезагрузка списка
      const unsubscribeFn = tasksService.subscribeToTasks(familyId, (newTasks) => {
        set({ tasks: newTasks });
      });
      set({ unsubscribe: unsubscribeFn });
    } catch (err) {
      console.error('Ошибка подписки на задачи:', err);
      set({ error: 'Не удалось загрузить задачи. Проверьте подключение.', isLoading: false });
    }
  },

  unsubscribeFromTasks: () => {
    get().unsubscribe?.();
    set({ unsubscribe: null });
  },
}));
