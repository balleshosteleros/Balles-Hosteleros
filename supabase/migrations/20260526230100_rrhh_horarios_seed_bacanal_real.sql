-- ============================================================
-- Seed RRHH horarios — datos reales exportados de producción
-- ============================================================
--
-- Fuente: snapshot vivo de prod el 2026-05-26 via Management API.
-- Idempotente: ON CONFLICT (id) DO NOTHING en las 3 tablas.
-- Se ejecuta DESPUÉS del snapshot (20260526230000_rrhh_horarios_snapshot.sql).
--
-- Resuelve empresa_id dinámicamente por nombre porque los UUIDs
-- varían entre entornos (prod / staging / dev).
--
-- Contenido:
--   - 3 cuadrantes (2 BACANAL + 1 HABANA)
--   - 43 turnos BACANAL con tramos reales
--   - 12 descansos BACANAL
--
-- Si una empresa no existe, se salta su sección sin error.
-- ============================================================

do $$
declare
  v_bacanal_id uuid;
  v_habana_id  uuid;
begin
  select id into v_bacanal_id from public.empresas where upper(nombre) = 'BACANAL' limit 1;
  select id into v_habana_id  from public.empresas where upper(nombre) = 'HABANA'  limit 1;

  -- ─── Cuadrantes ────────────────────────────────────────────
  if v_bacanal_id is not null then
    insert into public.rrhh_cuadrantes (id, empresa_id, nombre, activo) values
      ('cuad-bacanal-diario', v_bacanal_id, 'Cuadrante de Bacanal Diario',         true),
      ('cuad-bacanal-fines',  v_bacanal_id, 'Cuadrante de Bacanal Fines de semana', true)
    on conflict (id) do nothing;
  end if;

  if v_habana_id is not null then
    insert into public.rrhh_cuadrantes (id, empresa_id, nombre, activo) values
      ('cuad-habana-general', v_habana_id, 'Cuadrante de Habana General', true)
    on conflict (id) do nothing;
  end if;

  -- ─── Turnos BACANAL (43) ───────────────────────────────────
  if v_bacanal_id is not null then
    insert into public.rrhh_turnos
      (id, empresa_id, nombre, codigo, tramos, color, es_guardia, cuadrante_id, activo)
    values
      ('bt-art-cenas',   v_bacanal_id, 'ARTISTAS CENAS',            'ART', '[{"inicio":"21:30","fin":"23:00"}]'::jsonb,                                       'violet',  false, 'cuad-bacanal-diario', true),
      ('bt-art-comidas', v_bacanal_id, 'ARTISTAS COMIDAS',          'ART', '[{"inicio":"14:30","fin":"16:30"}]'::jsonb,                                       'violet',  false, 'cuad-bacanal-diario', true),
      ('bt-cal',         v_bacanal_id, 'CALIDAD',                   'CAL', '[{"inicio":"10:00","fin":"12:00"}]'::jsonb,                                       'emerald', false, 'cuad-bacanal-diario', true),
      ('bt-cam-dom',     v_bacanal_id, 'CAMARERO DOMINGO',          'CAM', '[{"inicio":"12:30","fin":"17:30"}]'::jsonb,                                       'rose',    false, 'cuad-bacanal-fines',  true),
      ('bt-cam-sab',     v_bacanal_id, 'CAMARERO SABADO',           'CAM', '[{"inicio":"20:30","fin":"00:30"}]'::jsonb,                                       'rose',    false, 'cuad-bacanal-fines',  true),
      ('bt-cam-vie',     v_bacanal_id, 'CAMARERO VIERNES',          'CAM', '[{"inicio":"20:30","fin":"00:30"}]'::jsonb,                                       'rose',    false, 'cuad-bacanal-fines',  true),
      ('bt-coc-dom',     v_bacanal_id, 'COCINERO DOMINGOS',         'COC', '[{"inicio":"12:30","fin":"17:00"}]'::jsonb,                                       'emerald', false, 'cuad-bacanal-fines',  true),
      ('bt-coc-jue',     v_bacanal_id, 'COCINERO JUEVES',           'COC', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb,      'violet',  false, 'cuad-bacanal-diario', true),
      ('bt-coc-lun',     v_bacanal_id, 'COCINERO LUNES',            'COC', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb,      'violet',  false, 'cuad-bacanal-diario', true),
      ('bt-coc-mar',     v_bacanal_id, 'COCINERO MARTES',           'COC', '[{"inicio":"19:30","fin":"00:00"}]'::jsonb,                                       'violet',  false, 'cuad-bacanal-diario', true),
      ('bt-coc-sab',     v_bacanal_id, 'COCINERO SABADO',           'COC', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"18:00","fin":"00:30"}]'::jsonb,      'emerald', false, 'cuad-bacanal-fines',  true),
      ('bt-coc-vie',     v_bacanal_id, 'COCINERO VIERNES',          'COC', '[{"inicio":"18:00","fin":"00:30"}]'::jsonb,                                       'emerald', false, 'cuad-bacanal-fines',  true),
      ('bt-con',         v_bacanal_id, 'CONTABILIDAD',              'CON', '[{"inicio":"12:00","fin":"13:00"}]'::jsonb,                                       'stone',   false, 'cuad-bacanal-diario', true),
      ('bt-edm-dom',     v_bacanal_id, 'JEFE DE SALA 3 DOMINGO',    'EDM', '[{"inicio":"12:30","fin":"17:30"},{"inicio":"19:30","fin":"00:30"}]'::jsonb,      'stone',   false, 'cuad-bacanal-fines',  true),
      ('bt-emd-diario',  v_bacanal_id, 'JEFE DE SALA 1 DIARIO MAÑANAS','EMD','[{"inicio":"12:30","fin":"17:30"}]'::jsonb,                                     'teal',    false, 'cuad-bacanal-diario', true),
      ('bt-en1-sab',     v_bacanal_id, 'JEFE DE SALA 1 SABADO',     'EN1', '[{"inicio":"12:30","fin":"17:30"},{"inicio":"20:30","fin":"01:30"}]'::jsonb,      'teal',    false, 'cuad-bacanal-fines',  true),
      ('bt-en2-sab',     v_bacanal_id, 'JEFE DE SALA 2 SABADO',     'EN2', '[{"inicio":"12:30","fin":"17:30"},{"inicio":"19:30","fin":"00:30"}]'::jsonb,      'teal',    false, 'cuad-bacanal-fines',  true),
      ('bt-en2-vie',     v_bacanal_id, 'JEFE DE SALA 2 VIERNES',    'EN2', '[{"inicio":"19:30","fin":"00:30"}]'::jsonb,                                       'teal',    false, 'cuad-bacanal-fines',  true),
      ('bt-enc-dom',     v_bacanal_id, 'JEFE DE SALA 2 DOMINGO',    'ENC', '[{"inicio":"12:30","fin":"17:30"}]'::jsonb,                                       'teal',    false, 'cuad-bacanal-fines',  true),
      ('bt-enc-vie',     v_bacanal_id, 'JEFE DE SALA 1 VIERNES',    'ENC', '[{"inicio":"12:30","fin":"17:30"},{"inicio":"20:30","fin":"01:30"}]'::jsonb,      'teal',    false, 'cuad-bacanal-fines',  true),
      ('bt-etd-diario',  v_bacanal_id, 'JEFE DE SALA 2 DIARIO TARDE','ETD','[{"inicio":"19:30","fin":"00:30"}]'::jsonb,                                       'teal',    false, 'cuad-bacanal-diario', true),
      ('bt-jc1-dom',     v_bacanal_id, 'JEFE COCINA 1 DOMINGO',     'JC1', '[{"inicio":"19:30","fin":"00:00"}]'::jsonb,                                       'amber',   false, 'cuad-bacanal-fines',  true),
      ('bt-jc1-jue',     v_bacanal_id, 'JEFE COCINA 1 JUEVES',      'JC1', '[{"inicio":"12:30","fin":"17:00"}]'::jsonb,                                       'amber',   false, 'cuad-bacanal-diario', true),
      ('bt-jc1-lun',     v_bacanal_id, 'JEFE COCINA 1 LUNES',       'JC1', '[{"inicio":"12:30","fin":"17:00"}]'::jsonb,                                       'amber',   false, 'cuad-bacanal-diario', true),
      ('bt-jc1-mie',     v_bacanal_id, 'JEFE COCINA 1 MIERCOLES',   'JC1', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb,      'amber',   false, 'cuad-bacanal-diario', true),
      ('bt-jc1-sab',     v_bacanal_id, 'JEFE COCINA 1 SABADO',      'JC1', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:30"}]'::jsonb,      'amber',   false, 'cuad-bacanal-fines',  true),
      ('bt-jc1-vie',     v_bacanal_id, 'JEFE COCINA 1 VIERNES',     'JC1', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:30"}]'::jsonb,      'amber',   false, 'cuad-bacanal-fines',  true),
      ('bt-jc2-dom',     v_bacanal_id, 'JEFE COCINA 2 DOMINGO',     'JC2', '[{"inicio":"12:30","fin":"17:00"}]'::jsonb,                                       'sky',     false, 'cuad-bacanal-fines',  true),
      ('bt-jc2-jue',     v_bacanal_id, 'JEFE COCINA 2 JUEVES',      'JC2', '[{"inicio":"19:30","fin":"00:00"}]'::jsonb,                                       'sky',     false, 'cuad-bacanal-diario', true),
      ('bt-jc2-lun',     v_bacanal_id, 'JEFE COCINA 2 LUNES',       'JC2', '[{"inicio":"19:30","fin":"00:00"}]'::jsonb,                                       'sky',     false, 'cuad-bacanal-diario', true),
      ('bt-jc2-mar',     v_bacanal_id, 'JEFE COCINA 2 MARTES',      'JC2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb,      'sky',     false, 'cuad-bacanal-diario', true),
      ('bt-jc2-sab',     v_bacanal_id, 'JEFE COCINA 2 SABADO',      'JC2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:30"}]'::jsonb,      'sky',     false, 'cuad-bacanal-fines',  true),
      ('bt-jc3-dom',     v_bacanal_id, 'JEFE COCINA 3 DOMINGO',     'JC3', '[{"inicio":"12:30","fin":"17:30"}]'::jsonb,                                       'emerald', false, 'cuad-bacanal-fines',  true),
      ('bt-jc3-sab',     v_bacanal_id, 'JEFE COCINA 3 SABADO',      'JC3', '[{"inicio":"19:30","fin":"00:30"}]'::jsonb,                                       'emerald', false, 'cuad-bacanal-fines',  true),
      ('bt-jc3-vie',     v_bacanal_id, 'JEFE COCINA 3 VIERNES',     'JC3', '[{"inicio":"19:30","fin":"00:30"}]'::jsonb,                                       'emerald', false, 'cuad-bacanal-fines',  true),
      ('bt-jef-sab',     v_bacanal_id, 'JEFE DE SALA 3 SABADO',     'JEF', '[{"inicio":"20:30","fin":"01:30"}]'::jsonb,                                       'stone',   false, 'cuad-bacanal-fines',  true),
      ('bt-jef-vie',     v_bacanal_id, 'JEFE DE SALA 3 VIERNES',    'JEF', '[{"inicio":"20:30","fin":"01:30"}]'::jsonb,                                       'stone',   false, 'cuad-bacanal-fines',  true),
      ('bt-jf2-vie',     v_bacanal_id, 'JEFE COCINA 2 VIERNES',     'JF2', '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:30"}]'::jsonb,      'sky',     false, 'cuad-bacanal-fines',  true),
      ('bt-lim-diario',  v_bacanal_id, 'OFFICE DIARIO',             'LIM', '[{"inicio":"21:00","fin":"23:00"}]'::jsonb,                                       'amber',   false, 'cuad-bacanal-diario', true),
      ('bt-lpo-dom',     v_bacanal_id, 'LIMPIEZA/OFFICE DOMINGO',   'LPO', '[{"inicio":"11:30","fin":"13:30"},{"inicio":"17:30","fin":"21:30"}]'::jsonb,      'amber',   false, 'cuad-bacanal-fines',  true),
      ('bt-lpo-sab',     v_bacanal_id, 'LIMPIEZA/OFFICE SABADO',    'LPO', '[{"inicio":"11:30","fin":"13:30"},{"inicio":"19:30","fin":"00:30"}]'::jsonb,      'amber',   false, 'cuad-bacanal-fines',  true),
      ('bt-lpo-vie',     v_bacanal_id, 'LIMPIEZA/OFFICE VIERNES',   'LPO', '[{"inicio":"17:30","fin":"00:30"}]'::jsonb,                                       'amber',   false, 'cuad-bacanal-fines',  true),
      ('bt-man-diario',  v_bacanal_id, 'MANTENIMIENTO DIARIO',      'MAN', '[{"inicio":"09:00","fin":"13:00"}]'::jsonb,                                       'stone',   false, 'cuad-bacanal-diario', true)
    on conflict (id) do nothing;
  end if;

  -- ─── Descansos BACANAL (12) ────────────────────────────────
  if v_bacanal_id is not null then
    insert into public.rrhh_descansos
      (id, empresa_id, nombre, icono, color, remunerado, cuando_fichar,
       intervalo_inicio, intervalo_fin, duracion_tipo, duracion_minutos,
       dias, turnos, activo)
    values
      ('dsc-01', v_bacanal_id, 'CAMARERO SABADO',         '☕', '#FCA98E', false, 'intervalo', '17:30', '20:30', 'sin_limite', null, '["S"]'::jsonb, '["bt-cam-sab"]'::jsonb,                 true),
      ('dsc-02', v_bacanal_id, 'ENCARGADO 1 SABADO',      '☕', '#FCA98E', false, 'intervalo', '17:30', '20:33', 'sin_limite', null, '["S"]'::jsonb, '["bt-en1-sab","bt-en2-sab"]'::jsonb,    true),
      ('dsc-03', v_bacanal_id, 'ENCARGADO 1 VIERNES',     '☕', '#FCA98E', false, 'intervalo', '17:30', '20:00', 'sin_limite', null, '["V"]'::jsonb, '["bt-enc-vie","bt-en2-vie"]'::jsonb,    true),
      ('dsc-04', v_bacanal_id, 'ENCARGADO 2 DOMINGO',     '☕', '#FCA98E', false, 'intervalo', '18:00', '18:30', 'sin_limite', null, '["D"]'::jsonb, '["bt-enc-dom"]'::jsonb,                 true),
      ('dsc-05', v_bacanal_id, 'JEFE COCINA 1 MIERCOLES', '☕', '#FCA98E', false, 'intervalo', '17:00', '19:30', 'sin_limite', null, '["X"]'::jsonb, '["bt-jc1-mie"]'::jsonb,                 true),
      ('dsc-06', v_bacanal_id, 'JEFE COCINA 1 SABADO',    '☕', '#FCA98E', false, 'intervalo', '17:00', '19:30', 'sin_limite', null, '["S"]'::jsonb, '["bt-jc1-sab"]'::jsonb,                 true),
      ('dsc-07', v_bacanal_id, 'JEFE COCINA 1 VIERNES',   '☕', '#FCA98E', false, 'intervalo', '17:00', '19:30', 'sin_limite', null, '["V"]'::jsonb, '["bt-jc1-vie"]'::jsonb,                 true),
      ('dsc-08', v_bacanal_id, 'JEFE COCINA 2 MARTES',    '☕', '#FCA98E', false, 'intervalo', '17:00', '19:30', 'sin_limite', null, '["M"]'::jsonb, '["bt-jc2-mar"]'::jsonb,                 true),
      ('dsc-09', v_bacanal_id, 'JEFE COCINA 2 SABADO',    '☕', '#FCA98E', false, 'intervalo', '17:00', '19:30', 'sin_limite', null, '["S"]'::jsonb, '["bt-jc2-sab"]'::jsonb,                 true),
      ('dsc-10', v_bacanal_id, 'JEFE COCINA 2 VIERNES',   '☕', '#FCA98E', false, 'intervalo', '17:00', '19:30', 'sin_limite', null, '["V"]'::jsonb, '["bt-jf2-vie"]'::jsonb,                 true),
      ('dsc-11', v_bacanal_id, 'JEFE DE SALA 2 SABADO',   '☕', '#FCA98E', false, 'intervalo', '17:00', '19:30', 'sin_limite', null, '["S"]'::jsonb, '["bt-en2-sab"]'::jsonb,                 true),
      ('dsc-12', v_bacanal_id, 'JEFE DE SALA 3 DOMINGOS', '☕', '#FCA98E', false, 'intervalo', '17:30', '19:30', 'sin_limite', null, '["D"]'::jsonb, '["bt-edm-dom","bt-jc3-dom"]'::jsonb,    true)
    on conflict (id) do nothing;
  end if;
end $$;
