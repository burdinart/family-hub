// Модель события календаря

import type { TimestampedDoc } from './common';

/** Тип события */
export type EventType = 'event' | 'reminder' | 'appointment';

/** Повторяющееся событие */
export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent extends TimestampedDoc {
  id: string;
  familyId: string;
  /** UUID создателя события (auth.users.id) */
  createdBy: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: EventType;
  recurrence: RecurrenceRule;
  /** ID участников, которых касается событие */
  participantIds: string[];
}
