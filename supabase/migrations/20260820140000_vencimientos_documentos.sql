-- Documentos oficiales de cada vencimiento: el acta del extintor, la licencia
-- de terraza, la poliza del seguro... Varios por vencimiento y pesados, asi que
-- el navegador los sube DIRECTO al bucket con URL firmada (salta el limite de
-- 4,5 MB del body de las Server Actions).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vencimientos-docs', 'vencimientos-docs', false, 524288000)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

CREATE TABLE IF NOT EXISTS public.vencimientos_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vencimiento_id uuid NOT NULL REFERENCES public.revisiones(id) ON DELETE CASCADE,
  empresa_id text NOT NULL,
  path text NOT NULL,
  nombre text NOT NULL,
  tamano bigint,
  mime text,
  subido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vencimientos_documentos_idx
  ON public.vencimientos_documentos (vencimiento_id, created_at DESC);

ALTER TABLE public.vencimientos_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vencimientos_documentos_read ON public.vencimientos_documentos;
CREATE POLICY vencimientos_documentos_read
  ON public.vencimientos_documentos FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario_text()));

DROP POLICY IF EXISTS vencimientos_documentos_write ON public.vencimientos_documentos;
CREATE POLICY vencimientos_documentos_write
  ON public.vencimientos_documentos FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario_text()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario_text()));

-- Acceso al bucket: cada empresa solo su carpeta (primer segmento = empresa_id).
DROP POLICY IF EXISTS vencimientos_docs_read ON storage.objects;
CREATE POLICY vencimientos_docs_read
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vencimientos-docs'
    AND (storage.foldername(name))[1] IN (SELECT empresas_del_usuario_text())
  );

DROP POLICY IF EXISTS vencimientos_docs_insert ON storage.objects;
CREATE POLICY vencimientos_docs_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vencimientos-docs'
    AND (storage.foldername(name))[1] IN (SELECT empresas_del_usuario_text())
  );

DROP POLICY IF EXISTS vencimientos_docs_delete ON storage.objects;
CREATE POLICY vencimientos_docs_delete
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vencimientos-docs'
    AND (storage.foldername(name))[1] IN (SELECT empresas_del_usuario_text())
  );
