-- ─── Contactos de la Agenda · sincronización automática ───────────────────
-- 1) Contactos de EMERGENCIA por defecto en cada empresa (no se pueden borrar).
-- 2) Cada EMPLEADO de alta se refleja como contacto (nombre + apellidos +
--    teléfono). Al darse de baja/desactivarse, el contacto se CONSERVA con una
--    etiqueta de estado; nunca se borra automáticamente.
-- 3) Cada PROVEEDOR de alta se refleja como contacto: nombre = comercial
--    (persona de contacto), empresa a la que pertenece = nombre_comercial,
--    teléfono del comercial. Al pasar a inactivo, etiqueta de estado y se
--    conserva.
--
-- Multi-tenant: aplica a TODAS las empresas actuales y futuras (trigger en
-- empresas + backfill al final). No toca una empresa concreta.

-- ===========================================================================
-- 0. Columnas de soporte en contactos_agenda
-- ===========================================================================
alter table public.contactos_agenda
  add column if not exists origen        text    not null default 'manual',
  add column if not exists protegido     boolean not null default false,
  add column if not exists activo        boolean not null default true,
  add column if not exists estado_origen text,
  add column if not exists empleado_id   uuid references public.empleados(id)   on delete set null,
  add column if not exists proveedor_id  uuid references public.proveedores(id) on delete set null;

do $$ begin
  alter table public.contactos_agenda
    add constraint contactos_agenda_origen_check
    check (origen in ('manual','sistema','empleado','proveedor'));
exception when duplicate_object then null;
end $$;

comment on column public.contactos_agenda.origen is
  'manual = creado a mano | sistema = emergencias por defecto | empleado | proveedor (sincronizado)';
comment on column public.contactos_agenda.protegido is
  'true = no se puede borrar desde la UI (emergencias por defecto y contactos sincronizados)';
comment on column public.contactos_agenda.activo is
  'Refleja el estado de la fuente (empleado/proveedor). false = mostrar etiqueta de estado_origen.';
comment on column public.contactos_agenda.estado_origen is
  'Texto del estado de la fuente cuando no está activo (ej. Desactivado, Baja temporal, Inactivo).';

-- Idempotencia de la sincronización: un contacto por empleado / proveedor / empresa.
create unique index if not exists uq_contactos_agenda_empleado
  on public.contactos_agenda(empresa_id, empleado_id) where empleado_id is not null;
create unique index if not exists uq_contactos_agenda_proveedor
  on public.contactos_agenda(empresa_id, proveedor_id) where proveedor_id is not null;
-- Idempotencia de las emergencias por defecto: una por nombre dentro de la empresa.
create unique index if not exists uq_contactos_agenda_sistema
  on public.contactos_agenda(empresa_id, nombre) where origen = 'sistema';

create index if not exists idx_contactos_agenda_empleado on public.contactos_agenda(empleado_id);
create index if not exists idx_contactos_agenda_proveedor on public.contactos_agenda(proveedor_id);

