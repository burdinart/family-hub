// Глобальный store семьи.
// Real-time подписка на документ families/{familyId} через onSnapshot.
// Компоненты НЕ обращаются к Firebase напрямую — только через этот store/сервисы.

import { create } from 'zustand';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getDbInstance } from '../config/firebase';
import type { Family, FamilyMember, LoadStatus, UserProfile } from '../types';

interface FamilyState {
  /** Активная семья пользователя */
  family: Family | null;
  /** Статус загрузки real-time данных */
  status: LoadStatus;
  error: string | null;

  // --- Selectors-хелперы (через getters в actions) ---
  getMemberById: (userId: string) => FamilyMember | undefined;

  // --- Actions ---
  setStatus: (status: LoadStatus) => void;
  setError: (error: string | null) => void;
  clearFamily: () => void;

  /**
   * Подписка на Firestore-документ семьи по профилю пользователя.
   * @returns функция отписки (вызывать в cleanup useEffect)
   */
  subscribeToFamily: (profile: UserProfile) => Unsubscribe;
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family: null,
  status: 'idle',
  error: null,

  getMemberById: (userId) => {
    const family = get().family;
    return family?.members.find((m) => m.userId === userId);
  },

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  clearFamily: () => set({ family: null, status: 'idle', error: null }),

  subscribeToFamily: (profile) => {
    const { setStatus, setError } = get();

    // Пользователь ещё не состоит в семье — выходим в состояние idle
    if (!profile.familyId) {
      set({ family: null, status: 'ready' });
      // no-op отписка
      return () => undefined;
    }

    setStatus('loading');

    const familyRef = doc(getDbInstance(), 'families', profile.familyId);

    // Real-time First: любые изменения у других участников мгновенно видны здесь
    const unsubscribe = onSnapshot(
      familyRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Семья удалена или нет прав на чтение
          set({ family: null, status: 'ready', error: null });
          return;
        }
        const data = snapshot.data();
        const family: Family = {
          id: snapshot.id,
          name: data.name ?? '',
          ownerId: data.ownerId ?? '',
          inviteCode: data.inviteCode ?? '',
          members: data.members ?? [],
          createdAt: data.createdAt?.toDate() ?? null,
          updatedAt: data.updatedAt?.toDate() ?? null,
        };
        set({ family, status: 'ready', error: null });
      },
      (err) => {
        // Всегда логируем и показываем понятную ошибку
        console.error('Family subscription error:', err);
        setStatus('error');
        setError(err.message);
      },
    );

    return unsubscribe;
  },
}));
