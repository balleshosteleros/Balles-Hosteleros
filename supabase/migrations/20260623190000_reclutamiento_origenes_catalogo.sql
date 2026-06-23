-- ============================================================
-- "¿Cómo nos has conocido?": catálogo de orígenes/canales por empresa.
-- Mismo modelo que `tipos_contrato` / `jornadas` (configurable por empresa).
-- Catálogo editable en Reclutamiento → Configuración → Candidatos.
-- `candidatos.origen` guarda el NOMBRE del origen (texto), igual que jornadas.
-- ============================================================

-- 1) Catálogo de orígenes por empresa
create table if not exists public.reclutamiento_origenes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists reclutamiento_origenes_empresa_nombre_uk
  on public.reclutamiento_origenes (empresa_id, lower(nombre));
create index if not exists reclutamiento_origenes_empresa_idx
  on public.reclutamiento_origenes (empresa_id);

alter table public.reclutamiento_origenes enable row level security;

drop policy if exists reclutamiento_origenes_select on public.reclutamiento_origenes;
create policy reclutamiento_origenes_select on public.reclutamiento_origenes for select
  using (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists reclutamiento_origenes_insert on public.reclutamiento_origenes;
create policy reclutamiento_origenes_insert on public.reclutamiento_origenes for insert
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists reclutamiento_origenes_update on public.reclutamiento_origenes;
create policy reclutamiento_origenes_update on public.reclutamiento_origenes for update
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists reclutamiento_origenes_delete on public.reclutamiento_origenes;
create policy reclutamiento_origenes_delete on public.reclutamiento_origenes for delete
  using (empresa_id in (select public.empresas_del_usuario()));

-- 2) Seed de orígenes canónicos en TODAS las empresas (idempotente)
insert into public.reclutamiento_origenes (empresa_id, nombre, orden)
select e.id, c.nombre, c.orden
from public.empresas e
cross join (values
  ('Web principal', 1),
  ('Portal de empleo', 2),
  ('Redes sociales', 3),
  ('Recomendación de un empleado', 4),
  ('InfoJobs', 5),
  ('LinkedIn', 6),
  ('Indeed', 7),
  ('Otros', 8)
) as c(nombre, orden)
where not exists (
  select 1 from public.reclutamiento_origenes x
  where x.empresa_id = e.id and lower(x.nombre) = lower(c.nombre)
);
