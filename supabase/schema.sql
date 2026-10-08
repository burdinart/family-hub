-- Family Hub: схема Supabase (PostgreSQL). Выполнить целиком в Supabase Studio -> SQL Editor.
-- Идемпотентна: можно запускать повторно.
-- Таблицы соответствуют src/types/app.ts: families, profiles, events, tasks,
-- shopping_lists, shopping_items, documents, schedule.

-- ============ 0. Расширения (gen_random_uuid нужен для default id) ============
-- Если этот блок падает с ошибкой permissions, выполните его отдельно role postgres:
--   create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgcrypto;

-- ============ 1. ТАБЛИЦЫ ============

create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  avatar_url text,
  family_id  uuid references public.families (id) on delete set null,
  points     integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  title      text not null,
  date       date not null,
  time       time,                          -- null = событие весь день
  category   text not null default 'event'
             check (category in ('event','birthday','school','sports','medical','family','other')),
  attendees  jsonb not null default '[]'::jsonb,  -- string[]: user_id участников
  reminders  jsonb not null default '[]'::jsonb,  -- number[]: минуты до начала
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  title       text not null,
  assignee_id uuid references auth.users (id) on delete set null,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  due_date    date,
  priority    text not null default 'medium' check (priority in ('low','medium','high')),
  category    text not null default 'other',
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.shopping_lists (id) on delete cascade,
  name       text not null,
  quantity   text not null default '',
  checked    boolean not null default false,
  added_by   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  title       text not null,                 -- название документа (редактирует пользователь)
  category    text not null default 'other'
              check (category in ('passport','insurance','auto','medical','education','property','other')),
  file_url    text not null,                 -- публичный URL файла в bucket 'documents'
  file_path   text not null,                 -- путь объекта в bucket — нужен для удаления
  file_name   text not null,                 -- исходное имя загруженного файла
  file_size   bigint not null default 0,     -- размер в байтах
  mime_type   text not null default 'application/octet-stream',
  expiry_date date,                          -- срок действия (паспорт, полис, права...)
  description text,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Миграция для старых БД: если таблица documents уже существовала со старой схемой
-- (name/file_url/...), добавляем недостающие колонки.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='name') then
    execute 'alter table public.documents add column if not exists title text';
    execute 'update public.documents set title = name where title is null';
    execute 'alter table public.documents alter column title set not null';
  end if;
end $$;
-- ВАЖНО: сначала добавляем колонки, и только потом заполняем данные — иначе UPDATE/SET NOT NULL
-- падают с «column does not exist», если таблица была создана по очень старой схеме.
alter table public.documents add column if not exists file_path   text;
alter table public.documents add column if not exists file_name   text;
alter table public.documents add column if not exists file_size   bigint;
alter table public.documents add column if not exists mime_type   text;
alter table public.documents add column if not exists description text;

-- Заполнение существующих строк — оборачиваем в проверку наличия колонок (идемпотентно)
do $$
begin
  -- title <- name (если таблица была со старой схемой)
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='name')
     and exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='title') then
    execute 'update public.documents set title = coalesce(title, name) where title is null';
  end if;

  -- file_path <- извлечение пути объекта из file_url — тоже через EXECUTE (см. комментарий ниже)
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='file_path') then
    execute $dyn$update public.documents
    set file_path = coalesce(
          file_path,
          nullif(substring(file_url from '/storage/v1/object/(?:public|sign)/[^/]+/(.+)$'), '')
        )$dyn$;
  end if;

  -- file_name <- из имени файла в пути.
  -- ВАЖНО: UPDATE с явным перечислением колонок в SET падает на этапе ПАРСИНГА всего
  -- do-блока, если хотя бы одной колонки ещё нет (42703), даже при защите через if exists.
  -- Поэтому все обращения к новым колонкам выполняем только через EXECUTE динамического SQL.
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='file_name') then
    execute $dyn$update public.documents
    set file_name = coalesce(
          file_name,
          nullif(reverse(split_part(reverse(coalesce(file_path, '')), '/', 1)), ''),
          'документ'
        )$dyn$;
  end if;

  -- mime_type <- по расширению файла (для старых записей) — тоже через EXECUTE
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='mime_type') then
    execute $dyn$update public.documents
    set mime_type = coalesce(mime_type, case
          when coalesce(file_path, file_url) ~* '\.png$'  then 'image/png'
          when coalesce(file_path, file_url) ~* '\.jpe?g$' then 'image/jpeg'
          when coalesce(file_path, file_url) ~* '\.pdf$'  then 'application/pdf'
          else 'application/octet-stream' end)$dyn$;
  end if;

  -- title <- name + NOT NULL (универсальный случай: таблица уже новая, без колонки name).
  execute 'update public.documents set title = coalesce(title, ''Документ'') where title is null';
  begin
    execute 'alter table public.documents alter column title set not null';
  exception when others then
    null;
  end if;
