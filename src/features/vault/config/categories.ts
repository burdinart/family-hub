// src/features/vault/config/categories.ts — реестр категорий документов «Сейфа».
// Единый источник правды для иконок, названий и цветов (используется в UI-компонентах).

import {
  Car,
  CreditCard,
  FileText,
  GraduationCap,
  Heart,
  Home,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import type { DocumentCategory } from '@/types';

export interface CategoryConfig {
  value: DocumentCategory;
  label: string;
  /** Короткое название для бейджей/фильтров */
  shortLabel: string;
  icon: LucideIcon;
  /** классы бейджа категории (Tailwind) */
  badgeClass: string;
  /** класс цвета иконки */
  iconClass: string;
}

/** Категории в порядке отображения в фильтрах и форме */
export const DOCUMENT_CATEGORIES: readonly CategoryConfig[] = [
  {
    value: 'passport',
    label: 'Паспорта',
    shortLabel: 'Паспорт',
    icon: CreditCard,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    iconClass: 'text-blue-600',
  },
  {
    value: 'insurance',
    label: 'Полисы ОМС/ДМС, ОСАГО',
    shortLabel: 'Полис',
    icon: Shield,
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    iconClass: 'text-green-600',
  },
  {
    value: 'auto',
    label: 'Автодокументы (СТС, права)',
    shortLabel: 'Авто',
    icon: Car,
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    iconClass: 'text-purple-600',
  },
  {
    value: 'medical',
    label: 'Медкарты, прививки',
    shortLabel: 'Медицина',
    icon: Heart,
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    iconClass: 'text-red-600',
  },
  {
    value: 'education',
    label: 'Дипломы, сертификаты',
    shortLabel: 'Образование',
    icon: GraduationCap,
    badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    iconClass: 'text-yellow-600',
  },
  {
    value: 'property',
    label: 'Свидетельства о собственности',
    shortLabel: 'Недвижимость',
    icon: Home,
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    iconClass: 'text-orange-600',
  },
  {
    value: 'other',
    label: 'Другое',
    shortLabel: 'Другое',
    icon: FileText,
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    iconClass: 'text-gray-600',
  },
];

/** Быстрый доступ к конфигурации категории по значению (типобезопасно) */
export const CATEGORY_MAP: Record<DocumentCategory, CategoryConfig> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.value, c]),
) as Record<DocumentCategory, CategoryConfig>;
