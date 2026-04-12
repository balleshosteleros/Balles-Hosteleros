-- 009: Tablas para la operativa diaria del restaurante
-- Fichajes, Reservas, Clientes, Proveedores, Pedidos, Mantenimiento, Comunicados

------------------------------------------------------------------
-- 1. FICHAJES
------------------------------------------------------------------
create table if not exists public.fichajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  empleado_id uuid references public.profiles(user_id) on delete cascade,
  empleado_nombre text not null,
  fecha date not null default current_date,
  hora_entrada timestamptz,
  hora_salida timestamptz,
  horas_totales numeric(5,2) default 0,
  estado text not null default 'pendiente',
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists fichajes_empresa_fecha on public.fichajes(empresa_id, fecha desc);
alter table public.fichajes enable row level security;

create policy "fichajes_read" on public.fichajes for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "fichajes_insert" on public.fichajes for insert to authenticated with check (true);
create policy "fichajes_update" on public.fichajes for update to authenticated using (true);

------------------------------------------------------------------
-- 2. CLIENTES DE SALA
------------------------------------------------------------------
create table if not exists public.clientes_sala (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  telefono text,
  email text,
  clasificacion text not null default 'NUEVO',
  visitas integer not null default 0,
  ultima_visita date,
  observaciones text,
  preferencias text,
  notas_internas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clientes_sala enable row level security;
create policy "clientes_read" on public.clientes_sala for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "clientes_write" on public.clientes_sala for all to authenticated
  using (true) with check (true);

------------------------------------------------------------------
-- 3. RESERVAS
------------------------------------------------------------------
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  cliente_nombre text not null,
  cliente_telefono text,
  cliente_id uuid references public.clientes_sala(id) on delete set null,
  fecha date not null,
  hora time not null,
  personas integer not null default 2,
  mesa text,
  zona text,
  turno text not null default 'COMIDA',
  estado text not null default 'PENDIENTE',
  notas text,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservas_empresa_fecha on public.reservas(empresa_id, fecha desc);
alter table public.reservas enable row level security;
create policy "reservas_read" on public.reservas for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "reservas_write" on public.reservas for all to authenticated
  using (true) with check (true);

------------------------------------------------------------------
-- 4. PROVEEDORES
------------------------------------------------------------------
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  nombre_comercial text,
  cif text,
  direccion text,
  codigo_postal text,
  ciudad text,
  telefono_principal text,
  telefono_secundario text,
  email_principal text,
  email_pedidos text,
  email_incidencias text,
  web text,
  estado text not null default 'Activo',
  dia_pedido text,
  dia_entrega text,
  hora_limite text,
  forma_pago text,
  condiciones text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proveedores enable row level security;
create policy "proveedores_read" on public.proveedores for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "proveedores_write" on public.proveedores for all to authenticated
  using (true) with check (true);

------------------------------------------------------------------
-- 5. PEDIDOS
------------------------------------------------------------------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  proveedor_nombre text not null,
  referencia text,
  fecha date not null default current_date,
  fecha_entrega date,
  estado text not null default 'Borrador',
  total numeric(12,2) default 0,
  notas text,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lineas_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_nombre text not null,
  cantidad numeric(10,3) not null default 1,
  unidad text not null default 'ud',
  precio_unitario numeric(10,2) not null default 0,
  total numeric(12,2) not null default 0,
  orden integer not null default 0
);

create index if not exists pedidos_empresa on public.pedidos(empresa_id, fecha desc);
create index if not exists lineas_pedido_pedido on public.lineas_pedido(pedido_id);
alter table public.pedidos enable row level security;
alter table public.lineas_pedido enable row level security;

create policy "pedidos_read" on public.pedidos for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "pedidos_write" on public.pedidos for all to authenticated
  using (true) with check (true);
create policy "lineas_read" on public.lineas_pedido for select to authenticated using (true);
create policy "lineas_write" on public.lineas_pedido for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- 6. MANTENIMIENTO (incidencias de instalaciones)
------------------------------------------------------------------
create table if not exists public.mantenimiento (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  desperfecto text not null,
  local_nombre text not null,
  estado text not null default 'PENDIENTE',
  gravedad text not null default 'LEVE',
  apunta_desperfecto text,
  reparador text,
  comentarios text,
  fecha_publicado date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mantenimiento_actualizaciones (
  id uuid primary key default gen_random_uuid(),
  incidencia_id uuid not null references public.mantenimiento(id) on delete cascade,
  texto text not null,
  apuntado_por text,
  fecha timestamptz not null default now()
);

alter table public.mantenimiento enable row level security;
alter table public.mantenimiento_actualizaciones enable row level security;

create policy "mant_read" on public.mantenimiento for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "mant_write" on public.mantenimiento for all to authenticated using (true) with check (true);
create policy "mant_act_read" on public.mantenimiento_actualizaciones for select to authenticated using (true);
create policy "mant_act_write" on public.mantenimiento_actualizaciones for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- 7. COMUNICADOS INTERNOS
------------------------------------------------------------------
create table if not exists public.comunicados (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  titulo text not null,
  asunto text,
  cuerpo text,
  estado text not null default 'borrador',
  prioridad text not null default 'normal',
  recurrencia text not null default 'sin_repeticion',
  toda_empresa boolean not null default true,
  roles_destinatarios text[] not null default '{}',
  envio timestamptz,
  alcance_pct integer not null default 0,
  observaciones text,
  creador_id uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comunicados enable row level security;
create policy "comunicados_read" on public.comunicados for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "comunicados_write" on public.comunicados for all to authenticated
  using (true) with check (true);
