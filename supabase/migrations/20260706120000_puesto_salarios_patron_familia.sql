-- ============================================================================
-- Horario del puesto por SELECCIÓN (no por edición).
--   El horario se crea en Horarios (rrhh_patrones). En el puesto solo se elige
--   qué patrón aplica; queda en la plantilla del puesto y se hereda al empleado.
--   Guardamos la FAMILIA del patrón (no una versión concreta) para que, si en
--   Horarios se crea una nueva versión del patrón, el puesto y los empleados
--   heredados sigan siempre a la versión oficial vigente.
-- ============================================================================

BEGIN;

ALTER TABLE public.puesto_salarios
  ADD COLUMN IF NOT EXISTS patron_familia_id uuid;

COMMENT ON COLUMN public.puesto_salarios.patron_familia_id IS
  'Familia (rrhh_patrones.familia_id) del patrón de horario elegido para el puesto. NULL = sin horario asignado.';

COMMIT;
