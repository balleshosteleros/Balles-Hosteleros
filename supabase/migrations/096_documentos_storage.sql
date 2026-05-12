-- ============================================================
-- 096_documentos_storage.sql
--
-- Tabla `documentos` para Dirección → Documentación + bucket
-- privado `documentacion` con policies por empresa, cuotas y
-- whitelist de tipos seguros.
--
-- Reglas:
--  · `documentos.carpeta_id` FK → `carpetas_documentos` (RESTRICT).
--  · RLS estricto patrón 091 (user_empresas OR profiles).
--  · Storage path: <empresa_id>/<carpeta_id>/<timestamp>_<filename>.
--  · Bucket privado, sin listing público (memoria 092).
--  · LÍMITES:
--       - 25 MB por archivo
--       - 500 documentos por carpeta
--       - 5000 documentos por empresa
--  · WHITELIST de MIME types: solo formatos ofimáticos / imágenes
--    seguros. Bloquea ejecutables, HTML/JS, scripts, etc.
-- ============================================================

-- ── Tabla documentos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  carpeta_id    uuid NOT NULL REFERENCES public.carpetas_documentos(id) ON DELETE RESTRICT,
  nombre        text NOT NULL,
  descripcion   text,
  storage_path  text NOT NULL,
  tipo_mime     text,
  tamano_bytes  bigint,
  estado        text NOT NULL DEFAULT 'vigente',
  nivel_acceso  text NOT NULL DEFAULT 'lectura',
  etiquetas     text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT documentos_nombre_chk CHECK (char_length(trim(nombre)) > 0),
  -- Tamaño máximo: 25 MB
  CONSTRAINT documentos_tamano_max
    CHECK (tamano_bytes IS NULL OR tamano_bytes <= 26214400),
  -- Whitelist MIME (solo formatos seguros)
  CONSTRAINT documentos_mime_whitelist
    CHECK (
      tipo_mime IS NULL OR tipo_mime IN (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
        'text/plain',
        'text/csv',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/heic',
        'image/heif'
      )
    )
);

CREATE INDEX IF NOT EXISTS documentos_empresa_carpeta_idx
  ON public.documentos (empresa_id, carpeta_id);
CREATE INDEX IF NOT EXISTS documentos_carpeta_idx
  ON public.documentos (carpeta_id);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_read"   ON public.documentos;
DROP POLICY IF EXISTS "doc_manage" ON public.documentos;

CREATE POLICY "doc_read" ON public.documentos FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = documentos.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = documentos.empresa_id)
  );

CREATE POLICY "doc_manage" ON public.documentos FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = documentos.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = documentos.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = documentos.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = documentos.empresa_id)
  );

-- ── Trigger updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_documentos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS documentos_set_updated_at ON public.documentos;
CREATE TRIGGER documentos_set_updated_at
BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.tg_documentos_set_updated_at();

-- ── Trigger de cuotas (carpeta + empresa) ───────────────────
CREATE OR REPLACE FUNCTION public.tg_documentos_check_quotas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  count_carpeta int;
  count_empresa int;
  max_carpeta CONSTANT int := 500;
  max_empresa CONSTANT int := 5000;
BEGIN
  SELECT count(*) INTO count_carpeta
  FROM public.documentos
  WHERE carpeta_id = NEW.carpeta_id;

  IF count_carpeta >= max_carpeta THEN
    RAISE EXCEPTION 'Límite de % documentos por carpeta alcanzado', max_carpeta
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO count_empresa
  FROM public.documentos
  WHERE empresa_id = NEW.empresa_id;

  IF count_empresa >= max_empresa THEN
    RAISE EXCEPTION 'Límite de % documentos por empresa alcanzado', max_empresa
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS documentos_check_quotas ON public.documentos;
CREATE TRIGGER documentos_check_quotas
BEFORE INSERT ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.tg_documentos_check_quotas();

-- ── Storage bucket privado con límites ─────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentacion',
  'documentacion',
  false,
  26214400, -- 25 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage policies (path: <empresa_id>/<carpeta_id>/<file>) ─
DROP POLICY IF EXISTS "documentacion_read"   ON storage.objects;
DROP POLICY IF EXISTS "documentacion_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentacion_update" ON storage.objects;
DROP POLICY IF EXISTS "documentacion_delete" ON storage.objects;

CREATE POLICY "documentacion_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentacion'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "documentacion_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentacion'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "documentacion_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentacion'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "documentacion_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentacion'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );
