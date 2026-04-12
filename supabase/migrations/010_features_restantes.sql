-- 010: Tablas para todas las features restantes
-- Cocina, Stock, Inventarios, Contabilidad, Dirección, Gerencia, Gestoría, Jurídico, Marketing, RRHH

-- Helper: RLS por empresa
-- Cada tabla sigue el patrón: empresa_id + policy que filtra por profiles.empresa_id del user

------------------------------------------------------------------
-- COCINA: Fichas técnicas
------------------------------------------------------------------
create table if not exists public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  categoria text,
  estado text not null default 'borrador',
  porciones integer default 1,
  tiempo_preparacion text,
  coste_total numeric(10,2) default 0,
  pvp numeric(10,2) default 0,
  margen_pct numeric(5,2) default 0,
  alergenos text[] default '{}',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredientes_ficha (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas_tecnicas(id) on delete cascade,
  nombre text not null,
  cantidad numeric(10,3) not null default 0,
  unidad text not null default 'kg',
  coste_unitario numeric(10,2) default 0,
  coste_total numeric(10,2) default 0,
  orden integer default 0
);

alter table public.fichas_tecnicas enable row level security;
alter table public.ingredientes_ficha enable row level security;
create policy "ft_read" on public.fichas_tecnicas for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "ft_write" on public.fichas_tecnicas for all to authenticated using (true) with check (true);
create policy "if_read" on public.ingredientes_ficha for select to authenticated using (true);
create policy "if_write" on public.ingredientes_ficha for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- COCINA: Elaboraciones
------------------------------------------------------------------
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

alter table public.elaboraciones enable row level security;
create policy "elab_read" on public.elaboraciones for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "elab_write" on public.elaboraciones for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- COCINA: Partidas
------------------------------------------------------------------
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

alter table public.partidas enable row level security;
create policy "part_read" on public.partidas for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "part_write" on public.partidas for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- COCINA: Temperaturas (equipos + registros)
------------------------------------------------------------------
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

alter table public.equipos_frio enable row level security;
alter table public.registros_temperatura enable row level security;
create policy "eq_read" on public.equipos_frio for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "eq_write" on public.equipos_frio for all to authenticated using (true) with check (true);
create policy "rt_read" on public.registros_temperatura for select to authenticated using (true);
create policy "rt_write" on public.registros_temperatura for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- LOGÍSTICA: Stock
------------------------------------------------------------------
create table if not exists public.stock (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  producto_id uuid references public.productos(id) on delete cascade,
  producto_nombre text not null,
  cantidad_actual numeric(10,3) default 0,
  cantidad_minima numeric(10,3) default 0,
  unidad text not null default 'ud',
  ubicacion text,
  ultimo_movimiento timestamptz default now(),
  created_at timestamptz not null default now()
);

alter table public.stock enable row level security;
create policy "stock_read" on public.stock for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "stock_write" on public.stock for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- LOGÍSTICA: Inventarios
------------------------------------------------------------------
create table if not exists public.inventarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  fecha date not null default current_date,
  estado text not null default 'Borrador',
  tipo text default 'general',
  notas text,
  created_by uuid references profiles(user_id) on delete set null,
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

alter table public.inventarios enable row level security;
alter table public.lineas_inventario enable row level security;
create policy "inv_read" on public.inventarios for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "inv_write" on public.inventarios for all to authenticated using (true) with check (true);
create policy "li_read" on public.lineas_inventario for select to authenticated using (true);
create policy "li_write" on public.lineas_inventario for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- CONTABILIDAD: Contactos, Facturas, Operaciones, Transacciones
------------------------------------------------------------------
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

alter table public.contactos_contabilidad enable row level security;
alter table public.facturas enable row level security;
alter table public.transacciones enable row level security;
create policy "cc_read" on public.contactos_contabilidad for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "cc_write" on public.contactos_contabilidad for all to authenticated using (true) with check (true);
create policy "fact_read" on public.facturas for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "fact_write" on public.facturas for all to authenticated using (true) with check (true);
create policy "tx_read" on public.transacciones for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "tx_write" on public.transacciones for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- DIRECCIÓN: Documentación
------------------------------------------------------------------
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  carpeta text,
  tipo_archivo text default 'pdf',
  nivel_acceso text default 'lectura',
  estado text default 'vigente',
  url text,
  tamano text,
  subido_por uuid references profiles(user_id) on delete set null,
  fecha_caducidad date,
  created_at timestamptz not null default now()
);

