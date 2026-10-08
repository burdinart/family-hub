// src/features/schedule/components/ScheduleModal.tsx — модалка создания/редактирования занятия.
// Mobile-first: bottom-sheet на телефонах, карточка по центру на десктопе.
// Ошибки показываем внутри формы (не alert), сохранение — через store (realtime обновит всех).

import { useState } from 'react';
import type { FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useScheduleStore } from '../store/scheduleStore';
import type { Schedule, ScheduleColor } from '@/types';

interface ScheduleModalProps {
  familyId: string;
  /** Если передано — режим редактирования, иначе — создание */
  editing?: Schedule | null;
  onClose: () => void;
}

/** Дни недели: 1=Пн ... 7=Вс (совпадает с CHECK day_of_week в БД) */
const DAYS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
  { value: 7, label: 'Воскресенье' },
];

/** Палитра цветов занятия (типизирована по ScheduleColor — никаких any) */
const COLORS: ReadonlyArray<{ value: ScheduleColor; label: string; dot: string }> = [
  { value: 'blue', label: 'Синий', dot: 'bg-blue-500' },
  { value: 'green', label: 'Зелёный', dot: 'bg-green-500' },
  { value: 'red', label: 'Красный', dot: 'bg-red-500' },
  { value: 'yellow', label: 'Жёлтый', dot: 'bg-yellow-500' },
  { value: 'purple', label: 'Фиолетовый', dot: 'bg-purple-500' },
  { value: 'pink', label: 'Розовый', dot: 'bg-pink-500' },
];

/** "HH:mm:ss" (Postgres time) -> "HH:mm" для <input type="time"> */
function toInputTime(time: string): string {
  return time.slice(0, 5);
}

export function ScheduleModal({ familyId, editing = null, onClose }: ScheduleModalProps) {
  const profile = useAuthStore((s) => s.user);
  const addSchedule = useScheduleStore((s) => s.addSchedule);
  const updateSchedule = useScheduleStore((s) => s.updateSchedule);

  const isEdit = editing !== null;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [dayOfWeek, setDayOfWeek] = useState<number>(editing?.day_of_week ?? 1);
  const [startTime, setStartTime] = useState(editing ? toInputTime(editing.start_time) : '14:00');
  const [endTime, setEndTime] = useState(editing ? toInputTime(editing.end_time) : '15:00');
  const [participantId, setParticipantId] = useState<string>(editing?.participant_id ?? profile?.id ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [color, setColor] = useState<ScheduleColor>(editing?.color ?? 'blue');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Введите название занятия.');
      return;
    }
    // Валидация времени: конец должен быть позже начала
    if (endTime <= startTime) {
      setError('Время окончания должно быть позже начала.');
      return;
    }
    if (!profile) {
      setError('Профиль не найден — войдите заново.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Postgres time принимает "HH:mm" и "HH:mm:ss" — отправляем HH:mm:ss
      const payload = {
        title: title.trim(),
        day_of_week: dayOfWeek,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        // Пустая строка в select = «занятие без привязки к участнику»
        participant_id: participantId || null,
        location: location.trim() || null,
        color,
      };

      if (isEdit && editing) {
        await updateSchedule(editing.id, payload);
      } else {
        await addSchedule({
          family_id: familyId,
          created_by: profile.id,
          ...payload,
        });
      }
      onClose();
    } catch (err) {
      console.error('Ошибка сохранения занятия:', err);
      setError(isEdit ? 'Не удалось обновить занятие.' : 'Не удалось создать занятие.');
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
      {/* На мобильных — bottom-sheet снизу, на десктопе — карточка по центру со скроллом */}
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Редактировать занятие' : 'Новое занятие'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2 hover:bg-gray-100 active:bg-gray-200"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Название */}
          <div>
            <label htmlFor="sched-title" className="mb-1 block text-sm font-medium text-gray-700">
              Название занятия *
            </label>
            <input
              id="sched-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Например: Футбол"
              autoFocus
              maxLength={120}
            />
          </div>

          {/* День недели */}
          <div>
            <label htmlFor="sched-day" className="mb-1 block text-sm font-medium text-gray-700">
              День недели *
            </label>
            <select
              id="sched-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          {/* Время начала/окончания */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sched-start" className="mb-1 block text-sm font-medium text-gray-700">
                Начало *
              </label>
              <input
                id="sched-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="sched-end" className="mb-1 block text-sm font-medium text-gray-700">
                Окончание *
              </label>
              <input
                id="sched-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Участник: «я» по умолчанию, можно отвязать (для всей семьи) */}
          <div>
            <label htmlFor="sched-participant" className="mb-1 block text-sm font-medium text-gray-700">
              Участник
            </label>
            <select
              id="sched-participant"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Вся семья</option>
              {profile && <option value={profile.id}>{profile.full_name || profile.email}</option>}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Для других участников выберите их из списка после добавления профилей семьи.
            </p>
          </div>

          {/* Место */}
          <div>
            <label htmlFor="sched-location" className="mb-1 block text-sm font-medium text-gray-700">
              Место
            </label>
            <input
              id="sched-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Например: Спортшкола №5"
              maxLength={120}
            />
          </div>

          {/* Цвет */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Цвет</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  aria-label={c.label}
                  className={`h-10 w-10 rounded-full ${c.dot} ${
                    color === c.value ? 'ring-2 ring-gray-400 ring-offset-2' : 'opacity-70'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Ошибка формы */}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Кнопки: крупные тач-зоны min-h-[44px] */}
          <div className="flex gap-2 pt-2 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
