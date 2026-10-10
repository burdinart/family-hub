// src/features/tasks/services/tasksService.ts — сервис данных модуля «Задачи».
// Единственная точка обращения к таблице tasks (Supabase). Компоненты и store
// не пишут запросы напрямую. Realtime-подписка: при любом изменении строки
// задачи семьи перезагружаем полный список (просто и надёжно для небольшого объёма).

import { supabase } from '@/config/supabase';
import type { Task, TaskAssignee, TaskPriority, TaskStatus } from '@/types';

/**
 * Payload для создания задачи (id/created_at генерирует БД).
 * assignee — виртуальное поле из join, в insert не попадает.
 */
export type NewTask = Omit<Task, 'id' | 'created_at' | 'assignee'>;

/**
 * Приведение строки БД к доменному Task без any: unknown + явные поля.
 * Поле `assignee` появляется, если запрос использовал embed
 * (`assignee:assignee_id ( id, full_name, avatar_url )`).
 */
function toTask(row: Record<string, unknown>): Task {
  // Embed может прийти объектом (many-to-one через FK) или массивом объектов —
  // нормализуем оба варианта к первому элементу.
  const rawAssignee = row.assignee;
  let assignee: TaskAssignee | null = null;
  if (rawAssignee && typeof rawAssignee === 'object') {
    const obj = Array.isArray(rawAssignee) ? rawAssignee[0] : rawAssignee;
    if (obj && typeof obj === 'object' && 'id' in obj) {
      const o = obj as Record<string, unknown>;
      assignee = {
        id: String(o.id),
        full_name: String(o.full_name ?? ''),
        avatar_url: (o.avatar_url as string | null) ?? null,
      };
    }
  }

  return {
    id: String(row.id),
    family_id: String(row.family_id),
    title: String(row.title),
    assignee_id: (row.assignee_id as string | null) ?? null,
    assignee,
    status: String(row.status ?? 'todo') as TaskStatus,
    due_date: (row.due_date as string | null) ?? null,
    priority: String(row.priority ?? 'medium') as TaskPriority,
    category: String(row.category ?? 'other'),
    created_by: String(row.created_by),
    created_at: String(row.created_at ?? ''),
  };
}

export const tasksService = {
  /** Подписка на изменения таблицы tasks данной семьи. Возвращает функцию отписки. */
  subscribeToTasks(familyId: string, callback: (tasks: Task[]) => void): () => void {
    const channel = supabase
      .channel(`tasks-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // insert / update / delete
          schema: 'public',
          table: 'tasks',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          // Перезагружаем данные при любом изменении (источник истины — БД)
          this.getTasksByFamily(familyId)
            .then(callback)
            .catch(console.error);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  /**
   * Все задачи семьи (свежие — сверху) вместе с карточками исполнителей.
   * Embed `assignee:assignee_id (...)` работает потому, что в БД есть FK
   * tasks.assignee_id → auth.users, а profiles.id — тот же uuid, что и auth.users.id.
   * Если embed недоступен (старая схема), откатываемся на обычный select('*'):
   * карточки задач тогда покажут имя из кэша членов семьи (fallback в TaskCard).
   */
  async getTasksByFamily(familyId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(
        `*,
         assignee:assignee_id ( id, full_name, avatar_url )`,
      )
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Embed assignee недоступен, загружаем задачи без него:', error.message);
      const fallback = await supabase
        .from('tasks')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => toTask(row as Record<string, unknown>));
    }

    return (data ?? []).map((row) => toTask(row as Record<string, unknown>));
  },

  /** Смена исполнителя задачи (null — снять назначение) */
  async updateTaskAssignee(taskId: string, assigneeId: string | null): Promise<void> {
    const { error } = await supabase.from('tasks').update({ assignee_id: assigneeId }).eq('id', taskId);
    if (error) throw error;
  },

  /** Создание задачи; возвращает созданную строку */
  async createTask(task: NewTask): Promise<Task> {
    const { data, error } = await supabase.from('tasks').insert([task]).select().single();

    if (error) throw error;
    return toTask(data as Record<string, unknown>);
  },

  /** Обновление статуса задачи */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
    if (error) throw error;
  },

  /** Удаление задачи */
  async deleteTask(taskId: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
  },
};
