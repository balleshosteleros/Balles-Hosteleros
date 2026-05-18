-- ============================================================
-- 20260518100000_empresas_rls_canonico.sql
--
-- Versiona en git la policy real de `public.empresas`.
--
-- Problema (Doc 4 §2): migración 002_align_profiles_and_roles.sql crea
-- la policy "Authenticated can view empresas" con `using (true)` —
-- cualquier authenticated lista TODAS las empresas (riesgo de
-- enumeración cross-tenant). En el remoto ya fue parcheada
-- manualmente a tenant-scoped vía la función user_has_empresa_access,
-- pero esa función y las nuevas policies NUNCA se versionaron: un
-- clon limpio aplicaba 002 y se quedaba con la policy abierta.
--
-- Esta migración es IDEMPOTENTE: crea solo lo que falte y reemplaza
-- la policy abierta por las tenant-scoped equivalentes al remoto.
--
-- Estado canónico (verificado con MCP el 2026-05-18):
--   pg_policies on public.empresas:
--     - empresas_select_by_access  SELECT  USING user_has_empresa_access(id)
--     - empresas_update_by_access  UPDATE  USING/CHECK user_has_empresa_access(id)
--   pg_proc:
--     - public.user_has_empresa_access(uuid) STABLE SECURITY DEFINER
--       SET search_path = public
--       SELECT EXISTS (SELECT 1 FROM user_empresas
--                       WHERE user_id = auth.uid() AND empresa_id = emp_id)
--
-- NOTA: user_has_empresa_access NO acepta el fallback profiles.empresa_id
-- (a diferencia del helper canónico is_member_of_empresa del Doc 4 §5.3).
-- Se mantiene el comportamiento exacto del remoto para no alterar acceso.
-- En la próxima pasada (Doc 4 §5) unificar a is_member_of_empresa.
-- ============================================================

-- 1. Función helper (idempotente vía CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.user_has_empresa_access(emp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_empresas
     WHERE user_id    = auth.uid()
       AND empresa_id = emp_id
  );
$$;

COMMENT ON FUNCTION public.user_has_empresa_access(uuid) IS
  'Doc 4 §5: true si auth.uid() es miembro de la empresa indicada (vía user_empresas). Usada por RLS de empresas. Equivalente histórico a is_member_of_empresa sin fallback profiles.';

-- Permisos: REVOKE de anon ya está en 094_security_hardening; aquí
-- garantizamos GRANT a authenticated para clones limpios.
REVOKE EXECUTE ON FUNCTION public.user_has_empresa_access(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_empresa_access(uuid) TO authenticated;

-- 2. Eliminar la policy abierta heredada de 002
DROP POLICY IF EXISTS "Authenticated can view empresas" ON public.empresas;

-- 3. Asegurar RLS habilitada (002 ya lo hizo, pero es idempotente)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- 4. Policies tenant-scoped canónicas (drop + create para fijar la forma)
DROP POLICY IF EXISTS empresas_select_by_access ON public.empresas;
DROP POLICY IF EXISTS empresas_update_by_access ON public.empresas;

CREATE POLICY empresas_select_by_access ON public.empresas
  FOR SELECT TO authenticated
  USING (public.user_has_empresa_access(id));

CREATE POLICY empresas_update_by_access ON public.empresas
  FOR UPDATE TO authenticated
  USING (public.user_has_empresa_access(id))
  WITH CHECK (public.user_has_empresa_access(id));

-- Nota intencional: NO se añaden policies de INSERT/DELETE. La creación
-- de empresas es operación de plataforma (gestionada vía service role en
-- código admin), no acción de usuario final. Sin policy = denegado por
-- defecto con RLS habilitada, que es el comportamiento deseado.

COMMENT ON POLICY empresas_select_by_access ON public.empresas IS
  'Doc 4 §5.1: usuario authenticated solo lee empresas donde es miembro (user_empresas).';
COMMENT ON POLICY empresas_update_by_access ON public.empresas IS
  'Doc 4 §5.1: usuario authenticated solo modifica empresas donde es miembro. Validación adicional de rol en código (server actions).';
