-- ============================================================
-- 015_inventarios_upgrade.sql
-- Añade columnas que faltan en la tabla inventarios y crea
-- las tablas auxiliares de logística que aún no existen.
-- ============================================================

-- ─── ENUMS (si no existen) ─────────────────────────────────

do $$ begin
  create type public.almacen_tipo as enum ('COCINA', 'BARRA', 'ALMACEN_GENERAL', 'CAMARA', 'CONGELADOR');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pedido_estado as enum ('Borrador', 'Pendiente', 'Confirmado', 'Enviado', 'Servido', 'Cancelado', 'Archivado');
exception when duplicate_object then null;
end $$;

-- ─── INVENTARIOS — añadir columnas nuevas ──────────────────

alter table public.inventarios
  add column if not exists almacen         text not null default 'COCINA',
  add column if not exists motivo          text not null default 'periodico',
  add column if not exists plantilla_id    uuid,
  add column if not exists usuario         text not null default '',
  add column if not exists confirmado_at   timestamptz,
  add column if not exists confirmado_por  text,
  add column if not exists observaciones   text not null default '',
  add column if not exists updated_at      timestamptz not null default now();

-- Rellenar almacen/motivo con datos existentes si los hay
update public.inventarios
  set almacen = coalesce(tipo, 'COCINA'),
      motivo  = coalesce(nombre, 'periodico')
  where almacen = 'COCINA' and motivo = 'periodico';

-- ─── LINEAS_INVENTARIO — asegurar columnas ─────────────────

alter table public.lineas_inventario
  add column if not exists stock_sistema  numeric not null default 0,
  add column if not exists coste_unitario numeric not null default 0,
  add column if not exists orden          integer not null default 0;

-- ─── PEDIDOS — crear si no existe ──────────────────────────

create table if not exists public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  numero        text not null default '',
  proveedor     text not null default '',
  proveedor_id  uuid,
  almacen       text not null default 'COCINA',
  fecha         date not null default current_date,
  fecha_entrega date,
  estado        text not null default 'Borrador',
  dto_pct       numeric not null default 0,
  dto_eur       numeric not null default 0,
  subtotal      numeric not null default 0,
  total         numeric not null default 0,
  notas         text not null default '',
  enviado_at    timestamptz,
  enviado_email text not null default '',
  creador       text not null default '',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_pedidos_empresa on public.pedidos(empresa_id);
create index if not exists idx_pedidos_estado  on public.pedidos(empresa_id, estado);

-- RLS pedidos
alter table public.pedidos enable row level security;
create policy if not exists "pedidos_read" on public.pedidos
  for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy if not exists "pedidos_write" on public.pedidos
  for all to authenticated using (true) with check (true);

-- ─── PEDIDOS_LINEAS ────────────────────────────────────────

create table if not exists public.pedidos_lineas (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  producto_id     uuid,
  nombre_producto text not null,
  cantidad        numeric not null default 0,
  unidad          text not null default 'ud',
  precio_uc       numeric not null default 0,
  dto_pct         numeric not null default 0,
  total           numeric not null default 0,
  recibido        numeric not null default 0,
  orden           integer not null default 0
);

create index if not exists idx_pedidos_lineas_pedido on public.pedidos_lineas(pedido_id);

-- ─── PLANTILLAS_INVENTARIO ─────────────────────────────────

create table if not exists public.plantillas_inventario (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  almacen     text not null default 'COCINA',
  producto_ids uuid[] not null default '{}',
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.plantillas_inventario enable row level security;
create policy if not exists "plantillas_rw" on public.plantillas_inventario
  for all to authenticated using (true) with check (true);

-- ─── STOCK — asegurar columnas ─────────────────────────────

alter table public.stock
  add column if not exists cantidad_maxima numeric not null default 0;
