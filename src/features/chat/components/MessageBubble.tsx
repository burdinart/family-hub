// src/features/chat/components/MessageBubble.tsx — пузырёк одного сообщения.
// Свои сообщения — справа и синие, чужие — слева, белые, с аватаром и именем.
// Удаление доступно только для своих сообщений (RLS дополнительно защищает на БД).
// Исправления против ТЗ-наброска: useAuth отдаёт user (не profile); ошибка удаления
// пишется в стор (без alert); кнопка удаления видна всегда на мобильных (тач-устройства
// не знают про :hover/group-hover).

import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import type { Message } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useMessagesStore } from '../store/messagesStore';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { user } = useAuth();
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);

  const isOwnMessage = message.sender_id === user?.id;

  const handleDelete = () => {
    if (!window.confirm('Удалить сообщение?')) return;
    if (!user) return;
    void deleteMessage(message.id, user.id);
  };

  // Относительное время: «5 минут назад» (date-fns, русская локаль)
  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: ru,
  });

  const senderName = message.sender?.full_name || 'Неизвестный';
  const avatarUrl = message.sender?.avatar_url;

  return (
    <div className={`mb-3 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[80%] items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Аватар отправителя (только для чужих сообщений) */}
        {!isOwnMessage && (
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={senderName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs font-bold text-gray-600">
                {senderName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Пузырёк сообщения */}
        <div
          className={`rounded-2xl px-4 py-2 shadow-sm ${
            isOwnMessage
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-900'
          }`}
        >
          {/* Имя отправителя (только для чужих сообщений) */}
          {!isOwnMessage && (
            <div className="mb-1 min-w-0 break-words text-xs font-medium text-gray-500">
              {senderName}
            </div>
          )}

          {/* Текст: перенос по словам и длинным словам, многострочность сохраняем */}
          <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-snug [overflow-wrap:anywhere]">
            {message.text}
          </div>

          {/* Время + кнопка удаления (своя — всегда видимая тач-зона) */}
          <div
            className={`mt-1 flex items-center justify-end gap-2 ${
              isOwnMessage ? 'text-blue-100' : 'text-gray-400'
            }`}
          >
            <span className="text-xs">{timeAgo}</span>
            {isOwnMessage && (
              <button
                onClick={handleDelete}
                aria-label="Удалить сообщение"
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 hover:text-red-200"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
