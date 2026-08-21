-- Validador de solicitudes: pasa de PERSONA a DEPARTAMENTO.
--
-- Antes: cada empleado tenía dos validadores personas concretas (uno de
-- trabajo y otro de ausencias) y solo esa persona podía aprobar. Eso obligaba
-- a reasignar cada vez que el validador causaba baja, y dejaba solicitudes sin
-- nadie que las resolviera.
--
-- Ahora: hay UN solo tipo de validador (de solicitudes) y no es una persona,
-- es un DEPARTAMENTO. Puede aprobar o denegar cualquier empleado activo cuyo
-- ROL le dé acceso a ese departamento (que es como funciona el acceso en todo
-- el software: por permiso configurado en el rol, no por pertenencia).
--
-- El departamento se define en el PUESTO y el empleado lo hereda al contratar,
-- igual que salario, jornada o convenio. Se puede cambiar en cada puesto.
--
-- Las columnas antiguas (validador_trabajo_id, validador_ausencias_id y sus
-- equivalentes _defecto_id en puestos) NO se borran: quedan sin uso como red
-- de seguridad para poder revertir. Se marcan como obsoletas en su comentario.
--
-- Idempotente.

-- 1. Departamento validador en el PUESTO (plantilla).
ALTER TABLE public.puestos
  ADD COLUMN IF NOT EXISTS validador_departamento_id uuid
    REFERENCES public.departamentos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.puestos.validador_departamento_id IS
  'Departamento que valida las solicitudes de quien ocupe este puesto. Puede aprobar cualquier empleado activo cuyo rol dé acceso a este departamento. Se hereda al empleado al contratar.';

-- 2. Departamento validador en el EMPLEADO (heredado del puesto).
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS validador_departamento_id uuid
    REFERENCES public.departamentos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.empleados.validador_departamento_id IS
  'Departamento que valida las solicitudes de este empleado. Puede aprobar cualquier empleado activo cuyo rol dé acceso a este departamento. Se hereda del puesto al contratar.';

CREATE INDEX IF NOT EXISTS idx_empleados_validador_departamento
  ON public.empleados(validador_departamento_id);
CREATE INDEX IF NOT EXISTS idx_puestos_validador_departamento
  ON public.puestos(validador_departamento_id);

-- 3. Relleno inicial: se toma el departamento que la empresa ya tenía
--    configurado como validador del ÁREA del empleado (operativa →
--    RECURSOS HUMANOS, administrativa → DIRECCIÓN por defecto). Así nadie se
--    queda sin validador al desplegar. Solo rellena lo que esté vacío.
UPDATE public.empleados e
SET validador_departamento_id = CASE d.area
  WHEN 'OPERATIVA'       THEN c.validador_depto_operativa_id
  WHEN 'ADMINISTRATIVA'  THEN c.validador_depto_administrativa_id
END
FROM public.departamentos d, public.empresa_rrhh_config c
WHERE d.id = e.departamento_id
  AND c.empresa_id = e.empresa_id
  AND e.validador_departamento_id IS NULL
  AND d.area IN ('OPERATIVA', 'ADMINISTRATIVA');

UPDATE public.puestos p
SET validador_departamento_id = CASE d.area
  WHEN 'OPERATIVA'       THEN c.validador_depto_operativa_id
  WHEN 'ADMINISTRATIVA'  THEN c.validador_depto_administrativa_id
END
FROM public.departamentos d, public.empresa_rrhh_config c
WHERE d.id = p.departamento_id
  AND c.empresa_id = p.empresa_id
  AND p.validador_departamento_id IS NULL
  AND d.area IN ('OPERATIVA', 'ADMINISTRATIVA');

-- 4. Marcar como obsoletas las columnas de validador-persona (no se borran).
COMMENT ON COLUMN public.empleados.validador_trabajo_id IS
  'OBSOLETO desde 2026-08-21: el validador es un departamento (validador_departamento_id), no una persona. Sin uso.';
COMMENT ON COLUMN public.empleados.validador_ausencias_id IS
  'OBSOLETO desde 2026-08-21: el validador es un departamento (validador_departamento_id), no una persona. Sin uso.';
COMMENT ON COLUMN public.puestos.validador_trabajo_defecto_id IS
  'OBSOLETO desde 2026-08-21: el validador es un departamento (validador_departamento_id), no una persona. Sin uso.';
COMMENT ON COLUMN public.puestos.validador_ausencias_defecto_id IS
  'OBSOLETO desde 2026-08-21: el validador es un departamento (validador_departamento_id), no una persona. Sin uso.';
