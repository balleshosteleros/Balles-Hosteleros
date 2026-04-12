-- Migration 006: Taxonomía de productos (categorías y familias) editables
-- Permite que el usuario añada, renombre y elimine categorías y familias
-- directamente desde la UI, por tipo de producto (compra / venta).

-- =======================================================
-- 1. Enum kind (categoria | familia)
-- =======================================================
do $$ begin
  create type public.producto_taxonomia_kind as enum ('categoria', 'familia');
exception when duplicate_object then null;
end $$;

-- =======================================================
-- 2. Tabla producto_taxonomia
-- =======================================================
create table if not exists public.producto_taxonomia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  tipo_producto public.producto_tipo not null,
  kind public.producto_taxonomia_kind not null,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (empresa_id, tipo_producto, kind, nombre)
);

create index if not exists idx_producto_taxonomia_lookup
  on public.producto_taxonomia(empresa_id, tipo_producto, kind, orden);

-- =======================================================
-- 3. Trigger de updated_at
-- =======================================================
create or replace function public.set_producto_taxonomia_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists producto_taxonomia_updated_at on public.producto_taxonomia;
create trigger producto_taxonomia_updated_at
  before update on public.producto_taxonomia
  for each row
  execute function public.set_producto_taxonomia_updated_at();

-- =======================================================
-- 4. RLS
-- =======================================================
alter table public.producto_taxonomia enable row level security;

drop policy if exists "Read own empresa taxonomia" on public.producto_taxonomia;
create policy "Read own empresa taxonomia"
  on public.producto_taxonomia for select
  to authenticated
  using (
    empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "Management insert taxonomia" on public.producto_taxonomia;
create policy "Management insert taxonomia"
  on public.producto_taxonomia for insert
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

drop policy if exists "Management update taxonomia" on public.producto_taxonomia;
create policy "Management update taxonomia"
  on public.producto_taxonomia for update
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

drop policy if exists "Management delete taxonomia" on public.producto_taxonomia;
create policy "Management delete taxonomia"
  on public.producto_taxonomia for delete
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  );

-- =======================================================
-- 5. Seed: categorías y familias por defecto para empresa default
-- =======================================================

-- CATEGORÍAS DE COMPRA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Materias primas', 1),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Bebidas', 2),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Limpieza', 3),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Utensilios', 4),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Consumibles', 5),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Ingredientes', 6)
on conflict do nothing;

-- FAMILIAS DE COMPRA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Cárnicos', 1),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Pescados', 2),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Lácteos', 3),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Verduras y frutas', 4),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Bebidas alcohólicas', 5),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Bebidas sin alcohol', 6),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Higiene', 7),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Menaje', 8),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Otros', 9)
on conflict do nothing;

-- CATEGORÍAS DE VENTA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Platos', 1),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Bebidas', 2),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Cócteles', 3),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Postres', 4),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Menús', 5),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Extras', 6)
on conflict do nothing;

-- FAMILIAS DE VENTA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Entrantes', 1),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Principales', 2),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Postres', 3),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Bebidas carta', 4),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Cócteles carta', 5),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Menú degustación', 6),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Menú del día', 7),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Extras', 8)
on conflict do nothing;
