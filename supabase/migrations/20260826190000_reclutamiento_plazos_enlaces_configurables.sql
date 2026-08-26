-- Plazos de caducidad de los enlaces de reclutamiento, configurables por empresa.
--
-- Hasta ahora los dos enlaces caducaban a los 7 días FIJOS en código:
--   · documentacion_dias_validez      → enlace del CANDIDATO para subir su documentación.
--   · gestoria_contrato_dias_validez  → enlace de la GESTORÍA para subir el contrato firmado.
--
-- Se pasan a Ajustes → RRHH → Reclutamiento. El valor por defecto (7) mantiene
-- EXACTAMENTE el comportamiento actual: quien no lo toque no nota ningún cambio.
-- Idempotente: se puede reejecutar sin efecto.

ALTER TABLE reclutamiento_config
  ADD COLUMN IF NOT EXISTS documentacion_dias_validez integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS gestoria_contrato_dias_validez integer NOT NULL DEFAULT 7;

-- Rango razonable: mínimo 1 día (un plazo de 0 dejaría el enlace muerto al nacer)
-- y máximo 90 (un enlace de subida de datos personales no debe vivir indefinido).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reclutamiento_config_documentacion_dias_chk'
  ) THEN
    ALTER TABLE reclutamiento_config
      ADD CONSTRAINT reclutamiento_config_documentacion_dias_chk
      CHECK (documentacion_dias_validez BETWEEN 1 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reclutamiento_config_gestoria_dias_chk'
  ) THEN
    ALTER TABLE reclutamiento_config
      ADD CONSTRAINT reclutamiento_config_gestoria_dias_chk
      CHECK (gestoria_contrato_dias_validez BETWEEN 1 AND 90);
  END IF;
END $$;

COMMENT ON COLUMN reclutamiento_config.documentacion_dias_validez IS
  'Días que vive el enlace personal con el que el candidato sube su documentación.';
COMMENT ON COLUMN reclutamiento_config.gestoria_contrato_dias_validez IS
  'Días que vive el enlace con el que la gestoría sube el contrato firmado.';
