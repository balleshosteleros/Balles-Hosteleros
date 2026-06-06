-- ============================================================
-- PRP-053: Versionado de turnos RRHH (Fase 1 — esquema)
-- ============================================================
-- Convierte cada turno en una "versión" de una familia (familia_id),
-- con una única versión oficial por familia y asignación fechada por
-- empleado (rrhh_turno_empleados.vigente_desde).
--
-- Fuera de alcance: el motor de tiempo teórico / saldo / estadísticas
-- NO se construye aquí (no existe aún en el código).
--
-- Idempotente: add column if not exists / create index if not exists.
-- RLS ya es correcta en ambas tablas (union user_empresas ∪ profiles),
-- por lo que NO se toca. El UNIQUE(turno_id, empleado_id) existente se
-- conserva: cada versión es un turno_id distinto, así que el historial
-- entre versiones funciona sin romper el upsert actual.
-- ============================================================

-- ─── rrhh_turnos: familia + versiones ───────────────────────
alter table public.rrhh_turnos
  add column if not exists familia_id    text,
  add column if not exists version       integer not null default 1,
  add column if not exists es_oficial    boolean not null default true,
  add column if not exists vigente_desde date;

-- backfill: cada turno existente es su propia familia, versión 1, oficial
update public.rrhh_turnos
  set familia_id = id
  where familia_id is null;

update public.rrhh_turnos
  set vigente_desde = created_at::date
  where vigente_desde is null;

alter table public.rrhh_turnos
  alter column familia_id set not null;

-- exactamente una versión oficial por familia
create unique index if not exists uq_rrhh_turnos_familia_oficial
  on public.rrhh_turnos(familia_id)
  where es_oficial;

create index if not exists idx_rrhh_turnos_familia
  on public.rrhh_turnos(familia_id);

-- ─── rrhh_turno_empleados: asignación fechada ───────────────
-- vigente_desde = fecha desde la que ese empleado trabaja esa versión.
alter table public.rrhh_turno_empleados
  add column if not exists vigente_desde        date,
  add column if not exists asignado_por_user_id uuid
    references auth.users(id) on delete set null;

-- backfill: asignaciones previas heredan su fecha de creación
update public.rrhh_turno_empleados
  set vigente_desde = created_at::date
  where vigente_desde is null;

alter table public.rrhh_turno_empleados
  alter column vigente_desde set default current_date,
  alter column vigente_desde set not null;
