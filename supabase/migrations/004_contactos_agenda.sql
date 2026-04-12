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
