// src/features/vault/components/DocumentCard.tsx — карточка документа в «Сейфе».
// Mobile-first: превью изображения / иконка PDF, название с переносом строк,
// бейдж категории, срок действия (с подсветкой истекающих), размер файла.
// Действия: просмотр (открывает модалку предпросмотра), редактирование, удаление.

import { format, differenceInDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Eye, Pencil, Trash2, FileText } from 'lucide-react';
import type { Document } from '@/types';
import { CATEGORY_MAP } from '../config/categories';
import { documentsService } from '../services/documentsService';

interface DocumentCardProps {
  document: Document;
  onView: (document: Document) => void;
  onEdit: (document: Document) => void;
  onDelete: (document: Document) => void;
}

/** Статус срока действия: null = нет срока */
function expiryStatus(expiryDate: string | null): {
  label: string;
  className: string;
} | null {
  if (!expiryDate) return null;
  try {
    const days = differenceInDays(parseISO(expiryDate), new Date());
    if (days < 0) {
      return { label: 'Просрочен', className: 'bg-red-100 text-red-700 border-red-200' };
    }
    if (days <= 30) {
      return {
        label: `Истекает через ${days} дн.`,
        className: 'bg-orange-100 text-orange-700 border-orange-200',
      };
    }
    return {
      label: `Действителен до ${format(parseISO(expiryDate), 'd MMM yyyy', { locale: ru })}`,
      className: 'bg-gray-50 text-gray-600 border-gray-200',
    };
  } catch {
    // Некорректная дата из БД — показываем как есть
    return { label: expiryDate, className: 'bg-gray-50 text-gray-600 border-gray-200' };
  }
}

export function DocumentCard({ document, onView, onEdit, onDelete }: DocumentCardProps) {
  const category = CATEGORY_MAP[document.category];
  const CategoryIcon = category.icon;
  const isImage = document.mime_type.startsWith('image/');
  const expiry = expiryStatus(document.expiry_date);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Превью: картинка или заглушка для PDF — клик открывает просмотр */}
      <button
        type="button"
        onClick={() => onView(document)}
        aria-label={`Открыть ${document.title}`}
        className="block w-full"
      >
        {isImage ? (
          <img
            src={document.file_url}
            alt={document.title}
            loading="lazy"
            className="h-40 w-full bg-gray-100 object-cover sm:h-44"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 sm:h-44">
            <FileText className="text-gray-500" size={48} />
          </div>
        )}
      </button>

      {/* Контент: min-w-0 + break-words — текст не обрезается */}
      <div className="min-w-0 p-4">
        <div className="flex items-start gap-2">
          <CategoryIcon size={18} className={`mt-0.5 flex-shrink-0 ${category.iconClass}`} />
          <h3 className="min-w-0 flex-1 break-words text-base font-medium leading-snug [overflow-wrap:anywhere] text-gray-900">
            {document.title}
          </h3>
        </div>

        {/* Мета: категория, размер, срок действия — flex-wrap на узких экранах */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${category.badgeClass}`}>
            {category.shortLabel}
          </span>
          <span className="text-xs text-gray-500">{documentsService.formatFileSize(document.file_size)}</span>
          {expiry && (
            <span className={`rounded border px-2 py-0.5 text-xs font-medium ${expiry.className}`}>
              {expiry.label}
            </span>
          )}
        </div>

        {document.description && (
          <p className="mt-2 break-words text-sm leading-snug text-gray-600 [overflow-wrap:anywhere]">
            {document.description}
          </p>
        )}

        {/* Компактные кнопки действий (тач-зоны ≥36px) */}
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => onView(document)}
            aria-label="Просмотр"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600"
          >
            <Eye size={18} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(document)}
            aria-label="Редактировать"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <Pencil size={18} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(document)}
            aria-label="Удалить"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
