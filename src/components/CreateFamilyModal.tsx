// src/components/CreateFamilyModal.tsx — модалка онбординга с двумя путями:
//   1. «Создать новую семью» (для первого члена) → автоматически получает код приглашения;
//   2. «Присоединиться по коду» (для остальных членов семьи).
// Показывается автоматически, когда у вошедшего пользователя profile.family_id === null
// (см. useAuth().needsFamily). Mobile-first: на узких экранах карточка занимает почти
// всю ширину и прокручивается, кнопки — крупными столбиком (touch-friendly).

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle, KeyRound, Loader2, Plus, Users, X } from 'lucide-react';
import { familyService, normalizeInviteCode } from '@/services/familyService';
import { useAuth } from '@/hooks/useAuth';

interface CreateFamilyModalProps {
  /** Закрытие модалки (без семьи основной UI недоступен — см. HomePage) */
  onClose: () => void;
  /** Успешное завершение онбординга (семья создана или к ней присоединились) */
  onFamilyCreated: () => void;
}

/** Режимы модалки: выбор пути → создание/присоединение → успех (только для создателя) */
type Mode = 'choose' | 'create' | 'join' | 'success';

/** Длина кода приглашения (A–Z0–9) */
const CODE_LENGTH = 6;

export function CreateFamilyModal({ onClose, onFamilyCreated }: CreateFamilyModalProps) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  // Данные созданной семьи для экрана успеха (код показываем один раз — потом
  // он доступен в интерфейсе главной страницы)
  const [createdCode, setCreatedCode] = useState('');
  const [createdFamilyName, setCreatedFamilyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  // Подтверждение копирования вместо нативного alert() — мобильный UX
  const [copied, setCopied] = useState(false);

  // При смене режима чистим ошибку предыдущей попытки
  useEffect(() => {
    setErrorText('');
  }, [mode]);

  /** Путь 1: создать семью → режим success с показом кода приглашения */
  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!familyName.trim() || !profile) return;

    setIsLoading(true);
    setErrorText('');
    try {
      const family = await familyService.createFamily(familyName.trim(), profile.id);
      setCreatedCode(family.invite_code ?? '');
      setCreatedFamilyName(family.name);
      setMode('success');
    } catch (error) {
      console.error('Ошибка при создании семьи:', error);
      setErrorText(error instanceof Error ? error.message : 'Не удалось создать семью. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Путь 2: присоединиться по коду → сразу закрываем онбординг */
  const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteCode.trim() || !profile) return;

    setIsLoading(true);
    setErrorText('');
    try {
      await familyService.joinFamilyByCode(inviteCode.trim(), profile.id);
      // Профиль обновлён родителем (refreshProfile) → needsFamily станет false
      onFamilyCreated();
    } catch (error) {
      console.error('Ошибка при присоединении к семье:', error);
      setErrorText(error instanceof Error ? error.message : 'Код неверный или семья не найдена.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Копирование кода в буфер обмена (с graceful fallback без clipboard API) */
  const handleCopyCode = async () => {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер недоступен (http / old browser) — выделяем код, пользователь скопирует вручную
      setErrorText('Не удалось скопировать — выделите код и скопируйте вручную.');
    }
  };

  /** Общий стиль primary-кнопки (единая дизайн-система: emerald) */
  const btnPrimary =
    'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 sm:flex-1';
  const btnSecondary =
    'w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 sm:flex-1';

  return (
    // Overlay на весь экран: затемнение + центрирование карточки (z-50 — поверх Layout)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-family-title"
        // Mobile-first: max-h + overflow-y — длинный контент скроллится внутри карточки
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
      >
        {/* Шапка: иконка + заголовок по режиму + кнопка закрытия (нет на экране успеха) */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={24} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <h2 id="create-family-title" className="text-lg font-bold text-gray-900 sm:text-xl">
              {mode === 'choose' && 'Добро пожаловать!'}
              {mode === 'create' && 'Создать семью'}
              {mode === 'join' && 'Присоединиться к семье'}
              {mode === 'success' && 'Семья создана!'}
            </h2>
          </div>
          {mode !== 'success' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Сообщение об ошибке (доступно для скринридеров вместо alert) */}
        {errorText && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorText}
          </p>
        )}

        {/* ===== РЕЖИМ 1: ВЫБОР ПУТИ ===== */}
        {mode === 'choose' && (
          <div className="space-y-3">
            <p className="mb-4 text-sm text-gray-600">
              У вас ещё нет семьи. Что хотите сделать?
            </p>
            <button
              type="button"
              onClick={() => setMode('create')}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-emerald-500 p-4 text-left transition-colors hover:bg-emerald-50"
            >
              <Plus size={24} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <span>
                <span className="block font-medium text-gray-900">Создать новую семью</span>
                <span className="block text-sm text-gray-500">Если вы первый член семьи</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-gray-300 p-4 text-left transition-colors hover:bg-gray-50"
            >
              <KeyRound size={24} className="shrink-0 text-gray-600" aria-hidden="true" />
              <span>
                <span className="block font-medium text-gray-900">Присоединиться по коду</span>
                <span className="block text-sm text-gray-500">Если вас уже пригласили</span>
              </span>
            </button>
          </div>
        )}

        {/* ===== РЕЖИМ 2: СОЗДАНИЕ СЕМЬИ ===== */}
        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="family-name" className="mb-1 block text-sm font-medium text-gray-700">
                Название семьи <span className="text-red-500">*</span>
              </label>
              <input
                id="family-name"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Например: Семья Ивановых"
                maxLength={80}
                required
                autoFocus
                autoComplete="off"
              />
            </div>
            {/* На мобильных кнопки в столбик (главная выше), на sm+ — в ряд */}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setMode('choose')}
                disabled={isLoading}
                className={btnSecondary}
              >
                Назад
              </button>
              <button type="submit" disabled={isLoading || !familyName.trim()} className={btnPrimary}>
                {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {isLoading ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </form>
        )}

        {/* ===== РЕЖИМ 3: ПРИСОЕДИНЕНИЕ ПО КОДУ ===== */}
        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="invite-code" className="mb-1 block text-sm font-medium text-gray-700">
                Код приглашения <span className="text-red-500">*</span>
              </label>
              <input
                id="invite-code"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                value={inviteCode}
                // Вводимые символы нормализуем на лету: верхний регистр, только A–Z0–9
                onChange={(e) => setInviteCode(normalizeInviteCode(e.target.value).slice(0, CODE_LENGTH))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 font-mono text-lg tracking-wider uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Например: A3F9K2"
                maxLength={CODE_LENGTH}
                required
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1 text-xs text-gray-500">
                Попросите код у того, кто создал семью
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setMode('choose')}
                disabled={isLoading}
                className={btnSecondary}
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={isLoading || inviteCode.length < CODE_LENGTH}
                className={btnPrimary}
              >
                {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {isLoading ? 'Проверка…' : 'Присоединиться'}
              </button>
            </div>
          </form>
        )}

        {/* ===== РЕЖИМ 4: УСПЕХ — показываем код приглашения ===== */}
        {mode === 'success' && (
          <div className="space-y-4 text-center">
            <CheckCircle size={48} className="mx-auto text-green-600" aria-hidden="true" />
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-2 text-sm text-gray-700">
                Семья <b>«{createdFamilyName}»</b> создана!
              </p>
              <p className="mb-2 text-xs text-gray-500">Поделитесь этим кодом с близкими:</p>
              <div className="mb-3 font-mono text-3xl font-bold tracking-wider text-emerald-700 select-all">
                {createdCode}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="text-sm text-emerald-700 underline-offset-2 hover:underline"
              >
                {copied ? '✓ Код скопирован' : 'Скопировать код'}
              </button>
            </div>
            <button type="button" onClick={onFamilyCreated} className={btnPrimary}>
              Перейти в приложение
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
