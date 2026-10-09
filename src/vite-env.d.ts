/// <reference types="vite/client" />

// Типизация переменных окружения (VITE_*) — читаются из .env.local
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Публичный VAPID-ключ для Web Push (безопасен для фронтенда) */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
