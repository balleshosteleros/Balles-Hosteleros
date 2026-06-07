-- Planificación por día concreta (cuadrante interactivo de /rrhh/horarios).
--
-- El modelo existente es RECURRENTE:
--   • rrhh_turno_empleados  → empleado ↔ turno con vigente_desde
--   • rrhh_patron_empleados → empleado ↔ patrón semanal
-- No guarda "el empleado E tiene el turno T el día D concreto", que es lo que
-- necesita el planner cuando arrastras un turno/patrón sobre una celda (día).
--
-- Esta tabla guarda esas asignaciones por fecha concreta:
--   • origen='manual' : se soltó un turno suelto sobre ese día.
--   • origen='patron'  : se soltó un patrón (7 días desde el día del drop);
--     cada día del patrón genera una fila con patron_id.
-- La rejilla fusiona estas filas con el cálculo recurrente; solo estas son
-- "quitables" desde la propia rejilla (las recurrentes se gestionan en ⚙️).

create table if not exists public.rrhh_planificacion (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha       date not null,
  -- los ids de turno son TEXT (generados client-side: makeTurnoId)
  turno_id    text not null references public.rrhh_turnos(id) on delete cascade,
  origen      text not null default 'manual' check (origen in ('manual', 'patron')),
  patron_id   uuid references public.rrhh_patrones(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (empleado_id, fecha, turno_id)
);

create index if not exists idx_rrhh_planif_empresa_fecha
  on public.rrhh_planificacion(empresa_id, fecha);
create index if not exists idx_rrhh_planif_empleado_fecha
  on public.rrhh_planificacion(empleado_id, fecha);

alter table public.rrhh_planificacion enable row level security;

-- RLS multi-tenant (profiles ∪ user_empresas vía helper empresas_del_usuario()).
drop policy if exists rrhh_planificacion_rw on public.rrhh_planificacion;
create policy rrhh_planificacion_rw on public.rrhh_planificacion
  for all
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

comment on table public.rrhh_planificacion is
  'Asignaciones de turno por día concreto (planner arrastrable de /rrhh/horarios). Complementa el modelo recurrente rrhh_turno_empleados / rrhh_patron_empleados.';
