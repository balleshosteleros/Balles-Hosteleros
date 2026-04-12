-- 008: Tablas para reuniones, nuevos platos, comunicación interna, incidencias de precio
-- Protocolo Fábrica: cada componente UI debe tener su tabla en Supabase con RLS.

------------------------------------------------------------------
-- 1. Reuniones
------------------------------------------------------------------
create table if not exists public.reuniones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  titulo text not null,
  fecha date not null default current_date,
  duracion text,
  participantes text[] not null default '{}',
  meet_link text,
  notas text,
  resumen_ia text,
  grabacion_url text,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reuniones enable row level security;

create policy "reuniones_read_empresa" on public.reuniones
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

create policy "reuniones_insert" on public.reuniones
  for insert to authenticated
  with check (true);

create policy "reuniones_update" on public.reuniones
  for update to authenticated
  using (created_by = auth.uid() or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin','director','gerencia')
  ));

------------------------------------------------------------------
-- 2. Nuevos Platos
------------------------------------------------------------------
create type if not exists nuevo_plato_estado as enum (
  'propuesto', 'en_cata', 'aprobado', 'rechazado', 'en_carta'
);

create type if not exists nuevo_plato_destino as enum (
  'cocina', 'sala', 'ambos'
);

create table if not exists public.nuevos_platos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  descripcion text,
  destino nuevo_plato_destino not null default 'ambos',
  estado nuevo_plato_estado not null default 'propuesto',
  propuesto_por uuid references public.profiles(user_id) on delete set null,
  propuesto_por_nombre text,
  fecha date not null default current_date,
  -- Pasos del proceso
  fotos_marketing boolean not null default false,
  cata_1 boolean not null default false,
  cata_2 boolean not null default false,
  grabar_producto boolean not null default false,
  ficha_proveedor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nuevos_platos enable row level security;

create policy "platos_read_empresa" on public.nuevos_platos
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

create policy "platos_insert" on public.nuevos_platos
  for insert to authenticated
  with check (true);

create policy "platos_update" on public.nuevos_platos
  for update to authenticated
  using (true);

create policy "platos_delete" on public.nuevos_platos
  for delete to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin','director','gerencia')
  ));

------------------------------------------------------------------
-- 3. Comunicación interna (canales + mensajes)
------------------------------------------------------------------
create table if not exists public.canales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  tipo text not null default 'departamento', -- departamento | grupo | directo
  created_at timestamptz not null default now()
);

alter table public.canales enable row level security;

create policy "canales_read_empresa" on public.canales
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

create policy "canales_insert" on public.canales
  for insert to authenticated
  with check (true);

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.canales(id) on delete cascade,
  autor_id uuid references public.profiles(user_id) on delete set null,
  autor_nombre text not null,
  texto text not null,
  fijado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mensajes_canal_idx on public.mensajes(canal_id, created_at desc);

alter table public.mensajes enable row level security;

-- Cualquier autenticado del canal puede leer
create policy "mensajes_read" on public.mensajes
  for select to authenticated
  using (true);

create policy "mensajes_insert" on public.mensajes
  for insert to authenticated
  with check (true);

------------------------------------------------------------------
-- 4. Incidencias de precio (proveedores)
------------------------------------------------------------------
create table if not exists public.incidencias_precio (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  producto text not null,
  proveedor text,
  precio_actual numeric(10,2) not null,
  precio_nuevo numeric(10,2) not null,
  variacion_pct numeric(6,2) not null,
  registrado_por uuid references public.profiles(user_id) on delete set null,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.incidencias_precio enable row level security;

create policy "incidencias_read_empresa" on public.incidencias_precio
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

create policy "incidencias_insert" on public.incidencias_precio
  for insert to authenticated
  with check (true);
