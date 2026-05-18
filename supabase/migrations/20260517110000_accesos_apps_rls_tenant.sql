-- ============================================================
-- 20260517110000_accesos_apps_rls_tenant.sql
--
-- Endurece accesos_apps:
--   1. Añade empresa_id (uuid) FK a empresas.id, backfill desde empresa_slug.
--   2. Reemplaza las RLS abiertas por policies tenant-scoped que verifican
--      membership vía user_empresas o profiles.empresa_id.
--
-- Riesgo previo: RLS `using (true)` permitía a cualquier authenticated leer
-- credenciales (usuario/contrasena) de TODAS las empresas. Cross-tenant abierto.
--
-- Nota: la columna `contrasena` sigue devolviéndose porque la UI requiere
-- mostrarla a admins. El cifrado en reposo + endpoint separado de revelado
-- queda como mejora posterior; ya no es exposición cross-tenant.
-- ============================================================

-- 1. Columna empresa_id + backfill desde slug
ALTER TABLE public.accesos_apps
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

UPDATE public.accesos_apps a
   SET empresa_id = e.id
  FROM public.empresas e
 WHERE a.empresa_slug = e.slug
   AND a.empresa_id IS NULL;

-- Si algún registro queda sin empresa_id, NO falla la migración pero queda visible
-- para revisión manual (no se exigirá NOT NULL hasta confirmar 100%).
DO $$
DECLARE
  huerfanos int;
BEGIN
  SELECT count(*) INTO huerfanos FROM public.accesos_apps WHERE empresa_id IS NULL;
  IF huerfanos > 0 THEN
    RAISE WARNING '[accesos_apps] % filas sin empresa_id (slug sin match en empresas)', huerfanos;
  ELSE
    ALTER TABLE public.accesos_apps ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accesos_apps_empresa_id
  ON public.accesos_apps(empresa_id);

-- 2. Sustituir RLS abierta por tenant-scoped
DROP POLICY IF EXISTS "accesos_apps_auth_read"  ON public.accesos_apps;
DROP POLICY IF EXISTS "accesos_apps_auth_write" ON public.accesos_apps;

CREATE POLICY "accesos_apps_tenant_read" ON public.accesos_apps
  FOR SELECT TO authenticated
  USING (
    empresa_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.user_empresas ue
              WHERE ue.user_id = auth.uid() AND ue.empresa_id = accesos_apps.empresa_id)
      OR EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.user_id = auth.uid() AND p.empresa_id = accesos_apps.empresa_id)
    )
  );

CREATE POLICY "accesos_apps_tenant_write" ON public.accesos_apps
  FOR ALL TO authenticated
  USING (
    empresa_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.user_empresas ue
              WHERE ue.user_id = auth.uid() AND ue.empresa_id = accesos_apps.empresa_id)
      OR EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.user_id = auth.uid() AND p.empresa_id = accesos_apps.empresa_id)
    )
  )
  WITH CHECK (
    empresa_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.user_empresas ue
              WHERE ue.user_id = auth.uid() AND ue.empresa_id = accesos_apps.empresa_id)
      OR EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.user_id = auth.uid() AND p.empresa_id = accesos_apps.empresa_id)
    )
  );

COMMENT ON COLUMN public.accesos_apps.empresa_id IS
  'Tenant FK a empresas.id. Fuente de verdad para RLS. empresa_slug queda como espejo legacy.';
