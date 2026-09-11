-- Correccion: el cuadrante nuevo movia los dias de libranza de los dos jefes de
-- cocina. Sus dias reales son los que tenia la version 1: el jefe 1 libra el
-- MARTES y el jefe 2 el MIERCOLES, y cada uno conserva su reparto de siempre.
-- Lo unico que cambia respecto a lo que ya tenian son las 1,5 h de recorte:
-- viernes y sabado cierran a las 00:00 (antes 00:30) y el partido entre diario
-- cierra a las 23:30 (miercoles del jefe 1, martes del jefe 2).
-- La version 2 aun no habia entrado en vigor (empieza el 14), asi que se
-- rehace en vez de crear una tercera.
-- Idempotente.
do $$
declare
  v_emp    uuid;
  v_desde  date := date '2026-09-14';
  v_hasta  date := date '2026-09-13';
  v_p1_new uuid := 'a0000000-0000-0000-0000-10000000000f';
  v_p2_new uuid := 'a0000000-0000-0000-0000-100000000010';
  r        record;
begin
  select id into v_emp from public.empresas where upper(nombre) = 'BACANAL' limit 1;
  if v_emp is null then raise notice 'BACANAL no encontrada'; return; end if;

  -- 1) Fuera los turnos que sobran. Nunca llegaron a estar vigentes (empezaban
  --    el 14), asi que no dejan historico detras. Van primero: mientras
  --    existan son la version oficial de su familia y no dejan reactivar la buena.
  delete from public.rrhh_turnos
   where empresa_id = v_emp
     and id in ('bt-jc1-mar', 'bt-jc2-mar-n', 'bt-jc2-mie',
                'bt-jc1-jue-v2', 'bt-jc1-dom-v2', 'bt-jc2-dom-v2');

  -- 2) Los dias que NO cambian vuelven a estar vigentes: jueves y domingo de
  --    cada uno se quedan exactamente como los tenian.
  update public.rrhh_turnos
     set es_oficial = true, vigente_hasta = null, activo = true, updated_at = now()
   where empresa_id = v_emp
     and id in ('bt-jc1-jue', 'bt-jc1-dom', 'bt-jc2-jue', 'bt-jc2-dom');

  -- 3) Los partidos entre diario estrenan version con cierre a las 23:30.
  for r in
    select * from (values
      ('bt-jc1-mie',      'bt-jc1-mie-v2',      '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"23:30"}]'::jsonb),
      ('bt-jc2-mar-part', 'bt-jc2-mar-part-v2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"23:30"}]'::jsonb)
    ) as t(familia, nuevo_id, tramos)
  loop
    if not exists (select 1 from public.rrhh_turnos where id = r.nuevo_id) then
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
        from public.rrhh_turnos t where t.id = r.familia;
    end if;
  end loop;

  -- 4) La semana de cada patron, con sus dias de siempre.
  update public.rrhh_patron_semanas
     set dias = '["bt-jc1-lun",null,"bt-jc1-mie-v2","bt-jc1-jue","bt-jc1-vie-v2","bt-jc1-sab-v2","bt-jc1-dom"]'::jsonb
   where patron_id = v_p1_new and orden = 0;

  update public.rrhh_patron_semanas
     set dias = '["bt-jc2-lun-n","bt-jc2-mar-part-v2",null,"bt-jc2-jue","bt-jf2-vie-v2","bt-jc2-sab-v2","bt-jc2-dom"]'::jsonb
   where patron_id = v_p2_new and orden = 0;

  -- 5) Las pausas siguen a los partidos que de verdad hay.
  update public.rrhh_descansos
     set turnos = '["bt-jc1-mie-v2"]'::jsonb, activo = true, dias = '["X"]'::jsonb, updated_at = now()
   where id = 'dsc-05' and empresa_id = v_emp;

  update public.rrhh_descansos
     set turnos = '["bt-jc2-mar-part-v2"]'::jsonb, activo = true, dias = '["M"]'::jsonb, updated_at = now()
   where id = 'dsc-08' and empresa_id = v_emp;

  delete from public.rrhh_descansos
   where empresa_id = v_emp and id in ('dsc-jc1-jue', 'dsc-jc2-mie');

  raise notice 'Cuadrante corregido: el jefe 1 libra martes y el jefe 2 miercoles.';
end $$;
