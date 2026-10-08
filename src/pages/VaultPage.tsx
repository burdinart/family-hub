// src/pages/VaultPage.tsx — раздел «Семейный сейф»: хранение сканов важных документов.
// При входе подписываемся на документы семьи (store + realtime), при выходе — отписываемся.
// Функционал: загрузка JPG/PNG/PDF, фильтр по категориям, поиск по названию,
// предпросмотр файла, редактирование метаданных, удаление (запись + файл из Storage).

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Plus, Search, Users } from 'lucide-react';
import type { Document, DocumentCategory } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useDocumentsStore } from '@/features/vault/store/documentsStore';
import { DOCUMENT_CATEGORIES } from '@/features/vault/config/categories';
import { DocumentCard } from '@/features/vault/components/DocumentCard';
import { UploadDocumentModal } from '@/features/vault/components/UploadDocumentModal';
import { EditDocumentModal } from '@/features/vault/components/EditDocumentModal';
import { DocumentViewer } from '@/features/vault/components/DocumentViewer';

export function VaultPage() {
  // id семьи берём из профиля (authStore)
  const familyId = useAuthStore((s) => s.user?.family_id ?? null);

  const documents = useDocumentsStore((s) => s.documents);
  const isLoading = useDocumentsStore((s) => s.isLoading);
  const error = useDocumentsStore((s) => s.error);
  const subscribeToFamilyDocuments = useDocumentsStore((s) => s.subscribeToFamilyDocuments);
  const unsubscribeFromDocuments = useDocumentsStore((s) => s.unsubscribeFromDocuments);
  const removeDocument = useDocumentsStore((s) => s.removeDocument);

  // UI-состояния страницы
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (familyId) {
      void subscribeToFamilyDocuments(familyId);
    }
    // Отписка при размонтировании страницы или смене семьи
    return () => {
      unsubscribeFromDocuments();
    };
  }, [familyId, subscribeToFamilyDocuments, unsubscribeFromDocuments]);

  // Фильтрация: категория + поиск по названию/описанию (без учёта регистра)
  const filtered = useMemo(() => {
    let list = documents;
    if (categoryFilter !== 'all') {
      list = list.filter((d) => d.category === categoryFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [documents, categoryFilter, query]);

  // Удаление с подтверждением
  const handleDelete = (doc: Document) => {
    if (!window.confirm(`Удалить документ «${doc.title}»? Файл будет удалён безвозвратно.`)) return;
    void removeDocument(doc.id);
  };

  // Семья не найдена — просим пройти онбординг
  if (!familyId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Users className="text-gray-400" size={48} />
        <p className="text-lg font-medium text-gray-700">Вы ещё не состоите в семье</p>
        <p className="text-sm text-gray-500">
          Создайте семью или присоединитесь по приглашению, чтобы вести общий сейф документов.
        </p>
      </div>
    );
  }

  // Состояние загрузки списка
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Заголовок + кнопка загрузки */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Lock className="text-emerald-600" size={24} />
          Сейф
        </h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 active:bg-blue-800"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Загрузить</span>
        </button>
      </div>

      {/* Баннер ошибки (загрузка/мутации) */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="min-w-0 break-words">{error}</span>
          <button
            onClick={() => void subscribeToFamilyDocuments(familyId)}
            className="flex-shrink-0 rounded-md border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Поиск по названию/описанию */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск документов..."
          className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          aria-label="Поиск документов"
        />
      </div>

      {/* Горизонтальный скролл чипов-фильтров категорий (mobile-friendly) */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`min-h-[36px] flex-shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              categoryFilter === 'all'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Все ({documents.length})
          </button>
          {DOCUMENT_CATEGORIES.map((c) => {
            const count = documents.filter((d) => d.category === c.value).length;
            const Icon = c.icon;
            const active = categoryFilter === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setCategoryFilter(active ? 'all' : c.value)}
                className={`flex min-h-[36px] flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? `${c.badgeClass} ring-2 ring-blue-400`
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {c.shortLabel} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Пустые состояния */}
      {documents.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <Lock className="text-gray-300" size={48} />
          <p className="font-medium text-gray-700">В сейфе пока пусто</p>
          <p className="max-w-xs text-sm text-gray-500">
            Загрузите сканы паспортов, полисов, прав и других важных документов — вся семья
            увидит их мгновенно.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-2 flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-5 font-medium text-white hover:bg-blue-700"
          >
            <Plus size={20} />
            Загрузить первый документ
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Ничего не найдено по выбранным фильтрам
        </div>
      ) : (
        // Сетка карточек: 1 колонка на мобильных, 2 на sm, 3 на lg
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={setViewing}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Модалки и просмотрщик */}
      {showUploadModal && (
        <UploadDocumentModal familyId={familyId} onClose={() => setShowUploadModal(false)} />
      )}
      {editing && <EditDocumentModal document={editing} onClose={() => setEditing(null)} />}
      {viewing && <DocumentViewer document={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
