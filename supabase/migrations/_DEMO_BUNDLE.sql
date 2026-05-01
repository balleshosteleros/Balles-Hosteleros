-- ============================================================
-- DEMO BUNDLE — Migraciones pendientes consolidadas
-- Generado: 2026-04-19T22:34:28.654Z
--
-- INSTRUCCIONES:
--   1. Abre Supabase Dashboard → SQL Editor → New query
--   2. Pega TODO este archivo
--   3. Click en Run
--   4. Espera a "Success" (puede tardar 10-30 seg)
--
-- Es IDEMPOTENTE: usa 'if not exists' en todas las creaciones.
-- Si una tabla ya existe, la migración la salta sin romper.
-- ============================================================

-- ── FIX PREVIO: constraints que las migraciones 026+ asumen ──
-- profiles.user_id debe ser UNIQUE (para que otras tablas puedan hacer FK a él).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_user_id_unique'
      and conrelid = 'public.profiles'::regclass
  ) then
    -- Eliminar duplicados en user_id primero (mantiene el más antiguo)
    delete from public.profiles p1
    using public.profiles p2
    where p1.user_id = p2.user_id
      and p1.created_at > p2.created_at;

    alter table public.profiles
      add constraint profiles_user_id_unique unique (user_id);
  end if;
end $$;

-- Asegurar permisos de schema para service_role (necesario para seed)
grant usage on schema public to service_role, authenticated, anon;
alter default privileges in schema public grant all on tables to service_role, authenticated;
alter default privileges in schema public grant all on sequences to service_role, authenticated;

-- ========================================================
-- ARCHIVO: 001_create_profiles.sql
-- ========================================================

-- Tabla profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: crear perfil automaticamente al signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ========================================================
-- ARCHIVO: 002_align_profiles_and_roles.sql
-- ========================================================

-- Migration 002: Align profiles + roles with code expectations
-- Reason: src/features/auth/contexts/auth-context.tsx and src/actions/admin.ts
-- expect columns/tables that 001_create_profiles.sql did not create.
-- This migration is additive and idempotent.

-- =======================================================
-- 1. empresas table
-- =======================================================
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz default now() not null
);

alter table public.empresas enable row level security;

drop policy if exists "Authenticated can view empresas" on public.empresas;
create policy "Authenticated can view empresas"
  on public.empresas for select
  to authenticated
  using (true);

-- Seed default empresa so existing users belong somewhere
insert into public.empresas (id, nombre)
values ('00000000-0000-0000-0000-000000000001', 'Balles Hosteleros')
on conflict (id) do nothing;

-- =======================================================
-- 2. profiles: add columns the code expects
-- =======================================================
alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists nombre text,
  add column if not exists apellidos text,
  add column if not exists empresa_id uuid references public.empresas(id);

-- Backfill existing rows
update public.profiles
set user_id    = coalesce(user_id, id),
    nombre     = coalesce(nombre, full_name),
    empresa_id = coalesce(empresa_id, '00000000-0000-0000-0000-000000000001'::uuid)
where user_id is null
   or nombre is null
   or empresa_id is null;

create index if not exists idx_profiles_user_id on public.profiles(user_id);

-- =======================================================
-- 3. app_role enum + user_roles table
-- =======================================================
do $$ begin
  create type public.app_role as enum (
    'admin','director','gerencia','responsable','empleado','solo_lectura'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz default now() not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- =======================================================
-- 4. Update handle_new_user trigger to populate new columns
-- =======================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, user_id, email, full_name, nombre, avatar_url, empresa_id)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    '00000000-0000-0000-0000-000000000001'::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

-- =======================================================
-- 5. Backfill: create profiles for auth.users that don't have one
-- =======================================================
insert into public.profiles (id, user_id, email, full_name, nombre, empresa_id)
select u.id,
       u.id,
       u.email,
       u.raw_user_meta_data->>'full_name',
       u.raw_user_meta_data->>'full_name',
       '00000000-0000-0000-0000-000000000001'::uuid
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- =======================================================
-- 6. Assign 'admin' role to every existing auth user (dev env)
-- =======================================================
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
on conflict (user_id, role) do nothing;


-- ========================================================
-- ARCHIVO: 003_faqs.sql
-- ========================================================

-- Migration 003: FAQs table for the in-app Ayuda center (PRP-023, Fase 2)
-- - Stores FAQ content editable from the software itself (no markdown files)
-- - Each FAQ is visible to one or more roles (app_role[])
-- - Admin/director can CRUD; everyone else can only read visible ones
-- This migration is additive and idempotent.

-- =======================================================
-- 1. faqs table
-- =======================================================
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  pregunta text not null,
  respuesta text not null,
  visible_para public.app_role[] not null default array['admin','director','gerencia','responsable','empleado','solo_lectura']::public.app_role[],
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_faqs_categoria on public.faqs(categoria);
create index if not exists idx_faqs_orden on public.faqs(categoria, orden);

-- =======================================================
-- 2. Trigger: auto-actualizar updated_at
-- =======================================================
create or replace function public.set_faqs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists faqs_updated_at on public.faqs;
create trigger faqs_updated_at
  before update on public.faqs
  for each row
  execute function public.set_faqs_updated_at();

-- =======================================================
-- 3. RLS
-- =======================================================
alter table public.faqs enable row level security;

-- Helper: check if current user has any of the given roles
create or replace function public.current_user_has_role(check_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any(check_roles)
  );
$$;

-- SELECT: usuarios autenticados ven FAQs cuya lista visible_para
--          intersecciona con cualquiera de SUS roles
drop policy if exists "Users see FAQs visible to their role" on public.faqs;
create policy "Users see FAQs visible to their role"
  on public.faqs for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = any(public.faqs.visible_para)
    )
  );

-- INSERT/UPDATE/DELETE: solo admin o director
drop policy if exists "Admin and director can insert FAQs" on public.faqs;
create policy "Admin and director can insert FAQs"
  on public.faqs for insert
  to authenticated
  with check (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  );

drop policy if exists "Admin and director can update FAQs" on public.faqs;
create policy "Admin and director can update FAQs"
  on public.faqs for update
  to authenticated
  using (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  )
  with check (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  );

drop policy if exists "Admin and director can delete FAQs" on public.faqs;
create policy "Admin and director can delete FAQs"
  on public.faqs for delete
  to authenticated
  using (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  );

-- =======================================================
-- 4. Seed: algunas FAQs de ejemplo para que la UI no arranque vacía
-- =======================================================
insert into public.faqs (categoria, pregunta, respuesta, visible_para, orden)
values
  (
    'General',
    '¿Cómo cambio mi contraseña?',
    'Ve a **Ajustes → Mi perfil → Cambiar contraseña**. Te enviaremos un correo de confirmación para validar el cambio.',
    array['admin','director','gerencia','responsable','empleado','solo_lectura']::public.app_role[],
    1
  ),
  (
    'General',
    '¿Puedo acceder desde el móvil?',
    'Sí. La aplicación es responsive y funciona en cualquier navegador móvil. Te recomendamos usar Chrome o Safari en tu teléfono.',
    array['admin','director','gerencia','responsable','empleado','solo_lectura']::public.app_role[],
    2
  ),
  (
    'RRHH',
    '¿Cómo registro un fichaje?',
    'Entra en **RECURSOS HUMANOS → FICHAJES** y pulsa el botón "Fichar entrada" o "Fichar salida". El sistema registra la hora automáticamente.',
    array['admin','director','gerencia','responsable','empleado']::public.app_role[],
    1
  ),
  (
    'Dirección',
    '¿Cómo veo las métricas de apertura del restaurante?',
    'Entra en **DIRECCIÓN → APERTURAS** y selecciona el rango de fechas. Verás ingresos, tickets, ticket medio y comparativas.',
    array['admin','director','gerencia']::public.app_role[],
    1
  ),
  (
    'Logística',
    '¿Cómo añado un proveedor nuevo?',
    'Ve a **LOGÍSTICA → PROVEEDORES** y pulsa "Nuevo proveedor". Rellena los datos fiscales y de contacto. Solo los roles de gerencia pueden añadir proveedores.',
    array['admin','director','gerencia']::public.app_role[],
    1
  )
on conflict do nothing;


-- ========================================================
-- ARCHIVO: 004_contactos_agenda.sql
-- ========================================================

-- Migration 004: Contactos de la Agenda Corporativa (PRP-006)
-- Base de datos centralizada de contactos externos (proveedores, mantenimiento,
-- servicios, etc.) para que cualquier empleado pueda consultarlos sin tener
-- que molestar a gerencia.
--
-- - Solo admin, director, gerencia pueden CRUD
-- - Cualquier usuario autenticado puede leer (scoped a su empresa vía RLS)
-- - Soft-scoped por empresa_id para multi-tenant futuro

-- =======================================================
-- 1. Enum de categorías
-- =======================================================
do $$ begin
  create type public.contacto_categoria as enum (
    'mantenimiento',
    'proveedores',
    'servicios',
    'emergencias',
    'otros'
  );
exception when duplicate_object then null;
end $$;

-- =======================================================
-- 2. Tabla contactos_agenda
-- =======================================================
create table if not exists public.contactos_agenda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  nombre text not null,
  empresa_contacto text,
  categoria public.contacto_categoria not null default 'otros',
  telefono text,
  email text,
  whatsapp text,
  direccion text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_contactos_agenda_empresa
  on public.contactos_agenda(empresa_id);
create index if not exists idx_contactos_agenda_categoria
  on public.contactos_agenda(empresa_id, categoria);
create index if not exists idx_contactos_agenda_nombre
  on public.contactos_agenda(empresa_id, nombre);

-- =======================================================
-- 3. Trigger de updated_at
-- =======================================================
create or replace function public.set_contactos_agenda_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contactos_agenda_updated_at on public.contactos_agenda;
create trigger contactos_agenda_updated_at
  before update on public.contactos_agenda
  for each row
  execute function public.set_contactos_agenda_updated_at();

-- =======================================================
-- 4. RLS
-- =======================================================
alter table public.contactos_agenda enable row level security;

-- SELECT: cualquier usuario autenticado puede consultar contactos de su empresa
drop policy if exists "Authenticated users can read their empresa contactos" on public.contactos_agenda;
create policy "Authenticated users can read their empresa contactos"
  on public.contactos_agenda for select
  to authenticated
  using (
    empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: solo admin, director, gerencia
drop policy if exists "Management can insert contactos" on public.contactos_agenda;
create policy "Management can insert contactos"
  on public.contactos_agenda for insert
  to authenticated
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia']::public.app_role[]
    )
    and empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "Management can update contactos" on public.contactos_agenda;
create policy "Management can update contactos"
  on public.contactos_agenda for update
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia']::public.app_role[]
    )
  )
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia']::public.app_role[]
    )
  );

drop policy if exists "Management can delete contactos" on public.contactos_agenda;
create policy "Management can delete contactos"
  on public.contactos_agenda for delete
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia']::public.app_role[]
    )
  );

-- =======================================================
-- 5. Seed: algunos ejemplos para no arrancar vacío
-- =======================================================
insert into public.contactos_agenda
  (empresa_id, nombre, empresa_contacto, categoria, telefono, email, notas)
values
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Servicio Técnico Frío',
    'FríoIndustrial S.L.',
    'mantenimiento',
    '+34 900 000 001',
    'avisos@frioindustrial.es',
    'Cámaras frigoríficas. Horario: L-V 9-18. Urgencias: mismo número.'
  ),
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Fontanero 24h',
    'Fontanería Rápida',
    'emergencias',
    '+34 900 000 002',
    null,
    'Guardia 24h. Precio fuera de horario x2.'
  ),
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Proveedor Pescado',
    'Mariscos del Norte',
    'proveedores',
    '+34 900 000 003',
    'pedidos@mariscosdelnorte.es',
    'Pedidos antes de las 17h para entrega al día siguiente.'
  )
on conflict do nothing;


-- ========================================================
-- ARCHIVO: 005_productos.sql
-- ========================================================

-- Migration 005: Productos table (Logística)
-- Tabla central de productos de compra y venta. Soporta importación
-- masiva desde CSV/Excel y migración desde la plataforma anterior.

-- =======================================================
-- 1. Enum de tipo y estado de producto
-- =======================================================
do $$ begin
  create type public.producto_tipo as enum ('compra', 'venta');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.producto_estado as enum ('Activo', 'Inactivo', 'Descatalogado', 'En revisión');
exception when duplicate_object then null;
end $$;

-- =======================================================
-- 2. Tabla productos
-- =======================================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  nombre text not null,
  tipo public.producto_tipo not null,
  categoria text not null,
  familia text,
  estado public.producto_estado not null default 'Activo',
  proveedor text,
  precio_compra text,
  precio_venta text,
  coste text,
  unidad text not null default 'ud',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_productos_empresa_tipo
  on public.productos(empresa_id, tipo);
create index if not exists idx_productos_categoria
  on public.productos(empresa_id, tipo, categoria);
create index if not exists idx_productos_nombre
  on public.productos(empresa_id, tipo, nombre);

-- =======================================================
-- 3. Trigger de updated_at
-- =======================================================
create or replace function public.set_productos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists productos_updated_at on public.productos;
create trigger productos_updated_at
  before update on public.productos
  for each row
  execute function public.set_productos_updated_at();

-- =======================================================
-- 4. RLS
-- =======================================================
alter table public.productos enable row level security;

-- SELECT: cualquier usuario autenticado puede ver los productos de su empresa
drop policy if exists "Users can read productos de su empresa" on public.productos;
create policy "Users can read productos de su empresa"
  on public.productos for select
  to authenticated
  using (
    empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: admin, director, gerencia, responsable
drop policy if exists "Management can insert productos" on public.productos;
create policy "Management can insert productos"
  on public.productos for insert
  to authenticated
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
    and empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "Management can update productos" on public.productos;
create policy "Management can update productos"
  on public.productos for update
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  )
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  );

drop policy if exists "Management can delete productos" on public.productos;
create policy "Management can delete productos"
  on public.productos for delete
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  );


-- ========================================================
-- ARCHIVO: 006_producto_taxonomia.sql
-- ========================================================

-- Migration 006: Taxonomía de productos (categorías y familias) editables
-- Permite que el usuario añada, renombre y elimine categorías y familias
-- directamente desde la UI, por tipo de producto (compra / venta).

-- =======================================================
-- 1. Enum kind (categoria | familia)
-- =======================================================
do $$ begin
  create type public.producto_taxonomia_kind as enum ('categoria', 'familia');
exception when duplicate_object then null;
end $$;

-- =======================================================
-- 2. Tabla producto_taxonomia
-- =======================================================
create table if not exists public.producto_taxonomia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  tipo_producto public.producto_tipo not null,
  kind public.producto_taxonomia_kind not null,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (empresa_id, tipo_producto, kind, nombre)
);

create index if not exists idx_producto_taxonomia_lookup
  on public.producto_taxonomia(empresa_id, tipo_producto, kind, orden);

-- =======================================================
-- 3. Trigger de updated_at
-- =======================================================
create or replace function public.set_producto_taxonomia_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists producto_taxonomia_updated_at on public.producto_taxonomia;
create trigger producto_taxonomia_updated_at
  before update on public.producto_taxonomia
  for each row
  execute function public.set_producto_taxonomia_updated_at();

-- =======================================================
-- 4. RLS
-- =======================================================
alter table public.producto_taxonomia enable row level security;

drop policy if exists "Read own empresa taxonomia" on public.producto_taxonomia;
create policy "Read own empresa taxonomia"
  on public.producto_taxonomia for select
  to authenticated
  using (
    empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "Management insert taxonomia" on public.producto_taxonomia;
create policy "Management insert taxonomia"
  on public.producto_taxonomia for insert
  to authenticated
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
    and empresa_id in (
      select p.empresa_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "Management update taxonomia" on public.producto_taxonomia;
create policy "Management update taxonomia"
  on public.producto_taxonomia for update
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  )
  with check (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  );

drop policy if exists "Management delete taxonomia" on public.producto_taxonomia;
create policy "Management delete taxonomia"
  on public.producto_taxonomia for delete
  to authenticated
  using (
    public.current_user_has_role(
      array['admin','director','gerencia','responsable']::public.app_role[]
    )
  );

-- =======================================================
-- 5. Seed: categorías y familias por defecto para empresa default
-- =======================================================

-- CATEGORÍAS DE COMPRA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Materias primas', 1),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Bebidas', 2),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Limpieza', 3),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Utensilios', 4),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Consumibles', 5),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'categoria', 'Ingredientes', 6)
on conflict do nothing;

-- FAMILIAS DE COMPRA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Cárnicos', 1),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Pescados', 2),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Lácteos', 3),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Verduras y frutas', 4),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Bebidas alcohólicas', 5),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Bebidas sin alcohol', 6),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Higiene', 7),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Menaje', 8),
  ('00000000-0000-0000-0000-000000000001', 'compra', 'familia', 'Otros', 9)
on conflict do nothing;

-- CATEGORÍAS DE VENTA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Platos', 1),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Bebidas', 2),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Cócteles', 3),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Postres', 4),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Menús', 5),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'categoria', 'Extras', 6)
on conflict do nothing;

-- FAMILIAS DE VENTA
insert into public.producto_taxonomia (empresa_id, tipo_producto, kind, nombre, orden)
values
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Entrantes', 1),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Principales', 2),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Postres', 3),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Bebidas carta', 4),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Cócteles carta', 5),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Menú degustación', 6),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Menú del día', 7),
  ('00000000-0000-0000-0000-000000000001', 'venta', 'familia', 'Extras', 8)
on conflict do nothing;


-- ========================================================
-- ARCHIVO: 007_jefe_directo_y_base_conocimiento.sql
-- ========================================================

-- 007: Jefe directo en profiles + tabla base_conocimiento + tickets de soporte
-- Esto es lo que necesita el sistema de soporte unificado:
--   • cada empleado tiene un jefe_directo asignado (otra fila de profiles)
--   • la base_conocimiento alimenta la "ayuda rápida" con IA
--   • soporte_tickets guarda las dudas que se escalan a un humano

------------------------------------------------------------------
-- 1. Jefe directo en profiles
------------------------------------------------------------------
alter table public.profiles
  add column if not exists jefe_directo_id uuid references public.profiles(user_id) on delete set null;

create index if not exists profiles_jefe_directo_idx
  on public.profiles(jefe_directo_id);

comment on column public.profiles.jefe_directo_id is
  'Jefe directo del empleado. Recibe los tickets de soporte que escala el empleado.';

------------------------------------------------------------------
-- 2. Base de conocimiento (ayuda rápida con IA)
------------------------------------------------------------------
create table if not exists public.base_conocimiento (
  id uuid primary key default gen_random_uuid(),
  pregunta text not null,
  palabras_clave text[] not null default '{}',
  respuesta text not null,
  video_url text,
  fuente text,
  visible_para_roles text[] not null default array['empleado','responsable','gerencia','director','admin']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists base_conocimiento_keywords_idx
  on public.base_conocimiento using gin(palabras_clave);

alter table public.base_conocimiento enable row level security;

-- Cualquier usuario autenticado puede leer
drop policy if exists "base_conocimiento_read_authenticated" on public.base_conocimiento;
create policy "base_conocimiento_read_authenticated"
  on public.base_conocimiento
  for select
  to authenticated
  using (true);

-- Solo admin/director pueden escribir
drop policy if exists "base_conocimiento_write_admin" on public.base_conocimiento;
create policy "base_conocimiento_write_admin"
  on public.base_conocimiento
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','director')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','director')
    )
  );

