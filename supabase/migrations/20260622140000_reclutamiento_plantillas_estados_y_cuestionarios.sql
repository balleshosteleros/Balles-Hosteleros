-- Plantillas de RECLUTAMIENTO: tres tipos (Emails · Estados · Cuestionarios).
--
-- Contexto: la pestaña "Plantillas" de Reclutamiento gestiona 3 tipos de
-- plantilla. Al crear una vacante nueva se elige (1) una plantilla de ESTADOS
-- = la consecución de columnas del pipeline; (2) por cada estado, qué plantilla
-- de EMAIL se usa para avisar al candidato; y (3) opcionalmente una plantilla de
-- CUESTIONARIO para que el candidato rellene al inscribirse (independiente de
-- estados y emails).
--
-- Los textos de fábrica viven en src/lib/seeds/* y se propagan a todas las
-- empresas (presentes y futuras) de forma ADITIVA vía syncSeedsToAllEmpresas()
-- / seedEmpresaDefaults(). El cliente puede editar sin que el sync lo pise.

-- NOTA: la tabla `reclutamiento_email_plantillas` (1 fila por empresa×estado)
-- la gestiona otra migración/feature en paralelo; aquí NO se toca.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Plantillas de ESTADOS (consecución de columnas del pipeline).
--    `estados` es un jsonb: array de { key, label, color, fase, orden }.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reclutamiento_plantillas_estado (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre           text NOT NULL,
  descripcion      text,
  es_predeterminada boolean NOT NULL DEFAULT false,
  estados          jsonb NOT NULL DEFAULT '[]'::jsonb,
  activa           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reclutamiento_plantillas_estado_empresa_idx
  ON public.reclutamiento_plantillas_estado(empresa_id);

ALTER TABLE public.reclutamiento_plantillas_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reclutamiento_plantillas_estado_all ON public.reclutamiento_plantillas_estado;
CREATE POLICY reclutamiento_plantillas_estado_all ON public.reclutamiento_plantillas_estado
  FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.reclutamiento_plantillas_estado IS
  'Plantillas de estados (consecución del pipeline de candidatos) por empresa.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Plantillas de CUESTIONARIO para candidatos (al inscribirse en la vacante).
--    `preguntas` es un jsonb: array de { id, tipo, etiqueta, opciones, requerida }.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reclutamiento_plantillas_cuestionario (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  descripcion  text,
  preguntas    jsonb NOT NULL DEFAULT '[]'::jsonb,
  activa       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reclutamiento_plantillas_cuestionario_empresa_idx
  ON public.reclutamiento_plantillas_cuestionario(empresa_id);

ALTER TABLE public.reclutamiento_plantillas_cuestionario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reclutamiento_plantillas_cuestionario_all ON public.reclutamiento_plantillas_cuestionario;
CREATE POLICY reclutamiento_plantillas_cuestionario_all ON public.reclutamiento_plantillas_cuestionario
  FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.reclutamiento_plantillas_cuestionario IS
  'Plantillas de cuestionario que rellena el candidato al inscribirse en una vacante.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Vacantes: vinculación con las plantillas elegidas en el wizard de alta.
--    - plantilla_estado_id: qué plantilla de estados sigue el pipeline.
--    - email_plantillas: jsonb map { estado_key: email_plantilla_id }.
--    - cuestionario_plantilla_id: cuestionario que rellena el candidato (opcional).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vacantes
  ADD COLUMN IF NOT EXISTS plantilla_estado_id uuid
    REFERENCES public.reclutamiento_plantillas_estado(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email_plantillas jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cuestionario_plantilla_id uuid
    REFERENCES public.reclutamiento_plantillas_cuestionario(id) ON DELETE SET NULL;
