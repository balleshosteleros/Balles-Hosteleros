-- ============================================================================
-- Patrones y turnos: rango de validez (fecha de inicio / fecha de fin)
-- ----------------------------------------------------------------------------
-- Un patrón (y un turno) pasa a tener un rango en el que es válido:
--   • vigente_desde : fecha de inicio. Por defecto hoy (current_date); editable
--                     hacia atrás. Obligatoria.
--   • vigente_hasta : fecha de fin. NULL = sin fecha final (vigente indefinido);
--                     editable hacia adelante.
--
-- Fuera de ese rango el patrón/turno NO debe usarse (lo aplica el motor de
-- horario en el fichaje y, cuando la pantalla de asignación esté estable, el
-- bloqueo al asignar a un empleado).
--
-- Cambio ADITIVO y retrocompatible: ADD COLUMN IF NOT EXISTS; los registros
-- existentes conservan su fecha real de alta como inicio y quedan sin fecha fin.
-- ============================================================================

-- ─── rrhh_patrones: rango de validez del patrón ─────────────────────────────
ALTER TABLE public.rrhh_patrones
  ADD COLUMN IF NOT EXISTS vigente_desde date,
  ADD COLUMN IF NOT EXISTS vigente_hasta date;

UPDATE public.rrhh_patrones
  SET vigente_desde = created_at::date
  WHERE vigente_desde IS NULL;

ALTER TABLE public.rrhh_patrones
  ALTER COLUMN vigente_desde SET DEFAULT current_date,
  ALTER COLUMN vigente_desde SET NOT NULL;

ALTER TABLE public.rrhh_patrones
  DROP CONSTRAINT IF EXISTS rrhh_patrones_rango_valido;
ALTER TABLE public.rrhh_patrones
  ADD CONSTRAINT rrhh_patrones_rango_valido
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde);

-- ─── rrhh_patron_empleados: fecha de la asignación al empleado ──────────────
ALTER TABLE public.rrhh_patron_empleados
  ADD COLUMN IF NOT EXISTS vigente_desde date;

UPDATE public.rrhh_patron_empleados
  SET vigente_desde = COALESCE(asignado_at::date, current_date)
  WHERE vigente_desde IS NULL;

ALTER TABLE public.rrhh_patron_empleados
  ALTER COLUMN vigente_desde SET DEFAULT current_date,
  ALTER COLUMN vigente_desde SET NOT NULL;

-- ─── rrhh_turnos: fecha de fin (la de inicio ya existe como vigente_desde) ──
ALTER TABLE public.rrhh_turnos
  ADD COLUMN IF NOT EXISTS vigente_hasta date;

ALTER TABLE public.rrhh_turnos
  DROP CONSTRAINT IF EXISTS rrhh_turnos_rango_valido;
ALTER TABLE public.rrhh_turnos
  ADD CONSTRAINT rrhh_turnos_rango_valido
  CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta >= vigente_desde);