------------------------------------------------------------------
-- 3. Tickets de soporte (chat escalado a humano)
------------------------------------------------------------------
do $$ begin
  create type soporte_ticket_estado as enum (
  'abierto',
  'asignado',
  'en_curso',
  'resuelto',
  'cerrado'
);
exception when duplicate_object then null;
end $$;

create table if not exists public.soporte_tickets (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.profiles(user_id) on delete cascade,
  jefe_id uuid references public.profiles(user_id) on delete set null,
  pregunta text not null,
  contexto jsonb,
  estado soporte_ticket_estado not null default 'abierto',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  respuesta text
);

create index if not exists soporte_tickets_empleado_idx
  on public.soporte_tickets(empleado_id);

create index if not exists soporte_tickets_jefe_idx
  on public.soporte_tickets(jefe_id);

alter table public.soporte_tickets enable row level security;

-- El empleado ve sus propios tickets
drop policy if exists "tickets_read_propios" on public.soporte_tickets;
create policy "tickets_read_propios"
  on public.soporte_tickets
  for select
  to authenticated
  using (empleado_id = auth.uid());

-- El jefe ve los tickets en los que está asignado
drop policy if exists "tickets_read_como_jefe" on public.soporte_tickets;
create policy "tickets_read_como_jefe"
  on public.soporte_tickets
  for select
  to authenticated
  using (jefe_id = auth.uid());

-- Admin/director ven todos
drop policy if exists "tickets_read_admin" on public.soporte_tickets;
create policy "tickets_read_admin"
  on public.soporte_tickets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','director')
    )
  );

-- El empleado puede crear tickets para sí mismo
drop policy if exists "tickets_insert_propios" on public.soporte_tickets;
create policy "tickets_insert_propios"
  on public.soporte_tickets
  for insert
  to authenticated
  with check (empleado_id = auth.uid());

-- El jefe puede actualizar los tickets que le tocan
drop policy if exists "tickets_update_como_jefe" on public.soporte_tickets;
create policy "tickets_update_como_jefe"
  on public.soporte_tickets
  for update
  to authenticated
  using (jefe_id = auth.uid())
  with check (jefe_id = auth.uid());

------------------------------------------------------------------
-- 4. Trigger: al crear ticket, auto-asignar al jefe del empleado
------------------------------------------------------------------
create or replace function public.auto_asignar_jefe_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.jefe_id is null then
    select jefe_directo_id into new.jefe_id
    from public.profiles
    where user_id = new.empleado_id;
    if new.jefe_id is not null then
      new.estado := 'asignado';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_asignar_jefe on public.soporte_tickets;
create trigger trg_auto_asignar_jefe
  before insert on public.soporte_tickets
  for each row
  execute function public.auto_asignar_jefe_ticket();


-- ========================================================
-- ARCHIVO: 008_reuniones_platos_comunicacion_incidencias.sql
-- ========================================================

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
do $$ begin
  create type nuevo_plato_estado as enum (
  'propuesto', 'en_cata', 'aprobado', 'rechazado', 'en_carta'
);
exception when duplicate_object then null;
end $$;

do $$ begin
  create type nuevo_plato_destino as enum (
  'cocina', 'sala', 'ambos'
);
exception when duplicate_object then null;
end $$;

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


-- ========================================================
-- ARCHIVO: 009_operativa_diaria.sql
-- ========================================================

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


-- ========================================================
-- ARCHIVO: 010_features_restantes.sql
-- ========================================================

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


-- ========================================================
-- ARCHIVO: 011_logistica_compras.sql
-- ========================================================

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


-- ========================================================
-- ARCHIVO: 012_elaboraciones.sql
-- ========================================================

-- ─── 012. Añadir tipo 'elaboracion' a productos ──────────────
-- Las elaboraciones son preparaciones intermedias (salsas, masas, caldos, fondos…)
-- que tienen su propio escandallo y se usan como ingrediente en otros platos.

alter type public.producto_tipo add value if not exists 'elaboracion';


-- ========================================================
-- ARCHIVO: 013_cronogramas_extras.sql
-- ========================================================

-- 013. Extender cronogramas_operativos para resumen + video + jerarquía
alter table public.cronogramas_operativos
  add column if not exists resumen text,
  add column if not exists video_url text,
  add column if not exists id_visible varchar(20),
  add column if not exists parent_id uuid references public.cronogramas_operativos(id) on delete cascade,
  add column if not exists orden integer default 0;

create index if not exists idx_cronogramas_parent on public.cronogramas_operativos(parent_id);
create index if not exists idx_cronogramas_rol_orden on public.cronogramas_operativos(rol, orden);


-- ========================================================
-- ARCHIVO: 014_productos_config.sql
-- ========================================================

-- 014. Configuración dinámica de taxonomías de productos
-- Almacena categorías, familias y estados por empresa y tipo de producto.

create table if not exists public.productos_config (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  tipo       text not null check (tipo in ('compra', 'venta', 'elaboracion', 'global')),
  seccion    text not null check (seccion in ('categorias', 'familias', 'estados')),
  valores    text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint uq_productos_config unique (empresa_id, tipo, seccion)
);

-- Actualizar updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_productos_config_updated_at on public.productos_config;
create trigger trg_productos_config_updated_at
  before update on public.productos_config
  for each row execute function public.set_updated_at();

-- RLS
alter table public.productos_config enable row level security;

create policy "empresa puede ver su config"
  on public.productos_config for select
  using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

create policy "empresa puede gestionar su config"
  on public.productos_config for all
  using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );


-- ========================================================
-- ARCHIVO: 015_inventarios_upgrade.sql
-- ========================================================

-- ============================================================
-- 015_inventarios_upgrade.sql
-- Añade columnas que faltan en la tabla inventarios y crea
-- las tablas auxiliares de logística que aún no existen.
-- ============================================================

-- ─── ENUMS (si no existen) ─────────────────────────────────

do $$ begin
  create type public.almacen_tipo as enum ('COCINA', 'BARRA', 'ALMACEN_GENERAL', 'CAMARA', 'CONGELADOR');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pedido_estado as enum ('Borrador', 'Pendiente', 'Confirmado', 'Enviado', 'Servido', 'Cancelado', 'Archivado');
exception when duplicate_object then null;
end $$;

-- ─── INVENTARIOS — añadir columnas nuevas ──────────────────

alter table public.inventarios
  add column if not exists almacen         text not null default 'COCINA',
  add column if not exists motivo          text not null default 'periodico',
  add column if not exists plantilla_id    uuid,
  add column if not exists usuario         text not null default '',
  add column if not exists confirmado_at   timestamptz,
  add column if not exists confirmado_por  text,
  add column if not exists observaciones   text not null default '',
  add column if not exists updated_at      timestamptz not null default now();

-- Rellenar almacen/motivo con datos existentes si los hay
update public.inventarios
  set almacen = coalesce(tipo, 'COCINA'),
      motivo  = coalesce(nombre, 'periodico')
  where almacen = 'COCINA' and motivo = 'periodico';

-- ─── LINEAS_INVENTARIO — asegurar columnas ─────────────────

alter table public.lineas_inventario
  add column if not exists stock_sistema  numeric not null default 0,
  add column if not exists coste_unitario numeric not null default 0,
  add column if not exists orden          integer not null default 0;

-- ─── PEDIDOS — crear si no existe ──────────────────────────

create table if not exists public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  numero        text not null default '',
  proveedor     text not null default '',
  proveedor_id  uuid,
  almacen       text not null default 'COCINA',
  fecha         date not null default current_date,
  fecha_entrega date,
  estado        text not null default 'Borrador',
  dto_pct       numeric not null default 0,
  dto_eur       numeric not null default 0,
  subtotal      numeric not null default 0,
  total         numeric not null default 0,
  notas         text not null default '',
  enviado_at    timestamptz,
  enviado_email text not null default '',
  creador       text not null default '',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_pedidos_empresa on public.pedidos(empresa_id);
create index if not exists idx_pedidos_estado  on public.pedidos(empresa_id, estado);

-- RLS pedidos
alter table public.pedidos enable row level security;
drop policy if exists "pedidos_read" on public.pedidos;
create policy "pedidos_read" on public.pedidos
  for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
drop policy if exists "pedidos_write" on public.pedidos;
create policy "pedidos_write" on public.pedidos
  for all to authenticated using (true) with check (true);

-- ─── PEDIDOS_LINEAS ────────────────────────────────────────

create table if not exists public.pedidos_lineas (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  producto_id     uuid,
  nombre_producto text not null,
  cantidad        numeric not null default 0,
  unidad          text not null default 'ud',
  precio_uc       numeric not null default 0,
  dto_pct         numeric not null default 0,
  total           numeric not null default 0,
  recibido        numeric not null default 0,
  orden           integer not null default 0
);

create index if not exists idx_pedidos_lineas_pedido on public.pedidos_lineas(pedido_id);

-- ─── PLANTILLAS_INVENTARIO ─────────────────────────────────

