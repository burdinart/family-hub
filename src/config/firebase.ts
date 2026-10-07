// Конфигурация Firebase: инициализация приложения, Auth, Firestore, Storage.
// Ключи читаются из .env.local (см. .env.example), НИКОГДА не хардкодятся.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/** Чтение переменных окружения с проверкой на этапе запуска */
function readEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    // Понятная ошибка вместо тихого сбоя инициализации Firebase
    throw new Error(
      `Missing environment variable "${name}". Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
};

// Единственные экземпляры сервисов в приложении (lazy — создаются один раз)
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

/** Ленивая инициализация Firebase. Вызывается при первом обращении к сервисам. */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getDbInstance(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getStorageInstance(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

/**
 * Проверка готовности конфигурации без инициализации Firebase.
 * Используется на старте приложения для показа friendly-ошибки.
 */
export function isFirebaseConfigured(): boolean {
  return Object.values(firebaseConfig).every(Boolean);
}
