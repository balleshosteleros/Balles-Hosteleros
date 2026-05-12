-- ============================================================
-- 098_rls_cronogramas_tareas_por_rol.sql
--
-- Cierra la RLS pendiente de cronogramas_operativos y tareas
-- usando los permisos por módulo guardados en empresa_roles.permisos.
--
-- MODELO:
-- · Cada rol tiene un array `permisos` con {modulo, ver, editar}.
-- · El usuario hereda los módulos del rol cuyo nombre coincide con
--   su `profiles.rol_label`.
-- · Los cronogramas/tareas filtran por `departamento` (texto en
--   mayúsculas) que coincide con el `modulo` del permiso.
--
-- (nueva_receta_gatekeeper y sub_estado se tratan en otra migración
-- aparte porque son de cocina/recetas, no de roles-departamentos.)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper: módulos visibles para el usuario autenticado.
-- Devuelve un set de strings (nombre del módulo en mayúsculas).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.modulos_del_usuario()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT elem->>'modulo'
  FROM public.profiles pr
  JOIN public.empresa_roles er
    ON er.empresa_id = pr.empresa_id
   AND lower(er.nombre) = lower(coalesce(pr.rol_label, ''))
  CROSS JOIN LATERAL jsonb_array_elements(er.permisos) elem
  WHERE pr.user_id = auth.uid()
    AND (elem->>'ver')::boolean = true;
$$;

REVOKE EXECUTE ON FUNCTION public.modulos_del_usuario() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.modulos_del_usuario() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 1. cronogramas_operativos
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cron_read"  ON public.cronogramas_operativos;
DROP POLICY IF EXISTS "cron_write" ON public.cronogramas_operativos;

CREATE POLICY "cron_read" ON public.cronogramas_operativos FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT pr.empresa_id FROM public.profiles pr WHERE pr.user_id = auth.uid())
  AND (
    departamento IS NULL
    OR departamento IN (SELECT * FROM public.modulos_del_usuario())
  )
);

CREATE POLICY "cron_write" ON public.cronogramas_operativos FOR ALL TO authenticated
USING (
  empresa_id IN (SELECT pr.empresa_id FROM public.profiles pr WHERE pr.user_id = auth.uid())
  AND (
    departamento IS NULL
    OR departamento IN (SELECT * FROM public.modulos_del_usuario())
  )
)
WITH CHECK (
  empresa_id IN (SELECT pr.empresa_id FROM public.profiles pr WHERE pr.user_id = auth.uid())
);

-- ────────────────────────────────────────────────────────────
-- 2. tareas
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tareas_write" ON public.tareas;

CREATE POLICY "tareas_write" ON public.tareas FOR ALL TO authenticated
USING (
  empresa_id IN (SELECT pr.empresa_id FROM public.profiles pr WHERE pr.user_id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (
      ref_tabla = 'cronogramas_operativos'
      AND EXISTS (
        SELECT 1 FROM public.cronogramas_operativos co
        WHERE co.id = tareas.ref_id
          AND (
            co.departamento IS NULL
            OR co.departamento IN (SELECT * FROM public.modulos_del_usuario())
          )
      )
    )
  )
)
WITH CHECK (
  empresa_id IN (SELECT pr.empresa_id FROM public.profiles pr WHERE pr.user_id = auth.uid())
);
