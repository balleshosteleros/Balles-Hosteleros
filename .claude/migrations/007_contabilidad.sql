-- ============================================================
-- 007_contabilidad.sql — Módulo de Contabilidad
-- Contactos contables, facturas, transacciones, bancos,
-- etiquetas y reglas de categorización automática.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.contacto_contable_tipo as enum ('EMPRESA', 'AUTONOMO', 'PARTICULAR');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.factura_tipo as enum ('COMPRA', 'VENTA');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.factura_estado as enum ('PENDIENTE', 'PAGADO', 'VENCIDO', 'COBRADO', 'ANULADO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaccion_tipo as enum ('COBRO', 'PAGO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.banco_sincronizacion as enum ('MANUAL', 'AUTOMATICA');
exception when duplicate_object then null;
end $$;

-- ─── 1. CONTACTOS CONTABLES ────────────────────────────────

create table if not exists public.contactos_contables (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  tipo            public.contacto_contable_tipo not null default 'EMPRESA',
  documento       text not null default '', -- CIF / NIF / NIE
  email           text not null default '',
  telefono        text not null default '',
  direccion       text not null default '',
  etiquetas       text[] not null default '{}',
  categoria       text not null default '',
  observaciones   text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_contactos_contables_empresa on public.contactos_contables(empresa_id);

-- ─── 2. FACTURAS ───────────────────────────────────────────

create table if not exists public.facturas (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  contacto_id       uuid references public.contactos_contables(id) on delete set null,
  tipo              public.factura_tipo not null,
  numero_factura    text not null,
  tipo_factura      text not null default 'ordinaria', -- 'ordinaria', 'rectificativa', 'proforma'
  cliente_nombre    text not null default '',
  fecha_emision     date not null,
  fecha_vencimiento date,
  fecha_pago        date,
  estado            public.factura_estado not null default 'PENDIENTE',
  base_imponible    numeric not null default 0,
  iva_pct           numeric not null default 21,
  iva_importe       numeric not null default 0,
  total             numeric not null default 0,
  dias_tarde        integer,
  concepto          text not null default '',
  observaciones     text not null default '',
  archivo_url       text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_facturas_empresa on public.facturas(empresa_id);
create index if not exists idx_facturas_estado  on public.facturas(empresa_id, estado);
create index if not exists idx_facturas_fecha   on public.facturas(empresa_id, fecha_emision desc);

-- ─── 3. ETIQUETAS CONTABLES ────────────────────────────────

create table if not exists public.etiquetas_contables (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  categoria       text not null default '',
  color           text not null default '#3B82F6',
  badge_class     text not null default '',
  usos            integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_etiquetas_contables_empresa on public.etiquetas_contables(empresa_id);

-- ─── 4. BANCOS CONECTADOS ──────────────────────────────────

create table if not exists public.bancos_conectados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  entidad         text not null default '',
  iban_parcial    text not null default '', -- últimos 4 dígitos
  productos       integer not null default 0,
  sincronizacion  public.banco_sincronizacion not null default 'MANUAL',
  ultima_sync     timestamptz,
  color           text not null default '#3B82F6',
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_bancos_conectados_empresa on public.bancos_conectados(empresa_id);

-- ─── 5. TRANSACCIONES ──────────────────────────────────────

create table if not exists public.transacciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  banco_id        uuid references public.bancos_conectados(id) on delete set null,
  factura_id      uuid references public.facturas(id) on delete set null,
  concepto        text not null,
  fecha           date not null,
  importe         numeric not null,
  tipo            public.transaccion_tipo not null,
  -- etiquetas: [{categoria, detalle, color}]
  etiquetas       jsonb not null default '[]',
  documentos      text[] not null default '{}', -- URLs de documentos adjuntos
  conciliada      boolean not null default false,
  observaciones   text not null default '',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_transacciones_empresa on public.transacciones(empresa_id);
create index if not exists idx_transacciones_fecha   on public.transacciones(empresa_id, fecha desc);
create index if not exists idx_transacciones_banco   on public.transacciones(banco_id);

-- ─── 6. REGLAS DE CATEGORIZACIÓN AUTOMÁTICA ────────────────

create table if not exists public.reglas_contables (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  -- condicion: {campo: 'concepto'|'importe', operador: 'contiene'|'igual'|'mayor', valor}
  condicion       jsonb not null default '{}',
  -- accion: {etiqueta, categoria}
  accion          jsonb not null default '{}',
  prioridad       integer not null default 0,
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_reglas_contables_empresa on public.reglas_contables(empresa_id);

-- ─── 7. RLS ────────────────────────────────────────────────

alter table public.contactos_contables  enable row level security;
alter table public.facturas             enable row level security;
alter table public.etiquetas_contables  enable row level security;
alter table public.bancos_conectados    enable row level security;
alter table public.transacciones        enable row level security;
alter table public.reglas_contables     enable row level security;

create policy "contactos_contables_empresa" on public.contactos_contables
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "facturas_empresa" on public.facturas
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "etiquetas_contables_empresa" on public.etiquetas_contables
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "bancos_conectados_empresa" on public.bancos_conectados
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "transacciones_empresa" on public.transacciones
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "reglas_contables_empresa" on public.reglas_contables
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

-- ─── 8. TRIGGERS updated_at ────────────────────────────────

create trigger contactos_contables_updated_at
  before update on public.contactos_contables
  for each row execute function public.set_updated_at();

create trigger facturas_updated_at
  before update on public.facturas
  for each row execute function public.set_updated_at();

create trigger bancos_conectados_updated_at
  before update on public.bancos_conectados
  for each row execute function public.set_updated_at();

create trigger transacciones_updated_at
  before update on public.transacciones
  for each row execute function public.set_updated_at();
