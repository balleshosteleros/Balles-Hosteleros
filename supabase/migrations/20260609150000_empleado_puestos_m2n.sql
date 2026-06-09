-- ============================================================================
-- empleado_puestos: un empleado puede ocupar VARIOS puestos (M:N).
-- Cada puesto aporta su propio horario (plantilla rrhh_patrones.puesto_id) y sus
-- condiciones (puesto_salarios). Uno de los puestos es el principal (es_principal),
-- del que cuelgan el departamento y el puesto-texto legacy de empleados (compat).
-- El rol (usuarios.rol_label) sigue siendo ÚNICO y va aparte (accesos al software).
-- Aplicada al remoto el 2026-06-09.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.empleado_puestos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id   uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  puesto_id     uuid NOT NULL REFERENCES public.puestos(id) ON DELETE CASCADE,
  es_principal  boolean NOT NULL DEFAULT false,
  vigente_desde date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empleado_id, puesto_id)
);

CREATE INDEX IF NOT EXISTS idx_empleado_puestos_empleado ON public.empleado_puestos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_empleado_puestos_puesto   ON public.empleado_puestos(puesto_id);

-- Solo un puesto principal por empleado
CREATE UNIQUE INDEX IF NOT EXISTS uq_empleado_puesto_principal
  ON public.empleado_puestos(empleado_id) WHERE es_principal;

ALTER TABLE public.empleado_puestos ENABLE ROW LEVEL SECURITY;

-- Gestión por la empresa del empleado (multi-tenant vía helper canónico)
CREATE POLICY empleado_puestos_empresa_rw ON public.empleado_puestos
  USING (EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = empleado_id AND e.empresa_id IN (SELECT empresas_del_usuario())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = empleado_id AND e.empresa_id IN (SELECT empresas_del_usuario())
  ));

-- El propio empleado puede leer sus puestos (para Mi Panel / buscador de tareas)
CREATE POLICY empleado_puestos_self_read ON public.empleado_puestos
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = empleado_id AND e.user_id = (SELECT auth.uid())
  ));

-- Backfill: enlaza coincidencias EXACTAS de empleados.puesto con el catálogo.
INSERT INTO public.empleado_puestos (empleado_id, puesto_id, es_principal)
SELECT e.id, p.id, true
FROM public.empleados e
JOIN public.puestos p
  ON p.empresa_id = e.empresa_id
 AND upper(trim(p.nombre)) = upper(trim(e.puesto))
WHERE e.puesto IS NOT NULL AND trim(e.puesto) <> ''
ON CONFLICT (empleado_id, puesto_id) DO NOTHING;
