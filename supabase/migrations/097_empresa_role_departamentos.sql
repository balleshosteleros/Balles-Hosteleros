-- ============================================================
-- 097_empresa_role_departamentos.sql
--
-- Tabla puente M:N entre empresa_roles y departamentos.
-- Permite que un rol tenga UNO o VARIOS departamentos asignados.
--
-- Reemplaza el campo singular empresa_roles.departamento_id (que se
-- queda como "departamento principal" por compatibilidad pero pierde
-- relevancia funcional).
--
-- Backfill idempotente: si algún rol tiene departamento_id no nulo,
-- se replica como primera fila en la tabla puente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.empresa_role_departamentos (
  rol_id           uuid NOT NULL REFERENCES public.empresa_roles(id)  ON DELETE CASCADE,
  departamento_id  uuid NOT NULL REFERENCES public.departamentos(id)  ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rol_id, departamento_id)
);

-- Índice para acelerar lookups por departamento (ej: "qué roles tienen acceso a este departamento")
CREATE INDEX IF NOT EXISTS idx_erd_departamento ON public.empresa_role_departamentos(departamento_id);

-- ────────────────────────────────────────────────────────────
-- RLS: solo accesible para usuarios de la misma empresa que el rol
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.empresa_role_departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erd_read"   ON public.empresa_role_departamentos;
DROP POLICY IF EXISTS "erd_manage" ON public.empresa_role_departamentos;

CREATE POLICY "erd_read" ON public.empresa_role_departamentos FOR SELECT TO authenticated
  USING (rol_id IN (
    SELECT id FROM public.empresa_roles
    WHERE empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));

CREATE POLICY "erd_manage" ON public.empresa_role_departamentos FOR ALL TO authenticated
  USING (rol_id IN (
    SELECT id FROM public.empresa_roles
    WHERE empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ))
  WITH CHECK (rol_id IN (
    SELECT id FROM public.empresa_roles
    WHERE empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));

-- ────────────────────────────────────────────────────────────
-- Backfill: si algún rol tenía departamento_id, lo replicamos
-- en la tabla puente. Idempotente vía ON CONFLICT.
-- ────────────────────────────────────────────────────────────
INSERT INTO public.empresa_role_departamentos (rol_id, departamento_id)
SELECT id, departamento_id FROM public.empresa_roles
WHERE departamento_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- Helper: devuelve los departamento_id (uuid) asignados al rol
-- del usuario autenticado en una empresa concreta.
-- Resuelve la cadena: profiles.rol_label → empresa_roles.nombre → erd
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.departamentos_del_usuario(p_empresa_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT erd.departamento_id
  FROM public.empresa_role_departamentos erd
  JOIN public.empresa_roles er ON er.id = erd.rol_id
  JOIN public.profiles pr      ON pr.empresa_id = er.empresa_id
  WHERE pr.user_id = auth.uid()
    AND er.empresa_id = p_empresa_id
    AND lower(pr.rol_label) = lower(er.nombre);
$$;

-- Cerrar acceso anon a la función
REVOKE EXECUTE ON FUNCTION public.departamentos_del_usuario(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.departamentos_del_usuario(uuid) TO authenticated;
