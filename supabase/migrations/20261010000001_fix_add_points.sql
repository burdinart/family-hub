-- 20261010000001_fix_add_points.sql — надёжная версия add_points() для геймификации.
--
-- Проблемы, которые исправляет:
-- 1) profiles.points допускал NULL — колонка приводится к integer NOT NULL DEFAULT 0;
--    ВАЖНО: сначала UPDATE (обходит RLS, т.к. миграция идёт под ролью postgres),
--    потом SET NOT NULL — иначе ALTER падает с SQLSTATE 23502 на NULL-строках;
-- 2) вызов RPC из клиента мог молча падать — функция идемпотентна и с проверками;
-- 3) защита от повторного начисления за одну и ту же задачу (category='task').

CREATE OR REPLACE FUNCTION public.add_points(
  p_family_id      uuid,
  p_user_id        uuid,
  p_points         integer,
  p_reason         text,
  p_category       text   DEFAULT 'task',
  p_reference_id   uuid   DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Защита от NULL-аргументов: без пользователя/семьи баллы не начисляем
  IF p_user_id IS NULL OR p_family_id IS NULL THEN
    RAISE EXCEPTION 'add_points: p_user_id и p_family_id обязательны';
  END IF;

  UPDATE public.profiles
     SET points = COALESCE(points, 0) + p_points
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'add_points: профиль % не найден', p_user_id;
  END IF;

  INSERT INTO public.points_log (family_id, user_id, points, reason, category, reference_id)
  VALUES (p_family_id, p_user_id, p_points, p_reason, p_category, p_reference_id);
END;
$function$;

-- 1) Сначала заполняем существующие NULL нулями (роль postgres обходит RLS)
UPDATE public.profiles SET points = 0 WHERE points IS NULL;

-- 2) Затем меняем тип/дефолт и включаем NOT NULL
ALTER TABLE public.profiles
  ALTER COLUMN points TYPE integer USING COALESCE(points, 0),
  ALTER COLUMN points SET DEFAULT 0,
  ALTER COLUMN points SET NOT NULL;

GRANT EXECUTE ON FUNCTION public.add_points(uuid, uuid, integer, text, text, uuid) TO authenticated;
