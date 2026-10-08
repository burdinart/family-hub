-- Family Hub: схема Supabase (PostgreSQL). Выполнить целиком в Supabase Studio -> SQL Editor.
-- Идемпотентна: можно запускать повторно.
-- Таблицы соответствуют src/types/app.ts: families, profiles, events, tasks,
-- shopping_lists, shopping_items, marks, documents.

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

create table if not exists public.marks (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null,
  lat        double precision not null,
  lng        double precision not null,
  radius     integer not null default 200,   -- метры
  category   text not null default 'other',
  created_by uuid not null references auth.users (id) on delete cascade,
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
alter table public.documents add column if not exists file_path   text;
alter table public.documents add column if not exists file_name   text;
alter table public.documents add column if not exists file_size   bigint not null default 0;
alter table public.documents add column if not exists mime_type   text not null default 'application/octet-stream';
alter table public.documents add column if not exists description text;

-- Индексы по family_id — все запросы идут с фильтром семьи
create index if not exists events_family_idx      on public.events      (family_id);
create index if not exists tasks_family_idx       on public.tasks       (family_id);
create index if not exists lists_family_idx       on public.shopping_lists (family_id);
create index if not exists items_list_idx         on public.shopping_items (list_id);
create index if not exists marks_family_idx       on public.marks       (family_id);
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
  execute format('alter table public.%I enable row level security', 'marks');
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

-- Данные семьи (events/tasks/lists/items/marks/documents):
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

drop policy if exists marks_rw on public.marks;
create policy marks_rw on public.marks
  for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id) and created_by = auth.uid());

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
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'marks'); exception when duplicate_object then null; end $$;
do $$ begin execute format('alter publication supabase_realtime add table public.%I', 'documents'); exception when duplicate_object then null; end $$;

-- ============ 6. Storage: бакет «сейфа» = documents (публичный для чтения) ============
-- Публичность bucket не нарушает приватность: доступ к файлам имеют только участники
-- семьи (RLS на таблице documents), а file_url известен лишь им. Публичный URL нужен,
-- чтобы <img>/<iframe> открывали файлы без токена авторизации.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists documents_storage_access on storage.objects;
create policy documents_storage_access on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.is_family_member(
    (split_part(name, '/', 1))::uuid
  ))
  with check (bucket_id = 'documents' and public.is_family_member(
    (split_part(name, '/', 1))::uuid
  ));

-- Совместимость: старый приватный бакет 'vault' — политики удаляем (файлы мигрируют в documents)
drop policy if exists vault_access on storage.objects;

-- Файлы хранятся по пути {family_id}/{timestamp}-{random}.{ext}
