-- Calendario de vacaciones: pasa a definirse en el PUESTO y heredarse.
--
-- Antes: `empleados.calendario_vacaciones_id` existía, pero NINGÚN alta lo
-- rellenaba. Todo empleado nacía sin calendario y por tanto sin poder pedir
-- vacaciones, hasta que alguien pulsaba a mano el botón de asignación masiva
-- en RRHH → Calendarios. Un empleado nuevo se quedaba bloqueado sin avisar.
--
-- Ahora: el calendario se elige en el PUESTO (plantilla) y el empleado lo
-- hereda al contratar, igual que el departamento validador, el salario o el
-- convenio. Cada puesto puede llevar un calendario distinto, porque no todos
-- los puestos tienen los mismos días de vacaciones.
--
-- Idempotente.

-- 1. Calendario de vacaciones en el PUESTO (plantilla).
--    En `empleados` la columna ya existe (20260607160000).
ALTER TABLE public.puestos
  ADD COLUMN IF NOT EXISTS calendario_vacaciones_id uuid
    REFERENCES public.rrhh_calendarios_vacaciones(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.puestos.calendario_vacaciones_id IS
  'Calendario de vacaciones (días al año + periodos bloqueados) de quien ocupe este puesto. Se hereda al empleado al contratar. NULL = se usará el calendario predeterminado de la empresa si existe.';

CREATE INDEX IF NOT EXISTS idx_puestos_calendario_vacaciones
  ON public.puestos(calendario_vacaciones_id);

-- 2. Relleno inicial de los PUESTOS que aún no tienen calendario: se les pone
--    el predeterminado de su empresa (anio IS NULL = vale todos los años). Si
--    la empresa tiene varios, se coge el más antiguo para que sea estable
--    entre ejecuciones. Solo rellena lo vacío: no pisa nada configurado.
UPDATE public.puestos p
SET calendario_vacaciones_id = (
  SELECT c.id
  FROM public.rrhh_calendarios_vacaciones c
  WHERE c.empresa_id = p.empresa_id
    AND c.activo IS TRUE
    AND c.anio IS NULL
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE p.calendario_vacaciones_id IS NULL;

-- 3. Empleados que sigan sin calendario: heredan el de su puesto si se puede
--    resolver por nombre (empleados.puesto es TEXT, no FK), y si no, el
--    predeterminado de su empresa. Nadie se queda bloqueado para pedir
--    vacaciones. Solo rellena lo vacío.
UPDATE public.empleados e
SET calendario_vacaciones_id = COALESCE(
  (
    SELECT p.calendario_vacaciones_id
    FROM public.puestos p
    WHERE p.empresa_id = e.empresa_id
      AND upper(trim(p.nombre)) = upper(trim(e.puesto))
      AND p.calendario_vacaciones_id IS NOT NULL
    LIMIT 1
  ),
  (
    SELECT c.id
    FROM public.rrhh_calendarios_vacaciones c
    WHERE c.empresa_id = e.empresa_id
      AND c.activo IS TRUE
      AND c.anio IS NULL
    ORDER BY c.created_at ASC
    LIMIT 1
  )
)
WHERE e.calendario_vacaciones_id IS NULL;
