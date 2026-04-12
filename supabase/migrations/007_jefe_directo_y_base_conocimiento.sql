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
create policy if not exists "base_conocimiento_read_authenticated"
  on public.base_conocimiento
  for select
  to authenticated
  using (true);

-- Solo admin/director pueden escribir
create policy if not exists "base_conocimiento_write_admin"
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
create type if not exists soporte_ticket_estado as enum (
  'abierto',
  'asignado',
  'en_curso',
  'resuelto',
  'cerrado'
);

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
create policy if not exists "tickets_read_propios"
  on public.soporte_tickets
  for select
  to authenticated
  using (empleado_id = auth.uid());

-- El jefe ve los tickets en los que está asignado
create policy if not exists "tickets_read_como_jefe"
  on public.soporte_tickets
  for select
  to authenticated
  using (jefe_id = auth.uid());

-- Admin/director ven todos
create policy if not exists "tickets_read_admin"
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
create policy if not exists "tickets_insert_propios"
  on public.soporte_tickets
  for insert
  to authenticated
  with check (empleado_id = auth.uid());

-- El jefe puede actualizar los tickets que le tocan
create policy if not exists "tickets_update_como_jefe"
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
