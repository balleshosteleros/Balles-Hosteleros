-- PERF: fusionar políticas permisivas duplicadas en la misma acción (lint
-- multiple_permissive_policies). Las permisivas se combinan con OR por
-- definición, así que fusionar N en una con USING (A OR B) es equivalente
-- en acceso, solo con menos evaluaciones. Incluye profiles y user_empresas,
-- tablas del camino de login.
-- Aplicado en prod vía MCP el 2026-06-06; este archivo versiona el cambio.

-- 1) escandallos: eliminar políticas duplicadas equivalentes (se conservan esc_read/esc_write)
DROP POLICY IF EXISTS escandallos_read  ON public.escandallos;
DROP POLICY IF EXISTS escandallos_write ON public.escandallos;

-- 2) firmas_documentos SELECT: fusionar empleado + empresa (OR)
DROP POLICY IF EXISTS fd_select_empleado ON public.firmas_documentos;
DROP POLICY IF EXISTS fd_select_empresa  ON public.firmas_documentos;
CREATE POLICY fd_select ON public.firmas_documentos
  FOR SELECT TO authenticated
  USING (
    (empleado_id IN ( SELECT e.id FROM empleados e WHERE (e.user_id = ( SELECT auth.uid() AS uid))))
    OR
    ((empresa_id IN ( SELECT p.empresa_id FROM profiles p WHERE (p.user_id = ( SELECT auth.uid() AS uid))))
     OR (empresa_id IN ( SELECT ue.empresa_id FROM user_empresas ue WHERE (ue.user_id = ( SELECT auth.uid() AS uid)))))
  );

-- 3) firmas_eventos SELECT: fusionar empleado + empresa (OR)
DROP POLICY IF EXISTS fe_select_empleado ON public.firmas_eventos;
DROP POLICY IF EXISTS fe_select_empresa  ON public.firmas_eventos;
CREATE POLICY fe_select ON public.firmas_eventos
  FOR SELECT TO authenticated
  USING (
    (documento_id IN ( SELECT d.id FROM firmas_documentos d
        WHERE (d.empleado_id IN ( SELECT e.id FROM empleados e WHERE (e.user_id = ( SELECT auth.uid() AS uid))))))
    OR
    (documento_id IN ( SELECT d.id FROM firmas_documentos d
        WHERE ((d.empresa_id IN ( SELECT p.empresa_id FROM profiles p WHERE (p.user_id = ( SELECT auth.uid() AS uid))))
            OR (d.empresa_id IN ( SELECT ue.empresa_id FROM user_empresas ue WHERE (ue.user_id = ( SELECT auth.uid() AS uid)))))))
  );

-- 4) profiles UPDATE: fusionar (uid=id) OR (uid=user_id)
DROP POLICY IF EXISTS "Users can update own profile"             ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile by user_id"  ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO public
  USING      ( (( SELECT auth.uid() AS uid) = id) OR (( SELECT auth.uid() AS uid) = user_id) )
  WITH CHECK ( (( SELECT auth.uid() AS uid) = id) OR (( SELECT auth.uid() AS uid) = user_id) );

-- 5) recordings INSERT: fusionar grabacion + onboarding (OR de WITH CHECK)
DROP POLICY IF EXISTS recordings_insert_grabacion  ON public.recordings;
DROP POLICY IF EXISTS recordings_insert_onboarding ON public.recordings;
CREATE POLICY recordings_insert ON public.recordings
  FOR INSERT TO public
  WITH CHECK (
    ((type = 'grabacion'::text) AND (empresa_id IN ( SELECT empresas_del_usuario() AS empresa_id)))
    OR
    ((type = 'onboarding'::text) AND (EXISTS ( SELECT 1 FROM profiles p
        WHERE ((p.user_id = ( SELECT auth.uid() AS uid))
           AND (lower(COALESCE(p.rol_label, ''::text)) = ANY (ARRAY['admin'::text, 'director'::text]))))))
  );

-- 6) user_empresas SELECT: fusionar admin + self (OR) — tabla del camino de login
DROP POLICY IF EXISTS user_empresas_admin_select ON public.user_empresas;
DROP POLICY IF EXISTS user_empresas_self_select  ON public.user_empresas;
CREATE POLICY user_empresas_select ON public.user_empresas
  FOR SELECT TO authenticated
  USING (
    (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.user_id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))
    OR
    (user_id = ( SELECT auth.uid() AS uid))
  );
