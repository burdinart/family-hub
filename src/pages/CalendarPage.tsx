// src/pages/CalendarPage.tsx — страница модуля «Календарь».
// Собирает вместе: сетку месяца, список событий выбранного дня, фильтры
// (поиск + категория) и модалку создания/редактирования. При монтировании
// подписывается на realtime-события семьи, при размонтировании — отписывается.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, CalendarDays, Search } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useEventsStore, sortEvents } from '@/features/calendar/store/eventsStore';
import { CalendarGrid } from '@/features/calendar/components/CalendarGrid';
import { EventCard } from '@/features/calendar/components/EventCard';
import { EventFormModal, CATEGORY_STYLES } from '@/features/calendar/components/EventFormModal';
import type { Event, EventCategory } from '@/types';

/** Опция фильтра категории: null = все */
type CategoryFilter = EventCategory | null;

export function CalendarPage() {
  // id семьи берём из профиля (useAuth.user === Profile)
  const { user } = useAuth();
  const familyId = user?.family_id ?? null;

  const {
    events,
    selectedDate,
    isLoading,
    error,
    subscribeToFamilyEvents,
    unsubscribeFromEvents,
    setSelectedDate,
  } = useEventsStore();

  // Локальный стейт страницы (не store): отображаемый месяц и модалка
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  // Дополнительные фильтры (из ТЗ, опционально)
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(null);

  // Подписка на события семьи: при входе грузим + realtime; при уходе — отписка
  useEffect(() => {
    if (familyId) {
      void subscribeToFamilyEvents(familyId);
    }
    return () => {
      unsubscribeFromEvents();
    };
  }, [familyId, subscribeToFamilyEvents, unsubscribeFromEvents]);

  // Фильтрация: поиск по названию + категория
  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, query, categoryFilter]);

  // События выбранного дня, отсортированные по времени
  const dayEvents = useMemo(
    () =>
      sortEvents(filteredEvents).filter((e) => {
        // Сравниваем ISO-дату события (без UTC-сдвига) с выбранным днём
        const evDate = new Date(`${e.date}T00:00:00`);
        return isSameDay(evDate, selectedDate);
      }),
    [filteredEvents, selectedDate],
  );

  const openCreate = () => {
    setEditingEvent(null);
    setModalOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditingEvent(event);
    setModalOpen(true);
  };

  // Семья не создана — просим пройти онбординг
  if (!familyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <CalendarDays size={48} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">Сначала создайте или присоединитесь к семье</p>
        <p className="text-gray-400 text-sm mt-1">Календарь появится после настройки семьи.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto px-4 py-6 max-w-3xl pb-28">
      {/* Заголовок + кнопка добавления */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Календарь</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 min-h-11 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 active:bg-emerald-800 shadow-sm"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Добавить событие</span>
          <span className="sm:hidden">Событие</span>
        </button>
      </div>

      {/* Состояние ошибки загрузки с возможностью повторить */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void subscribeToFamilyEvents(familyId)}
            className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 font-medium whitespace-nowrap"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Сетка месяца */}
      <CalendarGrid
        viewDate={viewDate}
        selectedDate={selectedDate}
        events={filteredEvents}
        onChangeMonth={setViewDate}
        onSelectDate={setSelectedDate}
      />

      {/* Панель фильтров: поиск + чипы категорий */}
      <div className="mt-4 space-y-2">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск событий..."
            aria-label="Поиск событий"
            className="w-full pl-11 pr-4 py-2.5 min-h-11 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              categoryFilter === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            Все
          </button>
          {(Object.keys(CATEGORY_STYLES) as EventCategory[]).map((c) => {
            const s = CATEGORY_STYLES[c];
            const active = categoryFilter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(active ? null : c)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  active ? `${s.badge} ring-2 ring-gray-300` : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Список событий выбранного дня */}
      <section className="mt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ru })}
          {filteredEvents.length !== events.length && (
            <span className="normal-case font-normal text-gray-400"> · фильтры</span>
          )}
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={36} className="animate-spin text-emerald-600" />
          </div>
        ) : dayEvents.length > 0 ? (
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <EventCard key={event.id} event={event} onEdit={openEdit} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
            <CalendarDays size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">На этот день событий нет</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-3 text-emerald-600 font-medium text-sm hover:underline"
            >
              + Добавить событие
            </button>
          </div>
        )}
      </section>

      {/* Модалка создания/редактирования */}
      {modalOpen && (
        <EventFormModal
          familyId={familyId}
          defaultDate={selectedDate}
          event={editingEvent}
          onClose={() => {
            setModalOpen(false);
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}
