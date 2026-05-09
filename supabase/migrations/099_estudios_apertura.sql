-- ============================================================
-- 099_estudios_apertura.sql
--
-- Tabla `estudios_apertura` para Dirección → Aperturas (estudios
-- de viabilidad de nuevos locales). NO confundir con la tabla
-- `aperturas` (027) que representa turnos diarios operativos.
--
-- Persistencia completa del estudio (datos, costes, procedencia,
-- destinos, amortización) en columnas JSONB + foto opcional en
-- bucket privado `estudios-apertura-fotos`.
--
-- Reglas:
--  · RLS estricto por empresa_id (patrón 091 / 096).
--  · Storage path: <empresa_id>/<estudio_id>.<ext>
--  · Bucket privado, sin listing público.
--  · Foto vinculada al estudio: al borrar el estudio se borra el
--    archivo desde el server action (no hay CASCADE de storage).
-- ============================================================

-- ── Tabla estudios_apertura ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.estudios_apertura (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  ciudad        text NOT NULL DEFAULT '',
  zona          text NOT NULL DEFAULT '',
  datos         jsonb NOT NULL DEFAULT '{}'::jsonb,
  facturacion   jsonb NOT NULL DEFAULT '{"lineas":[]}'::jsonb,
  costes        jsonb NOT NULL DEFAULT '{}'::jsonb,
  procedencia   jsonb NOT NULL DEFAULT '[]'::jsonb,
  destinos      jsonb NOT NULL DEFAULT '[]'::jsonb,
  amortizacion  jsonb NOT NULL DEFAULT '[]'::jsonb,
  foto_path     text,
  viabilidad    text NOT NULL DEFAULT 'viable'
                  CHECK (viabilidad IN ('viable','no_viable')),
  actividad     text NOT NULL DEFAULT 'activo'
                  CHECK (actividad IN ('activo','no_activo')),
  creado        date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT estudios_apertura_nombre_chk CHECK (char_length(trim(nombre)) > 0)
);

CREATE INDEX IF NOT EXISTS estudios_apertura_empresa_idx
  ON public.estudios_apertura (empresa_id, created_at DESC);

ALTER TABLE public.estudios_apertura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estudios_apertura_read"   ON public.estudios_apertura;
DROP POLICY IF EXISTS "estudios_apertura_manage" ON public.estudios_apertura;

CREATE POLICY "estudios_apertura_read" ON public.estudios_apertura FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = estudios_apertura.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles    p  WHERE p.user_id  = auth.uid() AND p.empresa_id  = estudios_apertura.empresa_id)
  );

CREATE POLICY "estudios_apertura_manage" ON public.estudios_apertura FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = estudios_apertura.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles    p  WHERE p.user_id  = auth.uid() AND p.empresa_id  = estudios_apertura.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = estudios_apertura.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles    p  WHERE p.user_id  = auth.uid() AND p.empresa_id  = estudios_apertura.empresa_id)
  );

-- ── Trigger updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_estudios_apertura_set_updated_at()
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

DROP TRIGGER IF EXISTS estudios_apertura_set_updated_at ON public.estudios_apertura;
CREATE TRIGGER estudios_apertura_set_updated_at
BEFORE UPDATE ON public.estudios_apertura
FOR EACH ROW EXECUTE FUNCTION public.tg_estudios_apertura_set_updated_at();

COMMENT ON TABLE public.estudios_apertura IS
  'Estudios de viabilidad para apertura de nuevos locales. NO confundir con aperturas (turnos diarios).';

-- ── Storage bucket privado para fotos ───────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estudios-apertura-fotos',
  'estudios-apertura-fotos',
  false,
  10485760, -- 10 MB
  ARRAY[
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

-- ── Storage policies (path: <empresa_id>/<estudio_id>.<ext>) ─
DROP POLICY IF EXISTS "estudios_apertura_fotos_read"   ON storage.objects;
DROP POLICY IF EXISTS "estudios_apertura_fotos_insert" ON storage.objects;
DROP POLICY IF EXISTS "estudios_apertura_fotos_update" ON storage.objects;
DROP POLICY IF EXISTS "estudios_apertura_fotos_delete" ON storage.objects;

CREATE POLICY "estudios_apertura_fotos_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'estudios-apertura-fotos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "estudios_apertura_fotos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'estudios-apertura-fotos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "estudios_apertura_fotos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'estudios-apertura-fotos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "estudios_apertura_fotos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'estudios-apertura-fotos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT p.empresa_id::text FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );
