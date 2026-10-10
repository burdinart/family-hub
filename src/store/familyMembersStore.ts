// src/store/familyMembersStore.ts — кэш членов текущей семьи (id, имя, аватар).
// Используется карточками задач для отображения имени исполнителя без лишней
// загрузки данных. Загружается один раз; при смене пользователя/семьи сбрасывается.

import { create } from 'zustand';
import { getFamilyMembers } from '@/services/familyMembersService';
import { useAuthStore } from '@/store/authStore';
import type { TaskAssignee } from '@/types';

interface FamilyMembersState {
  members: TaskAssignee[];
  /** id семьи, для которой загружен список (null — ещё не загружался) */
  loadedForFamilyId: string | null;
  isLoading: boolean;

  /** Загрузить список, если он ещё не актуален для текущей семьи */
  load: () => Promise<void>;
  /** Сброс кэша (при выходе из семьи / смене аккаунта) */
  reset: () => void;
}

export const useFamilyMembersStore = create<FamilyMembersState>((set, get) => ({
  members: [],
  loadedForFamilyId: null,
  isLoading: false,

  load: async () => {
    const familyId = useAuthStore.getState().user?.family_id ?? null;

    // Семьи нет — очищаем кэш и выходим
    if (!familyId) {
      if (get().members.length > 0 || get().loadedForFamilyId !== null) {
        set({ members: [], loadedForFamilyId: null });
      }
      return;
    }

    // Уже загружено для этой семьи — не дергаем БД повторно
    if (get().loadedForFamilyId === familyId) return;

    set({ isLoading: true });
    try {
      const members = await getFamilyMembers(familyId);
      set({ members, loadedForFamilyId: familyId, isLoading: false });
    } catch (err) {
      console.error('Не удалось загрузить членов семьи:', err);
      set({ isLoading: false });
    }
  },

  reset: () => set({ members: [], loadedForFamilyId: null, isLoading: false }),
}));
