-- ============================================================
-- 006_sala.sql — Módulo de Sala
-- Mesas, reservas, clientes y lista de espera.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.mesa_zona as enum ('SALA', 'BARRA', 'TERRAZA_INTERIOR', 'TERRAZA_EXTERIOR', 'PRIVADO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mesa_estado as enum ('LIBRE', 'OCUPADA', 'RESERVADA', 'BLOQUEADA');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mesa_tipo as enum ('MESA', 'BARRA', 'RESERVADO', 'TABURETE');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reserva_estado as enum ('CONFIRMADA', 'PENDIENTE', 'RECONFIRMADA', 'LISTA_ESPERA', 'WALK_IN', 'LLEGADA', 'NO_SHOW', 'COMPLETADA', 'CANCELADA');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reserva_turno as enum ('COMIDA', 'CENA', 'DIA_COMPLETO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.cliente_clasificacion as enum ('REGULAR', 'VIP', 'FRECUENTE', 'NUEVO', 'INACTIVO');
exception when duplicate_object then null;
end $$;

-- ─── 1. CLIENTES ───────────────────────────────────────────

create table if not exists public.clientes_sala (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  apellidos       text not null default '',
  telefono        text not null default '',
  email           text not null default '',
  clasificacion   public.cliente_clasificacion not null default 'NUEVO',
  visitas         integer not null default 0,
  ultima_visita   date,
  observaciones   text not null default '',
  preferencias    text not null default '',
  notas_internas  text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_clientes_sala_empresa on public.clientes_sala(empresa_id);

-- ─── 2. MESAS ──────────────────────────────────────────────

create table if not exists public.mesas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  codigo          text not null,
  numero          integer not null,
  zona            public.mesa_zona not null default 'SALA',
  capacidad       integer not null default 2,
  estado          public.mesa_estado not null default 'LIBRE',
  tipo            public.mesa_tipo not null default 'MESA',
  -- Posición en el plano del local (coordenadas relativas en %)
  pos_x           numeric not null default 0,
  pos_y           numeric not null default 0,
  ancho           numeric not null default 10,
  alto            numeric not null default 10,
  combinable      boolean not null default false,
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_mesas_empresa on public.mesas(empresa_id);
create index if not exists idx_mesas_zona    on public.mesas(empresa_id, zona);

-- ─── 3. RESERVAS ───────────────────────────────────────────

create table if not exists public.reservas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cliente_id      uuid references public.clientes_sala(id) on delete set null,
  -- Datos del cliente (se duplican para historial aunque se borre el cliente)
  cliente_nombre  text not null,
  cliente_apellidos text not null default '',
  cliente_telefono  text not null default '',
  cliente_email     text not null default '',
  fecha           date not null,
  hora            time not null,
  turno           public.reserva_turno not null default 'COMIDA',
  comensales      integer not null default 1,
  zona            public.mesa_zona,
  mesa_id         uuid references public.mesas(id) on delete set null,
  estado          public.reserva_estado not null default 'PENDIENTE',
  observaciones   text not null default '',
  empleado_id     uuid references public.empleados(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_reservas_empresa on public.reservas(empresa_id);
create index if not exists idx_reservas_fecha   on public.reservas(empresa_id, fecha desc);
create index if not exists idx_reservas_estado  on public.reservas(empresa_id, estado);

-- ─── 4. LISTA DE ESPERA ────────────────────────────────────

create table if not exists public.lista_espera (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cliente_nombre  text not null,
  cliente_telefono text not null default '',
  comensales      integer not null default 1,
  zona            public.mesa_zona,
  hora_entrada    time not null default current_time,
  fecha           date not null default current_date,
  estado          text not null default 'esperando', -- 'esperando', 'asignado', 'cancelado'
  observaciones   text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists idx_lista_espera_empresa on public.lista_espera(empresa_id, fecha);

-- ─── 5. RLS ────────────────────────────────────────────────

alter table public.clientes_sala  enable row level security;
alter table public.mesas          enable row level security;
alter table public.reservas       enable row level security;
alter table public.lista_espera   enable row level security;

create policy "clientes_sala_empresa" on public.clientes_sala
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "mesas_empresa" on public.mesas
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "reservas_empresa" on public.reservas
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "lista_espera_empresa" on public.lista_espera
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

-- ─── 6. TRIGGERS updated_at ────────────────────────────────

create trigger clientes_sala_updated_at
  before update on public.clientes_sala
  for each row execute function public.set_updated_at();

create trigger mesas_updated_at
  before update on public.mesas
  for each row execute function public.set_updated_at();

create trigger reservas_updated_at
  before update on public.reservas
  for each row execute function public.set_updated_at();