create table if not exists public.plantillas_inventario (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  almacen     text not null default 'COCINA',
  producto_ids uuid[] not null default '{}',
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.plantillas_inventario enable row level security;
drop policy if exists "plantillas_rw" on public.plantillas_inventario;
create policy "plantillas_rw" on public.plantillas_inventario
  for all to authenticated using (true) with check (true);

-- ─── STOCK — asegurar columnas ─────────────────────────────

alter table public.stock
  add column if not exists cantidad_maxima numeric not null default 0;


-- ========================================================
-- ARCHIVO: 016_agora_sync_log.sql
-- ========================================================

-- Migración 016: Tabla de registro de sincronizaciones con Ágora POS
-- Auditoría completa de cada intento de sync: estado, errores, datos de ventas.
--
-- Relacionada con:
--   - src/features/logistica/services/agora-sync.ts
--   - src/features/logistica/actions/agora-actions.ts
--   - Regla Seguridad Ágora: .claude/memory/feedback/regla_seguridad_agora.md

CREATE TABLE IF NOT EXISTS public.agora_sync_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Timestamp del intento de sincronización
  sync_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Estado del sync: ok | partial | timeout | error
  status         TEXT        NOT NULL CHECK (status IN ('ok', 'partial', 'timeout', 'error')),

  -- Mensaje de error legible (vacío si status = 'ok')
  error_message  TEXT,

  -- Datos de ventas recibidos de Ágora (el payload completo o parcial)
  sales_data     JSONB,

  -- Detalle de errores por registro (array de { registro, motivo, campo })
  error_detail   JSONB,

  -- Contadores de registros procesados
  total_records  INT         NOT NULL DEFAULT 0,
  ok_records     INT         NOT NULL DEFAULT 0,
  error_records  INT         NOT NULL DEFAULT 0,
  retry_count    INT         NOT NULL DEFAULT 0,

  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índice para consultas frecuentes: últimos logs por empresa, ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_agora_sync_log_empresa_at
  ON public.agora_sync_log (empresa_id, sync_at DESC);

-- RLS: cada empresa solo ve sus propios registros de sync
ALTER TABLE public.agora_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_propia_sync_log" ON public.agora_sync_log
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id
      FROM public.profiles
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.agora_sync_log IS
  'Registro de auditoría de cada sincronización con Ágora POS. '
  'Campos clave: status (ok/partial/timeout/error), error_message (texto legible), '
  'sales_data (payload JSONB de Ágora), error_detail (errores por registro).';


-- ========================================================
-- ARCHIVO: 017_fix_pedidos_empresa_id.sql
-- ========================================================

-- ============================================================
-- 017_fix_pedidos_empresa_id.sql
-- Corrige el tipo de empresa_id en pedidos (text → uuid)
-- y recrea las políticas RLS para evitar error de tipos.
-- ============================================================

-- 1. Eliminar políticas antiguas (creadas en 009 con tipo incorrecto)
drop policy if exists "pedidos_read"  on public.pedidos;
drop policy if exists "pedidos_write" on public.pedidos;
drop policy if exists "lineas_read"   on public.lineas_pedido;
drop policy if exists "lineas_write"  on public.lineas_pedido;

-- 2. Cambiar empresa_id de TEXT a UUID (tabla vacía o con UUIDs válidos)
alter table public.pedidos
  alter column empresa_id type uuid using empresa_id::uuid;

-- 3. Recrear políticas con tipos correctos
create policy "pedidos_read" on public.pedidos
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

create policy "pedidos_write" on public.pedidos
  for all to authenticated
  using (true) with check (true);

create policy "lineas_read" on public.lineas_pedido
  for select to authenticated using (true);

create policy "lineas_write" on public.lineas_pedido
  for all to authenticated using (true) with check (true);


-- ========================================================
-- ARCHIVO: 018_fix_albaranes_schema.sql
-- ========================================================

-- ============================================================
-- 018_fix_albaranes_schema.sql
-- Adapta la tabla albaranes para soportar persistencia desde
-- PedidosView (que trabaja con proveedor_nombre, no UUID).
-- ============================================================

-- 1. Hacer proveedor_id nullable (tenemos proveedor_nombre)
ALTER TABLE public.albaranes
  ALTER COLUMN proveedor_id DROP NOT NULL;

-- 2. Añadir columnas que necesita PedidosView
ALTER TABLE public.albaranes
  ADD COLUMN IF NOT EXISTS proveedor_nombre text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS almacen          text NOT NULL DEFAULT 'COCINA',
  ADD COLUMN IF NOT EXISTS documento        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS creador          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lineas           jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Índices útiles
CREATE INDEX IF NOT EXISTS idx_albaranes_pedido ON public.albaranes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_albaranes_fecha  ON public.albaranes(empresa_id, fecha DESC);


-- ========================================================
-- ARCHIVO: 019_drop_referencia_pedidos.sql
-- ========================================================

-- ============================================================
-- 019_drop_referencia_pedidos.sql
-- Elimina la columna referencia de la tabla pedidos.
-- Esta columna se usaba como "Doc. Proveedor" pero se ha
-- decidido eliminar del flujo de trabajo.
-- ============================================================

alter table public.pedidos
  drop column if exists referencia;


-- ========================================================
-- ARCHIVO: 020_add_numero_pedidos.sql
-- ========================================================

-- ============================================================
-- 020_add_numero_pedidos.sql
-- Añade columna numero a pedidos para el número de referencia
-- visible (PED-YYYY-XXX). La columna referencia fue eliminada
-- en la migración 019 y esta la reemplaza con nombre más claro.
-- ============================================================

alter table public.pedidos
  add column if not exists numero text;


-- ========================================================
-- ARCHIVO: 021_stock_backfill_producto_id.sql
-- ========================================================

-- ============================================================
-- 021_stock_backfill_producto_id.sql
-- La tabla stock ya tiene la columna producto_id (UUID FK a productos)
-- pero muchas filas tienen NULL porque el código antiguo solo usaba
-- producto_nombre como clave.
-- Esta migración:
--   1. Rellena producto_id cruzando por nombre (case-insensitive)
--   2. Asegura un índice en producto_id para búsquedas rápidas
-- ============================================================

-- Backfill: cruzar stock.producto_nombre con productos.nombre
-- stock.empresa_id es TEXT, productos.empresa_id es UUID → cast explícito
UPDATE public.stock s
SET producto_id = p.id
FROM public.productos p
WHERE s.producto_id IS NULL
  AND p.empresa_id::text = s.empresa_id
  AND LOWER(TRIM(s.producto_nombre)) = LOWER(TRIM(p.nombre));

-- Índice para búsquedas rápidas por producto_id
CREATE INDEX IF NOT EXISTS idx_stock_producto_id
  ON public.stock(producto_id)
  WHERE producto_id IS NOT NULL;

-- Índice compuesto empresa+nombre para fallback por nombre
CREATE INDEX IF NOT EXISTS idx_stock_empresa_nombre
  ON public.stock(empresa_id, LOWER(producto_nombre));


-- ========================================================
-- ARCHIVO: 022_lineas_pedido_producto_id.sql
-- ========================================================

-- ============================================================
-- 022_lineas_pedido_producto_id.sql
-- Añade producto_id (FK a productos) a lineas_pedido.
-- Nullable para no romper filas existentes; el código de app
-- exige que esté informado al crear nuevas líneas.
-- ============================================================

ALTER TABLE public.lineas_pedido
  ADD COLUMN IF NOT EXISTS producto_id uuid REFERENCES public.productos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_lineas_pedido_producto_id
  ON public.lineas_pedido(producto_id)
  WHERE producto_id IS NOT NULL;

-- Backfill: rellenar producto_id cruzando por nombre en los pedidos existentes
UPDATE public.lineas_pedido lp
SET producto_id = p.id
FROM public.productos p
WHERE lp.producto_id IS NULL
  AND LOWER(TRIM(lp.producto_nombre)) = LOWER(TRIM(p.nombre));


-- ========================================================
-- ARCHIVO: 023_empresa_logos.sql
-- ========================================================

-- Tabla para URLs de logos de empresas.
-- PRIMARY KEY en empresa_slug garantiza exactamente un registro por empresa,
-- de modo que los upserts actualizan en vez de insertar filas duplicadas.

CREATE TABLE IF NOT EXISTS empresa_logos (
  empresa_slug TEXT        PRIMARY KEY,
  logo_url     TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existía sin PRIMARY KEY (creada a mano), migrar los datos:
-- 1. Eliminar filas duplicadas conservando la más reciente por empresa_slug.
-- 2. Añadir la restricción de unicidad si faltaba.
DO $$
BEGIN
  -- Limpiar duplicados: quedarse solo con el registro de updated_at más reciente
  DELETE FROM empresa_logos el1
  USING empresa_logos el2
  WHERE el1.empresa_slug = el2.empresa_slug
    AND el1.updated_at < el2.updated_at;

  -- Añadir la clave primaria si todavía no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'empresa_logos'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE empresa_logos ADD PRIMARY KEY (empresa_slug);
  END IF;
END $$;

-- RLS: activar y permitir lectura pública (las URLs son públicas de todas formas)
ALTER TABLE empresa_logos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read empresa_logos" ON empresa_logos;
CREATE POLICY "Public read empresa_logos" ON empresa_logos
  FOR SELECT USING (true);


-- ========================================================
-- ARCHIVO: 024_stock_init_ingredientes.sql
-- ========================================================

-- ============================================================
-- 024_stock_init_ingredientes.sql
-- Inicializa una fila de stock (cantidad_actual = 0) para cada
-- producto de tipo 'compra' (ingredientes) que aún no tenga fila.
-- Necesario para que el descuento automático desde Ágora tenga
-- una fila donde decrementar cuando lleguen las primeras ventas.
-- ============================================================

INSERT INTO public.stock (
  empresa_id,
  producto_id,
  producto_nombre,
  cantidad_actual,
  unidad,
  ultimo_movimiento
)
SELECT
  p.empresa_id::text,
  p.id,
  p.nombre,
  0,
  COALESCE(p.unidad, 'ud'),
  NOW()
FROM public.productos p
WHERE p.tipo = 'compra'
  AND NOT EXISTS (
    SELECT 1 FROM public.stock s
    WHERE s.empresa_id = p.empresa_id::text
      AND s.producto_id = p.id
  );

-- Mensaje informativo
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.stock;
  RAISE NOTICE 'Total filas en stock tras migración: %', v_count;
END $$;


-- ========================================================
-- ARCHIVO: 025_stock_unique_constraint.sql
-- ========================================================

-- ============================================================
-- 025_stock_unique_constraint.sql
-- Añade constraint UNIQUE en (empresa_id, producto_id) a la tabla
-- stock para evitar filas duplicadas.
--
-- Contexto: en el test de integridad Ágora (2026-04-14) se detectaron
-- 130 duplicados tras la inicialización con migration 024 porque no
-- existía ningún constraint que lo impidiera.
--
-- Este constraint permite hacer INSERT ... ON CONFLICT DO NOTHING
-- o UPSERT con onConflict: "empresa_id,producto_id" de forma segura.
-- ============================================================

-- Eliminar duplicados antes de añadir el constraint
-- (keep la fila con id menor en orden lexicográfico UUID)
DELETE FROM public.stock s1
USING public.stock s2
WHERE s1.empresa_id = s2.empresa_id
  AND s1.producto_id = s2.producto_id
  AND s1.id > s2.id;

-- Añadir unique constraint
ALTER TABLE public.stock
  ADD CONSTRAINT stock_empresa_producto_unique
  UNIQUE (empresa_id, producto_id);

-- Índice ya creado en migración 021 (idx_stock_producto_id)
-- No se duplica aquí.

COMMENT ON CONSTRAINT stock_empresa_producto_unique ON public.stock IS
  'Garantiza una sola fila de stock por producto y empresa. '
  'Añadido en migración 025 tras detectar duplicados en init de Ágora (2026-04-14).';


-- ========================================================
-- ARCHIVO: 026_rrhh_empleados.sql
-- ========================================================

-- ============================================================
-- 026_rrhh_empleados.sql
-- Módulo RRHH: Tabla maestra de empleados, departamentos, puestos,
--              contratos, nóminas, vacaciones y evaluaciones.
--
-- NOTA: profiles es la tabla de auth (acceso al sistema).
--       empleados es la tabla maestra de RRHH (incluye trabajadores
--       sin acceso digital). Se vinculan por profile_id nullable.
-- ============================================================

-- ─── 1. DEPARTAMENTOS ──────────────────────────────────────
-- Áreas funcionales del restaurante (Cocina, Sala, Bar, Admin…)
-- Referenciado desde RRHH, Dirección y permisos.

create table if not exists public.departamentos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  color         text default '#6366f1',
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create index if not exists idx_departamentos_empresa
  on public.departamentos(empresa_id);

create or replace function public.set_departamentos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists departamentos_updated_at on public.departamentos;
create trigger departamentos_updated_at
  before update on public.departamentos
  for each row execute function public.set_departamentos_updated_at();

-- ─── 2. PUESTOS DE TRABAJO ─────────────────────────────────
-- Roles laborales: Cocinero, Camarero, Jefe de Partida, etc.
-- Conecta RRHH con Dirección (asignación de turnos por puesto).

create table if not exists public.puestos_trabajo (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  departamento_id uuid references public.departamentos(id) on delete set null,
  nombre          text not null,
  descripcion     text,
  salario_base    numeric(10,2),
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create index if not exists idx_puestos_empresa
  on public.puestos_trabajo(empresa_id);
create index if not exists idx_puestos_departamento
  on public.puestos_trabajo(departamento_id);

create or replace function public.set_puestos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists puestos_updated_at on public.puestos_trabajo;
create trigger puestos_updated_at
  before update on public.puestos_trabajo
  for each row execute function public.set_puestos_updated_at();

-- ─── 3. EMPLEADOS (tabla maestra RRHH) ────────────────────
-- Trabajadores del restaurante. profile_id es nullable:
--   - Sin profile_id = empleado sin acceso al sistema.
--   - Con profile_id = empleado que también puede iniciar sesión.
-- Referenciado desde: contratos, nóminas, vacaciones, ausencias,
--   fichajes, evaluaciones, produccion_diaria.

create table if not exists public.empleados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  profile_id      uuid references public.profiles(user_id) on delete set null,
  departamento_id uuid references public.departamentos(id) on delete set null,
  puesto_id       uuid references public.puestos_trabajo(id) on delete set null,
  -- Datos personales
  nombre          text not null,
  apellidos       text,
  dni_nie         text,
  fecha_nacimiento date,
  nacionalidad    text default 'Española',
  -- Contacto
  telefono        text,
  email_personal  text,
  email_empresa   text,
  direccion       text,
  -- Laborales
  numero_ss       text,
  numero_empleado text,
  fecha_alta      date not null default current_date,
  fecha_baja      date,
  estado          text not null default 'Activo'
                    check (estado in ('Activo','Baja temporal','Baja definitiva','Excedencia')),
  tipo_jornada    text not null default 'Completa'
                    check (tipo_jornada in ('Completa','Parcial','Indefinida','Temporal')),
  -- Jefe directo
  jefe_directo_id uuid references public.empleados(id) on delete set null,
  -- Meta
  notas           text,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_empleados_empresa
  on public.empleados(empresa_id);
create index if not exists idx_empleados_perfil
  on public.empleados(profile_id);
create index if not exists idx_empleados_departamento
  on public.empleados(departamento_id);
create index if not exists idx_empleados_estado
  on public.empleados(empresa_id, estado);

create or replace function public.set_empleados_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists empleados_updated_at on public.empleados;
create trigger empleados_updated_at
  before update on public.empleados
  for each row execute function public.set_empleados_updated_at();

comment on table public.empleados is
  'Tabla maestra RRHH. profile_id nullable: empleados sin acceso digital admitidos.';
comment on column public.empleados.jefe_directo_id is
  'FK a empleados (self-join) — quién supervisa a este trabajador';

-- ─── 4. CONTRATOS ──────────────────────────────────────────
-- Historial contractual de cada empleado.
-- Conecta con: RRHH (empleados), Contabilidad (costes laborales).

create table if not exists public.contratos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  tipo            text not null default 'Indefinido'
                    check (tipo in ('Indefinido','Temporal','Por obra','Formacion','Practicas','Relevo')),
  fecha_inicio    date not null,
  fecha_fin       date,
  salario_bruto   numeric(10,2) not null,
  jornada_horas   numeric(4,1) not null default 40,
  grupo_cotizacion text,
  categoria_profesional text,
  convenio        text,
  estado          text not null default 'Vigente'
                    check (estado in ('Vigente','Finalizado','Rescindido','Prorrogado')),
  documento_url   text,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_contratos_empleado
  on public.contratos(empleado_id);
create index if not exists idx_contratos_empresa
  on public.contratos(empresa_id);

create or replace function public.set_contratos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists contratos_updated_at on public.contratos;
create trigger contratos_updated_at
  before update on public.contratos
  for each row execute function public.set_contratos_updated_at();

-- ─── 5. NÓMINAS ────────────────────────────────────────────
-- Registro mensual de nómina por empleado.
-- Conecta con: RRHH (empleados, contratos), Contabilidad (transacciones).

create table if not exists public.nominas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  contrato_id     uuid references public.contratos(id) on delete set null,
  periodo         text not null,           -- 'YYYY-MM'
  fecha_pago      date,
  -- Devengos
  salario_base    numeric(10,2) not null default 0,
  complementos    numeric(10,2) not null default 0,
  horas_extra     numeric(10,2) not null default 0,
  otros_devengos  numeric(10,2) not null default 0,
  total_devengado numeric(10,2) not null default 0,
  -- Deducciones
  seg_social_empleado numeric(10,2) not null default 0,
  irpf_pct        numeric(4,2) not null default 0,
  irpf_importe    numeric(10,2) not null default 0,
  otras_deducciones numeric(10,2) not null default 0,
  total_deducciones numeric(10,2) not null default 0,
  -- Neto
  liquido_percibir numeric(10,2) not null default 0,
  -- Coste empresa
  seg_social_empresa numeric(10,2) not null default 0,
  coste_total_empresa numeric(10,2) not null default 0,
  -- Estado
  estado          text not null default 'Borrador'
                    check (estado in ('Borrador','Revisada','Pagada','Reclamada')),
  documento_url   text,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empleado_id, periodo)
);

create index if not exists idx_nominas_empleado
  on public.nominas(empleado_id);
create index if not exists idx_nominas_empresa_periodo
  on public.nominas(empresa_id, periodo);

create or replace function public.set_nominas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists nominas_updated_at on public.nominas;
create trigger nominas_updated_at
  before update on public.nominas
  for each row execute function public.set_nominas_updated_at();

-- ─── 6. VACACIONES ─────────────────────────────────────────
-- Control de días de vacaciones y permisos retribuidos.
-- Diferente de ausencias (imprevistos) — estas son planificadas.
-- Conecta con: RRHH, Dirección (planificación de personal).

create table if not exists public.vacaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  anio            integer not null default extract(year from current_date)::integer,
  tipo            text not null default 'Vacaciones'
                    check (tipo in ('Vacaciones','Permiso retribuido','Asuntos propios','Compensacion horas')),
  fecha_inicio    date not null,
  fecha_fin       date not null,
  dias_habiles    integer not null default 1,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','Aprobada','Denegada','Anulada')),
  aprobado_por    uuid references public.empleados(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create index if not exists idx_vacaciones_empleado
  on public.vacaciones(empleado_id);
create index if not exists idx_vacaciones_empresa_anio
  on public.vacaciones(empresa_id, anio);

create or replace function public.set_vacaciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists vacaciones_updated_at on public.vacaciones;
create trigger vacaciones_updated_at
  before update on public.vacaciones
  for each row execute function public.set_vacaciones_updated_at();

-- ─── 7. EVALUACIONES ───────────────────────────────────────
-- Evaluaciones de desempeño periódicas.
-- Conecta con: RRHH (empleados), Gerencia (KPIs de personal).

create table if not exists public.evaluaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  evaluador_id    uuid references public.empleados(id) on delete set null,
  periodo         text not null,           -- 'YYYY-TN' o 'YYYY-MM'
  tipo            text not null default 'Trimestral'
                    check (tipo in ('Mensual','Trimestral','Semestral','Anual','Prueba periodo')),
  -- Puntuaciones (1-5)
  puntualidad     integer check (puntualidad between 1 and 5),
  actitud         integer check (actitud between 1 and 5),
  calidad_trabajo integer check (calidad_trabajo between 1 and 5),
  trabajo_equipo  integer check (trabajo_equipo between 1 and 5),
  iniciativa      integer check (iniciativa between 1 and 5),
  puntuacion_media numeric(3,2),
  -- Texto
  puntos_fuertes  text,
  areas_mejora    text,
  objetivos_siguiente text,
  comentarios     text,
  -- Estado
  estado          text not null default 'Borrador'
                    check (estado in ('Borrador','Completada','Firmada')),
  fecha_evaluacion date default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_evaluaciones_empleado
  on public.evaluaciones(empleado_id);
create index if not exists idx_evaluaciones_empresa
  on public.evaluaciones(empresa_id);

create or replace function public.set_evaluaciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists evaluaciones_updated_at on public.evaluaciones;
create trigger evaluaciones_updated_at
  before update on public.evaluaciones
  for each row execute function public.set_evaluaciones_updated_at();

-- ─── 8. RLS ────────────────────────────────────────────────

alter table public.departamentos     enable row level security;
alter table public.puestos_trabajo   enable row level security;
alter table public.empleados         enable row level security;
alter table public.contratos         enable row level security;
alter table public.nominas           enable row level security;
alter table public.vacaciones        enable row level security;
alter table public.evaluaciones      enable row level security;

-- Departamentos
create policy "dep_read" on public.departamentos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "dep_manage" on public.departamentos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Puestos
create policy "puesto_read" on public.puestos_trabajo for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "puesto_manage" on public.puestos_trabajo for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Empleados
create policy "emp_read" on public.empleados for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "emp_manage" on public.empleados for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Contratos (solo admin/director/responsable)
create policy "cont_read" on public.contratos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "cont_manage" on public.contratos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Nóminas
create policy "nom_read" on public.nominas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "nom_manage" on public.nominas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Vacaciones
create policy "vac_read" on public.vacaciones for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "vac_manage" on public.vacaciones for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Evaluaciones
create policy "eval_read" on public.evaluaciones for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "eval_manage" on public.evaluaciones for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 9. VISTA: resumen_personal ────────────────────────────
-- Vista útil para cuadros de mando (Dirección) y Gerencia.

create or replace view public.resumen_personal as
select
  e.empresa_id,
  e.id                as empleado_id,
  e.nombre || ' ' || coalesce(e.apellidos, '') as nombre_completo,
  e.estado,
  e.tipo_jornada,
  d.nombre            as departamento,
  pt.nombre           as puesto,
  c.tipo              as tipo_contrato,
  c.salario_bruto,
  c.fecha_inicio      as fecha_alta_contrato,
  c.fecha_fin         as fecha_fin_contrato
from public.empleados e
left join public.departamentos d    on d.id = e.departamento_id
left join public.puestos_trabajo pt on pt.id = e.puesto_id
left join public.contratos c        on c.empleado_id = e.id
                                    and c.estado = 'Vigente'
where e.estado = 'Activo';

comment on view public.resumen_personal is
  'Vista agregada de empleados activos con su contrato vigente — usada en cuadros de mando';


-- ========================================================
-- ARCHIVO: 027_direccion_aperturas.sql
-- ========================================================

-- ============================================================
-- 027_direccion_aperturas.sql
-- Módulo Dirección: Horarios operativos, aperturas (turnos diarios),
--                   zonas y mesas, cuadros de mando.
--
-- CONEXIONES CRUZADAS:
--   - aperturas → fichajes (RRHH), mermas (Cocina), produccion_diaria (Cocina)
--   - zonas_mesas → reservas (Sala)
--   - cuadros_mando → agora_sync_log (ventas), nominas (coste), stock (inventario)
-- ============================================================

-- ─── 1. HORARIOS OPERATIVOS ────────────────────────────────
-- Plantilla de horario del restaurante por día de semana.
-- Base para calcular personal necesario y turnos.

create table if not exists public.horarios_operativos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null default 'Horario principal',
  dia_semana    integer not null check (dia_semana between 0 and 6), -- 0=lunes, 6=domingo
  turno         text not null check (turno in ('Mañana','Tarde','Noche','Partido','Cerrado')),
  hora_apertura time,
  hora_cierre   time,
  aforo_maximo  integer,
  activo        boolean not null default true,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, nombre, dia_semana, turno)
);

create index if not exists idx_horarios_empresa
  on public.horarios_operativos(empresa_id);

create or replace function public.set_horarios_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists horarios_updated_at on public.horarios_operativos;
create trigger horarios_updated_at
  before update on public.horarios_operativos
  for each row execute function public.set_horarios_updated_at();

-- ─── 2. ZONAS Y MESAS ──────────────────────────────────────
-- Plano del restaurante: zonas (Terraza, Interior, Barra…) y mesas.
-- Referenciado desde: reservas (Sala), aperturas (asignación de personal).

create table if not exists public.zonas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  aforo       integer default 0,
  activa      boolean not null default true,
  orden       integer default 0,
  created_at  timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create table if not exists public.mesas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  zona_id     uuid references public.zonas(id) on delete set null,
  numero      text not null,
  capacidad   integer not null default 2,
  estado      text not null default 'Libre'
                check (estado in ('Libre','Ocupada','Reservada','Bloqueada')),
  activa      boolean not null default true,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (empresa_id, numero)
);

create index if not exists idx_zonas_empresa  on public.zonas(empresa_id);
create index if not exists idx_mesas_empresa  on public.mesas(empresa_id);
create index if not exists idx_mesas_zona     on public.mesas(zona_id);

create or replace function public.set_mesas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists mesas_updated_at on public.mesas;
create trigger mesas_updated_at
  before update on public.mesas
  for each row execute function public.set_mesas_updated_at();

-- Conectar reservas con mesas (FK hacia tabla existente reservas)
-- La tabla reservas ya tiene mesa text — añadir mesa_id como FK opcional
alter table public.reservas
  add column if not exists mesa_id uuid references public.mesas(id) on delete set null;

alter table public.reservas
  add column if not exists zona_id uuid references public.zonas(id) on delete set null;

-- ─── 3. APERTURAS ──────────────────────────────────────────
-- Turno real de apertura del restaurante (≠ horario teórico).
-- Cada apertura agrupa: personal asistente, ventas Ágora, mermas, producción.
-- TABLA CENTRAL de operaciones diarias.

create table if not exists public.aperturas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  fecha           date not null default current_date,
  turno           text not null check (turno in ('Mañana','Tarde','Noche','Partido')),
  estado          text not null default 'Activa'
                    check (estado in ('Activa','Cerrada','Cancelada')),
  -- Personal
  responsable_id  uuid references public.empleados(id) on delete set null,
  num_personal    integer default 0,
  -- Ventas (poblado desde Ágora sync)
  ventas_total    numeric(12,2) default 0,
  num_tickets     integer default 0,
  ticket_medio    numeric(8,2) default 0,
  comensales      integer default 0,
  -- Operativa
  hora_apertura   time,
  hora_cierre     time,
  incidencias     text,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, fecha, turno)
);

create index if not exists idx_aperturas_empresa
  on public.aperturas(empresa_id);
create index if not exists idx_aperturas_fecha
  on public.aperturas(empresa_id, fecha desc);

create or replace function public.set_aperturas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists aperturas_updated_at on public.aperturas;
create trigger aperturas_updated_at
  before update on public.aperturas
  for each row execute function public.set_aperturas_updated_at();

comment on table public.aperturas is
  'Turno real del restaurante. Agrega ventas (Ágora), personal (RRHH), mermas (Cocina) y producción.';

-- ─── 4. ASIGNACIONES DE PERSONAL POR APERTURA ──────────────
-- Qué empleados trabajaron en cada apertura.
-- Conecta Dirección con RRHH (fichajes avanzados).

create table if not exists public.apertura_empleados (
  id           uuid primary key default gen_random_uuid(),
  apertura_id  uuid not null references public.aperturas(id) on delete cascade,
  empleado_id  uuid not null references public.empleados(id) on delete cascade,
  hora_entrada time,
  hora_salida  time,
  rol_turno    text,                  -- ej: 'Jefe de partida', 'Ayudante cocina'
  observaciones text,
  unique (apertura_id, empleado_id)
);

create index if not exists idx_ap_emp_apertura  on public.apertura_empleados(apertura_id);
create index if not exists idx_ap_emp_empleado  on public.apertura_empleados(empleado_id);

-- ─── 5. CUADROS DE MANDO ───────────────────────────────────
-- KPIs diarios/semanales/mensuales por empresa.
-- Datos calculados o importados desde Ágora, nóminas, stock.

create table if not exists public.cuadros_mando (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  periodo         text not null,      -- 'YYYY-MM-DD', 'YYYY-WNN', 'YYYY-MM'
  tipo_periodo    text not null default 'dia'
                    check (tipo_periodo in ('dia','semana','mes','trimestre','anio')),
  -- Ventas
  ventas_total    numeric(12,2) default 0,
  num_tickets     integer default 0,
  ticket_medio    numeric(8,2) default 0,
  comensales      integer default 0,
  -- Costes
  coste_mercancias numeric(12,2) default 0,  -- albaranes del período
  coste_personal   numeric(12,2) default 0,  -- nóminas del período
  otros_costes     numeric(12,2) default 0,
  -- Ratios
  food_cost_pct   numeric(5,2) default 0,    -- coste_mercancias / ventas
  labor_cost_pct  numeric(5,2) default 0,    -- coste_personal / ventas
  beneficio_bruto numeric(12,2) default 0,
  margen_pct      numeric(5,2) default 0,
  -- Personal
  horas_trabajadas numeric(8,2) default 0,
  num_aperturas   integer default 0,
  -- Meta de referencia
  presupuesto_ventas numeric(12,2),
  desviacion_pct  numeric(5,2),
  -- Control
  calculado_at    timestamptz default now(),
  fuente          text default 'manual'
                    check (fuente in ('manual','agora','sistema')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, periodo, tipo_periodo)
);

create index if not exists idx_cuadros_empresa
  on public.cuadros_mando(empresa_id);
