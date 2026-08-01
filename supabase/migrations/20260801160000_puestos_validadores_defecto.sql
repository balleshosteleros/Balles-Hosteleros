-- Validadores por defecto en el PUESTO (plantilla).
--
-- Igual que el puesto ya define salario, jornada, convenio, etc. que se copian
-- al empleado al contratar, ahora define también quién validará por defecto sus
-- solicitudes de trabajo y de ausencias. Al contratar desde reclutamiento, el
-- empleado hereda estos dos validadores (ver contratacion-actions.ts).
--
-- Ambos son opcionales a nivel de esquema (un puesto puede quedar sin definir);
-- si al contratar están vacíos, el empleado se crea sin validador y se avisa a
-- RRHH para que lo asigne a mano. FK a empleados con ON DELETE SET NULL: si el
-- empleado validador se borra, la plantilla queda sin validador (no rompe).
--
-- Idempotente.

ALTER TABLE puestos
  ADD COLUMN IF NOT EXISTS validador_trabajo_defecto_id uuid
    REFERENCES empleados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validador_ausencias_defecto_id uuid
    REFERENCES empleados(id) ON DELETE SET NULL;

COMMENT ON COLUMN puestos.validador_trabajo_defecto_id IS
  'Empleado que valida por defecto las solicitudes de TRABAJO de quien ocupe este puesto. Se hereda al empleado al contratar.';
COMMENT ON COLUMN puestos.validador_ausencias_defecto_id IS
  'Empleado que valida por defecto las solicitudes de AUSENCIA de quien ocupe este puesto. Se hereda al empleado al contratar.';
