// src/features/vault/store/documentsStore.ts — Zustand store модуля «Сейф».
// Хранит список документов семьи, статусы загрузки/ошибки и функцию realtime-отписки.
// Мутации идут через сервис; UI обновляется оптимистично, источник истины — БД + realtime.

import { create } from 'zustand';
import type { Document, DocumentCategory } from '@/types';
import { ratingsService } from '@/features/ratings/services/ratingsService';
import { describeError, documentsService, type NewDocumentInput } from '../services/documentsService';

interface DocumentsState {
  documents: Document[];
  isLoading: boolean;
  /** true, пока идёт загрузка файла в Storage */
  isUploading: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;

  setDocuments: (documents: Document[]) => void;
  setLoading: (loading: boolean) => void;
  setUploading: (uploading: boolean) => void;
  setError: (error: string | null) => void;

  /** Загрузка файла + создание записи; возвращает созданный документ или null при ошибке */
  uploadDocument: (input: NewDocumentInput) => Promise<Document | null>;
  /** id текущего пользователя — баллы за загрузку начисляются только ему */
  currentUserId: string | null;
  /** Обновить id текущего пользователя (вызывается страницей при монтировании) */
  setCurrentUserId: (userId: string | null) => void;
  /** Обновление метаданных (title/category/expiry/description) */
  editDocument: (
    id: string,
    updates: Partial<Pick<Document, 'title' | 'category' | 'expiry_date' | 'description'>>,
  ) => Promise<boolean>;
  /** Удаление документа (запись + файл) */
  removeDocument: (id: string) => Promise<boolean>;

  subscribeToFamilyDocuments: (familyId: string) => Promise<void>;
  unsubscribeFromDocuments: () => void;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  isLoading: false,
  isUploading: false,
  error: null,
  unsubscribe: null,
  currentUserId: null,

  setDocuments: (documents) => set({ documents }),
  setLoading: (isLoading) => set({ isLoading }),
  setUploading: (isUploading) => set({ isUploading }),
  setError: (error) => set({ error }),
  setCurrentUserId: (currentUserId) => set({ currentUserId }),

  uploadDocument: async (input) => {
    set({ isUploading: true, error: null });
    try {
      const doc = await documentsService.uploadDocument(input);
      // Геймификация: +2 балла за загруженный в сейф документ.
      // Начисляем ТОЛЬКО если документ загрузил текущий пользователь — иначе при
      // realtime-ререндерах чужими событиями баллы «капали» бы не тому человеку.
      // Ошибка начисления не должна ломать успешную загрузку — логируем и живём дальше.
      const meId = get().currentUserId;
      if (meId && input.uploadedBy === meId) {
        try {
          await ratingsService.addPoints(
            input.familyId,
            meId,
            2,
            `Загружен документ в сейф: ${doc.title}`,
            'document',
            doc.id,
          );
        } catch (pointsErr) {
          console.error('Не удалось начислить баллы за документ:', pointsErr);
        }
      }
      // Оптимистично добавляем в начало списка (realtime затем синхронизирует)
      set((state) => ({ documents: [doc, ...state.documents], isUploading: false }));
      return doc;
    } catch (err) {
      set({ isUploading: false, error: `Ошибка загрузки файла: ${describeError(err)}` });
      console.error('Document upload error:', err);
      return null;
    }
  },

  editDocument: async (id, updates) => {
    // Оптимистичное обновление + откат при ошибке
    const prev = get().documents;
    set({
      documents: prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      error: null,
    });
    try {
      await documentsService.updateDocument(id, updates);
      return true;
    } catch (err) {
      set({ documents: prev, error: `Не удалось сохранить изменения: ${describeError(err)}` });
      console.error('Document update error:', err);
      return false;
    }
  },

  removeDocument: async (id) => {
    const prev = get().documents;
    const target = prev.find((d) => d.id === id);
    if (!target) return false;

    // Оптимистично убираем из списка
    set({ documents: prev.filter((d) => d.id !== id), error: null });
    try {
      await documentsService.deleteDocument(id, target.file_path);
      return true;
    } catch (err) {
      set({ documents: prev, error: `Не удалось удалить документ: ${describeError(err)}` });
      console.error('Document delete error:', err);
      return false;
    }
  },

  subscribeToFamilyDocuments: async (familyId: string) => {
    const { unsubscribe } = get();

    // Отписываемся от предыдущей подписки, если есть
    if (unsubscribe) unsubscribe();

    set({ isLoading: true, error: null });

    try {
      // 1. Загружаем существующие документы
      const documents = await documentsService.getDocumentsByFamily(familyId);
      set({ documents, isLoading: false });

      // 2. Подписываемся на realtime-изменения
      const unsubscribeFn = documentsService.subscribeToDocuments(familyId, (newDocs) => {
        set({ documents: newDocs });
      });

      set({ unsubscribe: unsubscribeFn });
    } catch (err) {
      set({ error: 'Ошибка загрузки документов', isLoading: false });
      console.error('Documents subscription error:', err);
    }
  },

  unsubscribeFromDocuments: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },
}));

/** Селектор: документы по категории (для группировки в UI) */
export function selectByCategory(
  documents: Document[],
  category: DocumentCategory | 'all',
): Document[] {
  if (category === 'all') return documents;
  return documents.filter((d) => d.category === category);
}
