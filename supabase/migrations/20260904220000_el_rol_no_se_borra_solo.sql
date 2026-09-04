-- El rol de un usuario ya no se borra solo.
--
-- `sync_usuario_rol_id` enlaza `usuarios.rol_label` con `empresa_roles` y deja el
-- id en `usuarios.rol_id`. Hacía la asignación SIN comprobar si había encontrado
-- rol: `new.rol_id := v_id`. Si la búsqueda no daba resultado —porque en ese
-- instante la empresa aún no tenía ese rol creado, o el usuario se movía de
-- empresa— v_id era NULL y el trigger BORRABA un enlace que estaba bien.
--
-- Un usuario sin `rol_id` se queda sin permisos: el menú lateral filtra por los
-- permisos del rol, así que "Mis departamentos" aparecía vacío. Le pasó a la
-- cuenta de dirección de HABANA.
--
-- Ahora, si no hay rol que enlazar, el trigger deja el enlace anterior como
-- estaba en vez de vaciarlo. Un cambio real de rol se sigue reflejando: eso
-- ocurre cuando SÍ se encuentra el nuevo rol.
create or replace function public.sync_usuario_rol_id()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
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

    -- Sin rol encontrado no tocamos nada: mejor conservar el enlace vigente que
    -- dejar al usuario sin permisos.
    if v_id is null then
      return new;
    end if;

    new.rol_id := v_id;
    new.role := case when v_es_admin then 'admin' else 'empleado' end;
    if v_nombre is not null then
      new.rol_label := v_nombre;
    end if;
  end if;
  return new;
end;
$function$;

-- Reparación: reenlazar a los usuarios que se quedaron sin rol pero cuyo
-- `rol_label` sí existe en su empresa.
update public.usuarios u
set rol_label = u.rol_label
where u.rol_id is null
  and u.rol_label is not null
  and u.empresa_id is not null
  and exists (
    select 1 from public.empresa_roles er
    where er.empresa_id = u.empresa_id and er.nombre ilike u.rol_label
  );
