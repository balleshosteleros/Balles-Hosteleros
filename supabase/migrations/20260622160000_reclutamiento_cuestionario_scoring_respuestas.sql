-- Cuestionarios de vacantes: scoring (nota 0–10) + respuestas del candidato.
--
-- Parte de la base creada en 20260622140000 (tabla
-- `reclutamiento_plantillas_cuestionario` + `vacantes.cuestionario_plantilla_id`).
-- Aquí se añade:
--   1. `es_default` en la plantilla → cuestionario genérico por defecto de la
--      empresa (uno por empresa). El contenido canónico vive en
--      src/lib/seeds/reclutamiento-cuestionario-default.ts y se propaga vía
--      syncSeedsToAllEmpresas() / seedEmpresaDefaults() (aditivo).
--   2. CHECK de máximo 20 preguntas por cuestionario.
--   3. Tabla `candidato_cuestionario_respuestas`: lo que contesta el candidato
--      en el portal, con SNAPSHOT verbatim de las preguntas usadas + la nota
--      calculada en servidor (nunca se recalcula → el histórico no se rompe
--      aunque la plantilla se edite o borre).
--
-- Modelo de pregunta (jsonb en `preguntas`), forma canónica:
--   { "id": "p1", "titulo": "…", "tipo": "eleccion_multiple",
--     "obligatoria": true,
--     "opciones": [ { "id": "o1", "texto": "…", "correcta": true }, … ] }
-- Nota del candidato = (aciertos / total_preguntas) * 10.
-- Acierto = la opción elegida tiene "correcta": true.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Plantilla por defecto + tope de 20 preguntas.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.reclutamiento_plantillas_cuestionario
  ADD COLUMN IF NOT EXISTS es_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.reclutamiento_plantillas_cuestionario
  DROP CONSTRAINT IF EXISTS reclutamiento_plantillas_cuestionario_max_20;
ALTER TABLE public.reclutamiento_plantillas_cuestionario
  ADD CONSTRAINT reclutamiento_plantillas_cuestionario_max_20
  CHECK (
    preguntas IS NULL
    OR jsonb_typeof(preguntas) <> 'array'
    OR jsonb_array_length(preguntas) <= 20
  );

-- Un único cuestionario "por defecto" por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS reclutamiento_plantillas_cuestionario_default_unq
  ON public.reclutamiento_plantillas_cuestionario(empresa_id)
  WHERE es_default;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Respuestas del candidato al cuestionario (1 por candidato).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.candidato_cuestionario_respuestas (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  candidato_id              uuid NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
  cuestionario_plantilla_id uuid REFERENCES public.reclutamiento_plantillas_cuestionario(id) ON DELETE SET NULL,
  cuestionario_nombre       text,
  -- Copia verbatim de las preguntas tal como estaban al responder.
  preguntas_snapshot        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Respuestas: { preguntaId: opcionId }.
  respuestas                jsonb NOT NULL DEFAULT '{}'::jsonb,
  aciertos                  integer NOT NULL DEFAULT 0,
  total_preguntas           integer NOT NULL DEFAULT 0,
  nota                      numeric(4,2) NOT NULL DEFAULT 0,
  respondido_at             timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- 1 respuesta por candidato (una candidatura = un cuestionario).
CREATE UNIQUE INDEX IF NOT EXISTS candidato_cuestionario_respuestas_candidato_unq
  ON public.candidato_cuestionario_respuestas(candidato_id);

CREATE INDEX IF NOT EXISTS candidato_cuestionario_respuestas_empresa_idx
  ON public.candidato_cuestionario_respuestas(empresa_id);

CREATE INDEX IF NOT EXISTS candidato_cuestionario_respuestas_plantilla_idx
  ON public.candidato_cuestionario_respuestas(cuestionario_plantilla_id);

ALTER TABLE public.candidato_cuestionario_respuestas ENABLE ROW LEVEL SECURITY;

-- Los gestores de la empresa ven/gestionan las respuestas. El alta pública la
-- hace el endpoint /api/empleo/candidatura con service role (bypassa RLS).
DROP POLICY IF EXISTS candidato_cuestionario_respuestas_all ON public.candidato_cuestionario_respuestas;
CREATE POLICY candidato_cuestionario_respuestas_all ON public.candidato_cuestionario_respuestas
  FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.candidato_cuestionario_respuestas IS
  'Respuestas del candidato al cuestionario de la vacante + nota (0–10) calculada en servidor. Guarda snapshot verbatim de las preguntas.';
