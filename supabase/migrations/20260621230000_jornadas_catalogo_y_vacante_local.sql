-- ============================================================
-- Jornadas: catálogo por empresa + vínculo obligatorio en vacantes
-- Cada vacante elige una jornada (del catálogo) y un local.
-- Catálogo configurable en Ajustes → Departamentos → RRHH → Jornadas.
-- ============================================================

-- 1) Catálogo de jornadas por empresa
create table if not exists public.jornadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists jornadas_empresa_nombre_uk on public.jornadas (empresa_id, lower(nombre));
create index if not exists jornadas_empresa_idx on public.jornadas (empresa_id);

alter table public.jornadas enable row level security;

drop policy if exists jornadas_select on public.jornadas;
create policy jornadas_select on public.jornadas for select
  using (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists jornadas_insert on public.jornadas;
create policy jornadas_insert on public.jornadas for insert
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists jornadas_update on public.jornadas;
create policy jornadas_update on public.jornadas for update
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists jornadas_delete on public.jornadas;
create policy jornadas_delete on public.jornadas for delete
  using (empresa_id in (select public.empresas_del_usuario()));

-- 2) Columnas en vacantes (nullable a nivel BD; la obligatoriedad se exige en el formulario)
alter table public.vacantes add column if not exists local_id uuid references public.locales(id) on delete set null;
alter table public.vacantes add column if not exists jornada_id uuid references public.jornadas(id) on delete set null;
create index if not exists vacantes_local_idx on public.vacantes (local_id);
create index if not exists vacantes_jornada_idx on public.vacantes (jornada_id);

-- 3) Seed de las 3 jornadas canónicas en TODAS las empresas (idempotente)
insert into public.jornadas (empresa_id, nombre, orden)
select e.id, j.nombre, j.orden
from public.empresas e
cross join (values ('Completa', 1), ('Media jornada', 2), ('Por horas', 3)) as j(nombre, orden)
where not exists (
  select 1 from public.jornadas x
  where x.empresa_id = e.id and lower(x.nombre) = lower(j.nombre)
);

-- 4) Backfill local: cada vacante hereda el único local de su empresa
update public.vacantes v
set local_id = l.id
from (
  select distinct on (empresa_id) empresa_id, id
  from public.locales
  where coalesce(activo, true) = true
  order by empresa_id, created_at
) l
where v.empresa_id = l.empresa_id and v.local_id is null;

-- 5) Backfill jornada por título (orden importa: completa → media → resto)
-- 5a) Completa: jefes de sala, jefes de cocina, gerencia/gerentes
update public.vacantes v
set jornada_id = j.id
from public.jornadas j
where j.empresa_id = v.empresa_id and lower(j.nombre) = 'completa'
  and v.jornada_id is null
  and (v.titulo ilike '%jefe de sala%' or v.titulo ilike '%jefe de cocina%' or v.titulo ilike '%geren%');

-- 5b) Media jornada: camareros, cocineros, limpieza
update public.vacantes v
set jornada_id = j.id
from public.jornadas j
where j.empresa_id = v.empresa_id and lower(j.nombre) = 'media jornada'
  and v.jornada_id is null
  and (v.titulo ilike '%camarero%' or v.titulo ilike '%cocinero%' or v.titulo ilike '%limpieza%');

-- 5c) Por horas: el resto de vacantes
update public.vacantes v
set jornada_id = j.id
from public.jornadas j
where j.empresa_id = v.empresa_id and lower(j.nombre) = 'por horas'
  and v.jornada_id is null;
