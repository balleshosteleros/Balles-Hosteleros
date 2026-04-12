-- ============================================================
-- 011_logistica_compras.sql
-- Módulo de Logística: Compras, Proveedores, Escandallos, Temporadas
--
-- ADAPTA al esquema existente:
--   - productos (005) → se amplía con columnas para Ágora y conversión
--   - stock (010)     → se amplía con stock_maximo
--   - NO crea tablas duplicadas
-- ============================================================

-- ─── 1. AMPLIAR productos ──────────────────────────────────
-- Añadir campos para sincronización con Ágora (tipo='venta')
-- y para conversión de unidades (tipo='compra').

alter table public.productos
  add column if not exists agora_id text,
  add column if not exists ventas_dia_promedio numeric not null default 0,
  add column if not exists unidad_uso text,
  add column if not exists factor_conversion numeric not null default 1,
  add column if not exists stock_minimo numeric not null default 0,
  add column if not exists stock_maximo numeric not null default 0;

comment on column public.productos.agora_id is 'ID en Ágora POS — solo productos tipo venta';
comment on column public.productos.ventas_dia_promedio is 'Media diaria de ventas — se actualiza con sync de Ágora';
comment on column public.productos.unidad_uso is 'Unidad en escandallos (ej: L, kg). Si null, usa la columna unidad';
comment on column public.productos.factor_conversion is 'unidad_compra × factor = unidad_uso. Ej: 1 caja = 6 L → factor=6';
comment on column public.productos.stock_minimo is 'Punto de reorden (solo tipo compra)';
comment on column public.productos.stock_maximo is 'Techo de stock por defecto (solo tipo compra)';

-- Índice para sync Ágora (solo productos venta con agora_id)
create unique index if not exists idx_productos_agora
  on public.productos(empresa_id, agora_id) where agora_id is not null;

-- ─── 2. AMPLIAR stock ──────────────────────────────────────
-- La tabla stock (010) tiene cantidad_actual y cantidad_minima.
-- Añadir cantidad_maxima para el cálculo de compra automática.

alter table public.stock
  add column if not exists cantidad_maxima numeric(10,3) default 0;

comment on column public.stock.cantidad_maxima is 'Techo de stock por defecto — override posible vía stock_temporada';

-- ─── 3. PROVEEDORES ────────────────────────────────────────
-- Maestro de proveedores. Toda compra apunta aquí.

create table if not exists public.proveedores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre_comercial text not null,
  razon_social    text,
  cif_nif         text,
  categoria       text not null,
  estado          text not null default 'Activo'
                    check (estado in ('Activo','Inactivo','Archivado')),
  -- Contacto
  persona_contacto   text,
  telefono_principal text,
  telefono_secundario text,
  email_principal    text,
  email_pedidos      text,
  email_incidencias  text,
  web                text,
  -- Dirección
  direccion       text,
  ciudad          text,
  provincia       text,
  pais            text default 'España',
  codigo_postal   text,
  -- Condiciones logísticas
  dias_reparto       text[] default '{}',
  condiciones_pago   text,
  plazo_entrega      text,
  observaciones_logisticas text,
  comentarios_internos     text,
  observaciones   text,
  -- Meta
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_proveedores_empresa
  on public.proveedores(empresa_id);
create index if not exists idx_proveedores_estado
  on public.proveedores(empresa_id, estado);

-- Trigger updated_at
create or replace function public.set_proveedores_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists proveedores_updated_at on public.proveedores;
create trigger proveedores_updated_at
  before update on public.proveedores
  for each row execute function public.set_proveedores_updated_at();

-- ─── 4. INGREDIENTES_PROVEEDOR ─────────────────────────────
-- Tabla puente: un producto(tipo='compra') puede comprarse a N proveedores.
-- Permite comparativa de precios y selección del preferido.

create table if not exists public.ingredientes_proveedor (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos(id) on delete cascade,
  proveedor_id    uuid not null references public.proveedores(id) on delete cascade,
  precio_unitario numeric not null,
  referencia      text,
  es_preferido    boolean not null default false,
  ultimo_precio_fecha date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (producto_id, proveedor_id)
);

create index if not exists idx_ingprov_producto
  on public.ingredientes_proveedor(producto_id);
