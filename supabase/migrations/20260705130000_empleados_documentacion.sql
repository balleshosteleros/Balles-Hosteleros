-- Documentación identificativa del EMPLEADO (DNI/NIE, IBAN, Seguridad Social).
--
-- Al contratar a un candidato, los documentos que aportó en el paso
-- «Documentación» del reclutamiento se COPIAN a la ficha del empleado, de forma
-- que quedan guardados TAMBIÉN aquí (además de en el candidato). Así, aunque el
-- candidato se borre en el futuro, el empleado conserva sus documentos.
--
-- · Bucket PRIVADO `empleados-docs` (mismo patrón que `documentacion-candidatos`).
-- · Path: <empresa_id>/<empleado_id>/<tipo>.<ext>
--     tipo ∈ { dni_anverso, dni_reverso, iban, ss }
-- · La COPIA la hace el service-role al contratar → bypassa RLS.
-- · La LECTURA (signed URLs en la ficha) la hacen usuarios autenticados de la
--   empresa propietaria y el propio empleado.
-- Idempotente y aditivo.

-- 1) Columnas de paths en empleados (paralelas a las de candidatos) -----------
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS doc_dni_anverso_path text,
  ADD COLUMN IF NOT EXISTS doc_dni_reverso_path text,
  ADD COLUMN IF NOT EXISTS doc_iban_path text,
  ADD COLUMN IF NOT EXISTS doc_ss_path text;

COMMENT ON COLUMN public.empleados.doc_dni_anverso_path IS
  'Path en el bucket empleados-docs del DNI/NIE (anverso). Copiado del candidato al contratar.';
COMMENT ON COLUMN public.empleados.doc_dni_reverso_path IS
  'Path en el bucket empleados-docs del DNI/NIE (reverso). Copiado del candidato al contratar.';
COMMENT ON COLUMN public.empleados.doc_iban_path IS
  'Path en el bucket empleados-docs del documento del IBAN. Copiado del candidato al contratar.';
COMMENT ON COLUMN public.empleados.doc_ss_path IS
  'Path en el bucket empleados-docs del documento de la Seguridad Social. Copiado del candidato al contratar.';

-- 2) Bucket privado empleados-docs --------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empleados-docs',
  'empleados-docs',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage policies (path: <empresa_id>/<empleado_id>/<file>) ───────────────
-- Lectura para autenticados de la empresa propietaria (RRHH ve las fichas) y
-- para el propio empleado (sus fichas espejo). Las escrituras van por
-- service-role al contratar, que ignora estas policies.
DROP POLICY IF EXISTS "empleados_docs_read" ON storage.objects;
CREATE POLICY "empleados_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'empleados-docs'
    AND public.user_has_empresa_access(((storage.foldername(name))[1])::uuid)
  );
