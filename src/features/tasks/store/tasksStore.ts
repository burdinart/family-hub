// src/features/tasks/store/tasksStore.ts — Zustand store модуля «Задачи».
// Хранит список задач текущей семьи + статусы загрузки/ошибки + realtime-подписку.
// Оптимистичные обновления (UI меняется сразу), затем realtime из БД приводит
// состояние к истинному значению на всех устройствах семьи.

import { create } from 'zustand';
import { tasksService, type NewTask } from '../services/tasksService';
import { getTaskPoints, ratingsService } from '@/features/ratings/services/ratingsService';
import { useAuthStore } from '@/store/authStore';
import {
  createNotification,
  getOtherFamilyMembers,
} from '@/services/notificationHelper';
import type { Task, TaskStatus } from '@/types';

/**
 * Начислить баллы за действие, если пользователь состоит в семье.
 * Ошибку не пробрасываем в UI основного действия (задача уже сохранена) —
 * только логируем: рейтинг со временем синхронизируется realtime-подпиской.
 */
async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  category: 'task' | 'task_create' | 'shopping' | 'document',
  referenceId: string | null,
): Promise<void> {
  const familyId = useAuthStore.getState().user?.family_id;
  if (!familyId || points === 0) return;
  try {
    await ratingsService.addPoints(familyId, userId, points, reason, category, referenceId);
  } catch (err) {
    console.error('Не удалось начислить баллы:', err);
  }
}

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
  /** Смена исполнителя (null — «Не назначен») с оптимистичным обновлением */
  updateTaskAssignee: (taskId: string, assigneeId: string | null) => Promise<void>;
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
      const created = await tasksService.createTask(task);
      // Геймификация: +1 за создание задачи автору.
      // Если задача делегирована другому члену семьи — это «делегирование»,
      // баллы всё равно получает создатель (category 'task_create').
      const me = useAuthStore.getState().user;
      if (me && created.created_by === me.id) {
        const delegated = Boolean(created.assignee_id && created.assignee_id !== me.id);
        const reason = delegated
          ? `Делегирована задача: ${created.title}`
          : `Создана задача: ${created.title}`;
        await awardPoints(me.id, 1, reason, 'task_create', created.id);

        // Уведомления (не уведомляем автора действия — правило проекта):
        // - есть исполнитель-другой участник → пушим только ему («назначил вам»);
        // - исполнитель не назначен → пушим всем остальным членам семьи.
        if (delegated && created.assignee_id) {
          await createNotification({
            familyId: created.family_id,
            userId: created.assignee_id,
            senderId: me.id,
            title: '📋 Новая задача',
            body: `${me.full_name ?? 'Кто-то'} назначил вам: «${created.title}»`,
            type: 'task',
            referenceId: created.id,
            referenceType: 'task',
          });
        } else if (!created.assignee_id) {
          const others = await getOtherFamilyMembers(created.family_id, me.id);
          for (const member of others) {
            await createNotification({
              familyId: created.family_id,
              userId: member.id,
              senderId: me.id,
              title: '📋 Новая задача в семье',
              body: `${me.full_name ?? 'Кто-то'} создал(а) задачу: «${created.title}»`,
              type: 'task',
              referenceId: created.id,
              referenceType: 'task',
            });
          }
        }
      }
      // Список придёт через realtime-событие insert
    } catch (err) {
      console.error('Ошибка создания задачи:', err);
      set({ error: 'Не удалось создать задачу. Попробуйте ещё раз.' });
    }
  },

  updateTaskAssignee: async (taskId, assigneeId) => {
    // Оптимистично меняем исполнителя в локальном списке
    const prev = get().tasks;
    set({
      tasks: prev.map((t) =>
        t.id === taskId ? { ...t, assignee_id: assigneeId, assignee: null } : t,
      ),
    });
    try {
      await tasksService.updateTaskAssignee(taskId, assigneeId);
      // Полные данные исполнителя (embed имени/аватара) придут через
      // realtime-событие update — оно перезагрузит список с join.
    } catch (err) {
      console.error('Ошибка смены исполнителя:', err);
      set({ tasks: prev, error: 'Не удалось изменить исполнителя.' }); // откат
    }
  },

  updateTaskStatus: async (taskId, status) => {
    // Оптимистично меняем статус в локальном состоянии
    const prev = get().tasks;
    const task = prev.find((t) => t.id === taskId);
    const oldStatus = task?.status;
    set({ tasks: prev.map((t) => (t.id === taskId ? { ...t, status } : t)) });
    try {
      await tasksService.updateTaskStatus(taskId, status);

      // Геймификация: начисляем баллы только при первом переводе в 'done'
      // (повторные клики/откаты не должны фармить очки).
      if (task && status === 'done' && oldStatus !== 'done') {
        // «В срок» — если срок сегодня или позже либо у задачи нет даты
        const isOnTime = task.due_date ? new Date(`${task.due_date}T23:59:59`) >= new Date() : true;
        const points = getTaskPoints(task.priority, isOnTime);
        const reason = `Выполнена задача: ${task.title}${isOnTime ? ' (в срок)' : ''}`;
        // Баллы получает исполнитель (assignee), а если назначенного нет — тот, кто закрыл
        const me = useAuthStore.getState().user;
        const winnerId = task.assignee_id ?? me?.id ?? null;
        if (winnerId) {
          await awardPoints(winnerId, points, reason, 'task', task.id);
        }

        // Уведомление: автора задачи информируем о выполнении (если закрыл НЕ автор).
        // Себя-автора действия не уведомляем — правило проекта.
        if (me && task.created_by && task.created_by !== me.id) {
          await createNotification({
            familyId: task.family_id,
            userId: task.created_by,
            senderId: me.id,
            title: '✅ Задача выполнена',
            body: `${me.full_name ?? 'Кто-то'} выполнил(а): «${task.title}»`,
            type: 'task',
            referenceId: task.id,
            referenceType: 'task',
          });
        }
      }
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
