-- ============================================================
-- 067_sync_profile_estado_from_empleado.sql
-- Cuando se da de baja a un empleado en RRHH, su cuenta de usuario
-- queda automáticamente como Inactivo para impedirle entrar al portal.
--
-- Regla:
--   - empleado activo  = estado='Activo' AND (fecha_baja IS NULL OR fecha_baja > hoy)
--   - empleado inactivo = lo contrario (Baja temporal/definitiva, Excedencia,
--                         o fecha_baja ya pasada).
--
-- Si profile_id IS NULL → el empleado no tiene cuenta de portal y no
-- se hace nada. Si tiene cuenta, se sincroniza estado_acceso.
--
-- Importante: solo se cambia el estado SI cambia, para no escribir
-- al pedo y no machacar estados manuales que coincidan.
-- ============================================================

create or replace function public.empleado_esta_activo(
  p_estado text,
  p_fecha_baja date
)
returns boolean
language sql
immutable
as $$
  select p_estado = 'Activo'
     and (p_fecha_baja is null or p_fecha_baja > current_date);
$$;

create or replace function public.sync_profile_estado_from_empleado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  activo boolean;
begin
  -- DELETE → no tocamos estado_acceso (el trigger anterior ya gestiona es_empleado).
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.profile_id is null then
    return new;
  end if;

  pid := new.profile_id;
  activo := public.empleado_esta_activo(new.estado, new.fecha_baja);

  if activo then
    update public.profiles
       set estado_acceso = 'Activo'
     where id = pid
       and estado_acceso is distinct from 'Activo';
  else
    update public.profiles
       set estado_acceso = 'Inactivo'
     where id = pid
       and estado_acceso is distinct from 'Inactivo';
  end if;

  return new;
end;
$$;

drop trigger if exists empleados_sync_estado_acceso on public.empleados;
create trigger empleados_sync_estado_acceso
  after insert or update of estado, fecha_baja, profile_id on public.empleados
  for each row execute function public.sync_profile_estado_from_empleado();

comment on function public.sync_profile_estado_from_empleado() is
  'Refleja la baja/alta del empleado en profiles.estado_acceso para bloquear el login.';
