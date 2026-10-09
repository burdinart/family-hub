// src/features/ratings/services/ratingsService.ts — сервис данных модуля «Рейтинги».
// Единственная точка обращения к add_points() / points_log / profiles.points.
// Компоненты и store не пишут SQL-запросы напрямую.
//
// Важно про RLS: таблица points_log читается только участниками семьи, а запись
// баллов в profiles.points выполняет SECURITY DEFINER функция add_points() на стороне БД.

import { supabase } from '@/config/supabase';
import type { PointsCategory, PointsLog, RankInfo, TaskPriority } from '@/types';

/** Звание (уровень геймификации): диапазон баллов + эмодзи */
interface RankDefinition {
  title: string;
  emoji: string;
  min: number;
  max: number;
}

/**
 * Шкала званий по ТЗ:
 * 0-10 Новичок 🌱 | 11-30 Помощник ⭐ | 31-60 Активист 🏅 | 61-100 Мастер 🏆 | 101+ Легенда семьи 👑
 */
const RANKS: readonly RankDefinition[] = [
  { title: 'Новичок', emoji: '🌱', min: 0, max: 10 },
  { title: 'Помощник', emoji: '⭐', min: 11, max: 30 },
  { title: 'Активист', emoji: '🏅', min: 31, max: 60 },
  { title: 'Мастер', emoji: '🏆', min: 61, max: 100 },
  { title: 'Легенда семьи', emoji: '👑', min: 101, max: Number.POSITIVE_INFINITY },
];

/** Получить информацию о звании по количеству баллов (включая прогресс до следующего) */
export function getRankInfo(points: number): RankInfo {
  // Отрицательные баллы невозможны, но защищаем нижнюю границу
  const safePoints = Math.max(0, points);
  const current = RANKS.find((r) => safePoints >= r.min && safePoints <= r.max) ?? RANKS[0];
  const next = RANKS.find((r) => r.min > safePoints) ?? null;

  return {
    title: current.title,
    emoji: current.emoji,
    minPoints: current.min,
    // Для максимального ранга «потолок» размыт — возвращаем текущие баллы,
    // чтобы UI не рисовал бесконечную шкалу.
    maxPoints: Number.isFinite(current.max) ? current.max : safePoints,
    nextRank: next?.title ?? null,
    pointsToNext: next ? next.min - safePoints : 0,
  };
}

/**
 * Баллы за выполнение задачи: low=+1, medium=+2, high=+3,
 * плюс бонус +1, если задача закрыта в срок (due_date сегодня или позже;
 * задача без срока всегда считается выполненной вовремя).
 */
export function getTaskPoints(priority: TaskPriority, isOnTime: boolean): number {
  const basePoints: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };
  return (basePoints[priority] ?? 1) + (isOnTime ? 1 : 0);
}

/** Строка БД → доменный PointsLog без any (поля сверяются с supabase/schema.sql) */
function toPointsLog(row: Record<string, unknown>): PointsLog {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    user_id: String(row.user_id),
    points: Number(row.points ?? 0),
    reason: String(row.reason ?? ''),
    category: String(row.category ?? 'bonus') as PointsCategory,
    reference_id: (row.reference_id as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

/** Член семейного рейтинга (profile + вычисленное звание) */
export interface FamilyRatingEntry {
  id: string;
  full_name: string;
  avatar_url: string | null;
  points: number;
  rank: RankInfo;
}

export const ratingsService = {
  /**
   * Начислить (или списать, points < 0) баллы через atomic-функцию БД add_points().
   * Функция делает UPDATE profiles.points и INSERT в points_log одним транзакционным
   * вызовом — без гонок при параллельных действиях членов семьи.
   */
  async addPoints(
    familyId: string,
    userId: string,
    points: number,
    reason: string,
    category: PointsCategory = 'task',
    referenceId: string | null = null,
  ): Promise<void> {
    const { error } = await supabase.rpc('add_points', {
      p_family_id: familyId,
      p_user_id: userId,
      p_points: points,
      p_reason: reason,
      p_category: category,
      p_reference_id: referenceId,
    });
    if (error) throw error;
  },

  /** История начислений пользователя (свежие записи — сверху) */
  async getUserPointsHistory(userId: string, limit: number = 50): Promise<PointsLog[]> {
    const { data, error } = await supabase
      .from('points_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row) => toPointsLog(row as Record<string, unknown>));
  },

  /** Рейтинг семьи: все члены, отсортированные по баллам (убывание) */
  async getFamilyRating(familyId: string): Promise<FamilyRatingEntry[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, points')
      .eq('family_id', familyId)
      .order('points', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const points = Number(row.points ?? 0);
      return {
        id: String(row.id),
        full_name: String(row.full_name ?? ''),
        avatar_url: (row.avatar_url as string | null) ?? null,
        points,
        rank: getRankInfo(points),
      };
    });
  },

  /** Общий счёт семьи — сумма баллов всех участников */
  async getFamilyTotalPoints(familyId: string): Promise<number> {
    const { data, error } = await supabase
      .from('profiles')
      .select('points')
      .eq('family_id', familyId);

    if (error) throw error;
    return (data ?? []).reduce(
      (sum: number, raw) => sum + Number((raw as Record<string, unknown>).points ?? 0),
      0,
    );
  },

  /**
   * Подарить баллы другому члену семьи: два вызова add_points()
   * (−N дарителю, +N получателю). Проверка достаточности баланса — на клиенте
   * (UI) и на сервере (политика БД не даёт уйти в минус).
   */
  async giftPoints(
    familyId: string,
    fromUserId: string,
    toUserId: string,
    points: number,
    message: string,
    toUserName?: string,
    fromUserName?: string,
  ): Promise<void> {
    if (!Number.isInteger(points) || points <= 0) {
      throw new Error('Количество баллов должно быть целым и больше нуля');
    }
    if (fromUserId === toUserId) {
      throw new Error('Нельзя подарить баллы самому себе');
    }

    const text = message.trim() || 'Без сообщения';
    // Сначала списываем у дарителя: если этот шаг упадёт (недостаточно баллов),
    // начисление получателю не выполнится и баллы не «нарисуются из воздуха».
    await this.addPoints(
      familyId,
      fromUserId,
      -points,
      `Подарок${toUserName ? ` для ${toUserName}` : ''}: ${text}`,
      'gift',
      toUserId,
    );
    // Затем начисляем получателю
    await this.addPoints(
      familyId,
      toUserId,
      points,
      `Подарок от ${fromUserName || 'члена семьи'}: ${text}`,
      'gift',
      fromUserId,
    );
  },
};
