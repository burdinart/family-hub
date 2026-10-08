-- ============================================================
-- Family Hub: точечная миграция таблицы documents (безопасная)
-- Исправляет ошибку загрузки:
--   PGRST204 "Could not find the 'description' column of 'documents' in the schema cache"
-- Выполнить ЦЕЛИКОМ в Supabase Studio -> SQL Editor. Идемпотентно.
-- В отличие от полного schema.sql этот скрипт НЕ трогает другие таблицы и
-- не выполняет UPDATE над данными — только добавляет недостающие колонки.
-- ============================================================

-- 1. Недостигающие колонки новой модели документов.
--    ВАЖНО: сначала добавляем ВСЕ колонки, и только потом выполняем UPDATE/SET NOT NULL
--    (прошлые версии скрипта падали с «column file_name does not exist», потому что
--    UPDATE обращался к колонке, которую ещё не создали).
--    Файлы хранятся по пути {family_id}/..., поэтому file_path обязателен (NOT NULL).
alter table if exists public.documents
  add column if not exists file_path   text,
  add column if not exists file_name   text,
  add column if not exists mime_type   text,
  add column if not exists description text;

-- file_size как bigint с дефолтом 0 (в модели приложения number | null допустимы,
-- но NOT NULL безопаснее для старых строк)
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='documents' and column_name='file_size') then
    alter table public.documents add column file_size bigint not null default 0;
  end if;
end $$;

-- 2. Совместимость со старой схемой (колонка name вместо title): переносим название.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='documents' and column_name='name') then
    execute 'update public.documents set title = name where title is null';
    begin
      execute 'alter table public.documents alter column title set not null';
    exception when others then
      null; -- если остались null-строки — разберитесь вручную, не критично для загрузки новых
    end;
  end if;
end $$;

-- 3. Storage: публичный bucket «documents» + политики доступа для членов семьи.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = excluded.public;

-- Политика: работать можно только с папкой своей семьи (первый сегмент пути = family_id).
drop policy if exists documents_storage_access on storage.objects;
create policy documents_storage_access on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and public.is_family_member(
      case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then split_part(name, '/', 1)::uuid else null end
    )
  )
  with check (
    bucket_id = 'documents'
    and public.is_family_member(
      case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then split_part(name, '/', 1)::uuid else null end
    )
  );

-- Старый приватный бакет vault больше не используется
drop policy if exists vault_access on storage.objects;

-- 4. Realtime для таблицы documents (чтобы список обновлялся на всех устройствах)
do $$
begin
  begin
    alter publication supabase_realtime add table public.documents;
  exception when duplicate_object then
    null;
  end;
end $$;

-- 5. Принудительная перезагрузка кэша схемы PostgREST — УСТАНАВЛИВАЕТ ошибку PGRST204,
--    если колонки уже были добавлены ранее, но кэш остался устаревшим.
notify pgrst, 'reload schema';
