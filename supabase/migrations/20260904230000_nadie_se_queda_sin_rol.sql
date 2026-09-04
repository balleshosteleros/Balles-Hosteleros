-- Red de seguridad: NADIE se queda sin rol.
--
-- Un usuario sin `rol_id` no tiene permisos: se queda sin menú y sin acceso a
-- nada. Es un fallo de SEGURIDAD silencioso — no da error, simplemente el
-- software deja de enseñarle su trabajo.
--
-- Ya se tapó la causa conocida (el trigger `sync_usuario_rol_id` borraba el
-- enlace cuando no encontraba rol). Esto es la segunda capa: da igual QUIÉN
-- escriba en la tabla (una pantalla, un script, un arreglo a mano), el rol se
-- repone solo siempre que se pueda deducir.

-- 1) VIGILANTE. Se ejecuta DESPUÉS del sync, en toda alta o cambio de la ficha.
--    Si la fila se quedaría sin rol pero la etiqueta sí existe en su empresa,
--    lo repone. Si además falta la etiqueta, hereda el rol del departamento
--    (los roles son los departamentos: SALA, COCINA, …).
create or replace function public.repone_rol_si_falta()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_nombre text;
  v_es_admin boolean;
begin
  if new.rol_id is not null or new.empresa_id is null then
    return new;
  end if;

  -- a) por la etiqueta de rol que traiga la ficha
  select er.id, er.nombre, er.es_admin_plataforma
    into v_id, v_nombre, v_es_admin
  from public.empresa_roles er
  where er.empresa_id = new.empresa_id and er.nombre ilike new.rol_label
  limit 1;

  -- b) si no, por su departamento (rol y departamento comparten nombre)
  if v_id is null and new.departamento is not null then
    select er.id, er.nombre, er.es_admin_plataforma
      into v_id, v_nombre, v_es_admin
    from public.empresa_roles er
    where er.empresa_id = new.empresa_id and er.nombre ilike new.departamento
    limit 1;
  end if;

  if v_id is null then
    return new;
  end if;

  new.rol_id := v_id;
  new.rol_label := v_nombre;
  new.role := case when v_es_admin then 'admin' else 'empleado' end;
  return new;
end;
$function$;

drop trigger if exists trg_repone_rol_si_falta on public.usuarios;
create trigger trg_repone_rol_si_falta
  before insert or update on public.usuarios
  for each row execute function public.repone_rol_si_falta();

-- 2) DETECTOR. Deja a la vista, en cualquier momento, quién se ha quedado sin
--    permisos y si tiene arreglo automático. Sirve para revisar sin tener que
--    acordarse de la consulta.
create or replace view public.usuarios_sin_permisos as
select
  u.id,
  u.email,
  u.full_name,
  u.empresa_id,
  u.rol_label,
  u.departamento,
  exists (
    select 1 from public.empresa_roles er
    where er.empresa_id = u.empresa_id
      and (er.nombre ilike u.rol_label or er.nombre ilike u.departamento)
  ) as tiene_arreglo_automatico
from public.usuarios u
where u.rol_id is null;

comment on view public.usuarios_sin_permisos is
  'Usuarios sin rol enlazado: se quedan sin menú y sin acceso. Debería estar SIEMPRE vacía.';

-- 3) Reparación de los que hubiera ahora mismo (idempotente: no-op si no hay).
update public.usuarios set rol_label = rol_label where rol_id is null;
