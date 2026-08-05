-- Corte de acceso INMEDIATO y fiable al dar de baja a un empleado.
--
-- PROBLEMA (detectado 2026-08-05): sync_profile_estado_from_empleado solo
-- miraba la fila que se acababa de tocar. Con un empleado multi-empresa (una
-- fila por empresa, modelo espejo) eso se pisa: dar de baja en BACANAL ponia
-- estado_acceso='Inactivo', pero cualquier UPDATE posterior sobre la fila de
-- HABANA lo devolvia a 'Activo'. Casos reales encontrados: Javier Mora (baja
-- en las DOS empresas el 31-jul) y Cinthya Perez (baja el 11-jun) seguian con
-- el acceso ACTIVO — es decir, podian entrar en la app estando de baja.
--
-- REGLA CORRECTA: el acceso esta Activo si el empleado sigue Activo en ALGUNA
-- de sus empresas. Se evalua sobre TODAS sus fichas, no sobre la tocada.
-- Se dispara tambien en DELETE (borrar la ultima ficha activa debe cortar).
-- Verificado con baja+reactivacion en vivo: corta y restaura al instante.
CREATE OR REPLACE FUNCTION public.sync_profile_estado_from_empleado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  pid uuid;
  activo_en_alguna boolean;
BEGIN
  pid := coalesce(NEW.user_id, OLD.user_id);
  IF pid IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.user_id = pid
      AND (TG_OP <> 'DELETE' OR e.id <> OLD.id)
      AND public.empleado_esta_activo(e.estado, e.fecha_baja)
  ) INTO activo_en_alguna;

  IF activo_en_alguna THEN
    UPDATE public.usuarios SET estado_acceso = 'Activo'
     WHERE user_id = pid AND estado_acceso IS DISTINCT FROM 'Activo';
  ELSE
    UPDATE public.usuarios SET estado_acceso = 'Inactivo'
     WHERE user_id = pid AND estado_acceso IS DISTINCT FROM 'Inactivo';
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS empleados_sync_estado_acceso ON public.empleados;
CREATE TRIGGER empleados_sync_estado_acceso
AFTER INSERT OR UPDATE OF estado, fecha_baja, user_id OR DELETE
ON public.empleados
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_estado_from_empleado();

-- Correccion de los datos ya desincronizados.
UPDATE public.usuarios u
SET estado_acceso = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.empleados e
        WHERE e.user_id = u.user_id
          AND public.empleado_esta_activo(e.estado, e.fecha_baja)
      ) THEN 'Activo' ELSE 'Inactivo' END
WHERE EXISTS (SELECT 1 FROM public.empleados e WHERE e.user_id = u.user_id)
  AND u.estado_acceso IS DISTINCT FROM (
      CASE WHEN EXISTS (
        SELECT 1 FROM public.empleados e
        WHERE e.user_id = u.user_id
          AND public.empleado_esta_activo(e.estado, e.fecha_baja)
      ) THEN 'Activo' ELSE 'Inactivo' END);
