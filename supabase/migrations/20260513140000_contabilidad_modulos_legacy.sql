-- ============================================================
-- 20260513140000_contabilidad_modulos_legacy.sql
-- Crea las tablas que las migraciones 010 y 029 deberían haber dejado
-- pero que la BD remota nunca llegó a aplicar (figuran como aplicadas
-- en supabase_migrations pero sus tablas no existen).
--
-- SE EXCLUYEN tablas reemplazadas por sistemas modernos:
--   - fichas_tecnicas / ingredientes_ficha  → escandallos
--   - bonus                                 → toques_*
--   - turnos / ausencias                    → fichajes / solicitudes_personal
--
-- SE EXCLUYEN tablas que YA existen:
--   - stock, documentos, presentaciones, procesos_juridicos,
--     plantillas_boarding, procesos_boarding, candidatos
--
-- Replica fielmente los esquemas originales (empresa_id text en 010,
-- empresa_id uuid en 029). Una migración futura puede unificar tipos.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- COCINA — elaboraciones + partidas + APPCC (temperaturas)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.elaboraciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  categoria text,
  estado text not null default 'borrador',
  descripcion text,
  tiempo text,
  instrucciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partidas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  area text not null default 'COCINA',
  estado text not null default 'activa',
  responsable text,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipos_frio (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  tipo text not null default 'NEVERA',
  area text not null default 'COCINA',
  ubicacion text,
  temp_min numeric(4,1),
  temp_max numeric(4,1),
  estado text not null default 'ACTIVO',
  created_at timestamptz not null default now()
);