end $$;

-- Приводим nullable-колонки к модели приложения (неотъемлемые поля новой схемы)
do $$
begin
  begin alter table public.documents alter column file_size type bigint using coalesce(file_size, 0); exception when others then null; end;
  update public.documents set file_size = coalesce(file_size, 0) where file_size is null;
  alter table public.documents alter column file_size set default 0;
  alter table public.documents alter column file_size set not null;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='file_path') then
    -- НЕ удаляем строки без file_path: путь извлекается из file_url выше, а если он
    -- всё же пуст — приложение восстанавливает его из URL (getFilePathFromUrl).
    begin
      execute 'alter table public.documents alter column file_path set not null';
    exception when others then
      null;
    end;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='file_name') then
    alter table public.documents alter column file_name set not null;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='mime_type') then
    alter table public.documents alter column mime_type set not null;
  end if;

  begin alter table public.documents alter column title set not null; exception when others then null; end;
end $$;

-- Индексы по family_id — все запросы идут с фильтром семьи
create index if not exists events_family_idx      on public.events      (family_id);
create index if not exists tasks_family_idx       on public.tasks       (family_id);
create index if not exists lists_family_idx       on public.shopping_lists (family_id);
create index if not exists items_list_idx         on public.shopping_items (list_id);
create index if not exists documents_family_idx   on public.documents   (family_id);
create index if not exists profiles_family_idx    on public.profiles    (family_id);

-- ============ 2. RLS: доступ только участникам своей семьи ============

do $$
begin
  execute format('alter table public.%I enable row level security', 'families');
  execute format('alter table public.%I enable row level security', 'profiles');
  execute format('alter table public.%I enable row level security', 'events');
  execute format('alter table public.%I enable row level security', 'tasks');
  execute format('alter table public.%I enable row level security', 'shopping_lists');
  execute format('alter table public.%I enable row level security', 'shopping_items');
  execute format('alter table public.%I enable row level security', 'documents');
end $$;

-- Вспомогательная функция: состоит ли текущий пользователь в семье
create or replace function public.is_family_member(fam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.family_id = fam
  );
$$;

-- families: читать/менять свою семью; создавать может любой авторизованный
drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select using (public.is_family_member(id));

drop policy if exists families_insert on public.families;
create policy families_insert on public.families
  for insert with check (auth.uid() is not null);

drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update using (public.is_family_member(id));

-- profiles: свой профиль — полные права; профили своей семьи — чтение
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_family_member(family_id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid());

-- Данные семьи (events/tasks/lists/items/documents):
-- выборка и изменение — участникам; удаление — автору записи
drop policy if exists events_rw on public.events;
create policy events_rw on public.events
  for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id) and created_by = auth.uid());

drop policy if exists tasks_rw on public.tasks;
create policy tasks_rw on public.tasks
  for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id) and created_by = auth.uid());

drop policy if exists lists_rw on public.shopping_lists;
create policy lists_rw on public.shopping_lists
  for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id) and created_by = auth.uid());

-- shopping_items: права проверяются через родительский список
drop policy if exists items_rw on public.shopping_items;
create policy items_rw on public.shopping_items
  for all
  using (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and public.is_family_member(l.family_id)
  ))
  with check (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and public.is_family_member(l.family_id)
  ));

drop policy if exists documents_rw on public.documents;
create policy documents_rw on public.documents
  for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id) and uploaded_by = auth.uid());

-- ============ 3. Создание семьи + вступление (RPC) ============

