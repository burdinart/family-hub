-- ============================================================
-- Family Hub: расширение таблицы notifications для генерации уведомлений из приложения.
-- Добавляет колонки sender_id (кто инициировал событие), reference_id/reference_type
-- (ссылка на объект задачи/события/документа/сообщения) и разрешает INSERT участникам
-- семьи (политика проверяет family membership через profiles).
--
-- Идемпотентно: повторный прогон безопасен. Выполнить через `supabase db push`.
-- ТРЕБУЕТ существующей таблицы public.notifications (миграция 20261009000000).
-- ============================================================

-- 1. Новые колонки (если уже есть — ALTER ... ADD COLUMN IF NOT EXISTS не падает)
alter table public.notifications
  add column if not exists sender_id     uuid references auth.users (id) on delete set null,
  add column if not exists reference_id  text,
  add column if not exists reference_type text;

comment on column public.notifications.sender_id is 'Кто инициировал событие (не получатель); null — системное';
comment on column public.notifications.reference_id is 'id объекта-источника (task/event/document/message)';
comment on column public.notifications.reference_type is 'Тип источника: task | event | document | message | gift | system';

-- 2. Политика вставки: участник семьи может создавать уведомления для членов своей семьи.
--    Проверка membership идёт через profiles (RLS profiles_select уже разрешает читать
--    профили своей семьи). Получатель user_id тоже обязан быть из той же семьи —
--    это ограничивает произвольную отправку «кому попало».
drop policy if exists notifications_insert_family_member on public.notifications;
create policy notifications_insert_family_member on public.notifications
  for insert to authenticated
  with check (
    -- семья существует и совпадает с семьёй автора
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.family_id = notifications.family_id
    )
    -- адресат — тоже участник той же семьи
    and exists (
      select 1 from public.profiles r
      where r.id = notifications.user_id and r.family_id = notifications.family_id
    )
  );
