// src/pages/TasksPage.tsx — раздел «Задачи»: Kanban-доска семьи с realtime-синхронизацией.
// При входе подписываемся на задачи семьи (store), при выходе — отписываемся.

import { useEffect, useState } from 'react';
import { Plus, Loader2, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTasksStore } from '@/features/tasks/store/tasksStore';
import { KanbanBoard } from '@/features/tasks/components/KanbanBoard';
import { CreateTaskModal } from '@/features/tasks/components/CreateTaskModal';

export function TasksPage() {
  // id семьи берём из профиля (family_id); подписка отвязана от ререндеров
  const familyId = useAuthStore((s) => s.user?.family_id ?? null);
  const tasks = useTasksStore((s) => s.tasks);
  const isLoading = useTasksStore((s) => s.isLoading);
  const error = useTasksStore((s) => s.error);
  const subscribeToFamilyTasks = useTasksStore((s) => s.subscribeToFamilyTasks);
  const unsubscribeFromTasks = useTasksStore((s) => s.unsubscribeFromTasks);

  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (familyId) {
      void subscribeToFamilyTasks(familyId);
    }
    // Отписка при размонтировании страницы или смене семьи
    return () => {
      unsubscribeFromTasks();
    };
  }, [familyId, subscribeToFamilyTasks, unsubscribeFromTasks]);

  // Семья не найдена — просим пройти онбординг
  if (!familyId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Users className="text-gray-400" size={48} />
        <p className="text-lg font-medium text-gray-700">Вы ещё не состоите в семье</p>
        <p className="text-sm text-gray-500">
          Создайте семью или присоединитесь по приглашению, чтобы вести общие задачи.
        </p>
      </div>
    );
  }

  // Состояние загрузки списка
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 active:bg-blue-800"
        >
          <Plus size={20} />
          Новая задача
        </button>
      </div>

      {/* Ошибка загрузки/подписки — баннер с кнопкой повтора */}
      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => void subscribeToFamilyTasks(familyId)}
            className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      )}

      <KanbanBoard tasks={tasks} />

      {showCreateModal && (
        <CreateTaskModal familyId={familyId} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
