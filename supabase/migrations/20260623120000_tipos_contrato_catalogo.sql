-- ============================================================
-- Tipos de contrato: catálogo por empresa + vínculo en vacantes.
-- Mismo modelo que `jornadas` (texto en vacantes = nombre del catálogo).
-- Catálogo configurable en Ajustes → Departamentos → RRHH → Tipos de contrato.
-- ============================================================

-- 1) Catálogo de tipos de contrato por empresa
create table if not exists public.tipos_contrato (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tipos_contrato_empresa_nombre_uk on public.tipos_contrato (empresa_id, lower(nombre));
create index if not exists tipos_contrato_empresa_idx on public.tipos_contrato (empresa_id);

alter table public.tipos_contrato enable row level security;

drop policy if exists tipos_contrato_select on public.tipos_contrato;
create policy tipos_contrato_select on public.tipos_contrato for select
  using (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists tipos_contrato_insert on public.tipos_contrato;
create policy tipos_contrato_insert on public.tipos_contrato for insert
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists tipos_contrato_update on public.tipos_contrato;
create policy tipos_contrato_update on public.tipos_contrato for update
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists tipos_contrato_delete on public.tipos_contrato;
create policy tipos_contrato_delete on public.tipos_contrato for delete
  using (empresa_id in (select public.empresas_del_usuario()));

-- 2) Columna en vacantes (nullable a nivel BD; la obligatoriedad se exige en el formulario)
alter table public.vacantes add column if not exists tipo_contrato text;

-- 3) Seed de los 4 tipos de contrato canónicos en TODAS las empresas (idempotente)
insert into public.tipos_contrato (empresa_id, nombre, orden)
select e.id, c.nombre, c.orden
from public.empresas e
cross join (values
  ('Indefinido', 1),
  ('Temporal', 2),
  ('Fijo discontinuo', 3),
  ('Formación y prácticas', 4)
) as c(nombre, orden)
where not exists (
  select 1 from public.tipos_contrato x
  where x.empresa_id = e.id and lower(x.nombre) = lower(c.nombre)
);

-- 4) Backfill: las vacantes existentes pasan a "Indefinido" (datos completos)
update public.vacantes
set tipo_contrato = 'Indefinido'
where tipo_contrato is null;
