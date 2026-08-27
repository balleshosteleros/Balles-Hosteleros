-- PRP-081 (corrección) — Permitir carpetas anidadas sin límite de niveles.
-- Aplicada en producción el 2026-08-27. Idempotente (create or replace).
--
-- `tg_carpetas_check_max_depth` venía del gestor documental de Dirección y
-- solo permitía UN nivel de subcarpetas. La herramienta Archivos replica el
-- árbol de Google Drive tal cual, y allí hay carpetas dentro de carpetas
-- dentro de carpetas: la importación moría con "Solo se permite un nivel de
-- subcarpetas" antes de copiar un solo archivo.
--
-- Es el tercer límite heredado de aquel módulo que rompe Archivos, tras los
-- 2 MB por archivo y los 8 MB por empresa (migración 014).
--
-- Se conservan las dos comprobaciones que SÍ protegen datos —no ser su propio
-- padre y no mezclar empresas— y se añade la detección de ciclos completa:
-- sin el tope de profundidad, un movimiento circular (A dentro de B, B dentro
-- de A) dejaría una rama huérfana e invisible para siempre.
create or replace function public.tg_carpetas_check_max_depth()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  parent_empresa uuid;
  ancestro       uuid;
  saltos         int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Una carpeta no puede ser su propio padre'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT empresa_id INTO parent_empresa
  FROM public.carpetas_documentos
  WHERE id = NEW.parent_id;

  IF parent_empresa IS NULL THEN
    RAISE EXCEPTION 'Carpeta padre no encontrada' USING ERRCODE = 'check_violation';
  END IF;

  IF parent_empresa <> NEW.empresa_id THEN
    RAISE EXCEPTION 'La carpeta padre pertenece a otra empresa'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Ciclos: se sube por los ancestros; si se topa con la propia carpeta, el
  -- movimiento la metería dentro de sí misma. El tope de saltos corta un
  -- ciclo preexistente en los datos.
  ancestro := NEW.parent_id;
  WHILE ancestro IS NOT NULL AND saltos < 50 LOOP
    IF ancestro = NEW.id THEN
      RAISE EXCEPTION 'No se puede mover una carpeta dentro de sí misma'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_id INTO ancestro
    FROM public.carpetas_documentos
    WHERE id = ancestro;
    saltos := saltos + 1;
  END LOOP;

  RETURN NEW;
END;
$function$;
