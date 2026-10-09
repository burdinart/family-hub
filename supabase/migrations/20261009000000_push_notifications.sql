-- ============================================================
-- Family Hub: миграция Push-уведомлений (PWA / Web Push)
-- Создаёт таблицы notifications и push_subscriptions, RLS-политики
-- и триггер dispatch_push, который вызывает Edge Function send-push
-- через pg_net после вставки уведомления.
--
-- Выполнить ЦЕЛИКОМ в Supabase Studio -> SQL Editor (или supabase db push).
-- Идемпотентно: повторный прогон не падает.
--
-- ТРЕБУЕТ:
--   * включённого расширения pg_net (Database -> Extensions -> pg_net);
--   * задеплоенной Edge Function send-push;
--   * установленных секретов (supabase secrets set ...):
--       VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
--       SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
-- ============================================================

-- 1. Таблица уведомлений (входящие для конкретного пользователя).
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  family_id   uuid references public.families (id)      on delete cascade,
  type        text not null default 'info',             -- task | chat | points | gift | system
  title       text not null,
  body        text not null default '',
  url         text not null default '/',                -- куда вести при клике (относительный путь SPA)
  read_at     timestamptz,                              -- null = не прочитано
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- 2. Подписки Web Push (одно устройство = одна строка).
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null,
  p256dh_key  text not null,
  auth_key    text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- endpoint уникален: upsert с фронтенда ({ onConflict: 'endpoint' }) работает корректно
create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- 3. RLS: включаем и создаём политики идемпотентно (drop + create).
alter table public.notifications       enable row level security;
alter table public.push_subscriptions  enable row level security;

-- Уведомления: пользователь видит/обновляет/удаляет только свои.
-- Вставка из приложения НЕ разрешена — уведомления создаются сервисной
-- логикой (Edge Function / SQL с service_role обходит RLS).
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (auth.uid() = user_id);

-- Подписки: полный CRUD только над своими (фронтенд подписывается/отписывается сам).
drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists push_subs_insert_own on public.push_subscriptions;
create policy push_subs_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists push_subs_update_own on public.push_subscriptions;
create policy push_subs_update_own on public.push_subscriptions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_delete_own on public.push_subscriptions
  for delete to authenticated
  using (auth.uid() = user_id);

-- 4. Триггер-диспетчер: после вставки уведомления асинхронно вызываем
--    Edge Function send-push (pg_net POST на URL функции).
--    Функция сама читает notification по id и рассылает push на все подписки.
--    ВАЖНО: ссылка на функцию существует только после `supabase functions deploy send-push`.
create or replace function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://lvdslmaockpsyrfhlblc.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists notifications_after_insert_push on public.notifications;
create trigger notifications_after_insert_push
  after insert on public.notifications
  for each row
  execute function public.dispatch_push();

-- 5. Realtime: фронтенд подписывается на новые уведомления в реальном времени.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
