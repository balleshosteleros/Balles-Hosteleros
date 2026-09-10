-- Cuadrante nuevo de los jefes de cocina de BACANAL, en vigor el lunes 14/09/2026.
--
-- Qué cambia (40 h por jefe, antes 41,5 h):
--   Jefe 1: lun y mar comida · MIÉRCOLES LIBRE · jue partido hasta 23:30 ·
--           vie y sáb partido hasta 00:00 · dom comida
--   Jefe 2: lun y mar noche · mié partido hasta 23:30 · JUEVES LIBRE ·
--           vie y sáb partido hasta 00:00 · dom noche
--
-- El viernes y el sábado la cocina deja de servir a las 23:30 (última reserva a
-- las 23:00, local cerrado al público a las 00:00), pero la cocina SALE a las
-- 00:00: media hora de cierre. Por eso el turno llega hasta las 00:00.
--
-- Los tramos de un turno NO se editan en sitio: reescribirían las horas teóricas
-- de los meses ya cerrados y los patrones los referencian. Se crea una versión
-- nueva de cada turno (misma familia, version+1) y la anterior se cierra el
-- 13/09/2026. Igual con los patrones y con la asignación de cada empleado.
--
-- Idempotente: se puede aplicar varias veces sin duplicar nada.

do $$
declare
  v_emp     uuid;
  v_desde   date := date '2026-09-14';
  v_hasta   date := date '2026-09-13';
  v_p1_old  uuid := 'a0000000-0000-0000-0000-00000000000f';
  v_p2_old  uuid := 'a0000000-0000-0000-0000-000000000010';
  v_p1_new  uuid := 'a0000000-0000-0000-0000-10000000000f';
  v_p2_new  uuid := 'a0000000-0000-0000-0000-100000000010';
  r         record;
