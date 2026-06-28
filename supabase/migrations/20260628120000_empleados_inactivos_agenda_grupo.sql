-- ===========================================================================
-- Agenda: empleados y proveedores inactivos pasan a su propio grupo
--         ("empleados_inactivos" / "proveedores_inactivos")
-- ---------------------------------------------------------------------------
-- Hasta ahora todos los contactos espejo de empleados/proveedores quedaban en
-- 'empleados' / 'proveedores' (los inactivos solo con una etiqueta gris). A
-- partir de ahora, al desactivar el origen su contacto se mueve al grupo
-- "_inactivos" y al reactivarlo vuelve al grupo activo. La columna `categoria`
-- es text, así que no hace falta tocar ningún enum.
-- Idempotente: CREATE OR REPLACE + UPDATEs condicionales.
-- ===========================================================================

-- 0. Ampliar el CHECK de `categoria` con los dos grupos nuevos
alter table public.contactos_agenda
  drop constraint if exists contactos_agenda_categoria_check;
alter table public.contactos_agenda
  add constraint contactos_agenda_categoria_check
  check (categoria = any (array[
    'mantenimiento','proveedores','proveedores_inactivos',
    'servicios','emergencias','empleados','empleados_inactivos','otros'
  ]::text[]));

create or replace function public.sync_empleado_to_contacto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre    text;
  v_activo    boolean;
  v_estado    text;
  v_categoria text;
begin
  v_nombre := trim(coalesce(new.nombre,'') || ' ' || coalesce(new.apellidos,''));
  if v_nombre = '' then v_nombre := 'Empleado'; end if;
  v_activo := (coalesce(new.estado,'Activo') = 'Activo');
  v_estado := case when v_activo then null else new.estado end;
  v_categoria := case when v_activo then 'empleados' else 'empleados_inactivos' end;

  update public.contactos_agenda
     set nombre        = v_nombre,
         telefono      = new.telefono,
         email         = coalesce(new.email_empresa, new.email_personal),
         categoria     = v_categoria,
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
      (new.empresa_id, v_nombre, v_categoria, new.telefono,
       coalesce(new.email_empresa, new.email_personal),
       'empleado', true, v_activo, v_estado, new.id)
    on conflict (empresa_id, empleado_id) where empleado_id is not null do nothing;
  end if;

  return new;
end;
$$;

-- El trigger ya existe y escucha cambios de `estado`; no hace falta recrearlo.

-- Backfill: empleados ya inactivos → grupo nuevo
update public.contactos_agenda
   set categoria = 'empleados_inactivos', updated_at = now()
 where origen = 'empleado' and activo = false and categoria = 'empleados';

-- Reasegurar coherencia inversa: activos que estuvieran en el grupo inactivos
update public.contactos_agenda
   set categoria = 'empleados', updated_at = now()
 where origen = 'empleado' and activo = true and categoria = 'empleados_inactivos';

-- ---------------------------------------------------------------------------
-- Proveedores: mismo comportamiento
-- ---------------------------------------------------------------------------
create or replace function public.sync_proveedor_to_contacto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre    text;
  v_activo    boolean;
  v_estado    text;
  v_categoria text;
begin
  -- nombre = comercial (persona de contacto); si no hay, el nombre comercial de la empresa
  v_nombre := nullif(trim(coalesce(new.persona_contacto,'')), '');
  if v_nombre is null then v_nombre := coalesce(new.nombre_comercial, 'Proveedor'); end if;
  v_activo := (lower(coalesce(new.estado,'Activo')) = 'activo');
  v_estado := case when v_activo then null else new.estado end;
  v_categoria := case when v_activo then 'proveedores' else 'proveedores_inactivos' end;

  update public.contactos_agenda
     set nombre           = v_nombre,
         empresa_contacto = new.nombre_comercial,
         telefono         = coalesce(new.telefono_comercial, new.telefono_principal),
         email            = coalesce(new.email_comercial, new.email_principal),
         categoria        = v_categoria,
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
      (new.empresa_id, v_nombre, new.nombre_comercial, v_categoria,
       coalesce(new.telefono_comercial, new.telefono_principal),
       coalesce(new.email_comercial, new.email_principal),
       'proveedor', true, v_activo, v_estado, new.id)
    on conflict (empresa_id, proveedor_id) where proveedor_id is not null do nothing;
  end if;

  return new;
end;
$$;

-- El trigger ya existe y escucha cambios de `estado`; no hace falta recrearlo.

-- Backfill: proveedores ya inactivos → grupo nuevo
update public.contactos_agenda
   set categoria = 'proveedores_inactivos', updated_at = now()
 where origen = 'proveedor' and activo = false and categoria = 'proveedores';

-- Reasegurar coherencia inversa
update public.contactos_agenda
   set categoria = 'proveedores', updated_at = now()
 where origen = 'proveedor' and activo = true and categoria = 'proveedores_inactivos';
