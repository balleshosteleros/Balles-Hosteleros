-- ============================================================================
-- Hardening de seguridad (a raíz del informe de advisors de Supabase)
-- ----------------------------------------------------------------------------
-- 1) Borra tablas de backup obsoletas que quedaron expuestas sin RLS.
-- 2) Endurece buckets públicos: quita el listado amplio, deja solo lectura
--    por URL directa (object access), en app-logos e inspeccion-imagenes.
-- 3) Restringe el borrado libre de likes de la carta digital.
-- Idempotente.
-- ============================================================================

-- 1) Tablas de backup obsoletas (sin RLS, sin FK que dependan de ellas).
--    Datos vivos viven en `roles` y `organigramas`; estas son copias puntuales.
DROP TABLE IF EXISTS public._roles_backup_063;
DROP TABLE IF EXISTS public.organigramas_backup_20260610;

-- 2) Buckets públicos: quitar la policy de SELECT amplia que permite listar
--    TODOS los archivos. El código sirve estas imágenes con getPublicUrl()
--    (acceso por URL pública directa), que NO pasa por policies de SELECT.
--    Por tanto basta con eliminar la policy de listado: las imágenes se siguen
--    viendo por URL, pero ya nadie puede enumerar el bucket entero vía API.
DROP POLICY IF EXISTS app_logos_public_read ON storage.objects;
DROP POLICY IF EXISTS inspeccion_imagenes_public_read ON storage.objects;

-- 3) Likes de carta digital: impedir el borrado libre por anónimos.
--    El modelo es "1 voto por dispositivo, irreversible" (no se des-vota),
--    así que no debe existir un DELETE abierto.
DROP POLICY IF EXISTS carta_likes_public_delete ON public.carta_item_likes;
