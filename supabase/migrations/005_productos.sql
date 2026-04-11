-- Migration 005: Productos table (Logística)
-- Tabla central de productos de compra y venta. Soporta importación
-- masiva desde CSV/Excel y migración desde la plataforma anterior.

-- =======================================================
-- 1. Enum de tipo y estado de producto
-- =======================================================
do $$ begin
  create type public.producto_tipo as enum ('compra', 'venta');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.producto_estado as enum ('Activo', 'Inactivo', 'Descatalogado', 'En revisión');
exception when duplicate_object then null;
end $$;

-- =======================================================
-- 2. Tabla productos
-- =======================================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  nombre text not null,
  tipo public.producto_tipo not null,
  categoria text not null,
  familia text,
  estado public.producto_estado not null default 'Activo',
  proveedor text,
  precio_compra text,
  precio_venta text,
  coste text,
  unidad text not null default 'ud',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_productos_empresa_tipo
  on public.productos(empresa_id, tipo);
create index if not exists idx_productos_categoria
  on public.productos(empresa_id, tipo, categoria);
create index if not exists idx_productos_nombre
  on public.productos(empresa_id, tipo, nombre);

-- =======================================================
-- 3. Trigger de updated_at
-- =======================================================
create or replace function public.set_productos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists productos_updated_at on public.productos;
create trigger productos_updated_at
  before update on public.productos
  for each row
  execute function public.set_productos_updated_at();

-- =======================================================
-- 4. RLS
-- =======================================================
alter table public.productos enable row level security;

-- SELECT: cualquier usuario autenticado puede ver los productos de su empresa
drop policy if exists "Users can read productos de su empresa" on public.productos;
create policy "Users can read productos de su empresa"
  on public.productos for select
  to authenticated
  using (
    empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: admin, director, gerencia, responsable
drop policy if exists "Management can insert productos" on public.productos;
create policy "Management can insert productos"
  on public.productos for insert
  to authenticated
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
    and empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "Management can update productos" on public.productos;
create policy "Management can update productos"
  on public.productos for update
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  )
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  );

drop policy if exists "Management can delete productos" on public.productos;
create policy "Management can delete productos"
  on public.productos for delete
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  );
