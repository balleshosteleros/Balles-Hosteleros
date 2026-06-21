-- PRP-063 Fase 7: hardening de los objetos creados en el saneamiento.
-- 1) RLS en la tabla de backup (solo service-role la necesita): sin política =
--    denegado a clientes, abierto a service-role. Limpia el advisor ERROR
--    rls_disabled_in_public.
-- 2) search_path fijo en el trigger sync_usuario_rol_id (limpia el WARN
--    function_search_path_mutable). Idempotente.

alter table public._roles_backup_063 enable row level security;

create or replace function public.sync_usuario_rol_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_nombre text;
  v_es_admin boolean;
begin
  if new.rol_label is not null and new.empresa_id is not null then
    if tg_op = 'UPDATE'
       and new.rol_label is not distinct from old.rol_label
       and new.empresa_id is not distinct from old.empresa_id
       and new.rol_id is not null then
      return new;
    end if;
    select er.id, er.nombre, er.es_admin_plataforma
      into v_id, v_nombre, v_es_admin
    from public.empresa_roles er
    where er.empresa_id = new.empresa_id and er.nombre ilike new.rol_label
    limit 1;
    new.rol_id := v_id;
    new.role := case when v_es_admin then 'admin' else 'empleado' end;
    if v_nombre is not null then
      new.rol_label := v_nombre;
    end if;
  end if;
  return new;
end;
$$;
