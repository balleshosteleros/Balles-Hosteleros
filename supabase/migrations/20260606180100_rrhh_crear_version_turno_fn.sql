-- PRP-053 Fase 2: función atómica para crear una versión de turno
-- Cambia la oficial vieja -> false, inserta la nueva versión (hereda
-- metadata, cambia solo tramos), y asigna empleados con vigente_desde,
-- validando: (1) la fecha no es anterior al inicio de la versión
-- (trivial: es la misma) y (2) no solapa una versión ya vigente del
-- mismo empleado en esa familia (su última asignación debe ser anterior).
-- SECURITY INVOKER (default) => respeta RLS multi-empresa.

create or replace function public.rrhh_crear_version_turno(
  p_empresa_id    uuid,
  p_familia_id    text,
  p_nuevo_id      text,
  p_tramos        jsonb,
  p_vigente_desde date,
  p_empleado_ids  uuid[],
  p_asignado_por  uuid
) returns text
language plpgsql
as $$
declare
  v_oficial   public.rrhh_turnos%rowtype;
  v_max_ver   integer;
  v_emp       uuid;
  v_ult_fecha date;
begin
  select * into v_oficial
  from public.rrhh_turnos
  where familia_id = p_familia_id
    and empresa_id = p_empresa_id
    and es_oficial
  limit 1;

  if not found then
    raise exception 'No existe versión oficial para la familia % en la empresa', p_familia_id;
  end if;

  select coalesce(max(version), 0) into v_max_ver
  from public.rrhh_turnos
  where familia_id = p_familia_id and empresa_id = p_empresa_id;

  if p_empleado_ids is not null then
    foreach v_emp in array p_empleado_ids loop
      select max(te.vigente_desde) into v_ult_fecha
      from public.rrhh_turno_empleados te
      join public.rrhh_turnos t on t.id = te.turno_id
      where t.familia_id = p_familia_id
        and te.empleado_id = v_emp
        and te.empresa_id = p_empresa_id;

      if v_ult_fecha is not null and v_ult_fecha >= p_vigente_desde then
        raise exception 'El empleado % ya tiene una versión vigente desde % (la nueva fecha % debe ser posterior)',
          v_emp, v_ult_fecha, p_vigente_desde;
      end if;
    end loop;
  end if;

  update public.rrhh_turnos
  set es_oficial = false, updated_at = now()
  where id = v_oficial.id;

  insert into public.rrhh_turnos
    (id, empresa_id, familia_id, nombre, codigo, tramos, color,
     departamento, centro, activo, version, es_oficial, vigente_desde)
  values
    (p_nuevo_id, p_empresa_id, p_familia_id, v_oficial.nombre, v_oficial.codigo,
     p_tramos, v_oficial.color, v_oficial.departamento, v_oficial.centro,
     true, v_max_ver + 1, true, p_vigente_desde);

  if p_empleado_ids is not null then
    foreach v_emp in array p_empleado_ids loop
      insert into public.rrhh_turno_empleados
        (empresa_id, turno_id, empleado_id, vigente_desde, asignado_por_user_id)
      values
        (p_empresa_id, p_nuevo_id, v_emp, p_vigente_desde, p_asignado_por)
      on conflict (turno_id, empleado_id)
      do update set vigente_desde = excluded.vigente_desde,
                    asignado_por_user_id = excluded.asignado_por_user_id;
    end loop;
  end if;

  return p_nuevo_id;
end;
$$;
