-- PRP-060 multi-empresa (Fase 4): agrupa los tramos por empresa de una misma
-- jornada continua del empleado (reparto multi-empresa) bajo una sesión común.
-- Columna ADITIVA y nullable: los fichajes de una sola empresa la dejan en NULL.
-- (Aplicada en vivo vía MCP el 2026-06-20; este fichero versiona el cambio.)

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS sesion_id uuid;

COMMENT ON COLUMN public.fichajes.sesion_id IS
  'PRP-060: agrupa los tramos por empresa de una misma jornada continua del empleado (reparto multi-empresa). NULL en fichajes de una sola empresa.';

CREATE INDEX IF NOT EXISTS idx_fichajes_sesion_id
  ON public.fichajes (sesion_id) WHERE sesion_id IS NOT NULL;