create table if not exists public.registros_temperatura (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos_frio(id) on delete cascade,
  temperatura numeric(4,1) not null,
  estado text not null default 'OK',
  registrado_por text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- LOGÍSTICA — inventarios
-- ─────────────────────────────────────────────────────────────

create table if not exists public.inventarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  fecha date not null default current_date,
  estado text not null default 'Borrador',
  tipo text default 'general',
  notas text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lineas_inventario (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios(id) on delete cascade,
  producto_nombre text not null,
  cantidad_teorica numeric(10,3) default 0,
  cantidad_real numeric(10,3) default 0,
  diferencia numeric(10,3) default 0,
  unidad text default 'ud',
  orden integer default 0
);

-- ─────────────────────────────────────────────────────────────
-- CONTABILIDAD — contactos, facturas, transacciones (de 010)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.contactos_contabilidad (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  tipo text not null default 'EMPRESA',
  cif text,
  telefono text,
  email text,
  direccion text,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  numero text not null,
  tipo text not null default 'COMPRA',
  contacto_nombre text,
  contacto_id uuid references public.contactos_contabilidad(id) on delete set null,
  fecha date not null default current_date,
  fecha_vencimiento date,
  base_imponible numeric(12,2) default 0,
  iva_pct numeric(5,2) default 21,
  iva numeric(12,2) default 0,
  total numeric(12,2) default 0,
  estado text not null default 'PENDIENTE',
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists public.transacciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  tipo text not null default 'PAGO',
  concepto text not null,
  importe numeric(12,2) not null,
  fecha date not null default current_date,
  cuenta text,
  factura_id uuid references public.facturas(id) on delete set null,
  conciliado boolean default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- CONTABILIDAD — etiquetas, líneas, impuestos, cuentas/movimientos (de 029)
-- ─────────────────────────────────────────────────────────────

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

create table if not exists public.facturas_etiquetas (
  factura_id  uuid not null references public.facturas(id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  primary key (factura_id, etiqueta_id)
);

create table if not exists public.transacciones_etiquetas (
  transaccion_id uuid not null references public.transacciones(id) on delete cascade,
  etiqueta_id    uuid not null references public.etiquetas(id) on delete cascade,
  primary key (transaccion_id, etiqueta_id)
);

create index if not exists idx_etiquetas_empresa on public.etiquetas(empresa_id);

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

create index if not exists idx_lineas_factura_factura on public.lineas_factura(factura_id);

alter table public.facturas
  add column if not exists albaran_id uuid references public.albaranes(id) on delete set null;
alter table public.facturas
  add column if not exists proveedor_id uuid references public.proveedores(id) on delete set null;

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

create table if not exists public.cuentas_bancarias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
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

create or replace function public.set_cuentas_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists cuentas_updated_at on public.cuentas_bancarias;
create trigger cuentas_updated_at
  before update on public.cuentas_bancarias
  for each row execute function public.set_cuentas_updated_at();

alter table public.transacciones
  add column if not exists cuenta_bancaria_id uuid references public.cuentas_bancarias(id) on delete set null;

create table if not exists public.movimientos_banco (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cuenta_id       uuid not null references public.cuentas_bancarias(id) on delete cascade,
  fecha           date not null,
  concepto        text not null,
  importe         numeric(12,2) not null,
  saldo           numeric(12,2),
  referencia      text,
  transaccion_id  uuid references public.transacciones(id) on delete set null,
  conciliado      boolean not null default false,
  conciliado_at   timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_movbanco_cuenta     on public.movimientos_banco(cuenta_id);
create index if not exists idx_movbanco_fecha      on public.movimientos_banco(empresa_id, fecha desc);
create index if not exists idx_movbanco_conciliado on public.movimientos_banco(empresa_id, conciliado);

-- ─────────────────────────────────────────────────────────────
-- GERENCIA — descuentos, vencimientos, encuestas
-- ─────────────────────────────────────────────────────────────

create table if not exists public.descuentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  tipo text,
  porcentaje numeric(5,2) default 0,
  importe_fijo numeric(10,2) default 0,
  activo boolean default true,
  condiciones text,
  created_at timestamptz not null default now()
);

create table if not exists public.vencimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  categoria text not null default 'OTRO',
  estado text not null default 'AL DÍA',
  frecuencia text not null default 'ANUAL',
  fecha_vencimiento date,
  fecha_ultimo date,
  responsable text,
  proveedor text,
  coste numeric(10,2) default 0,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists public.encuestas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  titulo text not null,
  estado text not null default 'borrador',
  fecha_inicio date,
  fecha_fin date,
  preguntas jsonb not null default '[]',
  respuestas_count integer default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- MARKETING — publicaciones
-- ─────────────────────────────────────────────────────────────

create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  titulo text not null,
  red_social text,
  tipo_contenido text default 'imagen',
  estado text not null default 'borrador',
  fecha_publicacion timestamptz,
  texto text,
  hashtags text,
  url_media text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- RLS — enable + policies (idempotentes con drop if exists)
-- ─────────────────────────────────────────────────────────────

alter table public.elaboraciones              enable row level security;
alter table public.partidas                   enable row level security;
alter table public.equipos_frio               enable row level security;
alter table public.registros_temperatura      enable row level security;
alter table public.inventarios                enable row level security;
alter table public.lineas_inventario          enable row level security;
alter table public.contactos_contabilidad     enable row level security;
alter table public.facturas                   enable row level security;
alter table public.transacciones              enable row level security;
alter table public.etiquetas                  enable row level security;
alter table public.facturas_etiquetas         enable row level security;
alter table public.transacciones_etiquetas    enable row level security;
alter table public.lineas_factura             enable row level security;
alter table public.impuestos                  enable row level security;
alter table public.cuentas_bancarias          enable row level security;
alter table public.movimientos_banco          enable row level security;
alter table public.descuentos                 enable row level security;
alter table public.vencimientos               enable row level security;
alter table public.encuestas                  enable row level security;
alter table public.publicaciones              enable row level security;

-- Helper: filtro empresa_id text → comparado contra profiles.empresa_id (uuid cast to text)
-- Patrón usado por 010. Funciona porque PostgREST hace implicit cast.

drop policy if exists "elab_read"  on public.elaboraciones;
drop policy if exists "elab_write" on public.elaboraciones;
create policy "elab_read"  on public.elaboraciones for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "elab_write" on public.elaboraciones for all to authenticated using (true) with check (true);

drop policy if exists "part_read"  on public.partidas;
drop policy if exists "part_write" on public.partidas;
create policy "part_read"  on public.partidas for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "part_write" on public.partidas for all to authenticated using (true) with check (true);

drop policy if exists "eq_read"  on public.equipos_frio;
drop policy if exists "eq_write" on public.equipos_frio;
create policy "eq_read"  on public.equipos_frio for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "eq_write" on public.equipos_frio for all to authenticated using (true) with check (true);

drop policy if exists "rt_read"  on public.registros_temperatura;
drop policy if exists "rt_write" on public.registros_temperatura;
create policy "rt_read"  on public.registros_temperatura for select to authenticated using (true);
create policy "rt_write" on public.registros_temperatura for all to authenticated using (true) with check (true);

drop policy if exists "inv_read"  on public.inventarios;
drop policy if exists "inv_write" on public.inventarios;
create policy "inv_read"  on public.inventarios for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "inv_write" on public.inventarios for all to authenticated using (true) with check (true);

drop policy if exists "li_read"  on public.lineas_inventario;
drop policy if exists "li_write" on public.lineas_inventario;
create policy "li_read"  on public.lineas_inventario for select to authenticated using (true);
create policy "li_write" on public.lineas_inventario for all to authenticated using (true) with check (true);

drop policy if exists "cc_read"  on public.contactos_contabilidad;
drop policy if exists "cc_write" on public.contactos_contabilidad;
create policy "cc_read"  on public.contactos_contabilidad for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "cc_write" on public.contactos_contabilidad for all to authenticated using (true) with check (true);

drop policy if exists "fact_read"  on public.facturas;
drop policy if exists "fact_write" on public.facturas;
create policy "fact_read"  on public.facturas for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "fact_write" on public.facturas for all to authenticated using (true) with check (true);

drop policy if exists "tx_read"  on public.transacciones;
drop policy if exists "tx_write" on public.transacciones;
create policy "tx_read"  on public.transacciones for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "tx_write" on public.transacciones for all to authenticated using (true) with check (true);

drop policy if exists "etiq_read"   on public.etiquetas;
drop policy if exists "etiq_manage" on public.etiquetas;
create policy "etiq_read"   on public.etiquetas for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "etiq_manage" on public.etiquetas for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "fe_read"   on public.facturas_etiquetas;
drop policy if exists "fe_manage" on public.facturas_etiquetas;
create policy "fe_read"   on public.facturas_etiquetas for select to authenticated using (true);
create policy "fe_manage" on public.facturas_etiquetas for all to authenticated using (true) with check (true);

drop policy if exists "te_read"   on public.transacciones_etiquetas;
drop policy if exists "te_manage" on public.transacciones_etiquetas;
create policy "te_read"   on public.transacciones_etiquetas for select to authenticated using (true);
create policy "te_manage" on public.transacciones_etiquetas for all to authenticated using (true) with check (true);

drop policy if exists "lf_read"   on public.lineas_factura;
drop policy if exists "lf_manage" on public.lineas_factura;
create policy "lf_read"   on public.lineas_factura for select to authenticated using (true);
create policy "lf_manage" on public.lineas_factura for all to authenticated using (true) with check (true);

drop policy if exists "imp_read"   on public.impuestos;
drop policy if exists "imp_manage" on public.impuestos;
create policy "imp_read"   on public.impuestos for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "imp_manage" on public.impuestos for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "cuentas_read"   on public.cuentas_bancarias;
drop policy if exists "cuentas_manage" on public.cuentas_bancarias;
create policy "cuentas_read"   on public.cuentas_bancarias for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "cuentas_manage" on public.cuentas_bancarias for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "movbanco_read"   on public.movimientos_banco;
drop policy if exists "movbanco_manage" on public.movimientos_banco;
create policy "movbanco_read"   on public.movimientos_banco for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "movbanco_manage" on public.movimientos_banco for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "desc_read"  on public.descuentos;
drop policy if exists "desc_write" on public.descuentos;
create policy "desc_read"  on public.descuentos for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "desc_write" on public.descuentos for all to authenticated using (true) with check (true);

drop policy if exists "venc_read"  on public.vencimientos;
drop policy if exists "venc_write" on public.vencimientos;
create policy "venc_read"  on public.vencimientos for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "venc_write" on public.vencimientos for all to authenticated using (true) with check (true);

drop policy if exists "enc_read"  on public.encuestas;
drop policy if exists "enc_write" on public.encuestas;
create policy "enc_read"  on public.encuestas for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "enc_write" on public.encuestas for all to authenticated using (true) with check (true);

drop policy if exists "pub_read"  on public.publicaciones;
drop policy if exists "pub_write" on public.publicaciones;
create policy "pub_read"  on public.publicaciones for select to authenticated
  using (empresa_id in (select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()));
create policy "pub_write" on public.publicaciones for all to authenticated using (true) with check (true);
