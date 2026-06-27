-- Inventarios: backend real (cierre PRP-058)
-- Alinea el esquema con las server actions y habilita persistencia de conteos,
-- tipos y plantillas. Idempotente.

-- 1. Columnas faltantes en inventarios (las actions ya las escribían) ─────────
alter table public.inventarios add column if not exists almacen text;
alter table public.inventarios add column if not exists motivo text;
alter table public.inventarios add column if not exists usuario text;
alter table public.inventarios add column if not exists plantilla_id uuid;
alter table public.inventarios add column if not exists updated_at timestamptz default now();
alter table public.inventarios add column if not exists confirmado_at timestamptz;
alter table public.inventarios add column if not exists confirmado_por text;

-- 2. Agrupación por conteo en las líneas ─────────────────────────────────────
alter table public.lineas_inventario add column if not exists conteo_nombre text;

-- 3. Tipos de inventario (configurable por empresa) ──────────────────────────
create table if not exists public.inventario_tipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  created_at timestamptz default now()
);
alter table public.inventario_tipos enable row level security;
drop policy if exists it_read on public.inventario_tipos;
create policy it_read on public.inventario_tipos for select
  using (empresa_id in (select empresas_del_usuario_text()));
drop policy if exists it_write on public.inventario_tipos;
create policy it_write on public.inventario_tipos for all
  using (empresa_id in (select empresas_del_usuario_text()))
  with check (empresa_id in (select empresas_del_usuario_text()));

-- 4. Plantillas de inventario (lista de productos obligatorios) ──────────────
create table if not exists public.inventario_plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  productos_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table public.inventario_plantillas enable row level security;
drop policy if exists ip_read on public.inventario_plantillas;
create policy ip_read on public.inventario_plantillas for select
  using (empresa_id in (select empresas_del_usuario_text()));
drop policy if exists ip_write on public.inventario_plantillas;
create policy ip_write on public.inventario_plantillas for all
  using (empresa_id in (select empresas_del_usuario_text()))
  with check (empresa_id in (select empresas_del_usuario_text()));

-- 5. Seed de tipos estándar para empresas existentes (aditivo, idempotente) ──
insert into public.inventario_tipos (empresa_id, nombre)
select e.id::text, t.nombre
from public.empresas e
cross join (values
  ('Inventario inicial'),
  ('Inventario semanal'),
  ('Inventario mensual'),
  ('Inventario de control'),
  ('Inventario extraordinario'),
  ('Inventario de cierre')
) as t(nombre)
where not exists (
  select 1 from public.inventario_tipos it
  where it.empresa_id = e.id::text and it.nombre = t.nombre
);