create index if not exists idx_cuadros_periodo
  on public.cuadros_mando(empresa_id, tipo_periodo, periodo desc);

create or replace function public.set_cuadros_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists cuadros_updated_at on public.cuadros_mando;
create trigger cuadros_updated_at
  before update on public.cuadros_mando
  for each row execute function public.set_cuadros_updated_at();

comment on table public.cuadros_mando is
  'KPIs agregados por período. Se calcula diariamente desde Ágora, nóminas y albaranes.';

-- ─── 6. RLS ────────────────────────────────────────────────

alter table public.horarios_operativos enable row level security;
alter table public.zonas               enable row level security;
alter table public.mesas               enable row level security;
alter table public.aperturas           enable row level security;
alter table public.apertura_empleados  enable row level security;
alter table public.cuadros_mando       enable row level security;

-- Horarios
create policy "hor_read" on public.horarios_operativos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "hor_manage" on public.horarios_operativos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Zonas
create policy "zona_read" on public.zonas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "zona_manage" on public.zonas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Mesas
create policy "mesa_read" on public.mesas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "mesa_manage" on public.mesas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Aperturas
create policy "aper_read" on public.aperturas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "aper_manage" on public.aperturas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Apertura empleados (acceso vía apertura)
create policy "apemp_read" on public.apertura_empleados for select to authenticated using (true);
create policy "apemp_manage" on public.apertura_empleados for all to authenticated
  using (true) with check (true);

-- Cuadros de mando
create policy "cmd_read" on public.cuadros_mando for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "cmd_manage" on public.cuadros_mando for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 7. FUNCIÓN: recalcular_cuadro_dia ─────────────────────
-- Calcula el cuadro de mando diario a partir de las aperturas del día.

create or replace function public.recalcular_cuadro_dia(
  p_empresa_id uuid,
  p_fecha      date default current_date
)
returns void
language plpgsql
as $$
declare
  v_ventas        numeric;
  v_tickets       integer;
  v_comensales    integer;
  v_ticket_medio  numeric;
  v_aperturas     integer;
begin
  select
    coalesce(sum(ventas_total), 0),
    coalesce(sum(num_tickets), 0),
    coalesce(sum(comensales), 0),
    count(*)
  into v_ventas, v_tickets, v_comensales, v_aperturas
  from public.aperturas
  where empresa_id = p_empresa_id
    and fecha = p_fecha
    and estado = 'Cerrada';

  v_ticket_medio := case when v_tickets > 0 then round(v_ventas / v_tickets, 2) else 0 end;

  insert into public.cuadros_mando (
    empresa_id, periodo, tipo_periodo,
    ventas_total, num_tickets, ticket_medio, comensales,
    num_aperturas, fuente
  ) values (
    p_empresa_id, p_fecha::text, 'dia',
    v_ventas, v_tickets, v_ticket_medio, v_comensales,
    v_aperturas, 'sistema'
  )
  on conflict (empresa_id, periodo, tipo_periodo) do update set
    ventas_total    = excluded.ventas_total,
    num_tickets     = excluded.num_tickets,
    ticket_medio    = excluded.ticket_medio,
    comensales      = excluded.comensales,
    num_aperturas   = excluded.num_aperturas,
    calculado_at    = now(),
    fuente          = 'sistema',
    updated_at      = now();
end;
$$;


-- ========================================================
-- ARCHIVO: 028_cocina_mermas_produccion.sql
-- ========================================================

-- ============================================================
-- 028_cocina_mermas_produccion.sql
-- Módulo Cocina: Mermas, producción diaria, mise en place.
--
-- CONEXIONES CRUZADAS:
--   - mermas → productos (Logística), aperturas (Dirección), stock (descuento automático)
--   - produccion_diaria → partidas (Cocina existente), aperturas (Dirección), empleados (RRHH)
--   - mise_en_place → partidas, aperturas
-- ============================================================

-- ─── 1. MERMAS ─────────────────────────────────────────────
-- Registro de pérdidas de producto por turno (cocción, limpieza, caducidad…).
-- Conecta con: productos (Logística), aperturas (Dirección), stock (descuento).
-- El registro de merma puede descontar automáticamente del stock.

create table if not exists public.mermas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  producto_id     uuid not null references public.productos(id) on delete cascade,
  apertura_id     uuid references public.aperturas(id) on delete set null,
  -- Qué se perdió
  cantidad        numeric(10,3) not null check (cantidad > 0),
  unidad          text not null default 'kg',
  motivo          text not null default 'Elaboracion'
                    check (motivo in ('Elaboracion','Caducidad','Rotura','Error','Limpieza','Otro')),
  descripcion     text,
  -- Impacto económico (calculado)
  coste_unitario  numeric(10,2) default 0,
  coste_total     numeric(10,2) generated always as (cantidad * coste_unitario) stored,
  -- Descuento de stock
  descuenta_stock boolean not null default true,
  stock_descontado boolean not null default false,
  -- Trazabilidad
  registrado_por  uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_mermas_empresa
  on public.mermas(empresa_id);
create index if not exists idx_mermas_producto
  on public.mermas(producto_id);
create index if not exists idx_mermas_apertura
  on public.mermas(apertura_id);
create index if not exists idx_mermas_fecha
  on public.mermas(empresa_id, created_at desc);

create or replace function public.set_mermas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists mermas_updated_at on public.mermas;
create trigger mermas_updated_at
  before update on public.mermas
  for each row execute function public.set_mermas_updated_at();

comment on table public.mermas is
  'Pérdidas de producto por turno. Si descuenta_stock=true, trigger actualiza stock automáticamente.';

-- ─── 2. TRIGGER: descontar stock al registrar merma ────────

create or replace function public.fn_merma_descuenta_stock()
returns trigger language plpgsql as $$
begin
  if new.descuenta_stock and not new.stock_descontado and new.producto_id is not null then
    update public.stock
    set
      cantidad_actual   = greatest(cantidad_actual - new.cantidad, 0),
      ultimo_movimiento = now()
    where producto_id = new.producto_id;

    new.stock_descontado := true;
  end if;
  return new;
end;
$$;

drop trigger if exists merma_descuenta_stock on public.mermas;
create trigger merma_descuenta_stock
  before insert on public.mermas
  for each row execute function public.fn_merma_descuenta_stock();

-- ─── 3. PRODUCCIÓN DIARIA ──────────────────────────────────
-- Registro de lo que se produce en cada turno por partida.
-- Conecta con: partidas (Cocina), aperturas (Dirección), empleados (RRHH),
--              productos (Logística — lo que se fabrica es un producto tipo elaboracion).

create table if not exists public.produccion_diaria (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  apertura_id     uuid references public.aperturas(id) on delete set null,
  partida_id      uuid references public.partidas(id) on delete set null,
  producto_id     uuid references public.productos(id) on delete set null,
  -- Lo producido
  nombre_produccion text not null,    -- nombre libre si no hay producto vinculado
  cantidad_planificada numeric(10,3) default 0,
  cantidad_producida   numeric(10,3) default 0,
  unidad          text not null default 'ud',
  -- Control
  responsable_id  uuid references public.empleados(id) on delete set null,
  hora_inicio     time,
  hora_fin        time,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','En proceso','Completada','Incidencia')),
  incidencias     text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_prod_empresa
  on public.produccion_diaria(empresa_id);
create index if not exists idx_prod_apertura
  on public.produccion_diaria(apertura_id);
create index if not exists idx_prod_partida
  on public.produccion_diaria(partida_id);

create or replace function public.set_produccion_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists produccion_updated_at on public.produccion_diaria;
create trigger produccion_updated_at
  before update on public.produccion_diaria
  for each row execute function public.set_produccion_updated_at();

-- ─── 4. MISE EN PLACE ──────────────────────────────────────
-- Checklist de puesta a punto por partida/apertura.
-- Conecta con: partidas (Cocina), aperturas (Dirección).

create table if not exists public.plantillas_mep (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  partida_id  uuid references public.partidas(id) on delete set null,
  nombre      text not null,
  turno       text check (turno in ('Mañana','Tarde','Noche','Todas')),
  tareas      jsonb not null default '[]',  -- [{nombre, orden, critica}]
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.mise_en_place (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  plantilla_id    uuid references public.plantillas_mep(id) on delete set null,
  apertura_id     uuid references public.aperturas(id) on delete set null,
  partida_id      uuid references public.partidas(id) on delete set null,
  responsable_id  uuid references public.empleados(id) on delete set null,
  fecha           date not null default current_date,
  turno           text check (turno in ('Mañana','Tarde','Noche')),
  tareas          jsonb not null default '[]',  -- [{nombre, completada, completada_at, completada_por}]
  completado_pct  integer default 0,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','En progreso','Completado')),
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_mep_empresa    on public.mise_en_place(empresa_id);
create index if not exists idx_mep_apertura   on public.mise_en_place(apertura_id);
create index if not exists idx_mep_fecha      on public.mise_en_place(empresa_id, fecha desc);

create or replace function public.set_mep_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists mep_updated_at on public.mise_en_place;
create trigger mep_updated_at
  before update on public.mise_en_place
  for each row execute function public.set_mep_updated_at();

drop trigger if exists plantillas_mep_updated_at on public.plantillas_mep;
create trigger plantillas_mep_updated_at
  before update on public.plantillas_mep
  for each row execute function public.set_mep_updated_at();

-- ─── 5. VINCULAR fichas_tecnicas → productos ───────────────
-- Las fichas técnicas existentes no tienen FK a productos.
-- Añadir producto_venta_id para enlazar la ficha con el plato del menú.

alter table public.fichas_tecnicas
  add column if not exists producto_id uuid references public.productos(id) on delete set null;

comment on column public.fichas_tecnicas.producto_id is
  'Producto tipo venta al que corresponde esta ficha técnica. Permite calcular food cost real.';

create index if not exists idx_fichas_producto
  on public.fichas_tecnicas(producto_id) where producto_id is not null;

-- ─── 6. RLS ────────────────────────────────────────────────

alter table public.mermas            enable row level security;
alter table public.produccion_diaria enable row level security;
alter table public.plantillas_mep    enable row level security;
alter table public.mise_en_place     enable row level security;

-- Mermas
create policy "merm_read" on public.mermas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "merm_manage" on public.mermas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Producción
create policy "prod_read" on public.produccion_diaria for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "prod_manage" on public.produccion_diaria for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Plantillas MEP
create policy "plmep_read" on public.plantillas_mep for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "plmep_manage" on public.plantillas_mep for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Mise en place
create policy "mep_read" on public.mise_en_place for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "mep_manage" on public.mise_en_place for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));


-- ========================================================
-- ARCHIVO: 029_contabilidad_upgrade.sql
-- ========================================================

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


-- ========================================================
-- ARCHIVO: 030_gerencia_presupuestos.sql
-- ========================================================

-- ============================================================
-- 030_gerencia_presupuestos.sql
-- Módulo Gerencia: Presupuestos, metas KPI, campañas.
--
-- CONEXIONES CRUZADAS:
--   - presupuestos → cuadros_mando (Dirección — comparar presupuesto vs real)
--   - metas_kpi → cuadros_mando (Dirección — seguimiento de objetivos)
--   - campañas → descuentos (Gerencia existente), productos (Logística)
--   - presupuestos → nominas (RRHH — planificación de costes de personal)
-- ============================================================

-- ─── 1. PRESUPUESTOS ───────────────────────────────────────
-- Planificación financiera por período.
-- Comparado contra cuadros_mando para calcular desviaciones.

create table if not exists public.presupuestos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  periodo         text not null,          -- 'YYYY-MM' o 'YYYY'
  tipo_periodo    text not null default 'mes'
                    check (tipo_periodo in ('mes','trimestre','anio')),
  estado          text not null default 'Borrador'
                    check (estado in ('Borrador','Aprobado','Cerrado')),
  -- Ingresos planificados
  ventas_previstas    numeric(12,2) not null default 0,
  otros_ingresos      numeric(12,2) not null default 0,
  total_ingresos      numeric(12,2) generated always as (ventas_previstas + otros_ingresos) stored,
  -- Costes planificados
  coste_mercancias    numeric(12,2) not null default 0,  -- % sobre ventas típico: 28-32%
  coste_personal      numeric(12,2) not null default 0,  -- % sobre ventas típico: 30-35%
  alquiler            numeric(12,2) not null default 0,
  suministros         numeric(12,2) not null default 0,
  marketing           numeric(12,2) not null default 0,
  otros_costes        numeric(12,2) not null default 0,
  total_costes        numeric(12,2) generated always as (
                        coste_mercancias + coste_personal + alquiler +
                        suministros + marketing + otros_costes
                      ) stored,
  -- Beneficio esperado
  beneficio_esperado  numeric(12,2) generated always as (
                        (ventas_previstas + otros_ingresos) -
                        (coste_mercancias + coste_personal + alquiler +
                         suministros + marketing + otros_costes)
                      ) stored,
  -- Ratios objetivo
  food_cost_obj_pct   numeric(5,2),   -- % food cost objetivo
  labor_cost_obj_pct  numeric(5,2),   -- % labor cost objetivo
  -- Meta
  aprobado_por    uuid references auth.users(id) on delete set null,
  aprobado_at     timestamptz,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, periodo, tipo_periodo)
);

create index if not exists idx_presupuestos_empresa
  on public.presupuestos(empresa_id);
create index if not exists idx_presupuestos_periodo
  on public.presupuestos(empresa_id, tipo_periodo, periodo desc);

create or replace function public.set_presupuestos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists presupuestos_updated_at on public.presupuestos;
create trigger presupuestos_updated_at
  before update on public.presupuestos
  for each row execute function public.set_presupuestos_updated_at();

-- Enlazar cuadros_mando con presupuesto del período
alter table public.cuadros_mando
  add column if not exists presupuesto_id uuid references public.presupuestos(id) on delete set null;

comment on column public.cuadros_mando.presupuesto_id is
  'FK al presupuesto del período para calcular desviaciones en cuadro de mando';

-- ─── 2. METAS KPI ──────────────────────────────────────────
-- Objetivos cuantitativos por departamento o empresa.
-- Conecta con: departamentos (RRHH), cuadros_mando (Dirección).

create table if not exists public.metas_kpi (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  departamento_id uuid references public.departamentos(id) on delete set null,
  nombre          text not null,
  descripcion     text,
  kpi             text not null,          -- ej: 'ticket_medio', 'food_cost_pct'
  unidad          text not null default 'valor'
                    check (unidad in ('valor','porcentaje','unidades','horas')),
  periodo         text not null,
  tipo_periodo    text not null default 'mes'
                    check (tipo_periodo in ('semana','mes','trimestre','anio')),
  -- Objetivo
  valor_objetivo  numeric(12,2) not null,
  valor_minimo    numeric(12,2),          -- alerta si cae por debajo
  valor_maximo    numeric(12,2),          -- alerta si supera
  -- Resultado real (actualizado desde cuadros_mando o manualmente)
  valor_real      numeric(12,2),
  cumplimiento_pct numeric(5,2),
  estado          text not null default 'En seguimiento'
                    check (estado in ('En seguimiento','Cumplida','Incumplida','Superada')),
  responsable_id  uuid references public.empleados(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_metas_empresa
  on public.metas_kpi(empresa_id);
create index if not exists idx_metas_departamento
  on public.metas_kpi(departamento_id);

create or replace function public.set_metas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists metas_updated_at on public.metas_kpi;
create trigger metas_updated_at
  before update on public.metas_kpi
  for each row execute function public.set_metas_updated_at();

-- ─── 3. CAMPAÑAS ───────────────────────────────────────────
-- Campañas de marketing y promoción.
-- Conecta con: descuentos (Gerencia), productos (Logística — productos en campaña).

create table if not exists public.campanas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  descripcion     text,
  tipo            text not null default 'Promocion'
                    check (tipo in ('Promocion','Evento','Temporada','Fidelizacion','Redes sociales','Otro')),
  estado          text not null default 'Planificada'
                    check (estado in ('Planificada','Activa','Pausada','Finalizada','Cancelada')),
  fecha_inicio    date not null,
  fecha_fin       date,
  -- Presupuesto de campaña
  presupuesto     numeric(10,2) default 0,
  gasto_real      numeric(10,2) default 0,
  -- Resultados esperados
  objetivo_ventas numeric(12,2),
  ventas_generadas numeric(12,2) default 0,
  -- Canales
  canales         text[] default '{}',    -- ['Instagram','Email','Cartelería']
  -- Relaciones
  descuento_id    uuid references public.descuentos(id) on delete set null,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Productos incluidos en campaña
create table if not exists public.campanas_productos (
  campana_id  uuid not null references public.campanas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio_especial numeric(10,2),
  dto_pct         numeric(5,2) default 0,
  primary key (campana_id, producto_id)
);

create index if not exists idx_campanas_empresa
  on public.campanas(empresa_id);

create or replace function public.set_campanas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists campanas_updated_at on public.campanas;
create trigger campanas_updated_at
  before update on public.campanas
  for each row execute function public.set_campanas_updated_at();

-- Enriquecer comunicados con FK a campaña
alter table public.comunicados
  add column if not exists campana_id uuid references public.campanas(id) on delete set null;

comment on column public.comunicados.campana_id is
  'FK a campañas — comunicado puede ser parte de una campaña de gerencia';

-- ─── 4. RLS ────────────────────────────────────────────────

alter table public.presupuestos      enable row level security;
alter table public.metas_kpi         enable row level security;
alter table public.campanas          enable row level security;
alter table public.campanas_productos enable row level security;

-- Presupuestos
create policy "pres2_read" on public.presupuestos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pres2_manage" on public.presupuestos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Metas KPI
create policy "metas_read" on public.metas_kpi for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "metas_manage" on public.metas_kpi for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Campañas
create policy "camp_read" on public.campanas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "camp_manage" on public.campanas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Campañas-productos
create policy "cp_read" on public.campanas_productos for select to authenticated using (true);
create policy "cp_manage" on public.campanas_productos for all to authenticated
  using (true) with check (true);


-- ========================================================
-- ARCHIVO: 031_ajustes_audit.sql
-- ========================================================

-- ============================================================
-- 031_ajustes_audit.sql
-- Módulo Ajustes: Auditoría de cambios, configuración de integraciones,
--                 logs de acceso y plantillas de notificaciones.
--
-- CONEXIONES CRUZADAS:
--   - audit_log → todas las tablas (registro de cambios críticos)
--   - integraciones_config → agora_sync_log (Logística), empresas (Ajustes)
--   - notificaciones → profiles (usuarios), empleados (RRHH)
-- ============================================================

-- ─── 1. AUDIT LOG ──────────────────────────────────────────
-- Registro inmutable de cambios en datos críticos.
-- Conecta con: TODAS las tablas del sistema (via trigger genérico).

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references public.empresas(id) on delete set null,
  tabla       text not null,
  registro_id text not null,      -- UUID del registro afectado como text
  operacion   text not null check (operacion in ('INSERT','UPDATE','DELETE')),
  campos_antes jsonb,             -- valores previos (solo UPDATE/DELETE)
  campos_despues jsonb,           -- valores nuevos (solo INSERT/UPDATE)
  usuario_id  uuid references auth.users(id) on delete set null,
  usuario_email text,             -- desnormalizado para conservar tras borrado de user
  ip_address  inet,
  created_at  timestamptz not null default now()
);

-- Solo índices de lectura — la tabla no se actualiza, solo inserta
create index if not exists idx_audit_empresa
  on public.audit_log(empresa_id, created_at desc);
create index if not exists idx_audit_tabla
  on public.audit_log(tabla, registro_id);
create index if not exists idx_audit_usuario
  on public.audit_log(usuario_id, created_at desc);

comment on table public.audit_log is
  'Log inmutable de cambios críticos. Solo INSERT permitido. Nunca UPDATE/DELETE.';

-- RLS: solo lectura para admins; escritura solo vía funciones internas
alter table public.audit_log enable row level security;
create policy "audit_read" on public.audit_log for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
-- No policy de write — solo funciones server-side pueden insertar

-- ─── 2. FUNCIÓN GENÉRICA DE AUDITORÍA ──────────────────────
-- Trigger function reutilizable que registra cambios en cualquier tabla.
-- Uso: CREATE TRIGGER tbl_audit AFTER INSERT OR UPDATE OR DELETE ON tabla
--        FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

create or replace function public.fn_audit_log()
returns trigger language plpgsql security definer as $$
declare
  v_empresa_id uuid;
  v_registro_id text;
  v_antes jsonb;
  v_despues jsonb;
begin
  -- Extraer empresa_id si existe en el registro
  if tg_op = 'DELETE' then
    v_empresa_id := (old.empresa_id)::uuid;
    v_registro_id := old.id::text;
    v_antes := to_jsonb(old);
    v_despues := null;
  elsif tg_op = 'INSERT' then
    v_empresa_id := (new.empresa_id)::uuid;
    v_registro_id := new.id::text;
    v_antes := null;
    v_despues := to_jsonb(new);
  else -- UPDATE
    v_empresa_id := (new.empresa_id)::uuid;
    v_registro_id := new.id::text;
    v_antes := to_jsonb(old);
    v_despues := to_jsonb(new);
  end if;

  insert into public.audit_log (
    empresa_id, tabla, registro_id, operacion,
    campos_antes, campos_despues,
    usuario_id, created_at
  ) values (
    v_empresa_id, tg_table_name, v_registro_id, tg_op,
    v_antes, v_despues,
    auth.uid(), now()
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Activar auditoría en tablas críticas
drop trigger if exists audit_pedidos on public.pedidos;
create trigger audit_pedidos after insert or update or delete on public.pedidos
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_nominas on public.nominas;
create trigger audit_nominas after insert or update or delete on public.nominas
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_contratos on public.contratos;
create trigger audit_contratos after insert or update or delete on public.contratos
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_facturas on public.facturas;
create trigger audit_facturas after insert or update or delete on public.facturas
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_stock on public.stock;
create trigger audit_stock after update on public.stock
  for each row when (old.cantidad_actual is distinct from new.cantidad_actual)
  execute function public.fn_audit_log();

-- ─── 3. INTEGRACIONES CONFIG ───────────────────────────────
-- Configuración de integraciones externas por empresa.
-- Conecta con: agora_sync_log (Logística), empresas (Ajustes).

create table if not exists public.integraciones_config (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null
                    check (tipo in ('Agora','Facturae','Email','WhatsApp','Slack','Otro')),
  nombre          text not null,
  activa          boolean not null default false,
  config          jsonb not null default '{}',  -- credenciales cifradas por la app
  ultimo_sync_at  timestamptz,
  ultimo_estado   text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, tipo)
);

create index if not exists idx_integraciones_empresa
  on public.integraciones_config(empresa_id);

create or replace function public.set_integraciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists integraciones_updated_at on public.integraciones_config;
create trigger integraciones_updated_at
  before update on public.integraciones_config
  for each row execute function public.set_integraciones_updated_at();

alter table public.integraciones_config enable row level security;
create policy "integ_read" on public.integraciones_config for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "integ_manage" on public.integraciones_config for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 4. NOTIFICACIONES ─────────────────────────────────────
-- Notificaciones internas del sistema (alertas, avisos, mensajes del sistema).
-- Conecta con: profiles (Ajustes), empleados (RRHH), pedidos (Logística), etc.

create table if not exists public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  usuario_id      uuid not null references auth.users(id) on delete cascade,
  tipo            text not null
                    check (tipo in ('info','alerta','error','exito','recordatorio')),
  titulo          text not null,
  mensaje         text not null,
  leida           boolean not null default false,
  leida_at        timestamptz,
  -- Referencia al origen (ej: pedido_id, empleado_id, etc.)
  entidad_tipo    text,      -- 'pedido', 'nomina', 'stock', etc.
  entidad_id      uuid,
  accion_url      text,      -- ruta interna a la que navegar al hacer click
  created_at      timestamptz not null default now()
);

