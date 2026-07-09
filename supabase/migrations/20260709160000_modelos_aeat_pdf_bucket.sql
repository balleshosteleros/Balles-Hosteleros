-- ============================================================
-- 20260709160000_modelos_aeat_pdf_bucket.sql — PRP-072
-- Almacén de PDFs de modelos fiscales de gestoría.
--   1) Amplía el enum modelo_aeat_tipo con los tipos anuales/
--      documentales que aporta la gestoría (200, 190, PYG,
--      BALANCE, LIBRO_MAYOR).
--   2) Crea el bucket privado modelos-aeat-pdf con RLS por
--      empresa (patrón 096_documentos_storage.sql).
-- Idempotente: re-ejecutable sin efectos secundarios.
-- ============================================================

-- ─── 1. AMPLIAR ENUM modelo_aeat_tipo ──────────────────────
-- ALTER TYPE ... ADD VALUE es idempotente con IF NOT EXISTS (PG12+).
-- Debe ir en su propio bloque, sin usar los nuevos valores en la
-- misma transacción (gotcha: los valores nuevos no son visibles
-- hasta el commit).
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS '200';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS '190';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS 'PYG';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS 'BALANCE';
ALTER TYPE public.modelo_aeat_tipo ADD VALUE IF NOT EXISTS 'LIBRO_MAYOR';

-- ─── 2. BUCKET PRIVADO modelos-aeat-pdf ────────────────────
-- Path canónico: <empresa_id>/<ejercicio>/<periodo>/<tipo>_<timestamp>.pdf
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'modelos-aeat-pdf',
  'modelos-aeat-pdf',
  false,
  26214400, -- 25 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 3. STORAGE POLICIES (foldername[1] = empresa_id) ──────
-- Patrón idéntico a documentacion (096): user_empresas OR profiles.
DROP POLICY IF EXISTS "modelos_aeat_pdf_read"   ON storage.objects;
DROP POLICY IF EXISTS "modelos_aeat_pdf_insert" ON storage.objects;
DROP POLICY IF EXISTS "modelos_aeat_pdf_update" ON storage.objects;
DROP POLICY IF EXISTS "modelos_aeat_pdf_delete" ON storage.objects;

CREATE POLICY "modelos_aeat_pdf_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'modelos-aeat-pdf'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.usuario_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.usuarios p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "modelos_aeat_pdf_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'modelos-aeat-pdf'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.usuario_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.usuarios p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "modelos_aeat_pdf_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'modelos-aeat-pdf'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.usuario_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.usuarios p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "modelos_aeat_pdf_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'modelos-aeat-pdf'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.usuario_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.usuarios p WHERE p.user_id = auth.uid()
      )
    )
  );
