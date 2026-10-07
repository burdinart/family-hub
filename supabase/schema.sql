-- Family Hub: схема Supabase (PostgreSQL + RLS + Realtime)
-- Выполнить целиком в Supabase Studio -> SQL Editor.
-- Повторное выполнение безопасно (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- Вспомогательная функция: пользователь состоит в данной семье?
create or replace function public.is_family_member(family uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = family
      and fm.user_id = auth.uid()
  );
$$;

-- =====================================================================
-- ПРОФИЛИ (сопоставлены с auth.users по id)
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text   not null default '',
  full_name   text   not null default '',
  avatar_url  text,
  family_id   uuid,          -- FK добавлен ниже, чтобы избежать циклической зависимости
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- СЕМЬИ
-- =====================================================================
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references public.profiles (id),
  invite_code text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_family_id_fkey;
alter table public.profiles
  add constraint profiles_family_id_fkey
  foreign key (family_id) references public.families (id) on delete set null;

-- =====================================================================
-- УЧАСТНИКИ СЕМЬИ (роль + цвет; вместо jsonb-массива из Firestore-версии)
-- =====================================================================
create table if not exists public.family_members (
  family_id  uuid not null references public.families (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  nickname   text not null default '',
  color      text not null default 'blue'
             check (color in ('red','orange','amber','green','blue','violet')),
  joined_at  timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- =====================================================================
-- КАЛЕНДАРЬ
-- =====================================================================
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  created_by      uuid not null references public.profiles (id),
  title           text not null,
  description     text  not null default '',
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  all_day         boolean not null default false,
  type            text not null default 'event' check (type in ('event','reminder','appointment')),
  recurrence      text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
  participant_ids uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =====================================================================
-- ЗАДАЧИ
-- =====================================================================
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  title       text not null,
  description text not null default '',
  status      text not null default 'todo' check (status in ('todo','in-progress','done')),
  priority    text not null default 'medium' check (priority in ('low','medium','high')),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date    date,
  position    numeric not null default 0,   -- порядок в колонке (drag-and-drop)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- СПИСКИ ПОКУПОК (items — jsonb: [{id,name,quantity,checked}])
-- =====================================================================
create table if not exists public.shopping_lists (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name      text not null,
  items     jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- ХРАНИЛИЩЕ ДОКУМЕНТОВ (файлы — в Storage bucket 'vault', путь {family_id}/{id})
-- =====================================================================
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  name        text not null,
  category    text not null default 'other'
              check (category in ('passport','insurance','medical','education','contract','other')),
  storage_path text not null,
  mime_type   text not null default '',
  size_bytes  bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- GPS-МЕТКИ
-- =====================================================================
create table if not exists public.location_marks (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title      text not null,
  address    text not null default '',
  lat        double precision not null,
  lng        double precision not null,
  emoji      text not null default '📍',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Индексы для realtime-запросов по семье
create index if not exists events_family_idx          on public.events (family_id, start_at);
create index if not exists tasks_family_idx           on public.tasks (family_id, status, position);
create index if not exists shopping_lists_family_idx  on public.shopping_lists (family_id);
create index if not exists documents_family_idx       on public.documents (family_id);
create index if not exists location_marks_family_idx  on public.location_marks (family_id);
create index if not exists family_members_user_idx    on public.family_members (user_id);

-- =====================================================================
-- ROW LEVEL SECURITY: доступ только участникам семьи
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.families        enable row level security;
alter table public.family_members  enable row level security;
alter table public.events          enable row level security;
alter table public.tasks           enable row level security;
alter table public.shopping_lists  enable row level security;
alter table public.documents       enable row level security;
alter table public.location_marks  enable row level security;

-- Профили: читать может любой аутентифицированный (нужно для отображения
-- участников), изменять/создавать — только владелец профиля.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Семьи: видно и меняется участниками; удаление — только владельцем.
-- ВНИМАНИЕ: families_select не позволит проверить инвайт-код до вступления,
-- поэтому для присоединения используется SECURITY DEFINER функция join_family.
drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select to authenticated using (is_family_member(id));

drop policy if exists families_insert on public.families;
create policy families_insert on public.families
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update to authenticated using (is_family_member(id)) with check (is_family_member(id));

drop policy if exists families_delete on public.families;
create policy families_delete on public.families
  for delete to authenticated using (owner_id = auth.uid());

-- Участники: чтение — участникам семьи; добавление — существующим участником
-- или самим собой (присоединение по инвайт-коду); удаление — себя или (владелец).
drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members
  for select to authenticated using (is_family_member(family_id));

drop policy if exists members_insert on public.family_members;
create policy members_insert on public.family_members
  for insert to authenticated with check (is_family_member(family_id) or user_id = auth.uid());

-- Изменение роли возможно только owner/admin семьи.
drop policy if exists members_update on public.family_members;
create policy members_update on public.family_members
  for update to authenticated
  using (is_family_member(family_id))
  with check (
    is_family_member(family_id)
    and (
      role = 'member'
      or exists (
        select 1 from public.family_members admin
        where admin.family_id = family_members.family_id
          and admin.user_id = auth.uid()
          and admin.role in ('owner','admin')
      )
    )
  );

drop policy if exists members_delete on public.family_members;
create policy members_delete on public.family_members
  for delete to authenticated
  using (
    is_family_member(family_id)
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.family_members admin
        where admin.family_id = family_members.family_id
          and admin.user_id = auth.uid()
          and admin.role in ('owner','admin')
      )
    )
  );

-- Остальные таблицы: полный CRUD для участников своей семьи.
drop policy if exists events_crud on public.events;
create policy events_crud on public.events
  for all to authenticated
  using (is_family_member(family_id))
  with check (is_family_member(family_id) and created_by = auth.uid());

drop policy if exists tasks_crud on public.tasks;
create policy tasks_crud on public.tasks
  for all to authenticated
  using (is_family_member(family_id))
  with check (is_family_member(family_id));

drop policy if exists shopping_crud on public.shopping_lists;
create policy shopping_crud on public.shopping_lists
  for all to authenticated
  using (is_family_member(family_id))
  with check (is_family_member(family_id));

drop policy if exists documents_crud on public.documents;
create policy documents_crud on public.documents
  for all to authenticated
  using (is_family_member(family_id))
  with check (is_family_member(family_id) and uploaded_by = auth.uid());

drop policy if exists marks_crud on public.location_marks;
create policy marks_crud on public.location_marks
  for all to authenticated
  using (is_family_member(family_id))
  with check (is_family_member(family_id) and created_by = auth.uid());

-- =====================================================================
-- RPC: присоединение к семье по инвайт-коду.
-- SECURITY DEFINER, чтобы пройти RLS до появления членства.
-- Возвращает id семьи; ошибка 'INVALID_CODE' — если код не найден.
-- =====================================================================
create or replace function public.join_family(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  fam_id uuid;
begin
  select id into fam_id
  from public.families
  where invite_code = upper(trim(code))
  limit 1;

  if fam_id is null then
    raise exception 'INVALID_CODE';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (fam_id, auth.uid(), 'member')
  on conflict (family_id, user_id) do nothing;

  update public.profiles set family_id = fam_id where id = auth.uid();

  return fam_id;
end $$;

grant execute on function public.join_family(text) to authenticated;

-- =====================================================================
-- REALTIME: публикации изменений для клиентских подписок (идемпотентно)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','families','family_members','events','tasks','shopping_lists','documents','location_marks']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- уже добавлена
    end;
  end loop;
end $$;

-- =====================================================================
-- TRIGGER: создание профиля при регистрации + авто-update updated_at
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email,''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','families','events','tasks','shopping_lists','documents','location_marks']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- =====================================================================
-- STORAGE: приватный бакет vault + политики «только участники семьи»
-- Путь файла: vault/{family_id}/{document_id}.{ext}
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;

drop policy if exists "vault read for family members" on storage.objects;
create policy "vault read for family members" on storage.objects
  for select to authenticated
  using (bucket_id = 'vault' and public.is_family_member((storage.foldername(name))[1]::uuid));

drop policy if exists "vault insert for family members" on storage.objects;
create policy "vault insert for family members" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vault' and public.is_family_member((storage.foldername(name))[1]::uuid));

drop policy if exists "vault update for family members" on storage.objects;
create policy "vault update for family members" on storage.objects
  for update to authenticated
  using (bucket_id = 'vault' and public.is_family_member((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'vault' and public.is_family_member((storage.foldername(name))[1]::uuid));

drop policy if exists "vault delete for family members" on storage.objects;
create policy "vault delete for family members" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vault' and public.is_family_member((storage.foldername(name))[1]::uuid));