create index if not exists idx_notif_usuario
  on public.notificaciones(usuario_id, leida, created_at desc);
create index if not exists idx_notif_empresa
  on public.notificaciones(empresa_id, created_at desc);

alter table public.notificaciones enable row level security;
-- Cada usuario solo ve sus propias notificaciones
create policy "notif_read" on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());
create policy "notif_update" on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid());
-- Solo el sistema (service_role) puede insertar notificaciones
create policy "notif_insert" on public.notificaciones for insert to authenticated
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

comment on table public.notificaciones is
  'Notificaciones in-app. Cada usuario solo accede a las suyas vía RLS.';

-- ─── 5. ALERTAS DE STOCK BAJO ──────────────────────────────
-- Cuando stock cae bajo mínimo, crear notificación automáticamente.

create or replace function public.fn_alerta_stock_bajo()
returns trigger language plpgsql security definer as $$
declare
  v_empresa_uuid uuid;
  v_usuarios record;
begin
  -- Solo actuar si la cantidad cae por debajo del mínimo
  if new.cantidad_actual <= new.cantidad_minima and
     (old.cantidad_actual is null or old.cantidad_actual > old.cantidad_minima) then

    -- Obtener empresa_id del producto
    select empresa_id into v_empresa_uuid
    from public.productos where id = new.producto_id limit 1;

    if v_empresa_uuid is not null then
      -- Notificar a todos los usuarios de la empresa con rol admin/director/responsable
      for v_usuarios in
        select ur.user_id
        from public.user_roles ur
        join public.profiles pr on pr.user_id = ur.user_id
        where pr.empresa_id = v_empresa_uuid
          and ur.role in ('admin','director','responsable')
      loop
        insert into public.notificaciones (
          empresa_id, usuario_id, tipo, titulo, mensaje,
          entidad_tipo, entidad_id
        ) values (
          v_empresa_uuid,
          v_usuarios.user_id,
          'alerta',
          'Stock bajo: ' || new.producto_nombre,
          'El stock de "' || new.producto_nombre || '" está por debajo del mínimo (' ||
          new.cantidad_actual || ' / ' || new.cantidad_minima || ' ' || new.unidad || ').',
          'stock',
          new.id
        );
      end loop;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_bajo_alerta on public.stock;
create trigger stock_bajo_alerta
  after update on public.stock
  for each row execute function public.fn_alerta_stock_bajo();


-- ========================================================
-- ARCHIVO: 032_juridico_documentos.sql
-- ========================================================

-- ============================================================
-- 032_juridico_documentos.sql
-- Módulo Jurídico: Documentos legales, partes interesadas,
--                  plazos y costes judiciales.
--
-- CONEXIONES CRUZADAS:
--   - documentos_juridicos → procesos_juridicos (Jurídico), documentos (Dirección)
--   - partes_juridicas → procesos_juridicos (Jurídico), proveedores (Logística),
--     empleados (RRHH), contactos_contabilidad (Contabilidad)
--   - costes_juridicos → procesos_juridicos (Jurídico), facturas (Contabilidad)
-- ============================================================

-- ─── 1. PARTES INTERESADAS ─────────────────────────────────
-- Actores de un proceso legal: abogados, demandantes, demandados, peritos…
-- Conecta con: procesos_juridicos, proveedores (si es una empresa proveedora),
--              empleados (si es un empleado implicado).