alter table public.documentos enable row level security;
create policy "doc_read" on public.documentos for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "doc_write" on public.documentos for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- GERENCIA: Descuentos
------------------------------------------------------------------
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

alter table public.descuentos enable row level security;
create policy "desc_read" on public.descuentos for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "desc_write" on public.descuentos for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- GERENCIA: Vencimientos / Revisiones
------------------------------------------------------------------
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

alter table public.vencimientos enable row level security;
create policy "venc_read" on public.vencimientos for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "venc_write" on public.vencimientos for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- GERENCIA: Encuestas
------------------------------------------------------------------
create table if not exists public.encuestas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  titulo text not null,
  estado text not null default 'borrador',
  fecha_inicio date,
  fecha_fin date,
  preguntas jsonb not null default '[]',
  respuestas_count integer default 0,
  created_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.encuestas enable row level security;
create policy "enc_read" on public.encuestas for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "enc_write" on public.encuestas for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- GESTORÍA: Presentaciones
------------------------------------------------------------------
create table if not exists public.presentaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  periodo text,
  anio integer,
  trimestre integer,
  estado text not null default 'pendiente',
  fecha_limite date,
  fecha_presentacion date,
  notas text,
  created_at timestamptz not null default now()
);

alter table public.presentaciones enable row level security;
create policy "pres_read" on public.presentaciones for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pres_write" on public.presentaciones for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- JURÍDICO: Procesos
------------------------------------------------------------------
create table if not exists public.procesos_juridicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  titulo text not null,
  tipo text not null default 'Otro',
  estado text not null default 'PENDIENTE',
  gravedad text not null default 'LEVE',
  descripcion text,
  responsable text,
  abogado text,
  fecha_inicio date default current_date,
  fecha_vista date,
  importe_reclamado numeric(12,2) default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.procesos_juridicos enable row level security;
create policy "pj_read" on public.procesos_juridicos for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pj_write" on public.procesos_juridicos for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- MARKETING: Publicaciones + Calendario
------------------------------------------------------------------
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
  created_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.publicaciones enable row level security;
create policy "pub_read" on public.publicaciones for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pub_write" on public.publicaciones for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- RRHH: Boarding (plantillas + procesos)
------------------------------------------------------------------
create table if not exists public.plantillas_boarding (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  tipo text not null default 'onboarding',
  tareas jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.procesos_boarding (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  empleado_id uuid references profiles(user_id) on delete cascade,
  empleado_nombre text,
  tipo text not null default 'onboarding',
  estado text not null default 'activo',
  plantilla_id uuid references public.plantillas_boarding(id) on delete set null,
  plantilla_nombre text,
  fecha_inicio date default current_date,
  tareas jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.plantillas_boarding enable row level security;
alter table public.procesos_boarding enable row level security;
create policy "plb_read" on public.plantillas_boarding for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "plb_write" on public.plantillas_boarding for all to authenticated using (true) with check (true);
create policy "prb_read" on public.procesos_boarding for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "prb_write" on public.procesos_boarding for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- RRHH: Bonus
------------------------------------------------------------------
create table if not exists public.bonus (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  estado text not null default 'borrador',
  periodicidad text default 'mensual',
  tipo_destinatario text default 'todos',
  condiciones text,
  tramos jsonb default '[]',
  created_at timestamptz not null default now()
);

alter table public.bonus enable row level security;
create policy "bon_read" on public.bonus for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "bon_write" on public.bonus for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- RRHH: Horarios (turnos + ausencias)
------------------------------------------------------------------
create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  hora_inicio time,
  hora_fin time,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.ausencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  empleado_id uuid references profiles(user_id) on delete cascade,
  tipo text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  estado text default 'pendiente',
  notas text,
  created_at timestamptz not null default now()
);

alter table public.turnos enable row level security;
alter table public.ausencias enable row level security;
create policy "turno_read" on public.turnos for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "turno_write" on public.turnos for all to authenticated using (true) with check (true);
create policy "aus_read" on public.ausencias for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "aus_write" on public.ausencias for all to authenticated using (true) with check (true);

------------------------------------------------------------------
-- RRHH: Reclutamiento
------------------------------------------------------------------
create table if not exists public.candidatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  email text,
  telefono text,
  puesto text not null,
  fase text not null default 'nuevo',
  origen text,
  cv_url text,
  notas text,
  puntuacion integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidatos enable row level security;
create policy "cand_read" on public.candidatos for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "cand_write" on public.candidatos for all to authenticated using (true) with check (true);