create index if not exists idx_ingprov_proveedor
  on public.ingredientes_proveedor(proveedor_id);

comment on table public.ingredientes_proveedor is
  'Precios por proveedor para productos tipo compra. es_preferido=true → proveedor por defecto';

-- ─── 5. ESCANDALLOS ────────────────────────────────────────
-- Receta: qué productos(tipo='compra') necesita cada producto(tipo='venta').
-- Tabla CLAVE para el cálculo de compra automática.
--
-- Ejemplo: "Risotto de setas" (venta) necesita:
--   0.30 kg arroz (compra) + 0.15 kg setas (compra) + 0.05 L nata (compra)

create table if not exists public.escandallos (
  id                  uuid primary key default gen_random_uuid(),
  producto_venta_id   uuid not null references public.productos(id) on delete cascade,
  ingrediente_id      uuid not null references public.productos(id) on delete cascade,
  cantidad            numeric not null,
  merma_pct           numeric not null default 0,
  observaciones       text,
  created_at          timestamptz not null default now(),
  unique (producto_venta_id, ingrediente_id)
);

create index if not exists idx_escandallos_venta
  on public.escandallos(producto_venta_id);
create index if not exists idx_escandallos_ingrediente
  on public.escandallos(ingrediente_id);

comment on column public.escandallos.cantidad is 'En unidad_uso del ingrediente';
comment on column public.escandallos.merma_pct is '% de pérdida (limpieza, cocción). Real = cantidad × (1 + merma_pct/100)';

-- ─── 6. STOCK_TEMPORADA ────────────────────────────────────
-- Overrides estacionales de stock máximo/mínimo por ingrediente.
-- Ej: en verano stock_maximo de helado sube, el de caldo baja.

