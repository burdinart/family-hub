// Конфигурация Supabase: единая точка инициализации клиента.
// Ключи читаются из .env.local (см. .env.example), НИКОГДА не хардкодятся.
// VITE_SUPABASE_ANON_KEY — публичный anon-ключ, безопасен для браузера
// (реальный доступ ограничивается Row Level Security на стороне Supabase).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Чтение переменных окружения с проверкой на этапе запуска */
function readEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    // Понятная ошибка вместо тихого сбоя инициализации клиента
    throw new Error(
      `Missing environment variable "${name}". Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

// Единственный экземпляр клиента в приложении (lazy — создаётся один раз)
let client: SupabaseClient | undefined;

/** Ленивая инициализация Supabase-клиента. Вызывается при первом обращении. */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(readEnv('VITE_SUPABASE_URL'), readEnv('VITE_SUPABASE_ANON_KEY'));
  }
  return client;
}

/** Проверка конфигурации без бросания исключения (для friendly-ошибки на старте). */
export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}
