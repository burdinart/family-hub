// src/pages/PlaceholderPage.tsx — общая заглушка для нереализованных модулей.

import type { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  icon: LucideIcon;
}

/** Простая карточка «Модуль в разработке» с иконкой раздела */
export function PlaceholderPage({ title, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Icon size={32} aria-hidden="true" />
      </span>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <p className="max-w-xs text-sm text-gray-500">
        Модуль в разработке — скоро здесь появится интерактивная версия 🚧
      </p>
    </div>
  );
}
