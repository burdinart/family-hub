// src/features/tasks/components/KanbanBoard.tsx — доска задач по статусам.
// Адаптивность по ТЗ:
//  - мобильные (<640px): одна колонка, карточки на всю ширину;
//  - планшеты (sm–lg): сетка 2 колонки;
//  - десктоп (≥1024px): 3 колонки с минимальной шириной каждой и
//    горизонтальным скроллом контейнера, если не помещаются.
// Кнопка под карточкой переводит задачу в следующую колонку (todo → doing → done).

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
    <div className="overflow-x-auto pb-2">
      {/* min-w-0 у колонок важен: без него flex/grid-дети не умеют сжиматься и текст обрезается */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-row lg:items-start lg:gap-6">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              // На десктопном flex-режиме — фиксированная доля + минимум 300px
              className="min-w-0 rounded-xl bg-gray-50 p-4 lg:w-1/3 lg:min-w-[300px] lg:flex-shrink-0"
            >
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-700">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                {col.title} ({columnTasks.length})
              </h3>

              <div className="space-y-3">
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
    </div>
  );
}
