-- MANTENIMIENTO: actualizaciones inmutables + historial de cambios de estado.
--
-- 1. Lo que se apunta en una actualizacion queda grabado: es el historial de lo
--    que se hizo en el desperfecto y con el se reclama o se explica una averia
--    repetida. Se puede LEER y AÑADIR, nunca modificar ni borrar.
-- 2. Cada cambio de estado deja rastro de quien lo movio, de que estado a cual
--    y cuando. Lo escribe un trigger, asi que recoge TODOS los cambios vengan
--    de donde vengan (la tabla, la ficha o una actualizacion).
--
-- Idempotente.

------------------------------------------------------------------
-- 1. Actualizaciones inmutables
------------------------------------------------------------------
drop policy if exists mant_act_write on public.mantenimiento_actualizaciones;
drop policy if exists mant_act_insert on public.mantenimiento_actualizaciones;

create policy mant_act_insert on public.mantenimiento_actualizaciones
  for insert to authenticated
  with check (exists (
    select 1 from public.mantenimiento m
    where m.id = incidencia_id
      and m.empresa_id in (select empresas_del_usuario())
  ));

-- Sin policy de UPDATE ni DELETE: con RLS activo, lo no permitido queda
-- prohibido. La lectura sigue con mant_act_read.

------------------------------------------------------------------
-- 2. Historial de cambios de estado
------------------------------------------------------------------
create table if not exists public.mantenimiento_estados_historial (
  id uuid primary key default gen_random_uuid(),
  incidencia_id uuid not null references public.mantenimiento(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  cambiado_por uuid references auth.users(id),
  cambiado_por_nombre text,
  fecha timestamptz not null default now()
);

create index if not exists idx_mant_estados_incidencia
  on public.mantenimiento_estados_historial(incidencia_id, fecha desc);

alter table public.mantenimiento_estados_historial enable row level security;

drop policy if exists mant_estados_read on public.mantenimiento_estados_historial;
create policy mant_estados_read on public.mantenimiento_estados_historial
  for select to authenticated
  using (exists (
    select 1 from public.mantenimiento m
    where m.id = incidencia_id
      and m.empresa_id in (select empresas_del_usuario())
  ));

-- Sin policy de INSERT/UPDATE/DELETE: lo escribe el trigger (SECURITY DEFINER)
-- y nadie puede reescribir el historial a mano.

create or replace function public.registrar_cambio_estado_mantenimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if TG_OP = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  select trim(coalesce(u.nombre,'') || ' ' || coalesce(u.apellidos,''))
    into v_nombre
  from public.usuarios u
  where u.user_id = auth.uid();

  insert into public.mantenimiento_estados_historial
    (incidencia_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_por_nombre)
  values
    (new.id,
     case when TG_OP = 'UPDATE' then old.estado else null end,
     new.estado,
     auth.uid(),
     nullif(v_nombre, ''));

  return new;
end;
$$;

drop trigger if exists trg_mantenimiento_estado on public.mantenimiento;
create trigger trg_mantenimiento_estado
  after insert or update of estado on public.mantenimiento
  for each row execute function public.registrar_cambio_estado_mantenimiento();