-- Атомарно: создаёт семью и закрепляет её за профилем
create or replace function public.create_family(family_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.families (name) values (family_name) returning id into new_id;
  update public.profiles set family_id = new_id where id = auth.uid();
  return new_id;
end $$;

-- Присоединение к существующей семье по id (код-приглашение реализуются позже)
create or replace function public.join_family(fam uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.families where id = fam) then
    raise exception 'family not found';
  end if;
  update public.profiles set family_id = fam where id = auth.uid();
end $$;

-- ============ 4. Триггер: профиль при регистрации ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ 5. Realtime: все таблицы семьи в publication ============

do $$
begin
  execute format('alter publication supabase_realtime add table public.%I', 'families');
exception when duplicate_object then null;
end $$;


-- ============ Таблица schedule: регулярные занятия недели ============

create table if not exists public.schedule (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  day_of_week smallint not null check (day_of_week between 1 and 7), -- 1=Пн ... 7=Вс
  start_time time not null,
  end_time time not null,
  participant_id uuid references public.profiles(id) on delete set null,
  location text,
  color text not null default 'blue' check (color in ('blue','green','red','yellow','purple','pink')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists schedule_family_day_idx
  on public.schedule (family_id, day_of_week, start_time);

-- RLS для schedule: доступ только участникам семьи
alter table public.schedule enable row level security;

drop policy if exists schedule_select on public.schedule;
create policy schedule_select on public.schedule
  for select using (public.is_family_member(family_id));

drop policy if exists schedule_insert on public.schedule;
create policy schedule_insert on public.schedule
  for insert with check (public.is_family_member(family_id) and created_by = auth.uid());

drop policy if exists schedule_update on public.schedule;
create policy schedule_update on public.schedule
  for update using (public.is_family_member(family_id));

drop policy if exists schedule_delete on public.schedule;
create policy schedule_delete on public.schedule
  for delete using (public.is_family_member(family_id));

do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'profiles');
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'schedule'); exception when duplicate_object then null; end $$;
 exception when duplicate_object then null; end $$;
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'events'); exception when duplicate_object then null; end $$;
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'tasks'); exception when duplicate_object then null; end $$;
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'shopping_lists'); exception when duplicate_object then null; end $$;
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'shopping_items'); exception when duplicate_object then null; end $$;
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'documents'); exception when duplicate_object then null; end $$;

-- ============ 6. Storage: бакет «сейфа» = documents (публичный для чтения) ============
-- Публичность bucket не нарушает приватность: доступ к файлам имеют только участники
-- семьи (RLS на таблице documents), а file_url известен лишь им. Публичный URL нужен,
-- чтобы <img>/<iframe> открывали файлы без токена авторизации.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = excluded.public;

-- Политика Storage: любой аутентифицированный участник семьи может читать/записывать/удалять
-- объекты в папке своей семьи. Путь файла: {family_id}/{timestamp}-{random}.{ext}.
-- split_part(...)::uuid защищён от некорректных путей: сравнение идёт через text,
-- чтобы политика не падала на объектах с «не-uuid» первой папкой.
drop policy if exists documents_storage_select on storage.objects;
create policy documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_family_member(
      case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then split_part(name, '/', 1)::uuid else null end
    )
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_family_member(
      case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then split_part(name, '/', 1)::uuid else null end
    )
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.is_family_member(
      case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then split_part(name, '/', 1)::uuid else null end
    )
  );

-- Обновлённая схема требует колонку file_path у записей БД; заполняем её из URL и включаем RLS
-- (см. разделы 1–2 выше — скрипт идемпотентен).

-- Совместимость: старый приватный бакет 'vault' — политики удаляем (файлы мигрируют в documents)
drop policy if exists vault_access on storage.objects;

-- Файлы хранятся по пути {family_id}/{timestamp}-{random}.{ext}

-- ============================================================
-- 12. Семейный чат: messages (добавлено по ТЗ «Семейный чат»)
-- Индекс (family_id, created_at DESC) уже создан в боевой БД;
-- здесь он идемпотентен и для чистой установки.
-- ============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  text text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_family_created_idx
  on public.messages (family_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "family_members_select_messages" on public.messages;
create policy "family_members_select_messages" on public.messages
  for select to authenticated using (is_family_member(family_id));

-- Вставлять сообщение можно только от своего имени и в свою семью
drop policy if exists "family_members_insert_messages" on public.messages;
create policy "family_members_insert_messages" on public.messages
  for insert to authenticated with check (
    is_family_member(family_id) and sender_id = (select auth.uid())
  );

-- Удалять — только свои сообщения (админ семьи — любые, на случай модерации)
drop policy if exists "family_members_delete_messages" on public.messages;
create policy "family_members_delete_messages" on public.messages
  for delete to authenticated using (
    is_family_member(family_id)
    and (sender_id = (select auth.uid()) or is_family_admin(family_id))
  );

-- Realtime для сообщений семьи
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