create table if not exists public.stock_temporada (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null,
  fecha_inicio  date not null,
  fecha_fin     date not null,
  check (fecha_fin >= fecha_inicio),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_stock_temporada_empresa
  on public.stock_temporada(empresa_id);

-- Reglas individuales por producto dentro de una temporada
create table if not exists public.stock_temporada_reglas (
  id              uuid primary key default gen_random_uuid(),
  temporada_id    uuid not null references public.stock_temporada(id) on delete cascade,
  producto_id     uuid not null references public.productos(id) on delete cascade,
  stock_maximo    numeric not null,
  stock_minimo    numeric not null,
  unique (temporada_id, producto_id)
);

create index if not exists idx_stock_reglas_temporada
  on public.stock_temporada_reglas(temporada_id);

-- ─── 7. ALBARANES ──────────────────────────────────────────
-- Documento de entrada de mercancía del proveedor.

create table if not exists public.albaranes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  proveedor_id  uuid not null references public.proveedores(id),
  numero        text not null,
  fecha         date not null default current_date,
  estado        text not null default 'Pendiente'
                  check (estado in ('Pendiente','Confirmado','Recibido','Facturado','Archivado')),
  pedido_id     uuid,
  factura_ref   text,
  dto_pct       numeric not null default 0,
  dto_eur       numeric not null default 0,
  notas         text,
  creado_por    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_albaranes_empresa
  on public.albaranes(empresa_id);
create index if not exists idx_albaranes_proveedor
  on public.albaranes(proveedor_id);
create index if not exists idx_albaranes_fecha
  on public.albaranes(empresa_id, fecha desc);

-- Trigger updated_at
create or replace function public.set_albaranes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists albaranes_updated_at on public.albaranes;
create trigger albaranes_updated_at
  before update on public.albaranes
  for each row execute function public.set_albaranes_updated_at();

-- Líneas de albarán
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

create index if not exists idx_alblineas_albaran
  on public.albaranes_lineas(albaran_id);

-- ─── 8. RLS ────────────────────────────────────────────────
-- Patrón consistente: empresa_id vía profiles.empresa_id del usuario.

alter table public.proveedores             enable row level security;
alter table public.ingredientes_proveedor  enable row level security;
alter table public.escandallos             enable row level security;
alter table public.stock_temporada         enable row level security;
alter table public.stock_temporada_reglas  enable row level security;
alter table public.albaranes               enable row level security;
alter table public.albaranes_lineas        enable row level security;

-- Proveedores
create policy "prov_read" on public.proveedores for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "prov_manage" on public.proveedores for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Ingredientes-proveedor (acceso vía producto → empresa)
create policy "ip_read" on public.ingredientes_proveedor for select to authenticated using (true);
create policy "ip_manage" on public.ingredientes_proveedor for all to authenticated
  using (true) with check (true);

-- Escandallos (acceso vía producto → empresa)
create policy "esc_read" on public.escandallos for select to authenticated using (true);
create policy "esc_manage" on public.escandallos for all to authenticated
  using (true) with check (true);

-- Stock temporada
create policy "st_read" on public.stock_temporada for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "st_manage" on public.stock_temporada for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Stock temporada reglas
create policy "str_read" on public.stock_temporada_reglas for select to authenticated using (true);
create policy "str_manage" on public.stock_temporada_reglas for all to authenticated
  using (true) with check (true);

-- Albaranes
create policy "alb_read" on public.albaranes for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "alb_manage" on public.albaranes for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Albaranes líneas
create policy "al_read" on public.albaranes_lineas for select to authenticated using (true);
create policy "al_manage" on public.albaranes_lineas for all to authenticated
  using (true) with check (true);

-- ─── 9. FUNCIÓN: calcular_necesidad_compra ─────────────────
-- Calcula cuánto hay que comprar de cada ingrediente.
--
-- Lógica:
--   1. Busca productos tipo 'compra' activos de la empresa
--   2. Obtiene stock_objetivo = temporada activa override ?? stock.cantidad_maxima ?? productos.stock_maximo
--   3. necesidad = stock_objetivo - stock_actual
--   4. Si stock_actual > stock_minimo → no urgente, se omite
--   5. Busca proveedor preferido para estimación de coste

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
    select id
    from public.stock_temporada
    where empresa_id = p_empresa_id
      and current_date between fecha_inicio and fecha_fin
    limit 1
  ),
  productos_compra as (
    select
      pr.id,
      pr.nombre,
      pr.unidad,
      pr.factor_conversion,
      coalesce(s.cantidad_actual, 0) as stock_actual,
      coalesce(
        str.stock_maximo,
        s.cantidad_maxima,
        pr.stock_maximo
      ) as stock_objetivo,
      coalesce(
        str.stock_minimo,
        s.cantidad_minima,
        pr.stock_minimo
      ) as stock_minimo
    from public.productos pr
    left join public.stock s
      on s.producto_id = pr.id
    left join temporada_activa ta on true
    left join public.stock_temporada_reglas str
      on str.producto_id = pr.id
      and str.temporada_id = ta.id
    where pr.empresa_id = p_empresa_id
      and pr.tipo = 'compra'
      and pr.estado = 'Activo'
  ),
  necesidades as (
    select
      pc.*,
      greatest(pc.stock_objetivo - pc.stock_actual, 0) as necesidad
    from productos_compra pc
    where pc.stock_actual <= pc.stock_minimo
  )
  select
    n.id as producto_id,
    n.nombre,
    n.unidad,
    n.stock_actual,
    n.stock_objetivo,
    n.necesidad,
    ip.proveedor_id as proveedor_preferido,
    pv.nombre_comercial as proveedor_nombre,
    ip.precio_unitario as precio_estimado,
    round(n.necesidad * coalesce(ip.precio_unitario, 0), 2) as coste_estimado
  from necesidades n
  left join public.ingredientes_proveedor ip
    on ip.producto_id = n.id and ip.es_preferido = true
  left join public.proveedores pv
    on pv.id = ip.proveedor_id
  where n.necesidad > 0
  order by n.nombre;
$$;

-- ─── 10. FUNCIÓN: coste_escandallo ─────────────────────────
-- Calcula el food cost de un producto de venta sumando sus ingredientes.

create or replace function public.coste_escandallo(p_producto_venta_id uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(
    e.cantidad
    * (1 + e.merma_pct / 100)
    * coalesce(ip.precio_unitario, 0)
    / coalesce(nullif(ing.factor_conversion, 0), 1)
  ), 0)
  from public.escandallos e
  join public.productos ing on ing.id = e.ingrediente_id
  left join public.ingredientes_proveedor ip
    on ip.producto_id = e.ingrediente_id
    and ip.es_preferido = true
  where e.producto_venta_id = p_producto_venta_id;
$$;
