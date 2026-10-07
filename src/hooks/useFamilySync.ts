// Хук жизненного цикла семьи: связывает authStore -> профиль -> familyStore.
// Использование: в корневом компоненте приложения (App).

import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getDbInstance } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { useFamilyStore } from '../store/familyStore';
import type { UserProfile } from '../types';

/** Firestore Timestamp | null -> Date | null */
function toNullableDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybe = (value as { toDate: () => Date }).toDate();
    return maybe instanceof Date ? maybe : null;
  }
  return null;
}

export function useFamilySync() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const subscribeToFamily = useFamilyStore((s) => s.subscribeToFamily);
  const clearFamily = useFamilyStore((s) => s.clearFamily);

  // 1. Подписка на состояние авторизации
  useEffect(() => {
    const unsubscribe = useAuthStore.getState().initAuthListener();
    return unsubscribe;
  }, []);

  // 2. Профиль пользователя: real-time подписка на users/{uid}
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileRef = doc(getDbInstance(), 'users', user.uid);
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setProfile(null);
          return;
        }
        const data = snapshot.data();
        const nextProfile: UserProfile = {
          id: snapshot.id,
          email: data.email ?? user.email ?? '',
          displayName: data.displayName ?? user.displayName ?? '',
          photoURL: data.photoURL ?? user.photoURL ?? null,
          familyId: data.familyId ?? null,
          createdAt: toNullableDate(data.createdAt),
          updatedAt: toNullableDate(data.updatedAt),
        };
        setProfile(nextProfile);
      },
      (err) => {
        console.error('Profile subscription error:', err);
        useAuthStore.getState().setError(err.message);
      },
    );

    return unsubscribe;
  }, [user, setProfile]);

  // 3. Семья: при появлении familyId в профиле — подписываемся на families/{id}
  useEffect(() => {
    if (!profile?.familyId) {
      clearFamily();
      return;
    }
    const unsubscribe = subscribeToFamily(profile);
    return unsubscribe;
  }, [profile, subscribeToFamily, clearFamily]);
}
