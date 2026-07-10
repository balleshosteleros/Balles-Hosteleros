-- Baja médica: parte/justificante adjunto (hasta 3 fotos o PDFs que el
-- trabajador sube al solicitar la baja desde Mi Panel). Los ficheros se FUSIONAN
-- en un ÚNICO PDF en el servidor y se guardan en el bucket `bajas-medicas`.
--
-- · Bucket PRIVADO (sin listing público), patrón idéntico a `empleados-docs`.
-- · Path: <empresa_id>/<solicitud_id>.pdf  (un PDF por solicitud de baja médica).
-- · ESCRITURA por service-role (createAdminClient) desde la server action; la
--   subida ignora RLS. LECTURA por usuarios autenticados de la empresa dueña.
-- · La columna `justificante_path` en `solicitudes_personal` guarda ese path.

-- ── Bucket ──────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bajas-medicas',
  'bajas-medicas',
  false,
  10485760, -- 10 MB por fichero
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

-- ── Storage policy (path: <empresa_id>/<solicitud_id>.pdf) ───────────────────
-- Solo SELECT para autenticados de la empresa dueña. Las escrituras van por
-- service-role (la server action), que ignora estas policies. Usa el helper
-- canónico `user_has_empresa_access(uuid)`.
DROP POLICY IF EXISTS "bajas_medicas_read" ON storage.objects;

CREATE POLICY "bajas_medicas_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bajas-medicas'
    AND public.user_has_empresa_access(((storage.foldername(name))[1])::uuid)
  );

-- ── Columna en solicitudes_personal ─────────────────────────────────────────
-- Path (dentro del bucket `bajas-medicas`) del PDF con el parte de baja fusionado.
-- NULL = el trabajador no adjuntó parte (es opcional).
ALTER TABLE public.solicitudes_personal
  ADD COLUMN IF NOT EXISTS justificante_path text;
