// src/features/tasks/components/TaskCard.tsx — карточка одной задачи.
// Все мутации идут через store (оптимистичное обновление + realtime-синхронизация).
// Mobile-first: крупные тач-зоны (min 44px), подтверждение удаления — confirm().
// Исполнитель: аватар+имя из embed task.assignee; если embed нет (старая схема) —
// fallback по имени из кэша членов семьи (familyMembersStore). Смена исполнителя —
// прямо в карточке через нативный select (мобильный пикер).

import { useEffect } from 'react';
import { CalendarDays, CheckCircle2, Circle, Trash2, UserRound } from 'lucide-react';
import type { Task, TaskPriority } from '@/types';
import { useTasksStore } from '../store/tasksStore';
import { useFamilyMembersStore } from '@/store/familyMembersStore';

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

/** Круглый аватар исполнителя (или первая буква имени / иконка пользователя) */
function AssigneeAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        loading="lazy"
        className="h-5 w-5 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  if (name) {
    return (
      <span
        aria-hidden="true"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-gray-600"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <UserRound size={16} className="flex-shrink-0 text-gray-400" aria-hidden="true" />;
}

export function TaskCard({ task }: TaskCardProps) {
  const updateTaskStatus = useTasksStore((s) => s.updateTaskStatus);
  const updateTaskAssignee = useTasksStore((s) => s.updateTaskAssignee);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  // Кэш членов семьи — источник имён для fallback (если embed assignee недоступен)
  const members = useFamilyMembersStore((s) => s.members);
  const loadMembers = useFamilyMembersStore((s) => s.load);

  const isDone = task.status === 'done';

  // Убеждаемся, что список членов семьи загружен (store сам сбросит флаг при смене семьи)
  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Имя исполнителя: сначала embed из БД, иначе — из кэша членов семьи по id
  const assigneeName = task.assignee?.full_name || '';
  const fallbackName = task.assignee_id
    ? members.find((m) => m.id === task.assignee_id)?.full_name ?? ''
    : '';
  const displayName = assigneeName || fallbackName;

  // Отметка о выполнении: done <-> todo (для «В процессе» есть кнопка в Kanban)
  const handleStatusToggle = () => {
    void updateTaskStatus(task.id, isDone ? 'todo' : 'done');
  };

  const handleAssigneeChange = (value: string) => {
    // '' — «Не назначен» → null в БД
    void updateTaskAssignee(task.id, value || null);
  };

  const handleDelete = () => {
    if (!window.confirm('Удалить задачу?')) return;
    void deleteTask(task.id);
  };

  return (
    // overflow-hidden + break-words гарантируют, что длинное слово не «пробьёт» карточку
    <div
      className={`min-h-[80px] overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${
        isDone ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Кнопка переключения статуса — крупная тач-зона, но компактнее (40px) */}
        <button
          onClick={handleStatusToggle}
          aria-label={isDone ? 'Вернуть в активные' : 'Отметить выполненной'}
          className="flex min-h-[40px] min-w-[40px] flex-shrink-0 items-center justify-center rounded-full hover:bg-gray-50 active:bg-gray-100"
        >
          {isDone ? (
            <CheckCircle2 className="text-green-600" size={22} />
          ) : (
            <Circle className="text-gray-400" size={22} />
          )}
        </button>

        {/* min-w-0 — ключ к переносу текста внутри flex: без него строка не сжимается */}
        <div className="min-w-0 flex-1">
          {/* Название: 16px, font-medium, leading-snug, перенос по словам И по символам */}
          <h3
            className={`break-words text-base font-medium leading-snug [overflow-wrap:anywhere] ${
              isDone ? 'text-gray-500 line-through' : 'text-gray-900'
            }`}
          >
            {task.title}
          </h3>

          {/* Мета-информация: flex-wrap позволяет бейджам переходить на новую строку */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}
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

          {/* Исполнитель: аватар + имя, смена — нативным select (мобильный пикер).
              stopPropagation не нужен: внутри карточки нет клика по всей площади. */}
          <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
            <AssigneeAvatar name={displayName} avatarUrl={task.assignee?.avatar_url ?? null} />
            <select
              value={task.assignee_id ?? ''}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              aria-label="Исполнитель задачи"
              className="-ml-1 min-h-[32px] max-w-full cursor-pointer truncate rounded bg-transparent px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Не назначен</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || 'Без имени'}
                </option>
              ))}
              {/* Если текущий исполнитель не в списке (вышел из семьи) — показываем его id-метку */}
              {task.assignee_id && !members.some((m) => m.id === task.assignee_id) && (
                <option value={task.assignee_id}>{displayName || 'Бывший участник'}</option>
              )}
            </select>
          </div>
        </div>

        {/* Компактная кнопка удаления (36px зона) — экономит место для текста */}
        <button
          onClick={handleDelete}
          aria-label="Удалить задачу"
          className="flex min-h-[36px] min-w-[36px] flex-shrink-0 items-center justify-center self-stretch rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
