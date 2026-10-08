// src/features/chat/components/MessageInput.tsx — поле ввода сообщения.
// Enter — отправить, Shift+Enter — новая строка; textarea растёт автоматически до 120px.
// Отправка идёт через стор (он показывает isSending, ловит ошибки и перезагружает историю).
// Исправления против ТЗ-наброска: useAuth отдаёт user (не profile); ошибка показывается
// внутри формы, а не через alert.

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMessagesStore } from '../store/messagesStore';

interface MessageInputProps {
  familyId: string;
}

export function MessageInput({ familyId }: MessageInputProps) {
  const { user } = useAuth();
  const sendMessage = useMessagesStore((s) => s.sendMessage);
  const isSending = useMessagesStore((s) => s.isSending);
  const error = useMessagesStore((s) => s.error);

  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Автоматическое изменение высоты textarea (до 120px)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user || isSending) return;

    const ok = await sendMessage(familyId, user.id, trimmed);
    if (ok) {
      setText('');
      // Фокус обратно на поле ввода — удобно для быстрой переписки на телефоне
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Отправка по Enter (без Shift); на мобильных Enter обычно переводит строку —
    // там работает кнопка отправки
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex-shrink-0 border-t border-gray-200 bg-white p-3">
      {/* Ошибка отправки — человекочитаемая, внутри формы */}
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          rows={1}
          className="max-h-[120px] flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!text.trim() || isSending}
          aria-label="Отправить сообщение"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </form>
  );
}
