-- Bucket privado para la DOCUMENTACIÓN de candidatos (paso «Documentación» del
-- pipeline de reclutamiento): DNI/NIE (anverso/reverso), IBAN y nº Seguridad
-- Social, en foto (móvil) o PDF.
--
-- · Bucket PRIVADO (sin listing público).
-- · Path: <empresa_id>/<candidato_id>/<tipo>.<ext>
--     tipo ∈ { dni_anverso, dni_reverso, iban, ss }
-- · La SUBIDA la hace el service-role desde el endpoint público
--   /api/documentacion (el candidato no tiene sesión) → bypassa RLS.
-- · La LECTURA (signed URLs en la ficha) la hacen usuarios autenticados de la
--   empresa propietaria: policy por empresa (mismo patrón que bucket
--   `documentacion`, migración 096).
-- · Whitelist: PDF + imágenes de móvil (incluye HEIC/HEIF de iPhone). 10 MB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentacion-candidatos',
  'documentacion-candidatos',
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

-- ── Storage policies (path: <empresa_id>/<candidato_id>/<file>) ──────────────
-- Solo SELECT para autenticados de la empresa propietaria (las escrituras van por
-- service-role desde el endpoint público, que ignora estas policies). Usa el
-- helper canónico `user_has_empresa_access(uuid)` (resuelve la unión de
-- pertenencia user_empresas ∪ profiles internamente).
DROP POLICY IF EXISTS "doc_candidatos_read" ON storage.objects;

CREATE POLICY "doc_candidatos_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentacion-candidatos'
    AND public.user_has_empresa_access(((storage.foldername(name))[1])::uuid)
  );
