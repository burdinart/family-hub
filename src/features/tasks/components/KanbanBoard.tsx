// src/features/tasks/components/KanbanBoard.tsx — доска задач по статусам.
// Mobile-first: на телефонах колонки идут вертикально (grid-cols-1),
// на планшетах/десктопе — три колонки. Кнопка «→» переводит задачу в следующую
// колонку (todo → doing → done), «В работу» возвращает из done в doing.

import { ArrowRight } from 'lucide-react';
import type { Task, TaskStatus } from '@/types';
import { useTasksStore } from '../store/tasksStore';
import { TaskCard } from './TaskCard';

interface KanbanBoardProps {
  tasks: Task[];
}

/** Описание колонок доски */
const COLUMNS: ReadonlyArray<{ status: TaskStatus; title: string; dot: string }> = [
  { status: 'todo', title: 'Сделать', dot: 'bg-blue-500' },
  { status: 'doing', title: 'В процессе', dot: 'bg-yellow-500' },
  { status: 'done', title: 'Готово', dot: 'bg-green-500' },
];

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  const updateTaskStatus = useTasksStore((s) => s.updateTaskStatus);

  // Следующий статус по потоку доски: todo -> doing -> done (для done — возврат в doing)
  const nextStatus = (status: TaskStatus): TaskStatus =>
    status === 'todo' ? 'doing' : 'done';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="rounded-lg bg-gray-50 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-700">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              {col.title} ({columnTasks.length})
            </h3>

            <div className="space-y-2">
              {columnTasks.map((task) => (
                <div key={task.id}>
                  <TaskCard task={task} />
                  {/* Перевод задачи в следующую колонку — крупная тач-кнопка */}
                  <button
                    onClick={() => void updateTaskStatus(task.id, nextStatus(task.status))}
                    className="mt-1 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:bg-white hover:text-gray-700"
                  >
                    {task.status === 'done' ? (
                      'Вернуть в работу'
                    ) : (
                      <>
                        {task.status === 'todo' ? 'В работу' : 'Завершить'}
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              ))}

              {columnTasks.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">Нет задач</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
