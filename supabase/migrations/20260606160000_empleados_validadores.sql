-- Validadores por empleado: quién aprueba sus solicitudes de trabajo y de ausencias.
-- Cada validador es otro empleado de la misma empresa cuyo rol da acceso a RRHH.
-- ON DELETE SET NULL es la red de seguridad; el flujo de desactivación reasigna
-- antes de llegar a ese punto (es obligatorio que nunca quede huérfano).
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS validador_trabajo_id   uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validador_ausencias_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empleados_validador_trabajo   ON public.empleados(validador_trabajo_id);
CREATE INDEX IF NOT EXISTS idx_empleados_validador_ausencias ON public.empleados(validador_ausencias_id);

COMMENT ON COLUMN public.empleados.validador_trabajo_id   IS 'Empleado que valida las solicitudes de tipo trabajo de este empleado. Debe tener acceso a RRHH en su rol.';
COMMENT ON COLUMN public.empleados.validador_ausencias_id IS 'Empleado que valida las solicitudes de tipo ausencia de este empleado. Debe tener acceso a RRHH en su rol.';
