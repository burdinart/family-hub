// src/features/vault/components/DocumentViewer.tsx — полноэкранный просмотр файла.
// Изображения — <img> с pinch-zoom нативным скроллом; PDF — <iframe> (встроенный
// просмотрщик браузера). Кнопка «Скачать» ведёт на тот же URL с download-атрибутом.

import { X, Download } from 'lucide-react';
import type { Document } from '@/types';
import { CATEGORY_MAP } from '../config/categories';

interface DocumentViewerProps {
  document: Document;
  onClose: () => void;
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const isImage = document.mime_type.startsWith('image/');
  const category = CATEGORY_MAP[document.category];

  return (
    // Полноэкранный оверлей: на мобильных занимает весь экран (важно для чтения сканов)
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Панель заголовка */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-medium text-white">{document.title}</h2>
          <p className="text-xs text-white/60">
            {category.shortLabel} · {document.file_name}
          </p>
        </div>

        {/* Скачать: атрибут download работает для same-origin; для Storage это ок */}
        <a
          href={document.file_url}
          download={document.file_name}
          aria-label="Скачать"
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
        >
          <Download size={20} />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
        >
          <X size={20} />
        </button>
      </div>

      {/* Область просмотра: скролл в обеих осях для больших сканов */}
      <div className="flex-1 overflow-auto">
        {isImage ? (
          <div className="flex min-h-full items-center justify-center p-2">
            <img
              src={document.file_url}
              alt={document.title}
              className="max-h-[calc(100dvh-72px)] w-auto max-w-full object-contain"
            />
          </div>
        ) : (
          // PDF: iframe на всю доступную высоту; на десктопе браузер покажет свой viewer
          <iframe
            src={document.file_url}
            title={document.title}
            className="h-[calc(100dvh-72px)] w-full border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}
