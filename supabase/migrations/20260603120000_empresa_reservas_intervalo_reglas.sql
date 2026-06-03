-- Reglas de intervalo horario para reservas: límite de "máx reservas" o
-- "máx personas" que pueden empezar dentro de una franja [hora_inicio, hora_fin]
-- (ambos inclusivos), opcionalmente acotado a un turno (COMIDA/CENA/AMBOS) y
-- con periodicidad (siempre/día de la semana/rango de fechas/fechas concretas).
--
-- Convenciones:
--   - hora_inicio y hora_fin son TIME (sin TZ); ambos inclusivos.
--   - Una reserva "cae" en el intervalo cuando reservas.hora ∈ [hora_inicio, hora_fin].
--   - dias_semana usa ISODOW (1=lunes ... 7=domingo).
--   - Cascada de prioridad (de más específico a menos):
--       4) fechas_extra contiene la fecha
--       3) [fecha_desde..fecha_hasta] contiene la fecha
--       2) dias_semana contiene el ISODOW
--       1) regla general (sin vigencia)
--     Desempate: prioridad DESC, created_at DESC.

CREATE TABLE IF NOT EXISTS public.empresa_reservas_intervalo_reglas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  metrica       text NOT NULL CHECK (metrica IN ('max_reservas','max_personas')),
  valor         integer NOT NULL CHECK (valor >= 0),
  hora_inicio   time NOT NULL,
  hora_fin      time NOT NULL,
  turno         text NOT NULL CHECK (turno IN ('COMIDA','CENA','AMBOS')) DEFAULT 'AMBOS',
  fecha_desde   date,
  fecha_hasta   date,
  dias_semana   int4[] CHECK (dias_semana IS NULL OR (
                  array_length(dias_semana, 1) > 0
                  AND dias_semana <@ ARRAY[1,2,3,4,5,6,7]::int4[]
                )),
  fechas_extra  date[],
  prioridad     integer NOT NULL DEFAULT 0,
  nombre        text,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intervalo_horas_validas CHECK (hora_inicio <= hora_fin),
  CONSTRAINT intervalo_rango_valido  CHECK (
    fecha_desde IS NULL OR fecha_hasta IS NULL OR fecha_desde <= fecha_hasta
  )
);

CREATE INDEX IF NOT EXISTS idx_eri_empresa_activo
  ON public.empresa_reservas_intervalo_reglas (empresa_id, activo);
CREATE INDEX IF NOT EXISTS idx_eri_metrica
  ON public.empresa_reservas_intervalo_reglas (empresa_id, metrica, activo);

DROP TRIGGER IF EXISTS trg_eri_updated_at ON public.empresa_reservas_intervalo_reglas;
CREATE TRIGGER trg_eri_updated_at
  BEFORE UPDATE ON public.empresa_reservas_intervalo_reglas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.empresa_reservas_intervalo_reglas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eri_select ON public.empresa_reservas_intervalo_reglas;
CREATE POLICY eri_select ON public.empresa_reservas_intervalo_reglas
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP POLICY IF EXISTS eri_insert ON public.empresa_reservas_intervalo_reglas;
CREATE POLICY eri_insert ON public.empresa_reservas_intervalo_reglas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP POLICY IF EXISTS eri_update ON public.empresa_reservas_intervalo_reglas;
CREATE POLICY eri_update ON public.empresa_reservas_intervalo_reglas
  FOR UPDATE TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP POLICY IF EXISTS eri_delete ON public.empresa_reservas_intervalo_reglas;
CREATE POLICY eri_delete ON public.empresa_reservas_intervalo_reglas
  FOR DELETE TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));


