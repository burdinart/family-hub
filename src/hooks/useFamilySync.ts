// Хук жизненного цикла данных: связывает authStore -> профиль -> familyStore.
// Использование: в корневом компоненте приложения (App).
// Real-time First: подписки на profiles и family пересылают состояние при
// любых изменениях у других участников.

import { useEffect } from 'react';
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabase';
import { mapProfile } from '../features/family/services/familyService';
import { TABLES } from '../types/database';
import { useAuthStore } from '../store/authStore';
import { useFamilyStore } from '../store/familyStore';

/** Имя пользователя из user_metadata (Supabase Auth не имеет displayName) */
function userDisplayName(user: User): string {
  return (user.user_metadata?.full_name as string | undefined) ?? '';
}

export function useFamilySync() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const subscribeToFamily = useFamilyStore((s) => s.subscribeToFamily);
  const clearFamily = useFamilyStore((s) => s.clearFamily);

  // 1. Подписка на состояние авторизации Supabase
  useEffect(() => {
    const unsubscribe = useAuthStore.getState().initAuthListener();
    return unsubscribe;
  }, []);

  // 2. Профиль пользователя: чтение + realtime-подписка на public.profiles
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;

    // Первичная загрузка профиля
    void supabase
      .from(TABLES.profiles)
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Profile load error:', error);
          useAuthStore.getState().setError(error.message);
          return;
        }
        if (data) {
          setProfile(mapProfile(data, user.email, userDisplayName(user)));
        } else {
          // Триггер handle_new_user не сработал — создаём профиль минимально
          void supabase
            .from(TABLES.profiles)
            .insert({ id: user.id, email: user.email ?? '', full_name: userDisplayName(user) })
            .then(() => {
              if (!cancelled) {
                setProfile(mapProfile(
                  { id: user.id, email: user.email ?? '', full_name: userDisplayName(user), avatar_url: null, family_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                  user.email,
                  userDisplayName(user),
                ));
              }
            });
        }
      });

    // Realtime: изменения профиля (в т.ч. family_id после создания/вступления в семью)
    const channel: RealtimeChannel = supabase
      .channel(`profile:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.profiles, filter: `id=eq.${user.id}` },
        (payload) => {
          if (!cancelled && payload.new) {
            setProfile(mapProfile(payload.new as never, user.email, userDisplayName(user)));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user, setProfile]);

  // 3. Семья: при появлении familyId в профиле — подписываемся на realtime семьи
  useEffect(() => {
    const familyId = profile?.familyId;
    if (!familyId) {
      clearFamily();
      return;
    }
    const unsubscribe = subscribeToFamily(familyId);
    return unsubscribe;
  }, [profile?.familyId, subscribeToFamily, clearFamily]);
}
