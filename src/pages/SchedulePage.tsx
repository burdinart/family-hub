// src/pages/SchedulePage.tsx — раздел «Расписание»: недельная сетка регулярных занятий семьи
// с realtime-синхронизацией. При входе подписываемся на таблицу schedule (store),
// при выходе — отписываемся. Состояния: нет семьи / загрузка / ошибка / контент.

import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, Plus, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useScheduleStore } from '@/features/schedule/store/scheduleStore';
import { WeeklySchedule } from '@/features/schedule/components/WeeklySchedule';
import { ScheduleModal } from '@/features/schedule/components/ScheduleModal';
import type { Schedule } from '@/types';

export function SchedulePage() {
  // id семьи берём из профиля (family_id); подписка отвязана от ререндеров
  const familyId = useAuthStore((s) => s.user?.family_id ?? null);
  const schedule = useScheduleStore((s) => s.schedule);
  const isLoading = useScheduleStore((s) => s.isLoading);
  const error = useScheduleStore((s) => s.error);
  const subscribeToFamilySchedule = useScheduleStore((s) => s.subscribeToFamilySchedule);
  const unsubscribeFromSchedule = useScheduleStore((s) => s.unsubscribeFromSchedule);

  const [showModal, setShowModal] = useState(false);
  // Какое занятие редактируем (null = создание нового)
  const [editing, setEditing] = useState<Schedule | null>(null);

  useEffect(() => {
    if (familyId) {
      void subscribeToFamilySchedule(familyId);
    }
    // Отписка при размонтировании страницы или смене семьи
    return () => {
      unsubscribeFromSchedule();
    };
  }, [familyId, subscribeToFamilySchedule, unsubscribeFromSchedule]);

  // Семья не найдена — просим пройти онбординг
  if (!familyId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Users className="text-gray-400" size={48} />
        <p className="text-lg font-medium text-gray-700">Вы ещё не состоите в семье</p>
        <p className="text-sm text-gray-500">
          Создайте семью или присоединитесь по приглашению, чтобы вести общее расписание.
        </p>
      </div>
    );
  }

  // Начальная загрузка списка
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
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <CalendarDays size={24} className="text-blue-600" />
          Расписание
        </h1>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 active:bg-blue-800"
        >
          <Plus size={20} />
          Новое занятие
        </button>
      </div>

      {/* Ошибка загрузки/подписки — баннер с кнопкой повтора */}
      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => void subscribeToFamilySchedule(familyId)}
            className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      )}

      <WeeklySchedule
        schedule={schedule}
        onEdit={(item) => {
          setEditing(item);
          setShowModal(true);
        }}
      />

      {showModal && (
        <ScheduleModal
          familyId={familyId}
          editing={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