-- RPC: comprueba si crear/editar una reserva superaría algún límite de intervalo.
CREATE OR REPLACE FUNCTION public.validar_intervalo_reservas(
  p_empresa_id        uuid,
  p_fecha             date,
  p_hora              time,
  p_personas          integer,
  p_turno             text,
  p_ignore_reserva_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_isodow   integer;
  v_metrica  text;
  v_regla    record;
  v_count    integer;
  v_suma     integer;
  v_nueva    integer;
  v_nombre   text;
BEGIN
  IF p_empresa_id IS NULL OR p_fecha IS NULL OR p_hora IS NULL THEN
    RETURN NULL;
  END IF;

  v_isodow := EXTRACT(ISODOW FROM p_fecha)::integer;

  FOREACH v_metrica IN ARRAY ARRAY['max_reservas','max_personas']
  LOOP
    SELECT r.*,
      CASE
        WHEN r.fechas_extra IS NOT NULL AND p_fecha = ANY(r.fechas_extra) THEN 4
        WHEN r.fecha_desde IS NOT NULL AND r.fecha_hasta IS NOT NULL
             AND p_fecha BETWEEN r.fecha_desde AND r.fecha_hasta THEN 3
        WHEN r.dias_semana IS NOT NULL AND v_isodow = ANY(r.dias_semana) THEN 2
        WHEN r.fechas_extra IS NULL AND r.fecha_desde IS NULL
             AND r.fecha_hasta IS NULL AND r.dias_semana IS NULL THEN 1
        ELSE 0
      END AS score
    INTO v_regla
    FROM public.empresa_reservas_intervalo_reglas r
    WHERE r.empresa_id = p_empresa_id
      AND r.activo = true
      AND r.metrica = v_metrica
      AND p_hora BETWEEN r.hora_inicio AND r.hora_fin
      AND (r.turno = 'AMBOS' OR r.turno = p_turno)
      AND (
        (r.fechas_extra IS NOT NULL AND p_fecha = ANY(r.fechas_extra))
        OR (r.fecha_desde IS NOT NULL AND r.fecha_hasta IS NOT NULL
            AND p_fecha BETWEEN r.fecha_desde AND r.fecha_hasta)
        OR (r.dias_semana IS NOT NULL AND v_isodow = ANY(r.dias_semana))
        OR (r.fechas_extra IS NULL AND r.fecha_desde IS NULL
            AND r.fecha_hasta IS NULL AND r.dias_semana IS NULL)
      )
    ORDER BY
      score DESC,
      r.prioridad DESC,
      r.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(personas), 0)
      INTO v_count, v_suma
    FROM public.reservas r
    WHERE r.empresa_id = p_empresa_id
      AND r.fecha = p_fecha
      AND r.hora BETWEEN v_regla.hora_inicio AND v_regla.hora_fin
      AND COALESCE(r.estado, '') NOT IN ('CANCELADA','NO_SHOW','RECHAZADA')
      AND (p_ignore_reserva_id IS NULL OR r.id <> p_ignore_reserva_id);

    v_nombre := COALESCE(NULLIF(v_regla.nombre, ''),
                         CASE v_metrica
                           WHEN 'max_reservas' THEN 'máx. reservas por intervalo'
                           ELSE 'máx. personas por intervalo'
                         END);

    IF v_metrica = 'max_reservas' THEN
      v_nueva := v_count + 1;
      IF v_nueva > v_regla.valor THEN
        RETURN format(
          'Se superaría el límite "%s": franja %s–%s permite %s reservas y ya hay %s.',
          v_nombre,
          to_char(v_regla.hora_inicio, 'HH24:MI'),
          to_char(v_regla.hora_fin,    'HH24:MI'),
          v_regla.valor,
          v_count
        );
      END IF;
    ELSE
      v_nueva := v_suma + COALESCE(p_personas, 0);
      IF v_nueva > v_regla.valor THEN
        RETURN format(
          'Se superaría el límite "%s": franja %s–%s permite %s personas, ya hay %s y esta reserva añade %s.',
          v_nombre,
          to_char(v_regla.hora_inicio, 'HH24:MI'),
          to_char(v_regla.hora_fin,    'HH24:MI'),
          v_regla.valor,
          v_suma,
          COALESCE(p_personas, 0)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_intervalo_reservas(uuid, date, time, integer, text, uuid) TO authenticated;
