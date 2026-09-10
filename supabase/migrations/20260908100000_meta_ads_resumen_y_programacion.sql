-- ═══════════════════════════════════════════════════════════════════
-- PRP-087 · Fases 3 y 7 — Resúmenes por nivel y campañas programadas
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Resumen por nivel para la pantalla ─────────────────────────────
-- Igual que `meta_gasto_periodo`: se agrupa EN LA BASE DE DATOS. Leyendo las
-- filas y agrupando en el servidor, Supabase corta a 1.000 y las campañas de
-- abajo aparecerían con gasto cero.
--
-- OJO CON EL ALCANCE: `reach` son personas distintas, y sumar el alcance de
-- cada día NO da el alcance del período (la misma persona cuenta varias veces).
-- Por eso aquí NO se suma: se devuelve el mayor día como referencia honesta y
-- la pantalla no lo presenta como un total del período.
CREATE OR REPLACE FUNCTION public.meta_resumen_nivel(
  p_empresa UUID,
  p_nivel   TEXT,
  p_desde   DATE,
  p_hasta   DATE
) RETURNS TABLE (
  meta_id              TEXT,
  gasto_cent           BIGINT,
  impresiones          BIGINT,
  clics                BIGINT,
  resultados           BIGINT,
  alcance_dia_maximo   BIGINT,
  coste_resultado_cent BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    i.meta_id,
    COALESCE(SUM(i.gasto_cent), 0)::BIGINT   AS gasto_cent,
    COALESCE(SUM(i.impresiones), 0)::BIGINT  AS impresiones,
    COALESCE(SUM(i.clics), 0)::BIGINT        AS clics,
    COALESCE(SUM(i.resultados), 0)::BIGINT   AS resultados,
    COALESCE(MAX(i.alcance), 0)::BIGINT      AS alcance_dia_maximo,
    -- El coste por resultado se RECALCULA (gasto ÷ resultados). Promediar los
    -- costes diarios daría un número distinto y equivocado.
    CASE WHEN COALESCE(SUM(i.resultados), 0) > 0
         THEN ROUND(SUM(i.gasto_cent)::NUMERIC / SUM(i.resultados))::BIGINT
         ELSE NULL
    END AS coste_resultado_cent
  FROM public.meta_insights i
  WHERE i.empresa_id = p_empresa
    AND i.nivel = p_nivel
    AND i.dia BETWEEN p_desde AND p_hasta
  GROUP BY i.meta_id;
$$;

COMMENT ON FUNCTION public.meta_resumen_nivel IS
  'Resultados agregados por elemento de un nivel. Agrupa en BD (límite de 1000 filas). El alcance NO se suma: se devuelve el día mayor.';

-- ─── Campañas programadas ───────────────────────────────────────────
-- Programar = dejarla creada y en pausa, y que un cron la active a su hora.
-- La hora se guarda en UTC pero se anota TAMBIÉN la zona de la empresa con la
-- que se calculó: si mañana cambia la zona de la empresa, se puede saber qué
-- quiso decir quien programó, en vez de adivinar.
CREATE TABLE IF NOT EXISTS public.meta_programaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  campana_meta_id TEXT NOT NULL,
  arrancar_at     TIMESTAMPTZ NOT NULL,
  zona_horaria    TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','hecha','error','cancelada')),
  creada_por      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ejecutada_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una sola programación VIVA por campaña: reprogramar sustituye, no acumula.
-- Si no, una campaña con dos programaciones pendientes se activaría dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS meta_programaciones_una_viva
  ON public.meta_programaciones (empresa_id, campana_meta_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS meta_programaciones_pendientes_idx
  ON public.meta_programaciones (arrancar_at)
  WHERE estado = 'pendiente';

DROP TRIGGER IF EXISTS meta_programaciones_set_updated_at ON public.meta_programaciones;
CREATE TRIGGER meta_programaciones_set_updated_at
  BEFORE UPDATE ON public.meta_programaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_programaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_programaciones_select ON public.meta_programaciones;
CREATE POLICY meta_programaciones_select ON public.meta_programaciones FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

COMMENT ON TABLE public.meta_programaciones IS
  'Campañas de Meta que arrancan solas a una hora (PRP-087). La hora se fija con el reloj de la empresa.';