begin
  select id into v_emp from public.empresas where upper(nombre) = 'BACANAL' limit 1;
  if v_emp is null then
    raise notice 'BACANAL no encontrada: no se aplica nada.';
    return;
  end if;

  ------------------------------------------------------------------
  -- 1) Versiones nuevas de los turnos que cambian de horas
  ------------------------------------------------------------------
  for r in
    select * from (values
      ('bt-jc1-jue', 'bt-jc1-jue-v2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"23:30"}]'::jsonb),
      ('bt-jc1-vie', 'bt-jc1-vie-v2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb),
      ('bt-jc1-sab', 'bt-jc1-sab-v2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb),
      ('bt-jc1-dom', 'bt-jc1-dom-v2', '[{"inicio":"12:30","fin":"17:00"}]'::jsonb),
      ('bt-jf2-vie', 'bt-jf2-vie-v2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb),
      ('bt-jc2-sab', 'bt-jc2-sab-v2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb),
      ('bt-jc2-dom', 'bt-jc2-dom-v2', '[{"inicio":"19:30","fin":"00:00"}]'::jsonb)
    ) as t(familia, nuevo_id, tramos)
  loop
    if not exists (select 1 from public.rrhh_turnos where id = r.nuevo_id) then
      -- La versión vigente deja de ser la oficial y se cierra el día anterior.
      update public.rrhh_turnos
         set es_oficial = false, vigente_hasta = v_hasta, updated_at = now()
       where familia_id = r.familia and empresa_id = v_emp and es_oficial;

      insert into public.rrhh_turnos
        (id, empresa_id, familia_id, nombre, codigo, tramos, departamento, centro,
         activo, version, es_oficial, vigente_desde, tipo_jornada)
      select r.nuevo_id, v_emp, t.familia_id, t.nombre, t.codigo, r.tramos,
             t.departamento, t.centro, true,
             coalesce((select max(version) from public.rrhh_turnos
                        where familia_id = r.familia and empresa_id = v_emp), 1) + 1,
             true, v_desde, t.tipo_jornada
        from public.rrhh_turnos t
       where t.id = r.familia;
    end if;
  end loop;

  ------------------------------------------------------------------
  -- 2) Turnos que antes no existían
  ------------------------------------------------------------------
  insert into public.rrhh_turnos
    (id, empresa_id, familia_id, nombre, codigo, tramos, departamento,
     activo, version, es_oficial, vigente_desde, tipo_jornada)
  values
    ('bt-jc1-mar',   v_emp, 'bt-jc1-mar',   'JEFE COCINA 1 MARTES',       'JC1',
     '[{"inicio":"12:30","fin":"17:00"}]'::jsonb, 'COCINA', true, 1, true, v_desde, 'fijo'),
    ('bt-jc2-mar-n', v_emp, 'bt-jc2-mar-n', 'JEFE COCINA 2 MARTES NOCHE', 'JC2',
     '[{"inicio":"19:30","fin":"00:00"}]'::jsonb, 'COCINA', true, 1, true, v_desde, 'fijo'),
    ('bt-jc2-mie',   v_emp, 'bt-jc2-mie',   'JEFE COCINA 2 MIERCOLES',    'JC2',
     '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"23:30"}]'::jsonb,
     'COCINA', true, 1, true, v_desde, 'fijo')
  on conflict (id) do update
     set tramos = excluded.tramos,
         nombre = excluded.nombre,
         vigente_desde = excluded.vigente_desde,
         vigente_hasta = null,
         activo = true,
         updated_at = now();

  ------------------------------------------------------------------
  -- 3) Turnos que dejan de usarse
  ------------------------------------------------------------------
  -- Estuvieron en uso hasta el 13: se cierran, NO se desactivan, para que el
  -- histórico anterior siga leyéndose.
  update public.rrhh_turnos
     set vigente_hasta = v_hasta, updated_at = now()
   where empresa_id = v_emp
     and id in ('bt-jc1-mie', 'bt-jc2-jue', 'bt-jc2-mar-part')
     and vigente_hasta is null;

  -- Estos dos nunca llegaron a usarse: son duplicados de los de septiembre.
  update public.rrhh_turnos
     set activo = false, vigente_hasta = v_hasta, updated_at = now()
   where empresa_id = v_emp
     and id in ('bt-jc2-lun', 'bt-jc2-mar')
     and activo;

  ------------------------------------------------------------------
  -- 4) Versión nueva de cada patrón, con su semana
  ------------------------------------------------------------------
  if not exists (select 1 from public.rrhh_patrones where id = v_p1_new) then
    update public.rrhh_patrones
       set es_oficial = false, vigente_hasta = v_hasta, updated_at = now()
     where id = v_p1_old;

    insert into public.rrhh_patrones
      (id, empresa_id, nombre, tipo, creado_por_user_id, creado_por_nombre, activo,
       vigente_desde, tipo_jornada, familia_id, version, es_oficial, departamento, puesto_id)
    select v_p1_new, empresa_id, nombre, tipo, creado_por_user_id, creado_por_nombre, true,
           v_desde, tipo_jornada, familia_id, version + 1, true, departamento, puesto_id
      from public.rrhh_patrones where id = v_p1_old;

    insert into public.rrhh_patron_semanas (patron_id, orden, dias)
    values (v_p1_new, 0,
      '["bt-jc1-lun","bt-jc1-mar",null,"bt-jc1-jue-v2","bt-jc1-vie-v2","bt-jc1-sab-v2","bt-jc1-dom-v2"]'::jsonb);
  end if;

  if not exists (select 1 from public.rrhh_patrones where id = v_p2_new) then
    update public.rrhh_patrones
       set es_oficial = false, vigente_hasta = v_hasta, updated_at = now()
     where id = v_p2_old;

    insert into public.rrhh_patrones
      (id, empresa_id, nombre, tipo, creado_por_user_id, creado_por_nombre, activo,
       vigente_desde, tipo_jornada, familia_id, version, es_oficial, departamento, puesto_id)
    select v_p2_new, empresa_id, nombre, tipo, creado_por_user_id, creado_por_nombre, true,
           v_desde, tipo_jornada, familia_id, version + 1, true, departamento, puesto_id
      from public.rrhh_patrones where id = v_p2_old;

    insert into public.rrhh_patron_semanas (patron_id, orden, dias)
    values (v_p2_new, 0,
      '["bt-jc2-lun-n","bt-jc2-mar-n","bt-jc2-mie",null,"bt-jf2-vie-v2","bt-jc2-sab-v2","bt-jc2-dom-v2"]'::jsonb);
  end if;

  ------------------------------------------------------------------
  -- 5) Los empleados pasan a la versión nueva el 14
  ------------------------------------------------------------------
  -- Sin esto el cambio no llega a nadie: el horario de cada persona sale de SU
  -- asignación, no del patrón oficial.
  update public.rrhh_patron_empleados
     set vigente_hasta = v_hasta
   where patron_id in (v_p1_old, v_p2_old) and vigente_hasta is null;

  insert into public.rrhh_patron_empleados
    (patron_id, empleado_id, vigente_desde, asignado_por_user_id)
  select v_p1_new, empleado_id, v_desde, asignado_por_user_id
    from public.rrhh_patron_empleados where patron_id = v_p1_old
  on conflict (patron_id, empleado_id) do update set vigente_desde = excluded.vigente_desde;

  insert into public.rrhh_patron_empleados
    (patron_id, empleado_id, vigente_desde, asignado_por_user_id)
  select v_p2_new, empleado_id, v_desde, asignado_por_user_id
    from public.rrhh_patron_empleados where patron_id = v_p2_old
  on conflict (patron_id, empleado_id) do update set vigente_desde = excluded.vigente_desde;

  ------------------------------------------------------------------
  -- 6) Las pausas de los turnos partidos siguen a su turno
  ------------------------------------------------------------------
  update public.rrhh_descansos set turnos = '["bt-jc1-vie-v2"]'::jsonb, updated_at = now()
   where id = 'dsc-07' and empresa_id = v_emp;
  update public.rrhh_descansos set turnos = '["bt-jc1-sab-v2"]'::jsonb, updated_at = now()
   where id = 'dsc-06' and empresa_id = v_emp;
  update public.rrhh_descansos set turnos = '["bt-jc2-sab-v2"]'::jsonb, updated_at = now()
   where id = 'dsc-09' and empresa_id = v_emp;

  -- El jefe 1 ya no hace partido el miércoles, y el jefe 2 ya no lo hace el martes.
  update public.rrhh_descansos set activo = false, updated_at = now()
   where id in ('dsc-05', 'dsc-08') and empresa_id = v_emp and activo;

  -- Partidos nuevos: jueves del jefe 1, miércoles y viernes del jefe 2.
  insert into public.rrhh_descansos
    (id, empresa_id, nombre, icono, color, remunerado, cuando_fichar,
     intervalo_inicio, intervalo_fin, duracion_tipo, duracion_minutos, dias, turnos, activo)
  values
    ('dsc-jc1-jue', v_emp, 'JEFE COCINA 1 JUEVES',    '☕', '#FCA98E', false, 'intervalo',
     '17:00', '19:30', 'sin_limite', null, '["J"]'::jsonb, '["bt-jc1-jue-v2"]'::jsonb, true),
    ('dsc-jc2-mie', v_emp, 'JEFE COCINA 2 MIERCOLES', '☕', '#FCA98E', false, 'intervalo',
     '17:00', '19:30', 'sin_limite', null, '["X"]'::jsonb, '["bt-jc2-mie"]'::jsonb, true),
    ('dsc-jc2-vie', v_emp, 'JEFE COCINA 2 VIERNES',   '☕', '#FCA98E', false, 'intervalo',
     '17:00', '19:30', 'sin_limite', null, '["V"]'::jsonb, '["bt-jf2-vie-v2"]'::jsonb, true)
  on conflict (id) do update
     set turnos = excluded.turnos, dias = excluded.dias, activo = true, updated_at = now();

  raise notice 'Cuadrante de cocina de BACANAL actualizado: en vigor el %', v_desde;
end $$;
