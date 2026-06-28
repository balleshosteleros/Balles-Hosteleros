-- Candidatos: género, ubicación (localidad donde vive) y disponibilidad de
-- incorporación. Se capturan en el formulario público de empleo (obligatorios).
--   · genero          → 'masculino' | 'femenino'
--   · ubicacion       → texto libre de la localidad/barrio (autocompletado OSM)
--   · disponibilidad  → 'inmediato' | '15_dias'
-- Idempotente: solo añade las columnas si faltan. Aditivo (no rompe históricos).

ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS genero text,
  ADD COLUMN IF NOT EXISTS ubicacion text,
  ADD COLUMN IF NOT EXISTS disponibilidad text;
