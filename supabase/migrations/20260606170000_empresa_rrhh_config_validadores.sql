-- Configuración RRHH por empresa: de qué departamento salen los validadores
-- según el ÁREA del empleado validado. Default: operativa→RECURSOS HUMANOS,
-- administrativa→DIRECCIÓN. Aplica a las dos columnas (trabajo y ausencias).
CREATE TABLE IF NOT EXISTS public.empresa_rrhh_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  validador_depto_operativa_id      uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  validador_depto_administrativa_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  -- Si true, al validador le sale una tarea en Mi Panel mientras tenga
  -- solicitudes pendientes de aprobar/denegar.
  tareas_validador_activo boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_rrhh_config_empresa
  ON public.empresa_rrhh_config(empresa_id);

ALTER TABLE public.empresa_rrhh_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_rrhh_config_rw ON public.empresa_rrhh_config;
CREATE POLICY empresa_rrhh_config_rw ON public.empresa_rrhh_config
  FOR ALL TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP TRIGGER IF EXISTS empresa_rrhh_config_set_updated_at ON public.empresa_rrhh_config;
CREATE TRIGGER empresa_rrhh_config_set_updated_at
  BEFORE UPDATE ON public.empresa_rrhh_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defaults para todas las empresas existentes: operativa→RECURSOS HUMANOS,
-- administrativa→DIRECCIÓN (resuelto por nombre dentro de cada empresa).
INSERT INTO public.empresa_rrhh_config (empresa_id, validador_depto_operativa_id, validador_depto_administrativa_id)
SELECT e.id,
  (SELECT d.id FROM public.departamentos d WHERE d.empresa_id = e.id AND upper(trim(d.nombre)) = 'RECURSOS HUMANOS' LIMIT 1),
  (SELECT d.id FROM public.departamentos d WHERE d.empresa_id = e.id AND upper(trim(d.nombre)) = 'DIRECCIÓN' LIMIT 1)
FROM public.empresas e
ON CONFLICT (empresa_id) DO NOTHING;
