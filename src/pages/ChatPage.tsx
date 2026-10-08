// src/pages/ChatPage.tsx — страница «Семейный чат».
// При монтировании подписываемся на realtime-изменения сообщений семьи,
// при размонтировании / смене семьи — отписываемся. Новый экран и поле ввода
// зафиксированы: история скроллится внутри контейнера (mobile-first).

import { useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMessagesStore } from '@/features/chat/store/messagesStore';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { MessageInput } from '@/features/chat/components/MessageInput';

export function ChatPage() {
  const { user } = useAuth();
  const messages = useMessagesStore((s) => s.messages);
  const isLoading = useMessagesStore((s) => s.isLoading);
  const error = useMessagesStore((s) => s.error);
  const subscribeToFamilyMessages = useMessagesStore((s) => s.subscribeToFamilyMessages);
  const unsubscribeFromMessages = useMessagesStore((s) => s.unsubscribeFromMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // id семьи берём из профиля (user.family_id)
  const familyId = user?.family_id ?? null;

  useEffect(() => {
    if (familyId) {
      void subscribeToFamilyMessages(familyId);
    }
    return () => {
      unsubscribeFromMessages();
    };
  }, [familyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Автопрокрутка к последнему сообщению при каждом изменении истории
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Корректная русская форма слова «сообщение»
  const counterLabel = useMemo(() => {
    const n = messages.length;
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n} сообщение`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} сообщения`;
    return `${n} сообщений`;
  }, [messages.length]);

  // Семьи нет — просим пройти онбординг (как в других модулях)
  if (!familyId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="mb-2 text-lg">Чат недоступен</p>
          <p className="text-sm">Сначала создайте или присоединитесь к семье на главной странице.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  // Ошибка загрузки истории — баннер с кнопкой повтора (ошибки отправки показывает MessageInput)
  if (error && messages.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <button
            onClick={() => void subscribeToFamilyMessages(familyId)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 flex h-[calc(100dvh-136px)] flex-col bg-gray-50 sm:-mx-0">
      {/* Заголовок чата */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Семейный чат</h1>
        <p className="text-xs text-gray-500">{counterLabel}</p>
      </div>

      {/* Лента сообщений (скроллится, поле ввода всегда внизу) */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="mb-2 text-lg">Пока нет сообщений</p>
              <p className="text-sm">Напишите первое сообщение!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {/* Якорь для автопрокрутки */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Поле ввода */}
      <MessageInput familyId={familyId} />
    </div>
  );
}