create table if not exists public.partes_juridicas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  rol             text not null
                    check (rol in ('Demandante','Demandado','Abogado defensa','Abogado contrario',
                                   'Perito','Testigo','Juez','Mediador','Otro')),
  tipo_persona    text not null default 'Fisica'
                    check (tipo_persona in ('Fisica','Juridica')),
  nombre          text not null,
  cif_dni         text,
  telefono        text,
  email           text,
  bufete          text,           -- si es abogado: nombre del bufete
  colegio_num     text,           -- número de colegiado
  -- Vínculos con otras tablas (opcional)
  proveedor_id    uuid references public.proveedores(id) on delete set null,
  empleado_id     uuid references public.empleados(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_partes_proceso
  on public.partes_juridicas(proceso_id);
create index if not exists idx_partes_empresa
  on public.partes_juridicas(empresa_id);

create or replace function public.set_partes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists partes_updated_at on public.partes_juridicas;
create trigger partes_updated_at
  before update on public.partes_juridicas
  for each row execute function public.set_partes_updated_at();

-- ─── 2. DOCUMENTOS JURÍDICOS ───────────────────────────────
-- Documentos asociados a procesos legales (demandas, sentencias, autos…).
-- Conecta con: procesos_juridicos, documentos (tabla general de Dirección).

create table if not exists public.documentos_juridicos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  nombre          text not null,
  tipo            text not null default 'Otro'
                    check (tipo in ('Demanda','Contestacion','Auto','Sentencia','Recurso',
                                    'Acuerdo','Burofax','Requerimiento','Pericial','Otro')),
  fecha_documento date,
  fecha_recepcion date,
  plazo_respuesta date,          -- fecha límite para responder (si aplica)
  estado          text not null default 'Pendiente revisar'
                    check (estado in ('Pendiente revisar','Revisado','Respondido','Archivado')),
  url             text,          -- enlace a almacenamiento (Supabase Storage)
  confidencial    boolean not null default false,
  notas           text,
  subido_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_docjur_proceso
  on public.documentos_juridicos(proceso_id);
create index if not exists idx_docjur_empresa
  on public.documentos_juridicos(empresa_id);
create index if not exists idx_docjur_plazo
  on public.documentos_juridicos(empresa_id, plazo_respuesta)
  where plazo_respuesta is not null;

create or replace function public.set_docjur_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists docjur_updated_at on public.documentos_juridicos;
create trigger docjur_updated_at
  before update on public.documentos_juridicos
  for each row execute function public.set_docjur_updated_at();

-- ─── 3. PLAZOS JUDICIALES ──────────────────────────────────
-- Control de plazos y vistas judiciales.
-- Conecta con: procesos_juridicos, vencimientos (Gerencia — para alertas).

create table if not exists public.plazos_judiciales (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  nombre          text not null,
  tipo            text not null default 'Otro'
                    check (tipo in ('Vista oral','Junta conciliacion','Tramite','Sentencia',
                                    'Recurso','Notificacion','Pago','Otro')),
  fecha           date not null,
  hora            time,
  juzgado         text,
  sala            text,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','Celebrado','Aplazado','Anulado')),
  resultado       text,          -- resumen del resultado si estado=Celebrado
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_plazos_proceso
  on public.plazos_judiciales(proceso_id);
create index if not exists idx_plazos_fecha
  on public.plazos_judiciales(empresa_id, fecha)
  where estado = 'Pendiente';

create or replace function public.set_plazos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists plazos_updated_at on public.plazos_judiciales;
create trigger plazos_updated_at
  before update on public.plazos_judiciales
  for each row execute function public.set_plazos_updated_at();

-- ─── 4. COSTES JUDICIALES ──────────────────────────────────
-- Gastos asociados al proceso (honorarios, tasas, peritajes).
-- Conecta con: procesos_juridicos (Jurídico), facturas (Contabilidad).

create table if not exists public.costes_judiciales (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  concepto        text not null,
  tipo            text not null default 'Honorarios'
                    check (tipo in ('Honorarios abogado','Honorarios perito','Tasa judicial',
                                    'Costas','Indemnizacion','Otro')),
  importe         numeric(12,2) not null,
  fecha           date not null default current_date,
  pagado          boolean not null default false,
  fecha_pago      date,
  factura_id      uuid references public.facturas(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_costes_proceso
  on public.costes_judiciales(proceso_id);

-- Enriquecer procesos_juridicos con FK a partes y totales calculables
alter table public.procesos_juridicos
  add column if not exists abogado_id uuid references public.partes_juridicas(id) on delete set null,
  add column if not exists num_expediente text,
  add column if not exists juzgado text,
  add column if not exists coste_acumulado numeric(12,2) default 0;

comment on column public.procesos_juridicos.num_expediente is
  'Número de expediente judicial oficial';
comment on column public.procesos_juridicos.coste_acumulado is
  'Total acumulado de costes_judiciales — actualizado por trigger o manualmente';

-- ─── 5. RLS ────────────────────────────────────────────────

alter table public.partes_juridicas    enable row level security;
alter table public.documentos_juridicos enable row level security;
alter table public.plazos_judiciales   enable row level security;
alter table public.costes_judiciales   enable row level security;

-- Partes
create policy "partes_read" on public.partes_juridicas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "partes_manage" on public.partes_juridicas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Documentos jurídicos
create policy "docjur_read" on public.documentos_juridicos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "docjur_manage" on public.documentos_juridicos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Plazos
create policy "plazos_read" on public.plazos_judiciales for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "plazos_manage" on public.plazos_judiciales for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Costes
create policy "costes_jur_read" on public.costes_judiciales for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "costes_jur_manage" on public.costes_judiciales for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 6. VISTA: procesos_juridicos_resumen ──────────────────
-- Vista para el panel de Jurídico.

create or replace view public.procesos_juridicos_resumen as
select
  pj.id,
  pj.empresa_id,
  pj.titulo,
  pj.tipo,
  pj.estado,
  pj.gravedad,
  pj.fecha_inicio,
  pj.importe_reclamado,
  pj.coste_acumulado,
  count(distinct dj.id) as num_documentos,
  count(distinct plj.id) filter (where plj.estado = 'Pendiente') as plazos_pendientes,
  min(plj.fecha) filter (where plj.estado = 'Pendiente') as proximo_plazo
from public.procesos_juridicos pj
left join public.documentos_juridicos dj on dj.proceso_id = pj.id
left join public.plazos_judiciales plj on plj.proceso_id = pj.id
group by pj.id;

comment on view public.procesos_juridicos_resumen is
  'Vista agregada de procesos jurídicos con conteo de documentos y próximo plazo';


-- ========================================================
-- ARCHIVO: 033_empresa_config.sql
-- ========================================================

-- ============================================================
-- 033_empresa_config.sql
-- Roles por empresa: una fila por rol con permisos como JSONB.
-- ============================================================

create table if not exists public.empresa_roles (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  descripcion text not null default '',
  permisos    jsonb not null default '[]',
  protected   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_empresa_roles_empresa
  on public.empresa_roles(empresa_id, created_at);

comment on table public.empresa_roles is
  'Roles de acceso por empresa con permisos por módulo en JSONB.';

-- Trigger updated_at
create or replace function public.set_empresa_roles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists empresa_roles_updated_at on public.empresa_roles;
create trigger empresa_roles_updated_at
  before update on public.empresa_roles
  for each row execute function public.set_empresa_roles_updated_at();

-- RLS
alter table public.empresa_roles enable row level security;

create policy "empresa_roles_select" on public.empresa_roles
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "empresa_roles_all" on public.empresa_roles
  for all to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );


-- ========================================================
-- ARCHIVO: 034_user_status.sql
-- ========================================================

-- Migration 034: Add estado_acceso to profiles
-- Allowed values: Activo, Inactivo, Pendiente (Bloqueado removed)

alter table public.profiles
  add column if not exists estado_acceso text not null default 'Activo'
    check (estado_acceso in ('Activo', 'Inactivo', 'Pendiente'));

-- Migrate any existing rows that may have 'Bloqueado' stored elsewhere (safety)
update public.profiles
set estado_acceso = 'Inactivo'
where estado_acceso = 'Bloqueado';


-- ========================================================
-- ARCHIVO: 035_pos.sql
-- ========================================================

-- ============================================================
-- 035_pos.sql — Módulo POS (Punto de Venta) — submódulo de Sala
-- PRP-025 · Fase 1
--
-- Tablas nuevas:
--   pos_sesiones_caja     (arqueos)
--   pos_tickets           (ticket / comanda)
--   pos_ticket_lineas     (líneas del ticket)
--   pos_pagos             (medios de pago por ticket)
--   pos_movimientos_caja  (aportes / retiradas de caja)
--
-- Reutiliza: mesas, productos, escandallos, stock, descuentos,
--            profiles, user_roles, empresas.
-- ============================================================

-- ─── 0. ENUMS ─────────────────────────────────────────────────
do $$ begin
  create type public.ticket_estado as enum ('ABIERTO','ENVIADO','COBRADO','ANULADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pago_medio as enum ('EFECTIVO','TARJETA','BIZUM','VALE','OTROS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.caja_estado as enum ('ABIERTA','CERRADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.linea_destino as enum ('COCINA','BARRA','NINGUNO');
exception when duplicate_object then null; end $$;

-- ─── 1. SESIÓN DE CAJA (ARQUEO) ──────────────────────────────
create table if not exists public.pos_sesiones_caja (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  empleado_id    uuid,
  abierta_at     timestamptz not null default now(),
  cerrada_at     timestamptz,
  fondo_inicial  numeric(10,2) not null default 0,
  teorico_cierre numeric(10,2),
  real_cierre    numeric(10,2),
  diferencia     numeric(10,2),
  estado         public.caja_estado not null default 'ABIERTA',
  notas          text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists idx_pos_caja_empresa
  on public.pos_sesiones_caja(empresa_id, abierta_at desc);

create index if not exists idx_pos_caja_abierta
  on public.pos_sesiones_caja(empresa_id, estado)
  where estado = 'ABIERTA';

-- ─── 2. TICKETS ──────────────────────────────────────────────
create table if not exists public.pos_tickets (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  sesion_caja_id  uuid references public.pos_sesiones_caja(id) on delete set null,
  numero          text not null,
  mesa_id         uuid,
  comensales      integer not null default 1,
  empleado_id     uuid,
  estado          public.ticket_estado not null default 'ABIERTO',
  subtotal        numeric(10,2) not null default 0,
  descuento_id    uuid,
  descuento_valor numeric(10,2) not null default 0,
  iva_total       numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  abierto_at      timestamptz not null default now(),
  enviado_at      timestamptz,
  cerrado_at      timestamptz,
  anulado_at      timestamptz,
  anulado_motivo  text,
  stock_descontado boolean not null default false,
  notas           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_pos_tickets_empresa_fecha
  on public.pos_tickets(empresa_id, abierto_at desc);

create index if not exists idx_pos_tickets_empresa_estado
  on public.pos_tickets(empresa_id, estado);

create unique index if not exists idx_pos_tickets_numero_unico
  on public.pos_tickets(empresa_id, numero);

-- ─── 3. LÍNEAS DE TICKET ─────────────────────────────────────
create table if not exists public.pos_ticket_lineas (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.pos_tickets(id) on delete cascade,
  producto_id     uuid,
  nombre          text not null,
  cantidad        numeric(10,3) not null default 1,
  precio_unitario numeric(10,2) not null default 0,
  iva_pct         numeric(5,2) not null default 10,
  descuento_pct   numeric(5,2) not null default 0,
  destino         public.linea_destino not null default 'COCINA',
  enviada_at      timestamptz,
  nota_cocina     text not null default '',
  comensal_idx    smallint,
  created_at      timestamptz not null default now()
);

create index if not exists idx_pos_lineas_ticket
  on public.pos_ticket_lineas(ticket_id);

-- ─── 4. PAGOS ────────────────────────────────────────────────
create table if not exists public.pos_pagos (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.pos_tickets(id) on delete cascade,
  medio      public.pago_medio not null,
  importe    numeric(10,2) not null,
  referencia text,
  creado_at  timestamptz not null default now()
);

create index if not exists idx_pos_pagos_ticket
  on public.pos_pagos(ticket_id);

-- ─── 5. MOVIMIENTOS DE CAJA (aportes / retiradas) ────────────
create table if not exists public.pos_movimientos_caja (
  id             uuid primary key default gen_random_uuid(),
  sesion_caja_id uuid not null references public.pos_sesiones_caja(id) on delete cascade,
  tipo           text not null check (tipo in ('APORTE','RETIRADA')),
  importe        numeric(10,2) not null,
  motivo         text not null default '',
  creado_at      timestamptz not null default now()
);

create index if not exists idx_pos_mov_caja_sesion
  on public.pos_movimientos_caja(sesion_caja_id, creado_at desc);

-- ─── 6. RLS POR empresa_id (patrón profiles.user_id = auth.uid()) ─
alter table public.pos_sesiones_caja    enable row level security;
alter table public.pos_tickets          enable row level security;
alter table public.pos_ticket_lineas    enable row level security;
alter table public.pos_pagos            enable row level security;
alter table public.pos_movimientos_caja enable row level security;

drop policy if exists "pos_caja_empresa" on public.pos_sesiones_caja;
create policy "pos_caja_empresa" on public.pos_sesiones_caja
  for all to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

drop policy if exists "pos_tickets_empresa" on public.pos_tickets;
create policy "pos_tickets_empresa" on public.pos_tickets
  for all to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

drop policy if exists "pos_lineas_via_ticket" on public.pos_ticket_lineas;
create policy "pos_lineas_via_ticket" on public.pos_ticket_lineas
  for all to authenticated
  using (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  )
  with check (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "pos_pagos_via_ticket" on public.pos_pagos;
create policy "pos_pagos_via_ticket" on public.pos_pagos
  for all to authenticated
  using (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  )
  with check (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "pos_mov_via_caja" on public.pos_movimientos_caja;
create policy "pos_mov_via_caja" on public.pos_movimientos_caja
  for all to authenticated
  using (
    sesion_caja_id in (
      select c.id from public.pos_sesiones_caja c
      where c.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  )
  with check (
    sesion_caja_id in (
      select c.id from public.pos_sesiones_caja c
      where c.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  );

-- ─── 7. TRIGGER updated_at ───────────────────────────────────
drop trigger if exists pos_tickets_updated_at on public.pos_tickets;
create trigger pos_tickets_updated_at
  before update on public.pos_tickets
  for each row execute function public.set_updated_at();

-- ─── 8. FUNCIÓN: correlativo de ticket por empresa y día ─────
-- Genera "YYYYMMDD-NNNN" atómicamente dentro de una transacción.
create or replace function public.pos_next_ticket_numero(p_empresa_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_fecha_str text := to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDD');
  v_next      int;
  v_numero    text;
begin
  -- Busca último correlativo de hoy y suma 1 (bloqueo por lock de fila implícito en insert)
  select coalesce(max(substring(numero from 10)::int), 0) + 1
    into v_next
    from public.pos_tickets
   where empresa_id = p_empresa_id
     and numero like v_fecha_str || '-%';

  v_numero := v_fecha_str || '-' || lpad(v_next::text, 4, '0');
  return v_numero;
end $$;

comment on function public.pos_next_ticket_numero(uuid) is
  'Genera correlativo de ticket POS formato YYYYMMDD-NNNN por empresa y día.';

-- ─── 9. FLAG POR EMPRESA: evitar doble descuento Ágora+POS ───
-- Si una empresa usa POS propio, Ágora no debe descontar stock (y viceversa).
-- Se agrega a empresa_config si existe, si no se crea columna en empresas.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='empresa_config'
  ) then
    alter table public.empresa_config
      add column if not exists pos_descuenta_stock boolean not null default false;
  else
    alter table public.empresas
      add column if not exists pos_descuenta_stock boolean not null default false;
  end if;
end $$;

-- ─── 10. FOREIGN KEYS CONDICIONALES ──────────────────────────
-- Las FKs se crean sólo si la tabla destino existe en la BD.
-- Si aún no has aplicado la migración de `mesas` o de `descuentos`, la FK
-- se creará la próxima vez que ejecutes este script.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='mesas')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_tickets_mesa_id_fkey' and table_name='pos_tickets') then
    alter table public.pos_tickets
      add constraint pos_tickets_mesa_id_fkey
      foreign key (mesa_id) references public.mesas(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='descuentos')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_tickets_descuento_id_fkey' and table_name='pos_tickets') then
    alter table public.pos_tickets
      add constraint pos_tickets_descuento_id_fkey
      foreign key (descuento_id) references public.descuentos(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='profiles')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_tickets_empleado_id_fkey' and table_name='pos_tickets') then
    alter table public.pos_tickets
      add constraint pos_tickets_empleado_id_fkey
      foreign key (empleado_id) references public.profiles(id) on delete set null;

    alter table public.pos_sesiones_caja
      add constraint pos_sesiones_caja_empleado_id_fkey
      foreign key (empleado_id) references public.profiles(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='productos')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_ticket_lineas_producto_id_fkey' and table_name='pos_ticket_lineas') then
    alter table public.pos_ticket_lineas
      add constraint pos_ticket_lineas_producto_id_fkey
      foreign key (producto_id) references public.productos(id) on delete set null;
  end if;
end $$;

-- ─── FIN 035_pos.sql ─────────────────────────────────────────


-- ========================================================
-- ARCHIVO: 036_direccion_presentaciones.sql
-- ========================================================

-- ============================================================
-- 036_direccion_presentaciones.sql
-- Módulo Dirección → submódulo Presentaciones.
--
-- Genera presentaciones con Google Gemini aplicando branding
-- persistente por empresa (logo, colores, tipografías).
--
-- TABLAS:
--   - empresa_branding      : identidad visual persistente por empresa
--   - presentaciones        : biblioteca por empresa
--   - presentacion_slides   : slides individuales (editables/reordenables)
-- ============================================================

-- ─── 1. BRANDING POR EMPRESA ───────────────────────────────
-- Imagen de marca aplicada automáticamente a cada presentación.
-- 1 fila por empresa (PK = empresa_id).

create table if not exists public.empresa_branding (
  empresa_id        uuid primary key references public.empresas(id) on delete cascade,
  logo_url          text,                              -- Supabase Storage (bucket empresa-logos)
  color_primario    text not null default '#0F172A',
  color_secundario  text not null default '#3B82F6',
  color_fondo       text not null default '#FFFFFF',
  color_texto       text not null default '#0F172A',
  tipografia_titulo text not null default 'Inter',
  tipografia_cuerpo text not null default 'Inter',
  fondo_url         text,                              -- imagen de fondo opcional
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function public.set_branding_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists branding_updated_at on public.empresa_branding;
create trigger branding_updated_at
  before update on public.empresa_branding
  for each row execute function public.set_branding_updated_at();

comment on table public.empresa_branding is
  'Imagen de marca persistente por empresa. Aplicada a presentaciones vía branding_snapshot.';

-- ─── 2. PRESENTACIONES (biblioteca) ────────────────────────

create table if not exists public.presentaciones (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,

  -- metadatos de creación
  titulo            text not null,
  prompt_original   text not null,
  audiencia         text,
  tono              text not null default 'formal'
                      check (tono in ('formal','cercano','motivacional','tecnico')),
  idioma            text not null default 'es',
  num_slides        integer not null default 10 check (num_slides between 3 and 30),

  -- estado
  estado            text not null default 'borrador'
                      check (estado in ('borrador','generando','listo','fallida','archivada')),
  error_mensaje     text,

  -- IA
  modelo_ia         text default 'gemini-2.0-flash',
  tokens_input      integer,
  tokens_output     integer,

  -- snapshot del branding al generar (para que editar el branding
  -- no afecte presentaciones antiguas)
  branding_snapshot jsonb not null default '{}',

  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pres_empresa
  on public.presentaciones(empresa_id, created_at desc);
create index if not exists idx_pres_estado
  on public.presentaciones(empresa_id, estado);

create or replace function public.set_presentaciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists presentaciones_updated_at on public.presentaciones;
create trigger presentaciones_updated_at
  before update on public.presentaciones
  for each row execute function public.set_presentaciones_updated_at();

comment on table public.presentaciones is
  'Biblioteca de presentaciones generadas con IA. Slides en presentacion_slides.';

-- ─── 3. SLIDES ─────────────────────────────────────────────
-- Cada slide es una fila. Contenido en JSONB para flexibilidad por layout.

create table if not exists public.presentacion_slides (
  id              uuid primary key default gen_random_uuid(),
  presentacion_id uuid not null references public.presentaciones(id) on delete cascade,
  orden           integer not null,
  layout          text not null default 'bullets'
                    check (layout in ('portada','bullets','cita','comparacion','imagen','cierre')),
  titulo          text,
  contenido       jsonb not null default '{}',   -- { bullets: [], cuerpo, cita, etc. }
  notas           text,                          -- notas del ponente
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (presentacion_id, orden)
);

create index if not exists idx_slides_pres
  on public.presentacion_slides(presentacion_id, orden);

create or replace function public.set_slides_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists slides_updated_at on public.presentacion_slides;
create trigger slides_updated_at
  before update on public.presentacion_slides
  for each row execute function public.set_slides_updated_at();

comment on table public.presentacion_slides is
  'Slides individuales de cada presentación. Editables y reordenables.';

-- ─── 4. RLS ────────────────────────────────────────────────

alter table public.empresa_branding      enable row level security;
alter table public.presentaciones        enable row level security;
alter table public.presentacion_slides   enable row level security;

-- empresa_branding
create policy "brand_read" on public.empresa_branding for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "brand_manage" on public.empresa_branding for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- presentaciones
create policy "pres_read" on public.presentaciones for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pres_manage" on public.presentaciones for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- slides (acceso vía presentación)
create policy "slides_read" on public.presentacion_slides for select to authenticated
  using (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));
create policy "slides_manage" on public.presentacion_slides for all to authenticated
  using (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ))
  with check (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));

-- ─── 5. SEED: branding por defecto para empresas existentes ───

insert into public.empresa_branding (empresa_id)
select id from public.empresas
on conflict (empresa_id) do nothing;


-- ========================================================
-- ARCHIVO: 037_cocina_comandas.sql
-- ========================================================

-- ============================================================
-- 037_cocina_comandas.sql — Panel Comandas (KDS) — submódulo Cocina
-- PRP-027 · Fase 1
--
-- Extiende: pos_ticket_lineas (añade estado_cocina + timestamps + partida + prioridad)
-- Nuevas tablas:
--   cocina_alarmas_config  (umbrales por empresa)
-- Publication:
--   supabase_realtime += pos_ticket_lineas, pos_tickets
-- Trigger:
--   pos_linea_sync_timestamps  (rellena preparando_at/listo_at/servido_at)
-- ============================================================

-- ─── 0. ENUM estado_cocina ───────────────────────────────────
do $$ begin
  create type public.linea_estado_cocina as enum (
    'PENDIENTE','PREPARANDO','LISTO','SERVIDO','CANCELADA'
  );
exception when duplicate_object then null; end $$;

-- ─── 1. Columnas nuevas en pos_ticket_lineas ─────────────────
alter table public.pos_ticket_lineas
  add column if not exists estado_cocina public.linea_estado_cocina not null default 'PENDIENTE',
  add column if not exists preparando_at timestamptz,
  add column if not exists listo_at      timestamptz,
  add column if not exists servido_at    timestamptz,
  add column if not exists partida_id    uuid,
  add column if not exists prioridad     smallint not null default 0;

-- FK opcional a partidas (si existe la tabla)
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='partidas')
     and not exists (select 1 from information_schema.table_constraints
                     where constraint_name='pos_lineas_partida_fkey' and table_name='pos_ticket_lineas') then
    alter table public.pos_ticket_lineas
      add constraint pos_lineas_partida_fkey
      foreign key (partida_id) references public.partidas(id) on delete set null;
  end if;
end $$;

-- Índice parcial para el board (sólo líneas activas del día)
create index if not exists idx_pos_lineas_kds_activas
  on public.pos_ticket_lineas(ticket_id, estado_cocina)
  where enviada_at is not null and estado_cocina <> 'SERVIDO';

-- ─── 2. Tabla de umbrales de alarma por empresa ──────────────
create table if not exists public.cocina_alarmas_config (
  empresa_id          uuid primary key references public.empresas(id) on delete cascade,
  umbral_ambar_min    smallint not null default 8,
  umbral_rojo_min     smallint not null default 15,
  umbral_parpadeo_min smallint not null default 20,
  sonido_activo       boolean  not null default true,
  updated_at          timestamptz not null default now()
);

alter table public.cocina_alarmas_config enable row level security;

drop policy if exists "cocina_alarmas_empresa" on public.cocina_alarmas_config;
create policy "cocina_alarmas_empresa" on public.cocina_alarmas_config
  for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

-- ─── 3. Realtime publication ─────────────────────────────────
-- Idempotente: añade tablas sólo si no están ya en la publication.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pos_ticket_lineas'
  ) then
    execute 'alter publication supabase_realtime add table public.pos_ticket_lineas';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pos_tickets'
  ) then
    execute 'alter publication supabase_realtime add table public.pos_tickets';
  end if;
end $$;

-- ─── 4. Trigger: sincronizar timestamps al cambiar estado_cocina
create or replace function public.pos_linea_sync_timestamps()
returns trigger language plpgsql as $$
begin
  if new.estado_cocina = 'PREPARANDO' and coalesce(old.estado_cocina::text, '') <> 'PREPARANDO' then
    new.preparando_at := coalesce(new.preparando_at, now());
  end if;
  if new.estado_cocina = 'LISTO' and coalesce(old.estado_cocina::text, '') <> 'LISTO' then
    new.listo_at := coalesce(new.listo_at, now());
  end if;
  if new.estado_cocina = 'SERVIDO' and coalesce(old.estado_cocina::text, '') <> 'SERVIDO' then
    new.servido_at := coalesce(new.servido_at, now());
  end if;
  return new;
end $$;

drop trigger if exists trg_pos_linea_sync_ts on public.pos_ticket_lineas;
create trigger trg_pos_linea_sync_ts
  before update on public.pos_ticket_lineas
  for each row execute function public.pos_linea_sync_timestamps();

-- ─── FIN 037_cocina_comandas.sql ─────────────────────────────


-- ========================================================
-- ARCHIVO: 038_carta_digital.sql
-- ========================================================

-- ============================================================
-- 038_carta_digital.sql — Carta Digital pública (PRP-028)
--
-- Tablas nuevas:
--   carta_categorias       (categorías de carta por empresa)
--   carta_items            (platos con foto, precio, alérgenos)
--   carta_item_likes       (1 like por dispositivo, anónimo, RGPD-safe)
--
-- Extensiones:
--   empresas.carta_slug, carta_publicada, carta_horarios, carta_descripcion
--
-- Reutiliza: empresas, productos, profiles
-- ============================================================

-- ─── 0. Slug público en empresas ─────────────────────────────
alter table public.empresas
  add column if not exists carta_slug text unique,
  add column if not exists carta_publicada boolean not null default false,
  add column if not exists carta_horarios jsonb,
  add column if not exists carta_descripcion text;

create index if not exists idx_empresas_carta_slug
  on public.empresas(carta_slug) where carta_slug is not null;

-- ─── 1. Categorías ───────────────────────────────────────────
create table if not exists public.carta_categorias (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  orden        smallint not null default 0,
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_carta_cat_empresa
  on public.carta_categorias(empresa_id, orden);

-- ─── 2. Items (platos) ───────────────────────────────────────
create table if not exists public.carta_items (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  categoria_id      uuid not null references public.carta_categorias(id) on delete cascade,
  producto_id       uuid references public.productos(id) on delete set null,
  nombre            text not null,
  descripcion       text,
  precio            numeric(10,2) not null default 0,
  foto_url          text,
  foto_storage_path text,
  alergenos         text[] not null default '{}',
  orden             smallint not null default 0,
  visible           boolean not null default true,
  destacado         boolean not null default false,
  likes_count       integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_carta_items_cat
  on public.carta_items(categoria_id, orden) where visible = true;

create index if not exists idx_carta_items_destacado
  on public.carta_items(empresa_id, destacado) where destacado = true and visible = true;

-- ─── 3. Likes ────────────────────────────────────────────────
create table if not exists public.carta_item_likes (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.carta_items(id) on delete cascade,
  device_id   text not null,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (item_id, device_id)
);

create index if not exists idx_carta_likes_item
  on public.carta_item_likes(item_id);

create index if not exists idx_carta_likes_iphash_recent
  on public.carta_item_likes(ip_hash, created_at desc);

-- ─── 4. Trigger sync likes_count ─────────────────────────────
create or replace function public.carta_likes_sync()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.carta_items set likes_count = likes_count + 1, updated_at = now() where id = new.item_id;
  elsif tg_op = 'DELETE' then
    update public.carta_items set likes_count = greatest(likes_count - 1, 0), updated_at = now() where id = old.item_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_carta_likes_sync on public.carta_item_likes;
create trigger trg_carta_likes_sync
  after insert or delete on public.carta_item_likes
  for each row execute function public.carta_likes_sync();

-- ─── 5. Trigger updated_at automático ────────────────────────
create or replace function public.carta_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_carta_cat_updated on public.carta_categorias;
create trigger trg_carta_cat_updated before update on public.carta_categorias
  for each row execute function public.carta_set_updated_at();

drop trigger if exists trg_carta_items_updated on public.carta_items;
create trigger trg_carta_items_updated before update on public.carta_items
  for each row execute function public.carta_set_updated_at();

-- ─── 6. RLS ──────────────────────────────────────────────────
alter table public.carta_categorias enable row level security;
alter table public.carta_items      enable row level security;
alter table public.carta_item_likes enable row level security;

-- Lectura pública (anon + auth) sobre empresas con carta_publicada=true
drop policy if exists "carta_cat_public_read" on public.carta_categorias;
create policy "carta_cat_public_read" on public.carta_categorias
  for select to anon, authenticated
  using (
    visible = true and exists (
      select 1 from public.empresas e
      where e.id = empresa_id and e.carta_publicada = true
    )
  );

drop policy if exists "carta_items_public_read" on public.carta_items;
create policy "carta_items_public_read" on public.carta_items
  for select to anon, authenticated
  using (
    visible = true and exists (
      select 1 from public.empresas e
      where e.id = empresa_id and e.carta_publicada = true
    )
  );

-- Escritura admin (filtrado por empresa del profile)
drop policy if exists "carta_cat_admin_write" on public.carta_categorias;
create policy "carta_cat_admin_write" on public.carta_categorias
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "carta_items_admin_write" on public.carta_items;
create policy "carta_items_admin_write" on public.carta_items
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- Likes: insert/delete público (validación anti-spam server-side)
drop policy if exists "carta_likes_public_insert" on public.carta_item_likes;
create policy "carta_likes_public_insert" on public.carta_item_likes
  for insert to anon, authenticated
  with check (true);

drop policy if exists "carta_likes_public_delete" on public.carta_item_likes;
create policy "carta_likes_public_delete" on public.carta_item_likes
  for delete to anon, authenticated
  using (true);

drop policy if exists "carta_likes_public_select" on public.carta_item_likes;
create policy "carta_likes_public_select" on public.carta_item_likes
  for select to anon, authenticated
  using (true);

-- ─── 7. Realtime publication ─────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.carta_items;
exception when duplicate_object then null; end $$;

-- ─── 8. Storage bucket carta-fotos (idempotente) ─────────────
insert into storage.buckets (id, name, public)
values ('carta-fotos', 'carta-fotos', true)
on conflict (id) do nothing;

drop policy if exists "carta_fotos_public_read" on storage.objects;
create policy "carta_fotos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'carta-fotos');

drop policy if exists "carta_fotos_admin_upload" on storage.objects;
create policy "carta_fotos_admin_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'carta-fotos');

drop policy if exists "carta_fotos_admin_update" on storage.objects;
create policy "carta_fotos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'carta-fotos');

drop policy if exists "carta_fotos_admin_delete" on storage.objects;
create policy "carta_fotos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'carta-fotos');


-- ========================================================
-- ARCHIVO: 039_rename_nuevos_platos.sql
-- ========================================================

-- ============================================================
-- 039_rename_nuevos_platos.sql
-- Renombrado del submódulo: NUEVOS PLATOS → NUEVAS RECETAS
--
-- Idempotente:
--   - Si existe la tabla vieja (nuevos_platos): la renombra.
--   - Si no existe ninguna: crea nuevas_recetas desde cero.
--   - Renombra enums si existen (nuevo_plato_* → nueva_receta_*).
-- ============================================================

-- 1) Enums ----------------------------------------------------
do $$
begin
  if exists (select 1 from pg_type where typname='nuevo_plato_estado')
     and not exists (select 1 from pg_type where typname='nueva_receta_estado') then
    execute 'alter type nuevo_plato_estado rename to nueva_receta_estado';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname='nuevo_plato_destino')
     and not exists (select 1 from pg_type where typname='nueva_receta_destino') then
    execute 'alter type nuevo_plato_destino rename to nueva_receta_destino';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname='nueva_receta_estado') then
    create type nueva_receta_estado as enum ('propuesto', 'en_cata', 'aprobado', 'rechazado', 'en_carta');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname='nueva_receta_destino') then
    create type nueva_receta_destino as enum ('cocina', 'sala', 'ambos');
  end if;
end $$;

-- 2) Tabla ----------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='nuevos_platos')
     and not exists (select 1 from information_schema.tables
                     where table_schema='public' and table_name='nuevas_recetas') then
    execute 'alter table public.nuevos_platos rename to nuevas_recetas';
  end if;
end $$;

create table if not exists public.nuevas_recetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  destino nueva_receta_destino not null default 'ambos',
  estado nueva_receta_estado not null default 'propuesto',
  propuesto_por uuid,
  propuesto_por_nombre text,
  fecha date not null default current_date,
  fotos_marketing boolean not null default false,
  cata_1 boolean not null default false,
  cata_2 boolean not null default false,
  grabar_producto boolean not null default false,
  ficha_proveedor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) RLS y policies -------------------------------------------
alter table public.nuevas_recetas enable row level security;

drop policy if exists "platos_read_empresa" on public.nuevas_recetas;
drop policy if exists "platos_insert"       on public.nuevas_recetas;
drop policy if exists "platos_update"       on public.nuevas_recetas;
drop policy if exists "platos_delete"       on public.nuevas_recetas;

drop policy if exists "recetas_read_empresa" on public.nuevas_recetas;
create policy "recetas_read_empresa" on public.nuevas_recetas
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

drop policy if exists "recetas_insert" on public.nuevas_recetas;
create policy "recetas_insert" on public.nuevas_recetas
  for insert to authenticated
  with check (true);

drop policy if exists "recetas_update" on public.nuevas_recetas;
create policy "recetas_update" on public.nuevas_recetas
  for update to authenticated
  using (true);

drop policy if exists "recetas_delete" on public.nuevas_recetas;
create policy "recetas_delete" on public.nuevas_recetas
  for delete to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin','director','gerencia')
  ));


