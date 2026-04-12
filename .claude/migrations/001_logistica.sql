-- ============================================================
-- 001_logistica.sql — Módulo de Logística (auto-contenida)
-- Crea TODAS las tablas necesarias: productos, stock, proveedores,
-- escandallos, stock_temporada, albaranes.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.producto_tipo as enum ('compra', 'venta');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.producto_estado as enum ('Activo', 'Inactivo', 'Descatalogado', 'En revisión');
exception when duplicate_object then null;
end $$;

-- ─── 1. PRODUCTOS ──────────────────────────────────────────
-- Tabla central: productos de VENTA (platos, bebidas — de Ágora POS)
-- y de COMPRA (ingredientes, materias primas).

create table if not exists public.productos (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid references public.empresas(id) on delete cascade,
  tipo                public.producto_tipo not null,
  nombre              text not null,
  categoria           text not null,
  familia             text,
  estado              public.producto_estado not null default 'Activo',
  -- Compra
  proveedor           text,
  precio_compra       text,
  coste               text,
  unidad              text not null default 'ud',
  unidad_uso          text,
  factor_conversion   numeric not null default 1,
  stock_minimo        numeric not null default 0,
  stock_maximo        numeric not null default 0,
  -- Venta
  precio_venta        text,
  agora_id            text,
  ventas_dia_promedio numeric not null default 0,
  -- Meta
  observaciones       text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_productos_empresa_tipo on public.productos(empresa_id, tipo);
create unique index if not exists idx_productos_agora
  on public.productos(empresa_id, agora_id) where agora_id is not null;

-- ─── 2. STOCK ──────────────────────────────────────────────

create table if not exists public.stock (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  producto_id       uuid references public.productos(id) on delete cascade,
  producto_nombre   text not null,
  cantidad_actual   numeric not null default 0,
  cantidad_minima   numeric not null default 0,
  cantidad_maxima   numeric not null default 0,
  unidad            text not null default 'ud',
  ubicacion         text,
  ultimo_movimiento timestamptz default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_stock_empresa on public.stock(empresa_id);
create index if not exists idx_stock_producto on public.stock(producto_id);

-- ─── 3. PROVEEDORES ────────────────────────────────────────

create table if not exists public.proveedores (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  nombre_comercial    text not null,
  razon_social        text,
  cif_nif             text,
  categoria           text not null,
  estado              text not null default 'Activo'
                        check (estado in ('Activo','Inactivo','Archivado')),
  persona_contacto    text,
  telefono_principal  text,
  telefono_secundario text,
  email_principal     text,
  email_pedidos       text,
  email_incidencias   text,
  web                 text,
  direccion           text,
  ciudad              text,
  provincia           text,
  pais                text default 'España',
  codigo_postal       text,
  dias_reparto        text[] default '{}',
  condiciones_pago    text,
  plazo_entrega       text,
  observaciones       text,
  comentarios_internos text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_proveedores_empresa on public.proveedores(empresa_id);

-- ─── 4. INGREDIENTES_PROVEEDOR ─────────────────────────────
-- Precio de cada ingrediente por proveedor. Permite comparativa.

create table if not exists public.ingredientes_proveedor (
  id                  uuid primary key default gen_random_uuid(),
  producto_id         uuid not null references public.productos(id) on delete cascade,
  proveedor_id        uuid not null references public.proveedores(id) on delete cascade,
  precio_unitario     numeric not null,
  referencia          text,
  es_preferido        boolean not null default false,
  ultimo_precio_fecha date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (producto_id, proveedor_id)
);

create index if not exists idx_ingprov_producto on public.ingredientes_proveedor(producto_id);
create index if not exists idx_ingprov_proveedor on public.ingredientes_proveedor(proveedor_id);

-- ─── 5. ESCANDALLOS ────────────────────────────────────────
-- Receta: qué ingredientes lleva cada plato. Tabla CLAVE para compra automática.

create table if not exists public.escandallos (
  id                uuid primary key default gen_random_uuid(),
  producto_venta_id uuid not null references public.productos(id) on delete cascade,
  ingrediente_id    uuid not null references public.productos(id) on delete cascade,
  cantidad          numeric not null,
  merma_pct         numeric not null default 0,
  observaciones     text,
  created_at        timestamptz not null default now(),
  unique (producto_venta_id, ingrediente_id)
);

create index if not exists idx_escandallos_venta on public.escandallos(producto_venta_id);
create index if not exists idx_escandallos_ingrediente on public.escandallos(ingrediente_id);

-- ─── 6. STOCK_TEMPORADA ────────────────────────────────────

create table if not exists public.stock_temporada (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  nombre       text not null,
  fecha_inicio date not null,
  fecha_fin    date not null,
  check (fecha_fin >= fecha_inicio),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_stock_temporada_empresa on public.stock_temporada(empresa_id);

create table if not exists public.stock_temporada_reglas (
  id           uuid primary key default gen_random_uuid(),
  temporada_id uuid not null references public.stock_temporada(id) on delete cascade,
  producto_id  uuid not null references public.productos(id) on delete cascade,
  stock_maximo numeric not null,
  stock_minimo numeric not null,
  unique (temporada_id, producto_id)
);

create index if not exists idx_stock_reglas_temporada on public.stock_temporada_reglas(temporada_id);

-- ─── 7. ALBARANES ──────────────────────────────────────────

create table if not exists public.albaranes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id),
  numero       text not null,
  fecha        date not null default current_date,
  estado       text not null default 'Pendiente'
                 check (estado in ('Pendiente','Confirmado','Recibido','Facturado','Archivado')),
  pedido_id    uuid,
  factura_ref  text,
  dto_pct      numeric not null default 0,
  dto_eur      numeric not null default 0,
  notas        text,
  creado_por   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_albaranes_empresa on public.albaranes(empresa_id);
create index if not exists idx_albaranes_proveedor on public.albaranes(proveedor_id);
create index if not exists idx_albaranes_fecha on public.albaranes(empresa_id, fecha desc);

create table if not exists public.albaranes_lineas (
  id              uuid primary key default gen_random_uuid(),
  albaran_id      uuid not null references public.albaranes(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        numeric not null,
  precio_unitario numeric not null,
  impuesto_pct    numeric not null default 10,
  dto_pct         numeric not null default 0,
  dto_eur         numeric not null default 0
);

create index if not exists idx_alblineas_albaran on public.albaranes_lineas(albaran_id);

-- ─── 8. RLS ────────────────────────────────────────────────
-- Acceso por empresa del usuario autenticado (via profiles).

alter table public.productos              enable row level security;
alter table public.stock                  enable row level security;
alter table public.proveedores            enable row level security;
alter table public.ingredientes_proveedor enable row level security;
alter table public.escandallos            enable row level security;
alter table public.stock_temporada        enable row level security;
alter table public.stock_temporada_reglas enable row level security;
alter table public.albaranes              enable row level security;
alter table public.albaranes_lineas       enable row level security;

-- Nota: si 'profiles' no tiene aún la columna empresa_id, las policies
-- igual se crean pero ningún usuario verá datos hasta completar auth.
-- Se asume que profiles tiene: user_id (uuid) y empresa_id (uuid).

create policy "prod_read"  on public.productos for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "prod_write" on public.productos for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

create policy "stock_read"  on public.stock for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "stock_write" on public.stock for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

create policy "prov_read"  on public.proveedores for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "prov_write" on public.proveedores for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

create policy "ip_read"  on public.ingredientes_proveedor for select to authenticated using (true);
create policy "ip_write" on public.ingredientes_proveedor for all to authenticated
  using (true) with check (true);

create policy "esc_read"  on public.escandallos for select to authenticated using (true);
create policy "esc_write" on public.escandallos for all to authenticated
  using (true) with check (true);

create policy "st_read"  on public.stock_temporada for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "st_write" on public.stock_temporada for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

create policy "str_read"  on public.stock_temporada_reglas for select to authenticated using (true);
create policy "str_write" on public.stock_temporada_reglas for all to authenticated
  using (true) with check (true);

create policy "alb_read"  on public.albaranes for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "alb_write" on public.albaranes for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

create policy "al_read"  on public.albaranes_lineas for select to authenticated using (true);
create policy "al_write" on public.albaranes_lineas for all to authenticated
  using (true) with check (true);

-- ─── 9. FUNCIÓN: calcular_necesidad_compra ─────────────────

create or replace function public.calcular_necesidad_compra(p_empresa_id uuid)
returns table (
  producto_id         uuid,
  nombre              text,
  unidad              text,
  stock_actual        numeric,
  stock_objetivo      numeric,
  necesidad           numeric,
  proveedor_preferido uuid,
  proveedor_nombre    text,
  precio_estimado     numeric,
  coste_estimado      numeric
)
language sql stable
as $$
  with temporada_activa as (
    select id from public.stock_temporada
    where empresa_id = p_empresa_id
      and current_date between fecha_inicio and fecha_fin
    limit 1
  ),
  productos_compra as (
    select
      pr.id, pr.nombre, pr.unidad,
      coalesce(s.cantidad_actual, 0) as stock_actual,
      coalesce(str.stock_maximo, s.cantidad_maxima, pr.stock_maximo) as stock_objetivo,
      coalesce(str.stock_minimo, s.cantidad_minima, pr.stock_minimo) as stock_minimo
    from public.productos pr
    left join public.stock s on s.producto_id = pr.id
    left join temporada_activa ta on true
    left join public.stock_temporada_reglas str
      on str.producto_id = pr.id and str.temporada_id = ta.id
    where pr.empresa_id = p_empresa_id
      and pr.tipo = 'compra'
      and pr.estado = 'Activo'
  ),
  necesidades as (
    select pc.*, greatest(pc.stock_objetivo - pc.stock_actual, 0) as necesidad
    from productos_compra pc
    where pc.stock_actual <= pc.stock_minimo
  )
  select
    n.id, n.nombre, n.unidad, n.stock_actual, n.stock_objetivo, n.necesidad,
    ip.proveedor_id, pv.nombre_comercial,
    ip.precio_unitario,
    round(n.necesidad * coalesce(ip.precio_unitario, 0), 2)
  from necesidades n
  left join public.ingredientes_proveedor ip
    on ip.producto_id = n.id and ip.es_preferido = true
  left join public.proveedores pv on pv.id = ip.proveedor_id
  where n.necesidad > 0
  order by n.nombre;
$$;

-- ─── 10. FUNCIÓN: coste_escandallo ─────────────────────────

create or replace function public.coste_escandallo(p_producto_venta_id uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(
    e.cantidad * (1 + e.merma_pct / 100)
    * coalesce(ip.precio_unitario, 0)
    / coalesce(nullif(ing.factor_conversion, 0), 1)
  ), 0)
  from public.escandallos e
  join public.productos ing on ing.id = e.ingrediente_id
  left join public.ingredientes_proveedor ip
    on ip.producto_id = e.ingrediente_id and ip.es_preferido = true
  where e.producto_venta_id = p_producto_venta_id;
$$;
