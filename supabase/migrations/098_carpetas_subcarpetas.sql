-- ============================================================
-- 098_carpetas_subcarpetas.sql
--
-- Subcarpetas (1 nivel, NO más). Estructura permitida:
--   raíz → subcarpeta → documentos
--   raíz → documentos (sin subcarpeta)
--
-- · `parent_id` referencia a la carpeta padre (null = raíz).
-- · UNIQUE compuesto incluye el parent → permite mismo nombre
--   bajo distintos parents.
-- · Trigger: si parent_id no es null, su parent debe ser null
--   (= solo aceptamos un nivel) y misma empresa.
-- ============================================================

ALTER TABLE public.carpetas_documentos
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.carpetas_documentos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS carpetas_documentos_parent_idx
  ON public.carpetas_documentos (parent_id);

DROP INDEX IF EXISTS public.carpetas_documentos_empresa_nombre_uq;

CREATE UNIQUE INDEX IF NOT EXISTS carpetas_documentos_empresa_parent_nombre_uq
  ON public.carpetas_documentos (
    empresa_id,
    COALESCE(parent_id::text, ''),
    lower(nombre)
  );

CREATE OR REPLACE FUNCTION public.tg_carpetas_check_max_depth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  parent_parent_id uuid;
  parent_empresa   uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Una carpeta no puede ser su propio padre'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT parent_id, empresa_id
  INTO parent_parent_id, parent_empresa
  FROM public.carpetas_documentos
  WHERE id = NEW.parent_id;

  IF parent_empresa IS NULL THEN
    RAISE EXCEPTION 'Carpeta padre no encontrada' USING ERRCODE = 'check_violation';
  END IF;

  IF parent_empresa <> NEW.empresa_id THEN
    RAISE EXCEPTION 'La carpeta padre pertenece a otra empresa'
      USING ERRCODE = 'check_violation';
  END IF;

  IF parent_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se permite un nivel de subcarpetas'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS carpetas_check_max_depth ON public.carpetas_documentos;
CREATE TRIGGER carpetas_check_max_depth
BEFORE INSERT OR UPDATE OF parent_id ON public.carpetas_documentos
FOR EACH ROW EXECUTE FUNCTION public.tg_carpetas_check_max_depth();
