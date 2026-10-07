// src/features/tasks/services/tasksService.ts — сервис данных модуля «Задачи».
// Единственная точка обращения к таблице tasks (Supabase). Компоненты и store
// не пишут запросы напрямую. Realtime-подписка: при любом изменении строки
// задачи семьи перезагружаем полный список (просто и надёжно для небольшого объёма).

import { supabase } from '@/config/supabase';
import type { Task, TaskPriority, TaskStatus } from '@/types';

/** Payload для создания задачи (id/created_at генерирует БД) */
export type NewTask = Omit<Task, 'id' | 'created_at'>;

/** Приведение строки БД к доменному Task без any: unknown + явные поля */
function toTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    title: String(row.title),
    assignee_id: (row.assignee_id as string | null) ?? null,
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

  /** Все задачи семьи (свежие — сверху) */
  async getTasksByFamily(familyId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toTask);
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
