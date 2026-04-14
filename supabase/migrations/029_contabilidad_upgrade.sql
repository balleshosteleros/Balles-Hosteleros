-- ============================================================
-- 029_contabilidad_upgrade.sql
-- Módulo Contabilidad: Etiquetas, cuentas bancarias, líneas de factura,
--                      impuestos y conciliación bancaria.
--
-- CONEXIONES CRUZADAS:
--   - etiquetas → facturas, transacciones (Contabilidad)
--   - facturas → albaranes (Logística — albaran genera factura)
--   - cuentas_bancarias → transacciones (Contabilidad)
--   - impuestos → facturas, lineas_factura (Contabilidad)
--   - lineas_factura → productos (Logística — si factura de compra)
-- ============================================================

-- ─── 1. ETIQUETAS ──────────────────────────────────────────
-- Tags para clasificar facturas y transacciones (ej: #temporada-verano, #urgente).

create table if not exists public.etiquetas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  color       text default '#6366f1',
  descripcion text,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (empresa_id, nombre)
);

-- Tabla puente: facturas ↔ etiquetas (N:N)
create table if not exists public.facturas_etiquetas (
  factura_id  uuid not null references public.facturas(id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  primary key (factura_id, etiqueta_id)
);

-- Tabla puente: transacciones ↔ etiquetas (N:N)
create table if not exists public.transacciones_etiquetas (
  transaccion_id uuid not null references public.transacciones(id) on delete cascade,
  etiqueta_id    uuid not null references public.etiquetas(id) on delete cascade,
  primary key (transaccion_id, etiqueta_id)
);

create index if not exists idx_etiquetas_empresa on public.etiquetas(empresa_id);

-- ─── 2. LÍNEAS DE FACTURA ──────────────────────────────────
-- Detalle de cada línea de factura.
-- Conecta con: facturas (Contabilidad), productos (Logística — facturas de compra),
--              albaranes (Logística — albaran genera factura de compra).

create table if not exists public.lineas_factura (
  id              uuid primary key default gen_random_uuid(),
  factura_id      uuid not null references public.facturas(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,
  descripcion     text not null,
  cantidad        numeric(10,3) not null default 1,
  precio_unitario numeric(10,2) not null default 0,
  dto_pct         numeric(5,2) not null default 0,
  base_imponible  numeric(12,2) not null default 0,
  iva_pct         numeric(5,2) not null default 10,
  iva_importe     numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  orden           integer default 0
);

create index if not exists idx_lineas_factura_factura
  on public.lineas_factura(factura_id);

-- FK entre facturas y albaranes (albaran puede generar una factura)
alter table public.facturas
  add column if not exists albaran_id uuid references public.albaranes(id) on delete set null;
alter table public.facturas
  add column if not exists proveedor_id uuid references public.proveedores(id) on delete set null;

comment on column public.facturas.albaran_id is
  'FK a albaranes — si la factura de compra surge de un albarán recibido';
comment on column public.facturas.proveedor_id is
  'FK a proveedores — para facturas de compra sin albarán previo';

-- ─── 3. IMPUESTOS ──────────────────────────────────────────
-- Tipos de IVA e IRPF configurables por empresa.
-- Conecta con: lineas_factura, nóminas (IRPF).

create table if not exists public.impuestos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  tipo        text not null check (tipo in ('IVA','IRPF','Recargo equivalencia','Exento')),
  porcentaje  numeric(5,2) not null,
  es_defecto  boolean not null default false,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (empresa_id, nombre)
);

-- Datos por defecto de IVA para hostelería (se insertan para cada empresa al crear)
comment on table public.impuestos is
  'Tipos impositivos configurables. Hostelería típica: 10% IVA reducido (comida), 21% (bebida alcohólica).';

-- ─── 4. CUENTAS BANCARIAS ──────────────────────────────────
-- Cuentas corrientes de la empresa para conciliación.
-- Conecta con: transacciones (Contabilidad).

create table if not exists public.cuentas_bancarias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,            -- 'Cuenta principal BBVA', 'Caja efectivo'...
  banco       text,
  iban        text,
  bic         text,
  tipo        text not null default 'Cuenta corriente'
                check (tipo in ('Cuenta corriente','Cuenta ahorro','Caja efectivo','Tarjeta crédito','Otro')),
  saldo_inicial numeric(12,2) not null default 0,
  saldo_actual  numeric(12,2) not null default 0,
  moneda      text not null default 'EUR',
  activa      boolean not null default true,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_cuentas_empresa on public.cuentas_bancarias(empresa_id);

create or replace function public.set_cuentas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists cuentas_updated_at on public.cuentas_bancarias;
create trigger cuentas_updated_at
  before update on public.cuentas_bancarias
  for each row execute function public.set_cuentas_updated_at();

-- Conectar transacciones con cuenta bancaria
alter table public.transacciones
  add column if not exists cuenta_bancaria_id uuid references public.cuentas_bancarias(id) on delete set null;

comment on column public.transacciones.cuenta_bancaria_id is
  'FK a cuentas_bancarias — reemplaza el campo cuenta text para conciliación real';

-- ─── 5. CONCILIACIÓN BANCARIA ──────────────────────────────
-- Registro de movimientos bancarios importados vs. transacciones internas.

create table if not exists public.movimientos_banco (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cuenta_id       uuid not null references public.cuentas_bancarias(id) on delete cascade,
  fecha           date not null,
  concepto        text not null,
  importe         numeric(12,2) not null,   -- positivo=ingreso, negativo=pago
  saldo           numeric(12,2),
  referencia      text,
  -- Conciliación
  transaccion_id  uuid references public.transacciones(id) on delete set null,
  conciliado      boolean not null default false,
  conciliado_at   timestamptz,
  -- Meta
  created_at      timestamptz not null default now()
);

create index if not exists idx_movbanco_cuenta
  on public.movimientos_banco(cuenta_id);
create index if not exists idx_movbanco_fecha
  on public.movimientos_banco(empresa_id, fecha desc);
create index if not exists idx_movbanco_conciliado
  on public.movimientos_banco(empresa_id, conciliado);

-- ─── 6. RLS ────────────────────────────────────────────────

alter table public.etiquetas              enable row level security;
alter table public.facturas_etiquetas     enable row level security;
alter table public.transacciones_etiquetas enable row level security;
alter table public.lineas_factura         enable row level security;
alter table public.impuestos              enable row level security;
alter table public.cuentas_bancarias      enable row level security;
alter table public.movimientos_banco      enable row level security;

-- Etiquetas
create policy "etiq_read" on public.etiquetas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "etiq_manage" on public.etiquetas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Facturas-etiquetas (acceso vía factura)
create policy "fe_read" on public.facturas_etiquetas for select to authenticated using (true);
create policy "fe_manage" on public.facturas_etiquetas for all to authenticated
  using (true) with check (true);

-- Transacciones-etiquetas
create policy "te_read" on public.transacciones_etiquetas for select to authenticated using (true);
create policy "te_manage" on public.transacciones_etiquetas for all to authenticated
  using (true) with check (true);

-- Líneas factura
create policy "lf_read" on public.lineas_factura for select to authenticated using (true);
create policy "lf_manage" on public.lineas_factura for all to authenticated
  using (true) with check (true);

-- Impuestos
create policy "imp_read" on public.impuestos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "imp_manage" on public.impuestos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Cuentas bancarias
create policy "cuentas_read" on public.cuentas_bancarias for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "cuentas_manage" on public.cuentas_bancarias for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Movimientos banco
create policy "movbanco_read" on public.movimientos_banco for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "movbanco_manage" on public.movimientos_banco for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
