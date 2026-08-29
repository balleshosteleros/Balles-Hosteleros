-- La relacion entre empleado y usuario es de UN SOLO SENTIDO:
--   empleado  -> SIEMPRE necesita usuario (para entrar al portal)
--   usuario   -> NO tiene por que ser empleado (cuentas de gestion, demo,
--                colaboradores, la empresa gestora del software...)
--
-- El trigger `sync_profile_estado_from_empleado` aplicaba la regla en AMBOS
-- sentidos: si un usuario no tenia NINGUNA ficha de empleado activa lo ponia en
-- Inactivo. Consecuencia: las cuentas que nunca fueron empleado nacian
-- bloqueadas. Es lo que les paso a fmaroto2016@gmail.com y
-- agora.demo@balleshosteleros.com: ambas quedaron Inactivo en el mismo
-- microsegundo de su alta (created_at = updated_at), sin que nadie las tocara.
--
-- Correccion: el estado del acceso solo se sincroniza para quien SI tiene ficha
-- de empleado. Un usuario sin ninguna ficha no es un empleado de baja: es una
-- cuenta de gestion, y su acceso lo decide unicamente Ajustes -> Usuarios.
--
-- Se conserva el resto del comportamiento (verificado en pruebas revertidas):
--   - empleado activo en alguna empresa      -> Activo
--   - empleado con TODAS sus fichas de baja  -> Inactivo (baja en RRHH)
--
-- Idempotente.

create or replace function public.sync_profile_estado_from_empleado()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  pid uuid;
  activo_en_alguna boolean;
  tiene_alguna_ficha boolean;
BEGIN
  pid := coalesce(NEW.user_id, OLD.user_id);
  IF pid IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  -- ¿Le queda ALGUNA ficha de empleado? (excluimos la fila borrada en DELETE)
  SELECT EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.user_id = pid
      AND (TG_OP <> 'DELETE' OR e.id <> OLD.id)
  ) INTO tiene_alguna_ficha;

  -- Un usuario SIN ficha de empleado no es un empleado dado de baja: es una
  -- cuenta de gestion. Su acceso no lo decide RRHH, asi que no se toca.
  IF NOT tiene_alguna_ficha THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  -- ¿Sigue activo en ALGUNA empresa?
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

-- Reparacion de las dos cuentas que el fallo dejo bloqueadas desde su alta.
-- Solo afecta a usuarios SIN ficha de empleado que estaban en Inactivo.
update public.usuarios u
   set estado_acceso = 'Activo'
 where u.email in ('fmaroto2016@gmail.com', 'agora.demo@balleshosteleros.com')
   and u.estado_acceso = 'Inactivo'
   and not exists (select 1 from public.empleados e where e.user_id = u.user_id);
