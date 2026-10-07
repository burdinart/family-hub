// src/features/tasks/components/CreateTaskModal.tsx — модальное окно создания задачи.
// Mobile-first: крупные тач-зоны, bottom-sheet на телефонах. Ошибки показываем
// внутри модалки (не alert), создание — через store (addTask).

import { useState } from 'react';
import type { FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTasksStore } from '../store/tasksStore';
import type { TaskPriority } from '@/types';

interface CreateTaskModalProps {
  familyId: string;
  onClose: () => void;
}

/** Конфигурация кнопок приоритета (typo-safe: Record по TaskPriority) */
const PRIORITY_OPTIONS: ReadonlyArray<{ value: TaskPriority; label: string; active: string }> = [
  { value: 'low', label: 'Низкий', active: 'bg-green-100 border-green-500 text-green-700' },
  { value: 'medium', label: 'Средний', active: 'bg-yellow-100 border-yellow-500 text-yellow-700' },
  { value: 'high', label: 'Высокий', active: 'bg-red-100 border-red-500 text-red-700' },
];

export function CreateTaskModal({ familyId, onClose }: CreateTaskModalProps) {
  const profile = useAuthStore((s) => s.user);
  const addTask = useTasksStore((s) => s.addTask);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !profile?.family_id) {
      setError(!profile?.family_id ? 'Вы ещё не состоите в семье.' : 'Введите название задачи.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Создаём задачу от имени текущего профиля; assignee — сам пользователь
      await addTask({
        family_id: familyId,
        title: title.trim(),
        status: 'todo',
        priority,
        due_date: dueDate || null,
        category: 'general',
        assignee_id: profile.id,
        created_by: profile.id,
      });
      onClose();
    } catch (err) {
      console.error('Ошибка при создании задачи:', err);
      setError('Не удалось создать задачу. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Overlay: закрываемся по клику на затемнение
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* На мобильных — bottom-sheet (снизу), на десктопе — карточка по центру */}
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Новая задача</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2 hover:bg-gray-100 active:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-gray-700">
              Название задачи *
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Что нужно сделать?"
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Приоритет</span>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  aria-pressed={priority === p.value}
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    priority === p.value
                      ? p.active
                      : 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="task-due" className="mb-1 block text-sm font-medium text-gray-700">
              Дедлайн
            </label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Сообщение об ошибке прямо в форме */}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isSubmitting ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
