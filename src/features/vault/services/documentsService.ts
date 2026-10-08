// src/features/vault/services/documentsService.ts — сервис данных модуля «Сейф».
// Единственная точка обращения к таблице documents и bucket 'documents' (Supabase).
// Realtime: при любом изменении строк документов семьи перезагружаем полный список.

import { supabase } from '@/config/supabase';
import type { Document, DocumentCategory } from '@/types';

/** Bucket в Supabase Storage для файлов сейфа */
export const DOCUMENTS_BUCKET = 'documents';

/** Допустимые MIME-типы загружаемых файлов (по ТЗ: JPG, PNG, PDF) */
export const ALLOWED_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];

/** Максимальный размер файла: 10 МБ (защита от случайной загрузки «тяжёлых» фото) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Категория документа в БД может быть любой строкой — канонизируем к safe-значению */
const VALID_CATEGORIES: readonly DocumentCategory[] = [
  'passport',
  'insurance',
  'auto',
  'medical',
  'education',
  'property',
  'other',
];

function toCategory(raw: unknown): DocumentCategory {
  const value = String(raw ?? 'other');
  return (VALID_CATEGORIES as readonly string[]).includes(value)
    ? (value as DocumentCategory)
    : 'other';
}

/** Извлечение пути объекта в bucket 'documents' из публичного URL */
function getFilePathFromUrl(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const marker = `/object/public/${DOCUMENTS_BUCKET}/`;
    const idx = urlObj.pathname.indexOf(marker);
    if (idx === -1) return '';
    return decodeURIComponent(urlObj.pathname.slice(idx + marker.length));
  } catch {
    return '';
  }
}

/** Приведение строки БД к доменному Document без any: unknown + явные поля */
function toDocument(row: Record<string, unknown>): Document {
  // Postgres date приходит как "YYYY-MM-DD" — храним как есть
  const expiry = row.expiry_date == null ? null : String(row.expiry_date).slice(0, 10);
  const fileUrl = String(row.file_url ?? '');

  return {
    id: String(row.id),
    family_id: String(row.family_id),
    title: String(row.title ?? ''),
    category: toCategory(row.category),
    file_url: fileUrl,
    // Путь объекта в bucket: колонка file_path; для старых записей — фолбэк из URL
    file_path: String(row.file_path ?? '') || getFilePathFromUrl(fileUrl),
    file_name: String(row.file_name ?? ''),
    file_size: Number(row.file_size ?? 0),
    mime_type: String(row.mime_type ?? 'application/octet-stream'),
    expiry_date: expiry,
    description: (row.description as string | null) ?? null,
    uploaded_by: String(row.uploaded_by ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

/** Параметры создания документа (id/created_at генерирует БД) */
export interface NewDocumentInput {
  familyId: string;
  file: File;
  title: string;
  category: DocumentCategory;
  expiryDate: string | null;
  description: string | null;
  uploadedBy: string;
}

export const documentsService = {
  /** Подписка на realtime-изменения документов семьи. Возвращает функцию отписки. */
  subscribeToDocuments(familyId: string, callback: (documents: Document[]) => void) {
    const channel = supabase
      .channel(`documents-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          // Перезагружаем данные при любом изменении (источник истины — БД)
          void documentsService
            .getDocumentsByFamily(familyId)
            .then(callback)
            .catch((err: unknown) => console.error('Documents reload error:', err));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  /** Получение всех документов семьи (новые сверху) */
  async getDocumentsByFamily(familyId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toDocument);
  },

  /**
   * Загрузка файла в Storage и создание записи в БД.
   * Порядок критичен: сначала файл, потом строка; при ошибке БД удаляем файл,
   * чтобы не оставлять «сироты» в хранилище.
   */
  async uploadDocument(input: NewDocumentInput): Promise<Document> {
    const { familyId, file, title, category, expiryDate, description, uploadedBy } = input;

    // Валидация на клиенте: тип и размер
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error('Можно загружать только JPG, PNG или PDF');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('Файл слишком большой (максимум 10 МБ)');
    }

    // 1. Уникальное имя: {familyId}/{timestamp}-{случай}.{ext}
    const fileExt = file.name.split('.').pop() ?? 'bin';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    const filePath = `${familyId}/${fileName}`;

    // 2. Загружаем файл в Storage
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    // 3. Публичный URL для просмотра (<img>/<iframe>)
    const {
      data: { publicUrl },
    } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(filePath);

    // 4. Создаём запись в БД
    const { data, error: dbError } = await supabase
      .from('documents')
      .insert([
        {
          family_id: familyId,
          title,
          category,
          file_url: publicUrl,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          expiry_date: expiryDate,
          description,
          uploaded_by: uploadedBy,
        },
      ])
      .select()
      .single();

    if (dbError) {
      // Откат: убираем загруженный файл, если запись в БД не создана
      void supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
      throw dbError;
    }

    return toDocument(data as Record<string, unknown>);
  },

  /** Редактирование метаданных документа (без повторной загрузки файла) */
  async updateDocument(
    documentId: string,
    updates: Partial<Pick<Document, 'title' | 'category' | 'expiry_date' | 'description'>>,
  ): Promise<void> {
    const { error } = await supabase.from('documents').update(updates).eq('id', documentId);
    if (error) throw error;
  },

  /** Удаление документа: сначала запись из БД, затем файл из Storage. */
  async deleteDocument(documentId: string, filePath: string): Promise<void> {
    const { error: dbError } = await supabase.from('documents').delete().eq('id', documentId);
    if (dbError) throw dbError;

    // Файл чистим best-effort: ошибка удаления файла не должна блокировать UI
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([filePath]);
      if (storageError) console.error('Storage cleanup failed:', storageError);
    }
  },

  /** Путь к файлу из URL (публичный API сервиса, используется в тестах/миграциях) */
  getFilePathFromUrl,

  /** Человекочитаемый размер файла */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  },
};
