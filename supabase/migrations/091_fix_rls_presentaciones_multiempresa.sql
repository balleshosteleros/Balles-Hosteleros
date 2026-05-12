-- ============================================================
-- 091_fix_rls_presentaciones_multiempresa.sql
--
-- Bug: el INSERT en `presentaciones` falla con
--   "new row violates row-level security policy for table presentaciones"
-- cuando el usuario tiene varias empresas en `user_empresas` y la cookie
-- `bh_empresa_activa` apunta a una distinta de `profiles.empresa_id`.
--
-- Las políticas vigentes (migración 089) sólo aceptan la empresa principal
-- de `profiles`. Otras tablas multi-empresa del proyecto ya usan el patrón
-- `EXISTS user_empresas` (con OR profiles como fallback). Aquí lo replicamos
-- para presentaciones, slides y branding.
-- ============================================================

-- ── PRESENTACIONES ──────────────────────────────────────────
DROP POLICY IF EXISTS "pres_read"   ON public.presentaciones;
DROP POLICY IF EXISTS "pres_manage" ON public.presentaciones;

CREATE POLICY "pres_read" ON public.presentaciones FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = presentaciones.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = presentaciones.empresa_id)
  );

CREATE POLICY "pres_manage" ON public.presentaciones FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = presentaciones.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = presentaciones.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = presentaciones.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = presentaciones.empresa_id)
  );

-- ── PRESENTACION_SLIDES (filtra via padre) ──────────────────
DROP POLICY IF EXISTS "slides_read"   ON public.presentacion_slides;
DROP POLICY IF EXISTS "slides_manage" ON public.presentacion_slides;

CREATE POLICY "slides_read" ON public.presentacion_slides FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.presentaciones pr
      WHERE pr.id = presentacion_slides.presentacion_id
        AND (
          EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = pr.empresa_id)
          OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = pr.empresa_id)
        )
    )
  );

CREATE POLICY "slides_manage" ON public.presentacion_slides FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.presentaciones pr
      WHERE pr.id = presentacion_slides.presentacion_id
        AND (
          EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = pr.empresa_id)
          OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = pr.empresa_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.presentaciones pr
      WHERE pr.id = presentacion_slides.presentacion_id
        AND (
          EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = pr.empresa_id)
          OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = pr.empresa_id)
        )
    )
  );

-- ── EMPRESA_BRANDING ────────────────────────────────────────
DROP POLICY IF EXISTS "brand_read"   ON public.empresa_branding;
DROP POLICY IF EXISTS "brand_manage" ON public.empresa_branding;

CREATE POLICY "brand_read" ON public.empresa_branding FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = empresa_branding.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = empresa_branding.empresa_id)
  );

CREATE POLICY "brand_manage" ON public.empresa_branding FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = empresa_branding.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = empresa_branding.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = empresa_branding.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = empresa_branding.empresa_id)
  );
