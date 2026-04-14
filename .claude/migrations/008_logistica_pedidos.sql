-- ============================================================
-- 008_logistica_pedidos.sql — Complemento de Logística
-- Pedidos a proveedores, inventarios y plantillas.
-- (Las tablas base: productos, stock, escandallos, albaranes
--  ya están en 001_logistica.sql)
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.pedido_estado as enum ('Borrador', 'Pendiente', 'Confirmado', 'Enviado', 'Servido', 'Cancelado', 'Archivado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.inventario_estado as enum ('Borrador', 'Confirmado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.almacen_tipo as enum ('COCINA', 'BARRA', 'ALMACEN_GENERAL', 'CAMARA', 'CONGELADOR');
exception when duplicate_object then null;
end $$;

-- ─── 1. PEDIDOS A PROVEEDORES ──────────────────────────────

create table if not exists public.pedidos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  numero            text not null, -- número correlativo legible: 'PED-2026-001'
  proveedor         text not null,
  doc_proveedor     text not null default '', -- nº de albarán del proveedor
  almacen           public.almacen_tipo not null default 'COCINA',
  fecha             date not null default current_date,
  fecha_entrega     date,
  estado            public.pedido_estado not null default 'Borrador',
  dto_pct           numeric not null default 0,
  dto_eur           numeric not null default 0,
  subtotal          numeric not null default 0,
  total             numeric not null default 0,
  notas             text not null default '',
  albaran_id        uuid, -- se rellena cuando se convierte en albarán
  enviado_at        timestamptz,
  enviado_email     text not null default '',
  creador           text not null default '',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pedidos_empresa on public.pedidos(empresa_id);
create index if not exists idx_pedidos_estado  on public.pedidos(empresa_id, estado);

-- ─── 2. LÍNEAS DE PEDIDO ───────────────────────────────────

create table if not exists public.pedidos_lineas (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,
  nombre_producto text not null, -- copia del nombre por si se elimina el producto
  cantidad        numeric not null default 0,
  unidad          text not null default 'ud',
  precio_uc       numeric not null default 0, -- precio por unidad de compra
  dto_pct         numeric not null default 0,
  total           numeric not null default 0,
  recibido        numeric not null default 0, -- cantidad efectivamente recibida
  orden           integer not null default 0
);

create index if not exists idx_pedidos_lineas_pedido on public.pedidos_lineas(pedido_id);

-- ─── 3. INVENTARIOS ────────────────────────────────────────

create table if not exists public.inventarios (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  fecha           date not null default current_date,
  almacen         public.almacen_tipo not null default 'COCINA',
  motivo          text not null default 'periodico', -- 'periodico', 'cierre', 'apertura', 'spot'
  estado          public.inventario_estado not null default 'Borrador',
  plantilla_id    uuid, -- referencia opcional a plantilla
  usuario         text not null default '',
  confirmado_at   timestamptz,
  confirmado_por  text,
  observaciones   text not null default '',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_inventarios_empresa on public.inventarios(empresa_id);
create index if not exists idx_inventarios_fecha   on public.inventarios(empresa_id, fecha desc);

-- ─── 4. LÍNEAS DE INVENTARIO ───────────────────────────────

create table if not exists public.inventarios_lineas (
  id              uuid primary key default gen_random_uuid(),
  inventario_id   uuid not null references public.inventarios(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,
  nombre_producto text not null,
  unidad          text not null default 'ud',
  stock_sistema   numeric not null default 0, -- stock según el sistema antes del inventario
  cantidad_real   numeric not null default 0, -- cantidad contada físicamente
  diferencia      numeric generated always as (cantidad_real - stock_sistema) stored,
  coste_unitario  numeric not null default 0,
  orden           integer not null default 0
);

create index if not exists idx_inventarios_lineas_inventario on public.inventarios_lineas(inventario_id);

-- ─── 5. PLANTILLAS DE INVENTARIO ───────────────────────────

create table if not exists public.plantillas_inventario (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  almacen         public.almacen_tipo not null default 'COCINA',
  producto_ids    uuid[] not null default '{}',
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_plantillas_inventario_empresa on public.plantillas_inventario(empresa_id);

-- ─── 6. RLS ────────────────────────────────────────────────

alter table public.pedidos                enable row level security;
alter table public.pedidos_lineas         enable row level security;
alter table public.inventarios            enable row level security;
alter table public.inventarios_lineas     enable row level security;
alter table public.plantillas_inventario  enable row level security;

create policy "pedidos_empresa" on public.pedidos
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "pedidos_lineas_empresa" on public.pedidos_lineas
  for all using (
    pedido_id in (
      select id from public.pedidos
      where empresa_id in (select empresa_id from public.profiles where id = auth.uid())
    )
  );

create policy "inventarios_empresa" on public.inventarios
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "inventarios_lineas_empresa" on public.inventarios_lineas
  for all using (
    inventario_id in (
      select id from public.inventarios
      where empresa_id in (select empresa_id from public.profiles where id = auth.uid())
    )
  );

create policy "plantillas_inventario_empresa" on public.plantillas_inventario
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

-- ─── 7. TRIGGERS updated_at ────────────────────────────────

create trigger pedidos_updated_at
  before update on public.pedidos
  for each row execute function public.set_updated_at();

create trigger inventarios_updated_at
  before update on public.inventarios
  for each row execute function public.set_updated_at();

create trigger plantillas_inventario_updated_at
  before update on public.plantillas_inventario
  for each row execute function public.set_updated_at();

-- ─── 8. FUNCIÓN: número de pedido automático ───────────────

create or replace function public.siguiente_numero_pedido(p_empresa_id uuid)
returns text language plpgsql as $$
declare
  v_year   text := to_char(current_date, 'YYYY');
  v_count  integer;
begin
  select count(*) + 1 into v_count
  from public.pedidos
  where empresa_id = p_empresa_id
    and extract(year from created_at) = extract(year from current_date);
  return 'PED-' || v_year || '-' || lpad(v_count::text, 3, '0');
end $$;
