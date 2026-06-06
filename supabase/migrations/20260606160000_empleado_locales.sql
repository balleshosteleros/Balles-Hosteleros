-- Multi-local de fichaje por empleado.
-- Hasta ahora un empleado solo podía fichar en UN local (empleados.local_id).
-- Ahora puede tener varios locales asignados, de cualquiera de las empresas a
-- las que pertenece (user_empresas). Tabla puente empleado_locales.
--
-- empleados.local_id se conserva como "local por defecto" (compat con lecturas
-- existentes: fichajes.local_id, conteos), pero la fuente de verdad del conjunto
-- de locales donde puede fichar pasa a ser esta tabla.

CREATE TABLE IF NOT EXISTS public.empleado_locales (
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  local_id    UUID NOT NULL REFERENCES public.locales(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empleado_id, local_id)
);

CREATE INDEX IF NOT EXISTS empleado_locales_empleado_idx ON public.empleado_locales(empleado_id);
CREATE INDEX IF NOT EXISTS empleado_locales_local_idx    ON public.empleado_locales(local_id);

-- Backfill: cada empleados.local_id actual -> una fila en la tabla puente.
INSERT INTO public.empleado_locales (empleado_id, local_id)
SELECT e.id, e.local_id
FROM public.empleados e
WHERE e.local_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.empleado_locales ENABLE ROW LEVEL SECURITY;

-- RLS multi-tenant: el local debe pertenecer a una empresa del usuario.
CREATE POLICY empleado_locales_select_empresa
  ON public.empleado_locales FOR SELECT TO authenticated
  USING (
    local_id IN (
      SELECT id FROM public.locales
      WHERE empresa_id IN (SELECT public.empresas_del_usuario())
    )
  );

CREATE POLICY empleado_locales_insert_empresa
  ON public.empleado_locales FOR INSERT TO authenticated
  WITH CHECK (
    local_id IN (
      SELECT id FROM public.locales
      WHERE empresa_id IN (SELECT public.empresas_del_usuario())
    )
  );

CREATE POLICY empleado_locales_delete_empresa
  ON public.empleado_locales FOR DELETE TO authenticated
  USING (
    local_id IN (
      SELECT id FROM public.locales
      WHERE empresa_id IN (SELECT public.empresas_del_usuario())
    )
  );
