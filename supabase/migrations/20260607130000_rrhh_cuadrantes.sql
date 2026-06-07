-- Cuadrantes (RRHH): ámbito guardado = local (o todos) + departamentos.
-- La pestaña "Cuadrantes" vive encima de "Turnos" en /rrhh/horarios.
-- Un cuadrante agrupa empleados por local + departamentos; la columna
-- "Empleados" cuenta automáticamente los de ese ámbito que tienen turno
-- (asignación directa o vía patrón).

create table if not exists public.rrhh_cuadrantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  -- null = todos los locales de la empresa
  local_id uuid references public.locales(id) on delete set null,
  activo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rrhh_cuadrantes_empresa on public.rrhh_cuadrantes(empresa_id);
create index if not exists idx_rrhh_cuadrantes_local on public.rrhh_cuadrantes(local_id);

-- Departamentos del cuadrante (mínimo 1; máximo los que se quiera).
create table if not exists public.rrhh_cuadrante_departamentos (
  cuadrante_id uuid not null references public.rrhh_cuadrantes(id) on delete cascade,
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  primary key (cuadrante_id, departamento_id)
);

create index if not exists idx_rrhh_cuad_dep_dep on public.rrhh_cuadrante_departamentos(departamento_id);

alter table public.rrhh_cuadrantes enable row level security;
alter table public.rrhh_cuadrante_departamentos enable row level security;

-- RLS multi-tenant (profiles ∪ user_empresas vía helper empresas_del_usuario()).
drop policy if exists rrhh_cuadrantes_rw on public.rrhh_cuadrantes;
create policy rrhh_cuadrantes_rw on public.rrhh_cuadrantes
  for all
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists rrhh_cuad_dep_rw on public.rrhh_cuadrante_departamentos;
create policy rrhh_cuad_dep_rw on public.rrhh_cuadrante_departamentos
  for all
  using (exists (
    select 1 from public.rrhh_cuadrantes c
    where c.id = cuadrante_id and c.empresa_id in (select empresas_del_usuario())
  ))
  with check (exists (
    select 1 from public.rrhh_cuadrantes c
    where c.id = cuadrante_id and c.empresa_id in (select empresas_del_usuario())
  ));

create or replace function public.rrhh_cuadrantes_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rrhh_cuadrantes_updated on public.rrhh_cuadrantes;
create trigger trg_rrhh_cuadrantes_updated
  before update on public.rrhh_cuadrantes
  for each row execute function public.rrhh_cuadrantes_touch_updated_at();
