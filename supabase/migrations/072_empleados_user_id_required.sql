-- 072 — empleados.profile_id → empleados.user_id (NOT NULL + UNIQUE)
--
-- Regla de negocio: todo empleado DEBE tener un usuario asociado. Antes,
-- la columna se llamaba profile_id y era nullable (admitía empleados sin
-- acceso al portal). Ahora:
--   • renombrada a user_id (alineada con el resto de la BD).
--   • NOT NULL + UNIQUE.
--   • FK con ON DELETE CASCADE: borrar el usuario borra el empleado.
--   • Reescritos los triggers que sincronizan profiles.es_empleado y
--     profiles.estado_acceso para usar el nuevo nombre de columna.
--   • Reescritas las RLS policies empleados_self_read / empleados_self_update.

BEGIN;

DROP POLICY IF EXISTS empleados_self_read ON public.empleados;
DROP POLICY IF EXISTS empleados_self_update ON public.empleados;

ALTER TABLE public.empleados RENAME COLUMN profile_id TO user_id;
ALTER TABLE public.empleados RENAME CONSTRAINT empleados_profile_id_fkey TO empleados_user_id_fkey;

ALTER TABLE public.empleados ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.empleados ADD CONSTRAINT empleados_user_id_unique UNIQUE (user_id);

ALTER TABLE public.empleados DROP CONSTRAINT empleados_user_id_fkey;
ALTER TABLE public.empleados ADD CONSTRAINT empleados_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_profile_es_empleado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE perfil_anterior uuid;
BEGIN
  IF (TG_OP IN ('INSERT', 'UPDATE')) AND NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
       SET es_empleado = true
     WHERE id = NEW.user_id
       AND es_empleado IS DISTINCT FROM true;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.user_id IS NOT NULL
     AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    perfil_anterior := OLD.user_id;
    IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE user_id = perfil_anterior) THEN
      UPDATE public.profiles
         SET es_empleado = false
       WHERE id = perfil_anterior
         AND es_empleado IS DISTINCT FROM false;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE user_id = OLD.user_id) THEN
      UPDATE public.profiles
         SET es_empleado = false
       WHERE id = OLD.user_id
         AND es_empleado IS DISTINCT FROM false;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_estado_from_empleado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE pid uuid; activo boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  pid := NEW.user_id;
  activo := public.empleado_esta_activo(NEW.estado, NEW.fecha_baja);
  IF activo THEN
    UPDATE public.profiles
       SET estado_acceso = 'Activo'
     WHERE id = pid AND estado_acceso IS DISTINCT FROM 'Activo';
  ELSE
    UPDATE public.profiles
       SET estado_acceso = 'Inactivo'
     WHERE id = pid AND estado_acceso IS DISTINCT FROM 'Inactivo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE POLICY empleados_self_read ON public.empleados
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY empleados_self_update ON public.empleados
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;
