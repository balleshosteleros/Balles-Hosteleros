-- Calendarios de vacaciones (RRHH).
-- Una empresa puede tener VARIOS calendarios de vacaciones. Cada calendario
-- define:
--   · un total de días de vacaciones (dias_totales) para el año al que aplica
--   · uno o varios periodos BLOQUEADOS (no se pueden pedir vacaciones en ellos)
-- Cada empleado tiene UN calendario asociado (empleados.calendario_vacaciones_id).
-- Al solicitar vacaciones desde Mi Panel se comprueba contra ese calendario:
--   1) que las fechas no caigan en un periodo bloqueado
--   2) que no se superen los días disponibles (dias_totales - días ya usados)
-- El recuento de días gastados/restantes se calcula sobre la marcha a partir de
-- solicitudes_personal (subtipo = 'vacaciones', estado pendiente o aprobada).

create table if not exists public.rrhh_calendarios_vacaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  -- Año natural al que aplican los días y los bloqueos de este calendario.
  anio integer not null,
  -- Total de días de vacaciones disponibles en el año (días naturales).
  dias_totales integer not null default 30 check (dias_totales >= 0 and dias_totales <= 366),
  activo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rrhh_cal_vac_empresa on public.rrhh_calendarios_vacaciones(empresa_id);

-- Periodos en los que NO se pueden pedir vacaciones (lista negra).
create table if not exists public.rrhh_calendario_vacaciones_bloqueos (
  id uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references public.rrhh_calendarios_vacaciones(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  motivo text,
  created_at timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create index if not exists idx_rrhh_cal_vac_bloq_cal on public.rrhh_calendario_vacaciones_bloqueos(calendario_id);

-- Calendario asociado a cada empleado (obligatorio a nivel de aplicación;
-- ON DELETE SET NULL es la red de seguridad si se borra un calendario en uso).
alter table public.empleados
  add column if not exists calendario_vacaciones_id uuid
    references public.rrhh_calendarios_vacaciones(id) on delete set null;

create index if not exists idx_empleados_calendario_vacaciones
  on public.empleados(calendario_vacaciones_id);

comment on column public.empleados.calendario_vacaciones_id is
  'Calendario de vacaciones que rige los días y periodos bloqueados de este empleado. Obligatorio para poder solicitar vacaciones.';

alter table public.rrhh_calendarios_vacaciones enable row level security;
alter table public.rrhh_calendario_vacaciones_bloqueos enable row level security;

-- RLS multi-tenant (profiles ∪ user_empresas vía helper empresas_del_usuario()).
drop policy if exists rrhh_cal_vac_rw on public.rrhh_calendarios_vacaciones;
create policy rrhh_cal_vac_rw on public.rrhh_calendarios_vacaciones
  for all
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists rrhh_cal_vac_bloq_rw on public.rrhh_calendario_vacaciones_bloqueos;
create policy rrhh_cal_vac_bloq_rw on public.rrhh_calendario_vacaciones_bloqueos
  for all
  using (exists (
    select 1 from public.rrhh_calendarios_vacaciones c
    where c.id = calendario_id and c.empresa_id in (select empresas_del_usuario())
  ))
  with check (exists (
    select 1 from public.rrhh_calendarios_vacaciones c
    where c.id = calendario_id and c.empresa_id in (select empresas_del_usuario())
  ));

create or replace function public.rrhh_cal_vac_touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rrhh_cal_vac_updated on public.rrhh_calendarios_vacaciones;
create trigger trg_rrhh_cal_vac_updated
  before update on public.rrhh_calendarios_vacaciones
  for each row execute function public.rrhh_cal_vac_touch_updated_at();
