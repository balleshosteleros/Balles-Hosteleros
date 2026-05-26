-- ============================================================
-- TASK-007 (pulido): Crea los 5 cuadrantes de BACANAL y rellena
-- tramos reales en los 30 turnos seed.
--
-- Sustituye los tramos=[] del seed previo
-- (20260526210100_rrhh_turnos_seed_bacanal.sql) por horarios tipo
-- de restaurante con comidas + cenas. Enlaza cada turno con su
-- cuadrante.
--
-- Cuadrantes:
--   Cocina            (cocineros, jefes de cocina, artista, calidad)
--   Sala              (camareros, jefes de sala, encargados)
--   Limpieza/Office
--   Mantenimiento
--   Genéricos
--
-- Idempotente: cuadrantes vía SELECT-or-INSERT por (empresa, nombre).
-- Updates se aplican siempre para mantener los tramos canónicos —
-- si el usuario los editó manualmente, esta migración los sobreescribe.
-- Para conservar ediciones manuales, no re-ejecutar este migration.
-- ============================================================

do $$
declare
  v_empresa_id          uuid;
  v_cuad_cocina         uuid;
  v_cuad_sala           uuid;
  v_cuad_limpieza       uuid;
  v_cuad_mantenimiento  uuid;
  v_cuad_genericos      uuid;
begin
  select id into v_empresa_id
  from public.empresas
  where upper(nombre) = 'BACANAL'
  limit 1;

  if v_empresa_id is null then
    raise notice 'Empresa BACANAL no encontrada — saltando pulido seed';
    return;
  end if;

  -- ─── Cuadrantes: SELECT-or-INSERT ────────────────────────────
  select id into v_cuad_cocina
  from public.rrhh_cuadrantes
  where empresa_id = v_empresa_id and nombre = 'Cocina'
  limit 1;
  if v_cuad_cocina is null then
    insert into public.rrhh_cuadrantes (empresa_id, nombre)
    values (v_empresa_id, 'Cocina')
    returning id into v_cuad_cocina;
  end if;

  select id into v_cuad_sala
  from public.rrhh_cuadrantes
  where empresa_id = v_empresa_id and nombre = 'Sala'
  limit 1;
  if v_cuad_sala is null then
    insert into public.rrhh_cuadrantes (empresa_id, nombre)
    values (v_empresa_id, 'Sala')
    returning id into v_cuad_sala;
  end if;

  select id into v_cuad_limpieza
  from public.rrhh_cuadrantes
  where empresa_id = v_empresa_id and nombre = 'Limpieza/Office'
  limit 1;
  if v_cuad_limpieza is null then
    insert into public.rrhh_cuadrantes (empresa_id, nombre)
    values (v_empresa_id, 'Limpieza/Office')
    returning id into v_cuad_limpieza;
  end if;

  select id into v_cuad_mantenimiento
  from public.rrhh_cuadrantes
  where empresa_id = v_empresa_id and nombre = 'Mantenimiento'
  limit 1;
  if v_cuad_mantenimiento is null then
    insert into public.rrhh_cuadrantes (empresa_id, nombre)
    values (v_empresa_id, 'Mantenimiento')
    returning id into v_cuad_mantenimiento;
  end if;

  select id into v_cuad_genericos
  from public.rrhh_cuadrantes
  where empresa_id = v_empresa_id and nombre = 'Genéricos'
  limit 1;
  if v_cuad_genericos is null then
    insert into public.rrhh_cuadrantes (empresa_id, nombre)
    values (v_empresa_id, 'Genéricos')
    returning id into v_cuad_genericos;
  end if;

  -- ─── COCINA ─────────────────────────────────────────────────
  -- Cocineros lun/mar/jue: comida + cena estándar
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_cocina,
    tramos = '[{"inicio":"11:00","fin":"16:00"},{"inicio":"19:00","fin":"00:00"}]'::jsonb
  where empresa_id = v_empresa_id
    and id in ('bt-coc-lun','bt-coc-mar','bt-coc-jue');

  -- Cocineros vie: cena más larga
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_cocina,
    tramos = '[{"inicio":"11:00","fin":"16:00"},{"inicio":"19:30","fin":"01:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-coc-vie';

  -- Cocineros sáb/dom: horario weekend
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_cocina,
    tramos = '[{"inicio":"12:00","fin":"17:00"},{"inicio":"20:00","fin":"01:30"}]'::jsonb
  where empresa_id = v_empresa_id and id in ('bt-coc-sab','bt-coc-dom');

  -- Jefe Cocina 3 vie/sáb/dom
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_cocina,
    tramos = '[{"inicio":"11:00","fin":"16:00"},{"inicio":"19:00","fin":"01:00"}]'::jsonb
  where empresa_id = v_empresa_id and id in ('bt-jc3-vie','bt-jc3-sab','bt-jc3-dom');

  -- Artista cenas: solo turno noche
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_cocina,
    tramos = '[{"inicio":"21:00","fin":"00:30"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-art-cenas';

  -- Calidad: turno de servicio comida
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_cocina,
    tramos = '[{"inicio":"11:00","fin":"15:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-cal';

  -- ─── SALA ───────────────────────────────────────────────────
  -- Camarero viernes: cena
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_sala,
    tramos = '[{"inicio":"19:30","fin":"02:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-cam-vie';

  -- Camarero sábado: comida + cena larga
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_sala,
    tramos = '[{"inicio":"13:00","fin":"17:00"},{"inicio":"20:00","fin":"02:30"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-cam-sab';

  -- Camarero domingo: comida + cena
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_sala,
    tramos = '[{"inicio":"13:00","fin":"17:00"},{"inicio":"20:00","fin":"00:30"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-cam-dom';

  -- Encargado mañana (diario)
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_sala,
    tramos = '[{"inicio":"09:00","fin":"16:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-emd-diario';

  -- Encargado tarde (diario)
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_sala,
    tramos = '[{"inicio":"16:00","fin":"00:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-etd-diario';

  -- Encargados findes (vie/sáb/dom, con variantes)
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_sala,
    tramos = '[{"inicio":"18:00","fin":"02:00"}]'::jsonb
  where empresa_id = v_empresa_id
    and id in ('bt-enc-vie','bt-en1-sab','bt-en2-vie','bt-en2-sab','bt-enc-dom','bt-edm-dom');

  -- Jefes Sala 3 vie/sáb
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_sala,
    tramos = '[{"inicio":"18:30","fin":"02:00"}]'::jsonb
  where empresa_id = v_empresa_id and id in ('bt-jef-vie','bt-jef-sab');

  -- ─── LIMPIEZA / OFFICE ──────────────────────────────────────
  -- Limpieza diario: mañana antes de servicio
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_limpieza,
    tramos = '[{"inicio":"07:00","fin":"11:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-lim-diario';

  -- Limpieza/Office findes: tras cierre
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_limpieza,
    tramos = '[{"inicio":"02:00","fin":"06:00"}]'::jsonb
  where empresa_id = v_empresa_id
    and id in ('bt-lpo-vie','bt-lpo-sab','bt-lpo-dom');

  -- ─── MANTENIMIENTO ──────────────────────────────────────────
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_mantenimiento,
    tramos = '[{"inicio":"09:00","fin":"13:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-man-diario';

  -- ─── GENÉRICOS ──────────────────────────────────────────────
  update public.rrhh_turnos set
    cuadrante_id = v_cuad_genericos,
    tramos = '[{"inicio":"09:00","fin":"17:00"}]'::jsonb
  where empresa_id = v_empresa_id and id = 'bt-con';

end $$;
