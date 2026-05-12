-- ============================================================
-- 100_estudios_apertura_local_marca_gastronomia.sql
--
-- Amplía `estudios_apertura` con tres bloques pensados para la
-- presentación a inversores:
--   · `local`                  → características físicas + ubicación
--                                geolocalizada + listas de fotos por
--                                categoría (fachada / interior / barra /
--                                terraza / cocina / aseos / almacen /
--                                parking / otras).
--   · `imagen_marca`           → claim, descripción, paleta, valores,
--                                tipografía y logo.
--   · `propuesta_gastronomica` → concepto, descripción, platos
--                                destacados (foto + nombre + precio)
--                                y enlaces a la carta.
--
-- Las fotos de estos bloques se almacenan en el bucket existente
-- `estudios-apertura-fotos` (creado en 099) bajo el path:
--    <empresa_id>/<estudio_id>/<categoria>/<uuid>.<ext>
-- donde categoría ∈ {fachada,interior,barra,terraza,cocina,aseos,
-- almacen,parking,otras,marca,gastronomia}. Las RLS de storage de
-- 099 ya cubren cualquier path
-- que empiece por <empresa_id>/, así que NO se añaden políticas.
-- ============================================================

ALTER TABLE public.estudios_apertura
  ADD COLUMN IF NOT EXISTS local                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS imagen_marca           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS propuesta_gastronomica jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.estudios_apertura.local IS
  'Características físicas del local + ubicación (lat/lng/dirección) + galerías de fotos por categoría.';
COMMENT ON COLUMN public.estudios_apertura.imagen_marca IS
  'Imagen de marca del proyecto: claim, descripción, paleta, valores, tipografía, logo.';
COMMENT ON COLUMN public.estudios_apertura.propuesta_gastronomica IS
  'Propuesta gastronómica: concepto, descripción, platos destacados (con fotos), enlace a carta.';
