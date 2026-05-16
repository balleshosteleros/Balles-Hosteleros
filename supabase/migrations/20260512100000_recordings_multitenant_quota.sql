-- Recordings multi-tenant + cuota global de fase beta (R2 free tier).
--
-- Cambios:
--   1. Crea recordings si no existe (consolida la 072 que no se aplicó en remoto).
--   2. Añade empresa_id, owner_user_id, type, r2_key.
--   3. type = 'grabacion' (por defecto) | 'onboarding' (videos compartidos por todas las empresas).
--   4. Reemplaza la RLS abierta por aislamiento por empresa + onboarding visible para autenticados.
--   5. Vista storage_usage_global para chequeo de cuota desde el endpoint.
--   6. Constante (vía vista) STORAGE_LIMIT_BYTES = 9.5 GB para no rozar el free tier de 10 GB de R2.

-- 0. Tabla base (idempotente — si ya existe, no toca nada)
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  duration integer DEFAULT 0,
  file_size bigint DEFAULT 0,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- 1. Columnas nuevas
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'grabacion'
    CHECK (type IN ('grabacion', 'onboarding')),
  ADD COLUMN IF NOT EXISTS r2_key text;

-- Coherencia: grabaciones requieren empresa_id; onboarding NO debe tener empresa_id
ALTER TABLE public.recordings
  DROP CONSTRAINT IF EXISTS recordings_type_empresa_check;
ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_type_empresa_check CHECK (
    (type = 'grabacion' AND empresa_id IS NOT NULL)
    OR (type = 'onboarding' AND empresa_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_recordings_empresa ON public.recordings(empresa_id);
CREATE INDEX IF NOT EXISTS idx_recordings_type ON public.recordings(type);

-- 2. RLS: reemplazar la policy abierta de la migración 072
DROP POLICY IF EXISTS "Allow authenticated users to manage their recordings" ON public.recordings;

-- Lectura: las grabaciones de mi empresa + todos los onboarding
CREATE POLICY recordings_select ON public.recordings
  FOR SELECT
  USING (
    type = 'onboarding'
    OR empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Insert de grabaciones: solo en mi propia empresa
CREATE POLICY recordings_insert_grabacion ON public.recordings
  FOR INSERT
  WITH CHECK (
    type = 'grabacion'
    AND empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Insert de onboarding: solo admin/director (gestión interna nuestra)
CREATE POLICY recordings_insert_onboarding ON public.recordings
  FOR INSERT
  WITH CHECK (
    type = 'onboarding'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND lower(coalesce(p.rol_label, '')) IN ('admin', 'director')
    )
  );

-- Update / Delete: dueño del archivo o admin/director de su empresa
CREATE POLICY recordings_update ON public.recordings
  FOR UPDATE
  USING (
    owner_user_id = auth.uid()
    OR (
      empresa_id IN (
        SELECT p.empresa_id FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND lower(coalesce(p.rol_label, '')) IN ('admin', 'director')
      )
    )
  );

CREATE POLICY recordings_delete ON public.recordings
  FOR DELETE
  USING (
    owner_user_id = auth.uid()
    OR (
      empresa_id IN (
        SELECT p.empresa_id FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND lower(coalesce(p.rol_label, '')) IN ('admin', 'director')
      )
    )
  );

-- 3. Vista de uso global (suma TOTAL en bytes, sin importar empresa).
--    Usada por el endpoint para frenar uploads cuando rocemos el free tier de R2.
CREATE OR REPLACE VIEW public.storage_usage_global AS
SELECT
  COALESCE(SUM(file_size), 0)::bigint AS bytes_used,
  (9.5 * 1024 * 1024 * 1024)::bigint AS bytes_limit, -- 9.5 GB margen sobre los 10 GB free de R2
  COUNT(*)::int AS files_count
FROM public.recordings;

GRANT SELECT ON public.storage_usage_global TO authenticated;

-- 4. Vista de uso por empresa (útil para mostrar barra "X GB / Y GB" en UI por empresa)
CREATE OR REPLACE VIEW public.storage_usage_por_empresa AS
SELECT
  empresa_id,
  COALESCE(SUM(file_size), 0)::bigint AS bytes_used,
  COUNT(*)::int AS files_count
FROM public.recordings
WHERE type = 'grabacion'
GROUP BY empresa_id;

GRANT SELECT ON public.storage_usage_por_empresa TO authenticated;

-- Las vistas en Supabase se crean SECURITY DEFINER por defecto. Forzar INVOKER
-- para que respeten la RLS de recordings cuando las consulte un usuario normal.
ALTER VIEW public.storage_usage_global SET (security_invoker = on);
ALTER VIEW public.storage_usage_por_empresa SET (security_invoker = on);