-- ===========================================================================
-- 1. Emergencias por defecto (por empresa)
-- ===========================================================================
create or replace function public.seed_contactos_emergencia(p_empresa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.contactos_agenda
    (empresa_id, nombre, empresa_contacto, categoria, telefono, notas, origen, protegido, activo)
  values
    (p_empresa, 'Emergencias',              'Teléfono único de emergencias', 'emergencias', '112', 'Bomberos, policía y sanitario. Cobertura nacional.', 'sistema', true, true),
    (p_empresa, 'Policía Nacional',         null, 'emergencias', '091', null, 'sistema', true, true),
    (p_empresa, 'Guardia Civil',            null, 'emergencias', '062', null, 'sistema', true, true),
    (p_empresa, 'Policía Local',            null, 'emergencias', '092', null, 'sistema', true, true),
    (p_empresa, 'Bomberos',                 null, 'emergencias', '080', null, 'sistema', true, true),
    (p_empresa, 'Emergencias sanitarias',   'Ambulancias', 'emergencias', '061', null, 'sistema', true, true),
    (p_empresa, 'Información toxicológica', 'Instituto Nacional de Toxicología', 'emergencias', '915 620 420', 'Intoxicaciones (24 h).', 'sistema', true, true)
  on conflict (empresa_id, nombre) where origen = 'sistema' do nothing;
end;
$$;

create or replace function public.tg_seed_contactos_emergencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_contactos_emergencia(new.id);
  return new;
end;
$$;

drop trigger if exists empresas_seed_contactos_emergencia on public.empresas;
create trigger empresas_seed_contactos_emergencia
  after insert on public.empresas
  for each row execute function public.tg_seed_contactos_emergencia();

-- ===========================================================================
-- 2. Empleado → contacto
-- ===========================================================================
create or replace function public.sync_empleado_to_contacto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre   text;
  v_activo   boolean;
  v_estado   text;
begin
  v_nombre := trim(coalesce(new.nombre,'') || ' ' || coalesce(new.apellidos,''));
  if v_nombre = '' then v_nombre := 'Empleado'; end if;
  v_activo := (coalesce(new.estado,'Activo') = 'Activo');
  v_estado := case when v_activo then null else new.estado end;

  update public.contactos_agenda
     set nombre        = v_nombre,
         telefono      = new.telefono,
         email         = coalesce(new.email_empresa, new.email_personal),
         categoria     = 'empleados',
         activo        = v_activo,
         estado_origen = v_estado,
         empresa_id    = new.empresa_id,
         updated_at    = now()
   where empleado_id = new.id;

  if not found then
    insert into public.contactos_agenda
      (empresa_id, nombre, categoria, telefono, email,
       origen, protegido, activo, estado_origen, empleado_id)
    values
      (new.empresa_id, v_nombre, 'empleados', new.telefono,
       coalesce(new.email_empresa, new.email_personal),
       'empleado', true, v_activo, v_estado, new.id)
    on conflict (empresa_id, empleado_id) where empleado_id is not null do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists empleados_sync_contacto on public.empleados;
create trigger empleados_sync_contacto
  after insert or update of nombre, apellidos, telefono, email_empresa, email_personal, estado, empresa_id
  on public.empleados
  for each row execute function public.sync_empleado_to_contacto();

-- ===========================================================================
-- 3. Proveedor → contacto
-- ===========================================================================
create or replace function public.sync_proveedor_to_contacto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre   text;
  v_activo   boolean;
  v_estado   text;
begin
  -- nombre = comercial (persona de contacto); si no hay, el nombre comercial de la empresa
  v_nombre := nullif(trim(coalesce(new.persona_contacto,'')), '');
  if v_nombre is null then v_nombre := coalesce(new.nombre_comercial, 'Proveedor'); end if;
  v_activo := (lower(coalesce(new.estado,'Activo')) = 'activo');
  v_estado := case when v_activo then null else new.estado end;

  update public.contactos_agenda
     set nombre           = v_nombre,
         empresa_contacto = new.nombre_comercial,
         telefono         = coalesce(new.telefono_comercial, new.telefono_principal),
         email            = coalesce(new.email_comercial, new.email_principal),
         categoria        = 'proveedores',
         activo           = v_activo,
         estado_origen    = v_estado,
         empresa_id       = new.empresa_id,
         updated_at       = now()
   where proveedor_id = new.id;

  if not found then
    insert into public.contactos_agenda
      (empresa_id, nombre, empresa_contacto, categoria, telefono, email,
       origen, protegido, activo, estado_origen, proveedor_id)
    values
      (new.empresa_id, v_nombre, new.nombre_comercial, 'proveedores',
       coalesce(new.telefono_comercial, new.telefono_principal),
       coalesce(new.email_comercial, new.email_principal),
       'proveedor', true, v_activo, v_estado, new.id)
    on conflict (empresa_id, proveedor_id) where proveedor_id is not null do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists proveedores_sync_contacto on public.proveedores;
create trigger proveedores_sync_contacto
  after insert or update of persona_contacto, nombre_comercial, telefono_comercial,
    telefono_principal, email_comercial, email_principal, estado, empresa_id
  on public.proveedores
  for each row execute function public.sync_proveedor_to_contacto();

-- ===========================================================================
-- 4. Backfill (empresas, empleados y proveedores existentes)
-- ===========================================================================
do $$
declare r record;
begin
  for r in select id from public.empresas loop
    perform public.seed_contactos_emergencia(r.id);
  end loop;

  -- Empleados existentes
  insert into public.contactos_agenda
    (empresa_id, nombre, categoria, telefono, email,
     origen, protegido, activo, estado_origen, empleado_id)
  select
    e.empresa_id,
    coalesce(nullif(trim(coalesce(e.nombre,'') || ' ' || coalesce(e.apellidos,'')), ''), 'Empleado'),
    'empleados',
    e.telefono,
    coalesce(e.email_empresa, e.email_personal),
    'empleado', true,
    (coalesce(e.estado,'Activo') = 'Activo'),
    case when coalesce(e.estado,'Activo') = 'Activo' then null else e.estado end,
    e.id
  from public.empleados e
  on conflict (empresa_id, empleado_id) where empleado_id is not null do nothing;

  -- Proveedores existentes
  insert into public.contactos_agenda
    (empresa_id, nombre, empresa_contacto, categoria, telefono, email,
     origen, protegido, activo, estado_origen, proveedor_id)
  select
    p.empresa_id,
    coalesce(nullif(trim(coalesce(p.persona_contacto,'')), ''), p.nombre_comercial, 'Proveedor'),
    p.nombre_comercial,
    'proveedores',
    coalesce(p.telefono_comercial, p.telefono_principal),
    coalesce(p.email_comercial, p.email_principal),
    'proveedor', true,
    (lower(coalesce(p.estado,'Activo')) = 'activo'),
    case when lower(coalesce(p.estado,'Activo')) = 'activo' then null else p.estado end,
    p.id
  from public.proveedores p
  on conflict (empresa_id, proveedor_id) where proveedor_id is not null do nothing;
end $$;
