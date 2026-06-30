-- ============================================================================
-- Formación: publicar/despublicar por TEMA (sección) y por LECCIÓN, y portada
-- de vídeo por lección.
-- ----------------------------------------------------------------------------
-- - `publicado` en secciones y lecciones (default true: lo existente sigue visible).
-- - `cover` en lecciones: URL/imagen de portada del vídeo.
-- El alumno solo ve secciones y lecciones con publicado = true (y curso publicado).
-- Idempotente.
-- ============================================================================

ALTER TABLE public.formacion_secciones
  ADD COLUMN IF NOT EXISTS publicado boolean NOT NULL DEFAULT true;

ALTER TABLE public.formacion_lecciones
  ADD COLUMN IF NOT EXISTS publicado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cover text;
