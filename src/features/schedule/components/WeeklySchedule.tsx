// src/features/schedule/components/WeeklySchedule.tsx — недельное расписание семьи.
// Mobile-first: на телефонах — список по дням (не нужно зумить таблицу),
// на md+ — сетка «время × дни» с горизонтальным скроллом для узких экранов.
// Действия (редактирование/удаление) идут через store — realtime обновит все устройства.

import { CalendarDays, Clock, MapPin, Pencil, Trash2, User } from 'lucide-react';
import type { Schedule, ScheduleColor } from '@/types';
import { useScheduleStore } from '../store/scheduleStore';

interface WeeklyScheduleProps {
  schedule: Schedule[];
  /** Открыть модалку редактирования конкретного занятия */
  onEdit: (schedule: Schedule) => void;
}

/** Подписи дней: индекс 0 = Пн ... индекс 6 = Вс (в БД day_of_week: 1=Пн..7=Вс) */
const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/** Цветовые стили карточки занятия по всем значениям ScheduleColor (проверяется типом) */
const COLOR_STYLE: Record<ScheduleColor, string> = {
  blue: 'bg-blue-100 border-blue-300 text-blue-900',
  green: 'bg-green-100 border-green-300 text-green-900',
  red: 'bg-red-100 border-red-300 text-red-900',
  yellow: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  purple: 'bg-purple-100 border-purple-300 text-purple-900',
  pink: 'bg-pink-100 border-pink-300 text-pink-900',
};

/** "HH:mm:ss" -> "HH:mm" для отображения */
function fmtTime(time: string): string {
  return time.slice(0, 5);
}

/** Одна карточка занятия (используется и в мобильном списке, и в десктоп-сетке) */
function ScheduleItem({ item, onEdit }: { item: Schedule; onEdit: (s: Schedule) => void }) {
  const deleteSchedule = useScheduleStore((s) => s.deleteSchedule);

  const handleDelete = () => {
    if (!window.confirm('Удалить занятие?')) return;
    void deleteSchedule(item.id);
  };

  return (
    <div
      className={`relative min-w-0 rounded-lg border p-2 pr-8 text-xs ${COLOR_STYLE[item.color]}`}
    >
      {/* Название: перенос по словам и символам, без обрезки */}
      <div className="break-words font-medium leading-snug [overflow-wrap:anywhere]">
        {item.title}
      </div>

      <div className="mt-1 flex items-center gap-1 opacity-80">
        <Clock size={10} />
        {fmtTime(item.start_time)}–{fmtTime(item.end_time)}
      </div>

      {item.location && (
        <div className="mt-0.5 flex items-start gap-1 opacity-80">
          <MapPin size={10} className="mt-0.5 shrink-0" />
          <span className="break-words [overflow-wrap:anywhere]">{item.location}</span>
        </div>
      )}

      {item.participant_id && (
        <div className="mt-0.5 flex items-center gap-1 opacity-80">
          <User size={10} />
          участник
        </div>
      )}

      {/* Действия: компактная колонка справа (редактировать / удалить) */}
      <div className="absolute top-1 right-1 flex flex-col">
        <button
          onClick={() => onEdit(item)}
          aria-label="Редактировать занятие"
          className="rounded p-1 hover:bg-white/60 active:bg-white/80"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={handleDelete}
          aria-label="Удалить занятие"
          className="rounded p-1 hover:bg-white/60 active:bg-white/80"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export function WeeklySchedule({ schedule, onEdit }: WeeklyScheduleProps) {
  // Занятий пока нет — показываем понятный empty state вместо пустой таблицы
  if (schedule.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <CalendarDays size={40} className="text-gray-400" />
        <p className="font-medium text-gray-700">Расписание пока пустое</p>
        <p className="text-sm text-gray-500">
          Добавьте первое регулярное занятие — например, секцию или кружок. Оно появится у всех
          членов семьи мгновенно.
        </p>
      </div>
    );
  }

  // Диапазон часов: от самого раннего начала до самого позднего окончания (мин 8:00–21:00)
  const hours = schedule.reduce<{ min: number; max: number }>(
    (acc, s) => {
      const start = parseInt(s.start_time.slice(0, 2), 10);
      const end = parseInt(s.end_time.slice(0, 2), 10);
      return { min: Math.min(acc.min, start), max: Math.max(acc.max, isNaN(end) ? acc.max : end) };
    },
    { min: 8, max: 20 },
  );
  const hourList: number[] = [];
  for (let h = hours.min; h <= hours.max; h += 1) hourList.push(h);

  /** Занятия, начинающиеся в указанный час выбранного дня */
  const itemsForDayHour = (day: number, hour: number): Schedule[] =>
    schedule.filter(
      (s) =>
        s.day_of_week === day && Number.parseInt(s.start_time.slice(0, 2), 10) === hour,
    );

  return (
    <>
      {/* ===== Мобильный вид: вертикальный список по дням ===== */}
      <div className="space-y-4 md:hidden">
        {DAY_LABELS.map((label, idx) => {
          const day = idx + 1;
          const dayItems = schedule
            .filter((s) => s.day_of_week === day)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          if (dayItems.length === 0) return null; // пустые дни скрываем на мобильных
          return (
            <section key={label}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {label}
              </h3>
              <div className="space-y-2">
                {dayItems.map((item) => (
                  <ScheduleItem key={item.id} item={item} onEdit={onEdit} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* ===== Десктопный вид: сетка «часы × дни» с горизонтальным скроллом ===== */}
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[720px]">
          {/* Шапка дней */}
          <div className="mb-2 grid grid-cols-8 gap-1">
            <div className="p-2 text-sm font-medium text-gray-500">Время</div>
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="rounded bg-gray-50 p-2 text-center text-sm font-medium text-gray-700"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Строки часов */}
          <div className="space-y-1">
            {hourList.map((hour) => (
              <div key={hour} className="grid grid-cols-8 gap-1">
                <div className="flex items-center p-2 text-xs text-gray-500">
                  {String(hour).padStart(2, '0')}:00
                </div>
                {DAY_LABELS.map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  const items = itemsForDayHour(day, hour);
                  return (
                    <div
                      key={day}
                      className="min-h-[64px] space-y-1 rounded border border-gray-100 p-1"
                    >
                      {items.map((item) => (
                        <ScheduleItem key={item.id} item={item} onEdit={onEdit} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
