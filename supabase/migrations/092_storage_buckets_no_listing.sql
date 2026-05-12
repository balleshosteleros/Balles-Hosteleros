-- ============================================================
-- 092_storage_buckets_no_listing.sql
--
-- Bloque C parte 2: cierra la enumeración de archivos en buckets
-- públicos (carta-fotos, paginas-web-assets).
--
-- ESTRATEGIA:
-- Los buckets siguen siendo public=true → las URLs públicas
-- (/storage/v1/object/public/...) siguen funcionando para mostrar
-- imágenes en la carta digital y en la página web pública.
-- Lo que cerramos es el LISTING vía API, que es lo que el linter
-- de Supabase detecta como riesgo de enumeración.
--
-- Sustituimos las policies amplias de SELECT TO anon,authenticated
-- por una scoped policy: cada usuario autenticado solo puede LISTAR
-- los archivos cuya ruta empieza por el slug de su empresa.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- carta-fotos: path = {empresa_slug}/{filename}
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "carta_fotos_public_read" ON storage.objects;

CREATE POLICY "carta_fotos_list_propio" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'carta-fotos'
  AND split_part(name, '/', 1) IN (
    SELECT e.slug FROM public.empresas e
    WHERE e.id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  )
);

-- ────────────────────────────────────────────────────────────
-- paginas-web-assets: bucket vacío hoy, asumimos misma convención
-- de path por empresa. Si el path es distinto, la policy fallará
-- silenciosamente (devuelve 0 filas) y se corrige cuando suba algo.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "paginas_web_assets_public_read" ON storage.objects;

CREATE POLICY "paginas_web_assets_list_propio" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'paginas-web-assets'
  AND split_part(name, '/', 1) IN (
    SELECT e.slug FROM public.empresas e
    WHERE e.id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  )
);