-- ========================================================
-- ARCHIVO: 040_marketing_pagina_web.sql
-- ========================================================

-- ============================================================
-- 040_marketing_pagina_web.sql — Submódulo Página Web (PRP-029)
--
-- Tablas nuevas:
--   paginas_web             (páginas CMS multi-tenant + bloques JSONB)
--   paginas_web_dominios    (custom domains vía Vercel Domains API)
--   paginas_web_versiones   (historial/rollback de publicaciones)
--   leads_web               (capturas de formularios públicos, RGPD)
--
-- Reutiliza: empresas, profiles, carta_items (para bloque menu)
-- Idempotente: DO $$ ... $$ para enums, IF NOT EXISTS para tablas
-- ============================================================

-- ─── 0. Enums ────────────────────────────────────────────────
do $$ begin
  create type pagina_web_tipo as enum ('WEB_PRINCIPAL', 'ONE_PAGE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pagina_web_estado as enum ('BORRADOR', 'PUBLICADA', 'ARCHIVADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bloque_tipo as enum (
    'hero','galeria','menu','reservas','testimonios',
    'cta','formulario','mapa','footer','texto_libre','video'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dominio_estado as enum ('PENDIENTE_DNS','VERIFICADO','ERROR');
exception when duplicate_object then null; end $$;

-- ─── 1. Páginas ──────────────────────────────────────────────
create table if not exists public.paginas_web (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  tipo           pagina_web_tipo not null,
  nombre         text not null,
  slug_interno   text not null,
  bloques        jsonb not null default '[]'::jsonb,
  branding       jsonb,
  seo            jsonb,
  estado         pagina_web_estado not null default 'BORRADOR',
  publicada_at   timestamptz,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (empresa_id, slug_interno)
);

create index if not exists idx_paginas_web_empresa
  on public.paginas_web(empresa_id, estado);

-- ─── 2. Dominios ─────────────────────────────────────────────
create table if not exists public.paginas_web_dominios (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  pagina_id        uuid not null references public.paginas_web(id) on delete cascade,
  hostname         text not null unique,
  es_principal     boolean not null default false,
  estado           dominio_estado not null default 'PENDIENTE_DNS',
  vercel_domain_id text,
  dns_hint         jsonb,
  ssl_activo       boolean not null default false,
  verificado_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_paginas_web_dom_hostname
  on public.paginas_web_dominios(hostname);
create index if not exists idx_paginas_web_dom_pagina
  on public.paginas_web_dominios(pagina_id);

-- ─── 3. Leads públicos ───────────────────────────────────────
create table if not exists public.leads_web (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  pagina_id   uuid references public.paginas_web(id) on delete set null,
  bloque_id   text,
  nombre      text,
  email       text,
  telefono    text,
  mensaje     text,
  payload     jsonb not null default '{}'::jsonb,
  utm         jsonb,
  referrer    text,
  user_agent  text,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_leads_web_empresa_created
  on public.leads_web(empresa_id, created_at desc);

create index if not exists idx_leads_web_iphash_recent
  on public.leads_web(ip_hash, created_at desc);

-- ─── 4. Versiones (historial) ────────────────────────────────
create table if not exists public.paginas_web_versiones (
  id          uuid primary key default gen_random_uuid(),
  pagina_id   uuid not null references public.paginas_web(id) on delete cascade,
  version     integer not null,
  snapshot    jsonb not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (pagina_id, version)
);

create index if not exists idx_paginas_web_ver_pagina
  on public.paginas_web_versiones(pagina_id, version desc);

-- ─── 5. RLS ──────────────────────────────────────────────────
alter table public.paginas_web            enable row level security;
alter table public.paginas_web_dominios   enable row level security;
alter table public.paginas_web_versiones  enable row level security;
alter table public.leads_web              enable row level security;

-- ADMIN: solo su empresa (derivado de profiles.empresa_id)
drop policy if exists "paginas_web_admin_rw" on public.paginas_web;
create policy "paginas_web_admin_rw" on public.paginas_web
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "paginas_web_dom_admin_rw" on public.paginas_web_dominios;
create policy "paginas_web_dom_admin_rw" on public.paginas_web_dominios
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "paginas_web_ver_admin_rw" on public.paginas_web_versiones;
create policy "paginas_web_ver_admin_rw" on public.paginas_web_versiones
  for all to authenticated
  using (pagina_id in (
    select pw.id from public.paginas_web pw
    join public.profiles p on p.empresa_id = pw.empresa_id
    where p.user_id = auth.uid()
  ))
  with check (pagina_id in (
    select pw.id from public.paginas_web pw
    join public.profiles p on p.empresa_id = pw.empresa_id
    where p.user_id = auth.uid()
  ));

-- Leads: lectura admin
drop policy if exists "leads_web_admin_read" on public.leads_web;
create policy "leads_web_admin_read" on public.leads_web
  for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- PÚBLICO ANÓNIMO — lectura de páginas publicadas con dominio verificado
drop policy if exists "paginas_web_public_read" on public.paginas_web;
create policy "paginas_web_public_read" on public.paginas_web
  for select to anon, authenticated
  using (
    estado = 'PUBLICADA'
    and id in (select pagina_id from public.paginas_web_dominios where estado = 'VERIFICADO')
  );

drop policy if exists "paginas_web_dom_public_read" on public.paginas_web_dominios;
create policy "paginas_web_dom_public_read" on public.paginas_web_dominios
  for select to anon, authenticated
  using (estado = 'VERIFICADO');

-- Inserts de leads: server-side con service_role. No se expone policy anon de insert.

-- ─── 6. Triggers ─────────────────────────────────────────────
create or replace function public.paginas_web_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_paginas_web_touch on public.paginas_web;
create trigger trg_paginas_web_touch
  before update on public.paginas_web
  for each row execute function public.paginas_web_touch();

drop trigger if exists trg_paginas_web_dom_touch on public.paginas_web_dominios;
create trigger trg_paginas_web_dom_touch
  before update on public.paginas_web_dominios
  for each row execute function public.paginas_web_touch();

-- Snapshot automático a versiones cuando se publica
create or replace function public.paginas_web_snapshot_on_publish()
returns trigger language plpgsql as $$
declare
  next_ver integer;
begin
  if new.estado = 'PUBLICADA'
     and (old.estado is distinct from 'PUBLICADA'
          or old.bloques is distinct from new.bloques) then
    select coalesce(max(version), 0) + 1 into next_ver
      from public.paginas_web_versiones where pagina_id = new.id;
    insert into public.paginas_web_versiones (pagina_id, version, snapshot, created_by)
      values (new.id, next_ver,
              jsonb_build_object('bloques', new.bloques, 'seo', new.seo, 'branding', new.branding),
              new.created_by);
  end if;
  return new;
end $$;

drop trigger if exists trg_paginas_web_snapshot on public.paginas_web;
create trigger trg_paginas_web_snapshot
  after update on public.paginas_web
  for each row execute function public.paginas_web_snapshot_on_publish();

-- ─── 7. Storage bucket paginas-web-assets ────────────────────
insert into storage.buckets (id, name, public)
values ('paginas-web-assets', 'paginas-web-assets', true)
on conflict (id) do nothing;

drop policy if exists "paginas_web_assets_public_read" on storage.objects;
create policy "paginas_web_assets_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'paginas-web-assets');

drop policy if exists "paginas_web_assets_auth_upload" on storage.objects;
create policy "paginas_web_assets_auth_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'paginas-web-assets');

drop policy if exists "paginas_web_assets_auth_update" on storage.objects;
create policy "paginas_web_assets_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'paginas-web-assets');

drop policy if exists "paginas_web_assets_auth_delete" on storage.objects;
create policy "paginas_web_assets_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'paginas-web-assets');


-- ========================================================
-- ARCHIVO: 041_gestoria_modelos_aeat.sql
-- ========================================================

-- ============================================================
-- 041_gestoria_modelos_aeat.sql — Submódulo MODELOS (PRP-030)
-- Modelos oficiales AEAT (303, 130, 111, 115, 390, 347) con
-- categorización IA de facturas a casillas.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.modelo_aeat_tipo as enum ('303','130','111','115','390','347');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.modelo_aeat_periodo as enum ('Q1','Q2','Q3','Q4','ANUAL');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.modelo_aeat_estado as enum ('BORRADOR','REVISADO','PRESENTADO');
exception when duplicate_object then null;
end $$;

-- ─── 1. MODELOS AEAT ───────────────────────────────────────
-- Un registro = un modelo de un periodo concreto para una empresa

create table if not exists public.modelos_aeat (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  tipo                public.modelo_aeat_tipo not null,
  periodo             public.modelo_aeat_periodo not null,
  ejercicio           integer not null,
  estado              public.modelo_aeat_estado not null default 'BORRADOR',
  casillas            jsonb not null default '{}'::jsonb,
  snapshot_empresa    jsonb,
  fecha_presentacion  timestamptz,
  hash_snapshot       text,
  pdf_url             text,
  fichero_aeat_url    text,
  ia_corrida_en       timestamptz,
  ia_tokens_input     integer,
  ia_tokens_output    integer,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (empresa_id, tipo, periodo, ejercicio)
);

create index if not exists idx_modelos_aeat_empresa on public.modelos_aeat(empresa_id);
create index if not exists idx_modelos_aeat_ejercicio on public.modelos_aeat(empresa_id, ejercicio desc);
create index if not exists idx_modelos_aeat_estado on public.modelos_aeat(empresa_id, estado);

-- ─── 2. ASIGNACIONES factura → casilla ─────────────────────
-- Una fila por cada factura que entra en un modelo (con su casilla)

-- Nota: factura_id es uuid sin FK porque la tabla facturas puede no existir aún
-- en todas las instalaciones. La integridad se garantiza desde la app.
create table if not exists public.asignaciones_modelo (
  id              uuid primary key default gen_random_uuid(),
  modelo_id       uuid not null references public.modelos_aeat(id) on delete cascade,
  factura_id      uuid not null,
  casilla         text not null,
  importe         numeric not null default 0,
  tipo_aporte     text not null default 'base',
  origen          text not null default 'ia',
  confianza_ia    numeric,
  explicacion_ia  text,
  creada_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_asignaciones_modelo_id on public.asignaciones_modelo(modelo_id);
create index if not exists idx_asignaciones_factura_id on public.asignaciones_modelo(factura_id);
create index if not exists idx_asignaciones_modelo_casilla on public.asignaciones_modelo(modelo_id, casilla);

-- ─── 3. REGLAS APRENDIDAS DE CORRECCIONES HUMANAS ──────────

create table if not exists public.reglas_categorizacion_ia (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  patron          jsonb not null,
  modelo_tipo     public.modelo_aeat_tipo not null,
  casilla         text not null,
  activa          boolean not null default true,
  veces_aplicada  integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_reglas_categorizacion_empresa
  on public.reglas_categorizacion_ia(empresa_id);

-- ─── 4. CAMPO IVA DEDUCIBLE PARCIAL EN FACTURAS ────────────
-- Para vehículos al 50 %, gastos mixtos etc. (gotcha del PRP).
-- Sólo se añade si la tabla facturas existe ya.

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'facturas') then
    alter table public.facturas
      add column if not exists iva_deducible_pct numeric not null default 100;
  end if;
exception when others then null;
end $$;

-- ─── 4b. CAMPOS FISCALES EN EMPRESAS (para snapshot AEAT) ──

do $$ begin
  alter table public.empresas
    add column if not exists razon_social text,
    add column if not exists nif text,
    add column if not exists direccion text,
    add column if not exists epigrafe_iae text,
    add column if not exists logo_url text;
exception when others then null;
end $$;

-- ─── 5. RLS ────────────────────────────────────────────────

alter table public.modelos_aeat enable row level security;
alter table public.asignaciones_modelo enable row level security;
alter table public.reglas_categorizacion_ia enable row level security;

drop policy if exists "modelos_aeat_empresa" on public.modelos_aeat;
create policy "modelos_aeat_empresa" on public.modelos_aeat
  for all to authenticated
  using (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  )
  with check (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "asignaciones_modelo_empresa" on public.asignaciones_modelo;
create policy "asignaciones_modelo_empresa" on public.asignaciones_modelo
  for all to authenticated
  using (
    modelo_id in (
      select id from public.modelos_aeat
      where empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
    )
  )
  with check (
    modelo_id in (
      select id from public.modelos_aeat
      where empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
    )
  );

drop policy if exists "reglas_categorizacion_empresa" on public.reglas_categorizacion_ia;
create policy "reglas_categorizacion_empresa" on public.reglas_categorizacion_ia
  for all to authenticated
  using (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  )
  with check (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  );

-- ─── 6. TRIGGERS updated_at ────────────────────────────────

drop trigger if exists modelos_aeat_updated_at on public.modelos_aeat;
create trigger modelos_aeat_updated_at
  before update on public.modelos_aeat
  for each row execute function public.set_updated_at();

-- ─── 7. BLOQUEO DE EDICIÓN EN MODELOS PRESENTADOS ──────────
-- Un modelo PRESENTADO es inmutable (snapshot + hash).

create or replace function public.prevent_update_presentado()
returns trigger language plpgsql as $$
begin
  if old.estado = 'PRESENTADO' and old.hash_snapshot is not null then
    if new.estado <> old.estado
       or new.casillas <> old.casillas
       or new.snapshot_empresa is distinct from old.snapshot_empresa then
      raise exception 'Modelo AEAT presentado (hash=%) es inmutable', old.hash_snapshot;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists modelos_aeat_inmutable on public.modelos_aeat;
create trigger modelos_aeat_inmutable
  before update on public.modelos_aeat
  for each row execute function public.prevent_update_presentado();


-- ========================================================
-- ARCHIVO: 042_nuevas_recetas_pipeline.sql
-- ========================================================

-- ============================================================
-- 042_nuevas_recetas_pipeline.sql  (PRP-031)
-- Pipeline kanban por fases editables para NUEVAS RECETAS.
--
-- Idempotente. Extiende nuevas_recetas (no la rompe) y añade:
--   - Config por empresa: fases, sub-estados, gatekeepers
--   - Borrador de ficha técnica dentro de nuevas_recetas
--   - Ingredientes con prioridad principal/secundario
--   - Compra a proveedor por receta
--   - Catas estructuradas con foto + escandallo snapshot
--   - Historial de movimientos entre fases
--   - Tabla tareas (reemplazo del localStorage del TareasDrawer)
--   - Función seed idempotente de 5 fases por empresa
--   - Migración de datos existentes al nuevo modelo
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Extensión de nuevas_recetas
-- ────────────────────────────────────────────────────────────
alter table public.nuevas_recetas
  add column if not exists fase_id uuid,
  add column if not exists sub_estado_id uuid,
  add column if not exists ficha_tecnica_id uuid,
  add column if not exists estado_general text not null default 'en_progreso'
    check (estado_general in ('en_progreso','aprobada','archivada')),
  add column if not exists fecha_fase_inicio timestamptz default now(),
  add column if not exists datos_gatekeeper jsonb not null default '{}'::jsonb,
  add column if not exists favorita boolean not null default false,
  add column if not exists motivo_archivado text,
  -- Borrador de ficha técnica (NO toca fichas_tecnicas hasta Publicar oficial)
  add column if not exists ft_descripcion text,
  add column if not exists ft_elaboracion text,
  add column if not exists ft_alergenos text[] default '{}',
  add column if not exists ft_partida text,
  add column if not exists ft_tiempo_preparacion int,
  add column if not exists ft_porciones int default 1,
  add column if not exists ft_pvp_propuesto numeric(10,2),
  add column if not exists ft_coste_estimado numeric(10,2),
  add column if not exists ft_etiquetas_finales text[] default '{}';

create index if not exists idx_nuevas_recetas_fase
  on public.nuevas_recetas(empresa_id, fase_id);
create index if not exists idx_nuevas_recetas_estado_general
  on public.nuevas_recetas(empresa_id, estado_general);

-- FK a fichas_tecnicas SOLO si la tabla existe (puede no haber corrido la migración 010)
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='fichas_tecnicas')
     and not exists (select 1 from information_schema.constraint_column_usage
                     where table_name='nuevas_recetas' and constraint_name='nuevas_recetas_ficha_tecnica_id_fkey') then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_ficha_tecnica_id_fkey
      foreign key (ficha_tecnica_id) references public.fichas_tecnicas(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 2. nueva_receta_fase — config por empresa
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_fase (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  color text not null default 'gris'
    check (color in ('azul','naranja','ambar','violeta','rosa','verde','rojo','cian','indigo','gris')),
  orden int not null,
  responsable_departamento text,
  responsable_user_id uuid,
  plazo_dias int,
  es_sistema boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fase_empresa_orden
  on public.nueva_receta_fase(empresa_id, orden);

-- FK diferida ahora que la tabla existe
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name='nuevas_recetas' and constraint_name='nuevas_recetas_fase_id_fkey'
  ) then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_fase_id_fkey
      foreign key (fase_id) references public.nueva_receta_fase(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 3. nueva_receta_sub_estado
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_sub_estado (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references public.nueva_receta_fase(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_sub_estado_fase
  on public.nueva_receta_sub_estado(fase_id, orden);

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name='nuevas_recetas' and constraint_name='nuevas_recetas_sub_estado_id_fkey'
  ) then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_sub_estado_id_fkey
      foreign key (sub_estado_id) references public.nueva_receta_sub_estado(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 4. nueva_receta_gatekeeper — datos obligatorios al entrar a una fase
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_gatekeeper (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references public.nueva_receta_fase(id) on delete cascade,
  campo text not null,
  label text not null,
  tipo text not null check (tipo in ('texto','numero','adjunto','booleano','select','ref')),
  opciones jsonb,
  obligatorio boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gatekeeper_fase
  on public.nueva_receta_gatekeeper(fase_id, orden);

-- ────────────────────────────────────────────────────────────
-- 5. nueva_receta_ingrediente — con prioridad principal/secundario
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_ingrediente (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre_libre text,
  cantidad numeric(10,3),
  unidad text default 'g',
  prioridad text not null default 'secundario'
    check (prioridad in ('principal','secundario')),
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ing_receta
  on public.nueva_receta_ingrediente(receta_id, orden);

-- ────────────────────────────────────────────────────────────
-- 6. nueva_receta_compra — vínculo con Logística
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_compra (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  proveedor_nombre_libre text,
  producto_id uuid references public.productos(id) on delete set null,
  producto_nombre_propuesto text,
  cantidad numeric(10,3),
  unidad text default 'kg',
  precio_propuesto numeric(10,2),
  fecha_recepcion_prevista date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_compra_receta
  on public.nueva_receta_compra(receta_id);

-- ────────────────────────────────────────────────────────────
-- 7. nueva_receta_cata — catas estructuradas
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_cata (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  numero int not null,                              -- 1, 2, 3...
  fecha date not null default current_date,
  valoracion text check (valoracion in
    ('pendiente','rehacer_entera','rehacer_media','semi_aprobada','aprobada')),
  aciertos text,
  mejoras text,
  coste_real numeric(10,2),
  pvp_sugerido numeric(10,2),
  foto_url text,
  escandallo_snapshot jsonb,
  director_user_id uuid,
  director_nombre text,
  created_at timestamptz not null default now(),
  unique (receta_id, numero)
);

create index if not exists idx_cata_receta
  on public.nueva_receta_cata(receta_id, numero);

-- ────────────────────────────────────────────────────────────
-- 8. nueva_receta_historial — cambios de fase
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_historial (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  fase_anterior_id uuid references public.nueva_receta_fase(id) on delete set null,
  fase_anterior_nombre text,
  fase_nueva_id uuid references public.nueva_receta_fase(id) on delete set null,
  fase_nueva_nombre text,
  sub_estado_nuevo_id uuid references public.nueva_receta_sub_estado(id) on delete set null,
  usuario_id uuid,
  usuario_nombre text,
  nota text,
  comunicado boolean not null default false,
  tarea_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_historial_receta
  on public.nueva_receta_historial(receta_id, created_at desc);

-- ────────────────────────────────────────────────────────────
-- 9. tareas — reemplazo persistente del localStorage del TareasDrawer
-- ────────────────────────────────────────────────────────────
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  user_id uuid,                                     -- destinatario (a quien le aparece en drawer)
  titulo text not null,
  descripcion text,
  fecha date not null default current_date,
  hecha boolean not null default false,
  prioridad text not null default 'media' check (prioridad in ('alta','media','baja')),
  tipo text default 'manual'
    check (tipo in ('manual','nueva_receta_fase','sistema')),
  link_url text,
  ref_tabla text,
  ref_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tareas_user_fecha
  on public.tareas(user_id, fecha desc);
create index if not exists idx_tareas_empresa
  on public.tareas(empresa_id);

-- ────────────────────────────────────────────────────────────
-- 10. RLS — activar y policies
-- ────────────────────────────────────────────────────────────
alter table public.nueva_receta_fase          enable row level security;
alter table public.nueva_receta_sub_estado    enable row level security;
alter table public.nueva_receta_gatekeeper    enable row level security;
alter table public.nueva_receta_ingrediente   enable row level security;
alter table public.nueva_receta_compra        enable row level security;
alter table public.nueva_receta_cata          enable row level security;
alter table public.nueva_receta_historial     enable row level security;
alter table public.tareas                     enable row level security;

-- fase: por empresa
drop policy if exists "fase_read"   on public.nueva_receta_fase;
drop policy if exists "fase_write"  on public.nueva_receta_fase;
create policy "fase_read" on public.nueva_receta_fase for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "fase_write" on public.nueva_receta_fase for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- sub_estado / gatekeeper: vía fase
drop policy if exists "sub_read"   on public.nueva_receta_sub_estado;
drop policy if exists "sub_write"  on public.nueva_receta_sub_estado;
create policy "sub_read" on public.nueva_receta_sub_estado for select to authenticated
  using (exists (select 1 from public.nueva_receta_fase f
                 where f.id = fase_id
                   and f.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "sub_write" on public.nueva_receta_sub_estado for all to authenticated
  using (true) with check (true);

drop policy if exists "gk_read"   on public.nueva_receta_gatekeeper;
drop policy if exists "gk_write"  on public.nueva_receta_gatekeeper;
create policy "gk_read" on public.nueva_receta_gatekeeper for select to authenticated
  using (exists (select 1 from public.nueva_receta_fase f
                 where f.id = fase_id
                   and f.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "gk_write" on public.nueva_receta_gatekeeper for all to authenticated
  using (true) with check (true);

-- ingrediente / compra / cata / historial: vía receta
drop policy if exists "ing_read"   on public.nueva_receta_ingrediente;
drop policy if exists "ing_write"  on public.nueva_receta_ingrediente;
create policy "ing_read" on public.nueva_receta_ingrediente for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "ing_write" on public.nueva_receta_ingrediente for all to authenticated
  using (true) with check (true);

drop policy if exists "compra_read"   on public.nueva_receta_compra;
drop policy if exists "compra_write"  on public.nueva_receta_compra;
create policy "compra_read" on public.nueva_receta_compra for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "compra_write" on public.nueva_receta_compra for all to authenticated
  using (true) with check (true);

drop policy if exists "cata_read"   on public.nueva_receta_cata;
drop policy if exists "cata_write"  on public.nueva_receta_cata;
create policy "cata_read" on public.nueva_receta_cata for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "cata_write" on public.nueva_receta_cata for all to authenticated
  using (true) with check (true);

drop policy if exists "hist_read"   on public.nueva_receta_historial;
drop policy if exists "hist_write"  on public.nueva_receta_historial;
create policy "hist_read" on public.nueva_receta_historial for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "hist_write" on public.nueva_receta_historial for all to authenticated
  using (true) with check (true);

-- tareas: el user solo ve las suyas o las creadas por él en su empresa
drop policy if exists "tareas_read"   on public.tareas;
drop policy if exists "tareas_write"  on public.tareas;
create policy "tareas_read" on public.tareas for select to authenticated
  using (
    user_id = auth.uid()
    or created_by = auth.uid()
    or empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );
create policy "tareas_write" on public.tareas for all to authenticated
  using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- 11. Función seed idempotente — 5 fases por empresa
-- ────────────────────────────────────────────────────────────
create or replace function public.ensure_nueva_receta_seed(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_fase_id uuid;
begin
  select count(*) into v_count from public.nueva_receta_fase where empresa_id = p_empresa_id;
  if v_count > 0 then return; end if;

  -- Fase 1: Propuesta
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Propuesta de receta', 'azul', 1, 3)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Borrador', 1),
    (v_fase_id, 'Presentada', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'nombre', 'Nombre de la receta', 'texto', true, 1);

  -- Fase 2: Propuesta de compra
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Propuesta de compra', 'naranja', 2, 7)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Buscando proveedor', 1),
    (v_fase_id, 'Precios recibidos', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'ingredientes_con_prioridad', 'Ingredientes etiquetados (principal/secundario)', 'booleano', true, 1);

  -- Fase 3: Primera cata
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Primera cata', 'ambar', 3, 14)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Cata programada', 1),
    (v_fase_id, 'Cata realizada', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'compra_registrada', 'Proveedor y productos seleccionados', 'booleano', true, 1);

  -- Fase 4: Segunda cata
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Segunda cata', 'violeta', 4, 7)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Cata programada', 1),
    (v_fase_id, 'Cata realizada', 2),
    (v_fase_id, 'Etiquetas finales', 3);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'cata_1_registrada', 'Primera cata realizada y valorada', 'booleano', true, 1);

  -- Fase 5: Marketing y carta
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Marketing y carta', 'verde', 5, 14)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Fotos pendientes', 1),
    (v_fase_id, 'Publicada oficial', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'cata_2_aprobada', 'Segunda cata aprobada o semi-aprobada', 'booleano', true, 1),
    (v_fase_id, 'etiquetas_finales', 'Etiquetas finales definidas', 'booleano', true, 2);
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 12. Migración de datos existentes (idempotente)
--    Mapea recetas viejas (enum `estado`) a fase correspondiente.
-- ────────────────────────────────────────────────────────────
do $$
declare
  r record;
  v_fase_id uuid;
  v_fase_nombre text;
begin
  -- Seed para todas las empresas con recetas existentes
  for r in (select distinct empresa_id from public.nuevas_recetas where fase_id is null) loop
    perform public.ensure_nueva_receta_seed(r.empresa_id);
  end loop;

  -- Mapear estado viejo → fase nueva
  for r in (select id, empresa_id, estado from public.nuevas_recetas where fase_id is null) loop
    v_fase_nombre := case r.estado
      when 'propuesto' then 'Propuesta de receta'
      when 'en_cata' then 'Primera cata'
      when 'aprobado' then 'Marketing y carta'
      when 'rechazado' then 'Propuesta de receta'  -- se marcará como archivada
      when 'en_carta' then 'Marketing y carta'
      else 'Propuesta de receta'
    end;

    select id into v_fase_id from public.nueva_receta_fase
      where empresa_id = r.empresa_id and nombre = v_fase_nombre limit 1;

    update public.nuevas_recetas set
      fase_id = v_fase_id,
      estado_general = case
        when r.estado = 'rechazado' then 'archivada'
        when r.estado in ('aprobado','en_carta') then 'aprobada'
        else 'en_progreso'
      end,
      fecha_fase_inicio = coalesce(fecha_fase_inicio, now())
    where id = r.id;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────
-- 13. Storage bucket para fotos de cata (QR móvil)
--     Si ya existe no hace nada.
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('nuevas-recetas-fotos-cata', 'nuevas-recetas-fotos-cata', false)
  on conflict (id) do nothing;

-- Policy de lectura: authenticated users de la empresa
drop policy if exists "recetas_fotos_read" on storage.objects;
create policy "recetas_fotos_read" on storage.objects for select to authenticated
  using (bucket_id = 'nuevas-recetas-fotos-cata');

drop policy if exists "recetas_fotos_write" on storage.objects;
create policy "recetas_fotos_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'nuevas-recetas-fotos-cata');

drop policy if exists "recetas_fotos_update" on storage.objects;
create policy "recetas_fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'nuevas-recetas-fotos-cata');

drop policy if exists "recetas_fotos_delete" on storage.objects;
create policy "recetas_fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'nuevas-recetas-fotos-cata');

-- ────────────────────────────────────────────────────────────
-- 14. Trigger de updated_at
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fase_updated on public.nueva_receta_fase;
create trigger trg_fase_updated before update on public.nueva_receta_fase
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tareas_updated on public.tareas;
create trigger trg_tareas_updated before update on public.tareas
  for each row execute function public.set_updated_at();

-- ============================================================
-- FIN migración 042
-- ============================================================


-- ========================================================
-- ARCHIVO: 043_fichas_tecnicas_repair.sql
-- ========================================================

-- ============================================================
-- 043_fichas_tecnicas_repair.sql
-- Re-crea fichas_tecnicas + ingredientes_ficha si no existen.
-- (La migración 010 parece no haber corrido en este proyecto.)
--
-- Además: añade el FK nuevas_recetas.ficha_tecnica_id → fichas_tecnicas(id)
-- que quedó pendiente en 042 por la ausencia de la tabla destino.
--
-- Idempotente — seguro de re-ejecutar.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Tabla fichas_tecnicas
-- ────────────────────────────────────────────────────────────
create table if not exists public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  categoria text,
  estado text not null default 'Activa'
    check (estado in ('Activa','Inactiva','Archivada','Borrador')),
  partida text,
  porciones integer default 1,
  tiempo_preparacion integer,          -- minutos
  elaboracion text,
  descripcion text,
  coste_total numeric(10,2) default 0,
  pvp numeric(10,2) default 0,
  margen_pct numeric(5,2) default 0,
  alergenos text[] default '{}',
  etiquetas text[] default '{}',
  foto_url text,
  notas text,
  origen_receta_id uuid,               -- vínculo inverso a nuevas_recetas (si nació de un pipeline)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_fichas_tecnicas_empresa
  on public.fichas_tecnicas(empresa_id);
create index if not exists idx_fichas_tecnicas_nombre
  on public.fichas_tecnicas(empresa_id, nombre);

-- ────────────────────────────────────────────────────────────
-- 2. Tabla ingredientes_ficha
-- ────────────────────────────────────────────────────────────
create table if not exists public.ingredientes_ficha (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas_tecnicas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre text not null,
  cantidad numeric(10,3) not null default 0,
  unidad text not null default 'g',
  coste_unitario numeric(10,2) default 0,
  coste_total numeric(10,2) default 0,
  prioridad text not null default 'secundario'
    check (prioridad in ('principal','secundario')),
  orden integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingredientes_ficha
  on public.ingredientes_ficha(ficha_id, orden);

-- ────────────────────────────────────────────────────────────
-- 3. RLS
-- ────────────────────────────────────────────────────────────
alter table public.fichas_tecnicas   enable row level security;
alter table public.ingredientes_ficha enable row level security;

drop policy if exists "ft_read"   on public.fichas_tecnicas;
drop policy if exists "ft_write"  on public.fichas_tecnicas;
create policy "ft_read" on public.fichas_tecnicas for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "ft_write" on public.fichas_tecnicas for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "if_read"   on public.ingredientes_ficha;
drop policy if exists "if_write"  on public.ingredientes_ficha;
create policy "if_read" on public.ingredientes_ficha for select to authenticated
  using (exists (select 1 from public.fichas_tecnicas f
                 where f.id = ficha_id
                   and f.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "if_write" on public.ingredientes_ficha for all to authenticated
  using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- 4. Ahora que fichas_tecnicas existe, cerrar el FK pendiente de 042
--    Usa pg_constraint (fiable) en vez de information_schema.
-- ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where c.conname = 'nuevas_recetas_ficha_tecnica_id_fkey'
      and t.relname = 'nuevas_recetas'
      and n.nspname = 'public'
  ) then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_ficha_tecnica_id_fkey
      foreign key (ficha_tecnica_id)
      references public.fichas_tecnicas(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 5. Trigger updated_at
-- ────────────────────────────────────────────────────────────
drop trigger if exists trg_fichas_tecnicas_updated on public.fichas_tecnicas;
create trigger trg_fichas_tecnicas_updated before update on public.fichas_tecnicas
  for each row execute function public.set_updated_at();

-- ============================================================
-- FIN migración 043
-- ============================================================


-- ========================================================
-- ARCHIVO: 044_marketing_campanas.sql
-- ========================================================

-- ============================================================
-- 044_marketing_campanas.sql — Submódulo Campañas (Marketing)
--
-- Tabla única `campanas_marketing` que almacena los 3 canales
-- (email, whatsapp, meta) con un campo JSONB `payload` que contiene
-- la configuración específica de cada canal.
--
-- Por qué una sola tabla:
--  - Los 3 canales comparten 90% de campos (nombre, estado, empresa,
--    estadísticas, fechas). Unificar simplifica el listado, filtros
--    y dashboards.
--  - El payload JSONB permite evolucionar la configuración de cada
--    canal sin migraciones extra.
--
-- Reutiliza: empresas, profiles
-- Idempotente: DO $$ ... $$ para enums, IF NOT EXISTS para tablas
-- ============================================================

-- ─── 0. Enums ────────────────────────────────────────────────
do $$ begin
  create type canal_campana as enum ('email', 'whatsapp', 'meta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_campana as enum (
    'borrador', 'programada', 'activa', 'pausada', 'finalizada', 'fallida'
  );
exception when duplicate_object then null; end $$;

-- ─── 1. Tabla principal ──────────────────────────────────────
create table if not exists public.campanas_marketing (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  canal             canal_campana not null,
  nombre            text not null,
  estado            estado_campana not null default 'borrador',
  segmento          text,
  fecha_envio       timestamptz,
  fecha_inicio      timestamptz,
  fecha_fin         timestamptz,
  -- Configuración canal-específica (asunto, cuerpo, plantilla,
  -- objetivo, presupuesto, público, creatividad...)
  payload           jsonb not null default '{}'::jsonb,
  -- Estadísticas (enviados, abiertos, clicks, gasto...)
  estadisticas      jsonb not null default '{}'::jsonb,
  -- Referencias externas (Meta, Resend, WhatsApp)
  meta_campaign_id  text,
  meta_adset_id     text,
  meta_ad_id        text,
  meta_synced_at    timestamptz,
  meta_sync_error   text,
  resend_batch_id   text,
  whatsapp_job_id   text,
  -- Metadatos
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_campanas_empresa on public.campanas_marketing (empresa_id);
create index if not exists idx_campanas_canal   on public.campanas_marketing (empresa_id, canal);
create index if not exists idx_campanas_estado  on public.campanas_marketing (empresa_id, estado);

-- ─── 2. Trigger updated_at ───────────────────────────────────
create or replace function public.campanas_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_campanas_updated_at on public.campanas_marketing;
create trigger trg_campanas_updated_at
  before update on public.campanas_marketing
  for each row execute function public.campanas_set_updated_at();

-- ─── 3. RLS ──────────────────────────────────────────────────
alter table public.campanas_marketing enable row level security;

drop policy if exists campanas_select_own on public.campanas_marketing;
create policy campanas_select_own on public.campanas_marketing
  for select using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists campanas_insert_own on public.campanas_marketing;
create policy campanas_insert_own on public.campanas_marketing
  for insert with check (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists campanas_update_own on public.campanas_marketing;
create policy campanas_update_own on public.campanas_marketing
  for update using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists campanas_delete_own on public.campanas_marketing;
create policy campanas_delete_own on public.campanas_marketing
  for delete using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

comment on table public.campanas_marketing is
  'Campañas de marketing multi-canal (email, whatsapp, meta). El payload JSONB contiene la configuración específica de cada canal.';


-- ============================================================
-- FIN DEL BUNDLE — refresca PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
