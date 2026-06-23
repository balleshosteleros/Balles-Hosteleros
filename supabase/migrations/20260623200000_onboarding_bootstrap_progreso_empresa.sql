-- PRP-067: progreso del onboarding (bootstrap) por empresa.
-- Una fila por empresa × paso. El estado "completado" se DERIVA de conteos
-- reales en la app; aquí solo persistimos señales no derivables (omitido / en
-- progreso) y la marca de completado. Idempotente.

CREATE TABLE IF NOT EXISTS empresa_onboarding_pasos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  paso_key TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_progreso','completado','omitido')),
  completado_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, paso_key)
);

ALTER TABLE empresa_onboarding_pasos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_onboarding_pasos_rw ON empresa_onboarding_pasos;
CREATE POLICY empresa_onboarding_pasos_rw ON empresa_onboarding_pasos
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

-- Flag global para dejar de auto-lanzar el asistente cuando termina.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS onboarding_completado_at TIMESTAMPTZ;
