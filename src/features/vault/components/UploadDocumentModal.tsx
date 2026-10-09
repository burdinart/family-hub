// src/features/vault/components/UploadDocumentModal.tsx — модалка загрузки нового документа.
// Поток: выбор файла (JPG/PNG/PDF) → метаданные (название, категория, срок, описание) → загрузка.
// Mobile-first: bottom-sheet на телефонах, карточка по центру на десктопе.
// Загрузка идёт через store.uploadDocument (Storage + запись в БД с откатом при ошибке).

import { useEffect, useRef, useState } from 'react';
import { UploadCloud, X, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import type { DocumentCategory } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useDocumentsStore } from '../store/documentsStore';
import { DOCUMENT_CATEGORIES } from '../config/categories';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, documentsService } from '../services/documentsService';

interface UploadDocumentModalProps {
  familyId: string;
  onClose: () => void;
}

export function UploadDocumentModal({ familyId, onClose }: UploadDocumentModalProps) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const uploadDocument = useDocumentsStore((s) => s.uploadDocument);
  // id текущего пользователя в store — защита от начисления баллов чужими событиями
  const setCurrentUserId = useDocumentsStore((s) => s.setCurrentUserId);

  useEffect(() => {
    setCurrentUserId(userId);
  }, [userId, setCurrentUserId]);
  const isUploading = useDocumentsStore((s) => s.isUploading);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Состояния формы
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('passport');
  const [expiryDate, setExpiryDate] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  /** Проверка выбранного файла: тип и размер */
  const validateFile = (f: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(f.type)) {
      return 'Можно загружать только JPG, PNG или PDF';
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `Файл слишком большой (${documentsService.formatFileSize(f.size)}). Максимум 10 МБ`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const error = validateFile(selected);
    if (error) {
      setFormError(error);
      // Сбрасываем input, чтобы можно было выбрать тот же файл после исправления
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFormError(null);
    setFile(selected);
    // Автозаполняем название из имени файла, если поле пустое
    if (!title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, '').slice(0, 80));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !userId) return;
    if (!title.trim()) {
      setFormError('Укажите название документа');
      return;
    }

    const created = await uploadDocument({
      familyId,
      file,
      title: title.trim(),
      category,
      expiryDate: expiryDate || null,
      description: description.trim() || null,
      uploadedBy: userId,
    });

    // При успехе закрываем модалку; ошибки уже проставлены в store.error (показывает страница)
    if (created) onClose();
  };

  const isImage = file ? file.type.startsWith('image/') : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      {/* На мобильных — bottom-sheet на всю ширину, на десктопе — карточка */}
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Новый документ</h2>
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
          {/* Зона выбора файла */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              file ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {file ? (
              <>
                {isImage ? (
                  <ImageIcon className="text-emerald-600" size={28} />
                ) : (
                  <FileText className="text-emerald-600" size={28} />
                )}
                <span className="break-words text-sm font-medium text-gray-900 [overflow-wrap:anywhere]">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">{documentsService.formatFileSize(file.size)}</span>
                <span className="text-xs text-emerald-700">Нажмите, чтобы выбрать другой файл</span>
              </>
            ) : (
              <>
                <UploadCloud className="text-gray-400" size={28} />
                <span className="text-sm font-medium text-gray-700">Выбрать файл</span>
                <span className="text-xs text-gray-500">JPG, PNG или PDF, до 10 МБ</span>
              </>
            )}
          </button>

          {/* Название */}
          <div>
            <label htmlFor="doc-title" className="mb-1 block text-sm font-medium text-gray-700">
              Название *
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Паспорт — Артём"
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Категория — сетка кнопок-чипов с иконками */}
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
            <label htmlFor="doc-expiry" className="mb-1 block text-sm font-medium text-gray-700">
              Срок действия (если есть)
            </label>
            <input
              id="doc-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Описание */}
          <div>
            <label htmlFor="doc-desc" className="mb-1 block text-sm font-medium text-gray-700">
              Заметка
            </label>
            <textarea
              id="doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Серия/номер, где оригинал и т.п."
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Ошибка валидации формы */}
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
              disabled={!file || !title.trim() || isUploading || !userId}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Загрузка...
                </>
              ) : (
                'Загрузить'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
