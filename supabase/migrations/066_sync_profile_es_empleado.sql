-- ============================================================
-- 066_sync_profile_es_empleado.sql
-- Auto-sincroniza profiles.es_empleado según haya fila en empleados.
--
-- Regla: si existe al menos un registro en `empleados` con
-- profile_id = X → profiles.es_empleado = true.
-- Si no queda ninguno → profiles.es_empleado = false.
--
-- Así no hace falta tocar el flag a mano: dar de alta a alguien
-- en RRHH lo marca como empleado; quitarlo lo marca como externo.
-- ============================================================

create or replace function public.sync_profile_es_empleado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil_anterior uuid;
begin
  -- INSERT / UPDATE: si hay profile_id nuevo, marcar como empleado.
  if (tg_op in ('INSERT', 'UPDATE')) and new.profile_id is not null then
    update public.profiles
       set es_empleado = true
     where id = new.profile_id
       and es_empleado is distinct from true;
  end if;

  -- UPDATE: si profile_id cambió, revisar el perfil anterior.
  if tg_op = 'UPDATE'
     and old.profile_id is not null
     and old.profile_id is distinct from new.profile_id then
    perfil_anterior := old.profile_id;
    if not exists (
      select 1 from public.empleados where profile_id = perfil_anterior
    ) then
      update public.profiles
         set es_empleado = false
       where id = perfil_anterior
         and es_empleado is distinct from false;
    end if;
  end if;

  -- DELETE: si el borrado tenía profile_id y ya no quedan referencias, marcar externo.
  if tg_op = 'DELETE' and old.profile_id is not null then
    if not exists (
      select 1 from public.empleados where profile_id = old.profile_id
    ) then
      update public.profiles
         set es_empleado = false
       where id = old.profile_id
         and es_empleado is distinct from false;
    end if;
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists empleados_sync_profile_flag on public.empleados;
create trigger empleados_sync_profile_flag
  after insert or update of profile_id or delete on public.empleados
  for each row execute function public.sync_profile_es_empleado();

comment on function public.sync_profile_es_empleado() is
  'Mantiene profiles.es_empleado en sync con la presencia de filas en empleados.';
