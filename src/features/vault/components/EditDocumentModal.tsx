// src/features/vault/components/EditDocumentModal.tsx — редактирование метаданных документа.
// Файл перезагрузить нельзя (для этого нужно создать новый документ) — правим только
// название, категорию, срок действия и заметку. Сохранение через store.editDocument.

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Document, DocumentCategory } from '@/types';
import { useDocumentsStore } from '../store/documentsStore';
import { DOCUMENT_CATEGORIES } from '../config/categories';

interface EditDocumentModalProps {
  document: Document;
  onClose: () => void;
}

export function EditDocumentModal({ document, onClose }: EditDocumentModalProps) {
  const editDocument = useDocumentsStore((s) => s.editDocument);

  const [title, setTitle] = useState(document.title);
  const [category, setCategory] = useState<DocumentCategory>(document.category);
  const [expiryDate, setExpiryDate] = useState(document.expiry_date ?? '');
  const [description, setDescription] = useState(document.description ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Укажите название документа');
      return;
    }

    setIsSaving(true);
    const ok = await editDocument(document.id, {
      title: title.trim(),
      category,
      expiry_date: expiryDate || null,
      description: description.trim() || null,
    });
    setIsSaving(false);

    // При успехе закрываем; ошибки ставит store (показывает страница)
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Редактировать документ</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Название */}
          <div>
            <label htmlFor="edit-title" className="mb-1 block text-sm font-medium text-gray-700">
              Название *
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Категория */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Категория *</span>
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? `${c.badgeClass} ring-2 ring-offset-1 ring-blue-400`
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={16} className={active ? '' : 'text-gray-400'} />
                    <span className="min-w-0 flex-1 break-words leading-tight [overflow-wrap:anywhere]">
                      {c.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Срок действия */}
          <div>
            <label htmlFor="edit-expiry" className="mb-1 block text-sm font-medium text-gray-700">
              Срок действия (если есть)
            </label>
            <input
              id="edit-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Заметка */}
          <div>
            <label htmlFor="edit-desc" className="mb-1 block text-sm font-medium text-gray-700">
              Заметка
            </label>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 pb-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSaving}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Сохранение...
                </>
              ) : (
                'Сохранить'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
