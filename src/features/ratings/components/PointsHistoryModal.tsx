// src/features/ratings/components/PointsHistoryModal.tsx — модалка истории баллов.
// Список начислений/списаний текущего пользователя (points_log) с относительным
// временем (date-fns, русская локаль). Mobile-first: на узких экранах — почти во весь экран.

import { useEffect } from 'react';
import { X, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useRatingsStore } from '../store/ratingsStore';
import type { PointsCategory } from '@/types';

interface PointsHistoryModalProps {
  onClose: () => void;
}

/** Человекочитаемые подписи категорий начислений */
const CATEGORY_LABELS: Record<PointsCategory, string> = {
  task: 'Задача',
  task_create: 'Создание задачи',
  shopping: 'Покупки',
  document: 'Документ',
  gift: 'Подарок',
  bonus: 'Бонус',
};

export function PointsHistoryModal({ onClose }: PointsHistoryModalProps) {
  const { user: profile } = useAuth();
  const userHistory = useRatingsStore((s) => s.userHistory);
  const loadUserHistory = useRatingsStore((s) => s.loadUserHistory);

  // Подтягиваем историю при открытии (realtime-подписка виджета держит её свежей)
  useEffect(() => {
    if (profile?.id) {
      void loadUserHistory(profile.id);
    }
  }, [profile?.id, loadUserHistory]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      {/* Mobile-first: снизу экрана, высота 90dvh; на sm+ — карточка по центру */}
      <div className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-bold text-gray-900">История баллов</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="min-h-[44px] min-w-[44px] rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {userHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Пока нет начислений — выполняйте задачи, отмечайте покупки и делитесь баллами!
            </p>
          ) : (
            <ul className="space-y-2">
              {userHistory.map((log) => {
                const isPositive = log.points > 0;
                return (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 rounded-xl bg-gray-50 p-3"
                  >
                    {/* Иконка направления: рост / падение */}
                    <span
                      className={`shrink-0 rounded-full p-2 ${
                        isPositive ? 'bg-green-100' : 'bg-red-100'
                      }`}
                      aria-hidden="true"
                    >
                      {isPositive ? (
                        <TrendingUp size={16} className="text-green-600" />
                      ) : (
                        <TrendingDown size={16} className="text-red-600" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{log.reason}</p>
                      <p className="text-xs text-gray-500">
                        {CATEGORY_LABELS[log.category] ?? log.category} •{' '}
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 text-base font-bold ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isPositive ? `+${log.points}` : log.points}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
