-- ============================================================
-- TASK-007 (seed): Inserta los 30 turno_ids únicos que el seed de
-- patrones BACANAL ya referencia (20260515150100_rrhh_patrones_seed_bacanal.sql).
--
-- Antes de esta migración esos IDs eran strings huérfanos en
-- rrhh_patron_semanas.dias[]. Ahora apuntan a registros reales en
-- rrhh_turnos.
--
-- IMPORTANTE: tramos=[] y codigo=UPPER(id_short) son placeholders.
-- El usuario debe editar cada turno desde /rrhh/horarios → Turnos
-- para fijar las horas reales según el negocio.
--
-- Idempotente: ON CONFLICT (id) DO NOTHING.
-- ============================================================

do $$
declare
  v_empresa_id uuid;
  rec record;
begin
  select id into v_empresa_id
  from public.empresas
  where upper(nombre) = 'BACANAL'
  limit 1;

  if v_empresa_id is null then
    raise notice 'Empresa BACANAL no encontrada — saltando seed de turnos';
    return;
  end if;

  for rec in (
    select * from (values
      -- Artistas
      ('bt-art-cenas',   'Artista (cenas)',           'ART-CEN', 'violet'),
      -- Calidad
      ('bt-cal',         'Calidad',                   'CAL',     'sky'),
      -- Camarero (viernes / sábado / domingo)
      ('bt-cam-vie',     'Camarero — Viernes',        'CAM-VIE', 'amber'),
      ('bt-cam-sab',     'Camarero — Sábado',         'CAM-SAB', 'amber'),
      ('bt-cam-dom',     'Camarero — Domingo',        'CAM-DOM', 'amber'),
      -- Cocinero (semana completa salvo miércoles)
      ('bt-coc-lun',     'Cocinero — Lunes',          'COC-LUN', 'rose'),
      ('bt-coc-mar',     'Cocinero — Martes',         'COC-MAR', 'rose'),
      ('bt-coc-jue',     'Cocinero — Jueves',         'COC-JUE', 'rose'),
      ('bt-coc-vie',     'Cocinero — Viernes',        'COC-VIE', 'rose'),
      ('bt-coc-sab',     'Cocinero — Sábado',         'COC-SAB', 'rose'),
      ('bt-coc-dom',     'Cocinero — Domingo',        'COC-DOM', 'rose'),
      -- Jefe de Cocina 3 (viernes / sábado / domingo)
      ('bt-jc3-vie',     'Jefe Cocina 3 — Viernes',   'JC3-VIE', 'emerald'),
      ('bt-jc3-sab',     'Jefe Cocina 3 — Sábado',    'JC3-SAB', 'emerald'),
      ('bt-jc3-dom',     'Jefe Cocina 3 — Domingo',   'JC3-DOM', 'emerald'),
      -- Encargado mañana/tarde diario
      ('bt-emd-diario',  'Encargado mañana (diario)', 'EMD',     'teal'),
      ('bt-etd-diario',  'Encargado tarde (diario)',  'ETD',     'teal'),
      -- Encargado viernes/sábado/domingo
      ('bt-enc-vie',     'Encargado — Viernes',       'ENC-VIE', 'teal'),
      ('bt-en1-sab',     'Encargado 1 — Sábado',      'EN1-SAB', 'teal'),
      ('bt-en2-vie',     'Encargado 2 — Viernes',     'EN2-VIE', 'teal'),
      ('bt-en2-sab',     'Encargado 2 — Sábado',      'EN2-SAB', 'teal'),
      ('bt-enc-dom',     'Encargado — Domingo',       'ENC-DOM', 'teal'),
      ('bt-edm-dom',     'Encargado mañana — Domingo','EDM-DOM', 'teal'),
      -- Jefe de Sala 3 (viernes/sábado)
      ('bt-jef-vie',     'Jefe Sala 3 — Viernes',     'JEF-VIE', 'emerald'),
      ('bt-jef-sab',     'Jefe Sala 3 — Sábado',      'JEF-SAB', 'emerald'),
      -- Limpieza / Office
      ('bt-lim-diario',  'Limpieza (diario)',         'LIM',     'stone'),
      ('bt-lpo-vie',     'Limpieza/Office — Viernes', 'LPO-VIE', 'stone'),
      ('bt-lpo-sab',     'Limpieza/Office — Sábado',  'LPO-SAB', 'stone'),
      ('bt-lpo-dom',     'Limpieza/Office — Domingo', 'LPO-DOM', 'stone'),
      -- Mantenimiento
      ('bt-man-diario',  'Mantenimiento (diario)',    'MAN',     'stone'),
      -- Plantilla sin nombre — turno genérico
      ('bt-con',         'Turno genérico',            'CON',     'stone')
    ) as t(id, nombre, codigo, color)
  ) loop
    insert into public.rrhh_turnos (
      id, empresa_id, nombre, codigo, tramos, color, es_guardia, activo
    )
    values (
      rec.id, v_empresa_id, rec.nombre, rec.codigo,
      '[]'::jsonb,  -- tramos vacíos: usuario debe configurar horas vía UI
      rec.color, false, true
    )
    on conflict (id) do nothing;
  end loop;
end $$;

comment on table public.rrhh_turnos is
  'Turnos por empresa. ID text (formato t-* nuevo o bt-* legacy). Seed BACANAL crea 30 placeholders con tramos=[]: el usuario los edita desde /rrhh/horarios.';
