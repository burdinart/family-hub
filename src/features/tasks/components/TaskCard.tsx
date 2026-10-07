// src/features/tasks/components/TaskCard.tsx — карточка одной задачи.
// Все мутации идут через store (оптимистичное обновление + realtime-синхронизация).
// Mobile-first: крупные тач-зоны (min 44px), подтверждение удаления — confirm().

import { CalendarDays, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import type { Task, TaskPriority } from '@/types';
import { useTasksStore } from '../store/tasksStore';

interface TaskCardProps {
  task: Task;
}

/** Цвета бейджа приоритета по всем значениям TaskPriority (проверяется типом) */
const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-green-100 text-green-700 border-green-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  high: 'bg-red-100 text-red-700 border-red-300',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

export function TaskCard({ task }: TaskCardProps) {
  const updateTaskStatus = useTasksStore((s) => s.updateTaskStatus);
  const deleteTask = useTasksStore((s) => s.deleteTask);

  const isDone = task.status === 'done';

  // Отметка о выполнении: done <-> todo (для «В процессе» есть кнопка в Kanban)
  const handleStatusToggle = () => {
    void updateTaskStatus(task.id, isDone ? 'todo' : 'done');
  };

  const handleDelete = () => {
    if (!window.confirm('Удалить задачу?')) return;
    void deleteTask(task.id);
  };

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-opacity ${
        isDone ? 'border-gray-200 opacity-60' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Кнопка переключения статуса — крупная, не менее 44px по тач-зоне */}
        <button
          onClick={handleStatusToggle}
          aria-label={isDone ? 'Вернуть в активные' : 'Отметить выполненной'}
          className="-m-1 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full hover:bg-gray-50 active:bg-gray-100"
        >
          {isDone ? (
            <CheckCircle2 className="text-green-600" size={24} />
          ) : (
            <Circle className="text-gray-400" size={24} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h3 className={`font-medium ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
            {task.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-2 py-1 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>

            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <CalendarDays size={12} />
                {new Date(`${task.due_date}T00:00:00`).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleDelete}
          aria-label="Удалить задачу"
          className="-m-1 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
