-- ============================================================
-- 20260517100000_estudios_apertura_cerrar_anon.sql
--
-- Cierra el acceso público (anon) directo a `estudios_apertura`.
-- La policy original permitía `SELECT WHERE share_active = true`,
-- lo que dejaba enumerar todos los estudios activos con la anon key
-- (sin necesidad de conocer el slug).
--
-- El acceso público legítimo se sirve server-side desde
-- `fetchEstudioPorSlug()` con service-role, así que no hay regresión
-- de funcionalidad.
-- ============================================================

DROP POLICY IF EXISTS "estudios_apertura_public_read" ON public.estudios_apertura;

COMMENT ON COLUMN public.estudios_apertura.share_slug IS
  'Slug público compartible. Lectura pública únicamente vía endpoint server-side con service-role.';
