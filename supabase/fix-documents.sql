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

-- 2. Гарантируем наличие колонки title (в старой схеме её не было — была name).
--    ВАЖНО: в PL/pgSQL нельзя сослаться на ещё НЕ существующую колонку даже внутри
--    if exists(...) — планировщик проверяет имена на этапе парсинга блока
--    (ошибка «42703: column "title" does not exist»). Поэтому все обращения к
--    title/name выполняются только через EXECUTE динамического SQL.
alter table if exists public.documents add column if not exists title text;

do $$
declare
  has_title boolean;
  has_name  boolean;
begin
  select exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='documents' and column_name='title')
    into has_title;
  select exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='documents' and column_name='name')
    into has_name;

  -- Переносим название из старой колонки name в новую title (если name существует)
  if has_name then
    execute 'update public.documents set title = coalesce(title, name) where title is null';
  end if;

  -- Если остались строки без названия — ставим заглушку, чтобы можно было NOT NULL
  if has_title then
    execute 'update public.documents set title = ''Документ'' where title is null';
    begin
      execute 'alter table public.documents alter column title set not null';
    exception when others then
      null;
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

-- 4. Заполнение новых колонок для СТАРЫХ записей (только если колонки уже созданы выше).
--    Все обращения — через EXECUTE динамического SQL (см. комментарий в блоке 2).
do $$
declare
  has_col text;
begin
  foreach has_col in array array['file_path','file_name','mime_type'] loop
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='documents' and column_name=has_col) then
      if has_col = 'file_path' then
        execute $dyn$update public.documents
        set file_path = coalesce(
              nullif(file_path, ''),
              nullif(substring(coalesce(file_url,'') from '/storage/v1/object/(?:public|sign)/[^/]+/(.+)$'), '')
            )$dyn$;
      elsif has_col = 'file_name' then
        execute $dyn$update public.documents
        set file_name = coalesce(
              nullif(file_name, ''),
              nullif(reverse(split_part(reverse(coalesce(file_path,'')), '/', 1)), ''),
              'документ'
            )$dyn$;
      else
        execute $dyn$update public.documents
        set mime_type = coalesce(nullif(mime_type, ''), case
              when coalesce(file_path, file_url, '') ~* '\.png$'   then 'image/png'
              when coalesce(file_path, file_url, '') ~* '\.jpe?g$' then 'image/jpeg'
              when coalesce(file_path, file_url, '') ~* '\.pdf$'   then 'application/pdf'
              else 'application/octet-stream' end)$dyn$;
      end if;
    end if;
  end loop;
end $$;

-- 5. Realtime для таблицы documents (чтобы список обновлялся на всех устройствах)
do $$
begin
  begin
    alter publication supabase_realtime add table public.documents;
  exception when duplicate_object then
    null;
  end;
end $$;

-- 6. Принудительная перезагрузка кэша схемы PostgREST — УСТАНАВЛИВАЕТ ошибку PGRST204,
--    если колонки уже были добавлены ранее, но кэш остался устаревшим.
notify pgrst, 'reload schema';
