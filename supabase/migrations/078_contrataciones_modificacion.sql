-- Extender contrataciones para soportar 'modificacion'
ALTER TABLE public.contrataciones
  DROP CONSTRAINT IF EXISTS contrataciones_tipo_check;

ALTER TABLE public.contrataciones
  ADD CONSTRAINT contrataciones_tipo_check
  CHECK (tipo IN ('alta','baja','modificacion'));

ALTER TABLE public.contrataciones
  ADD COLUMN IF NOT EXISTS modificacion_tipo text,
  ADD COLUMN IF NOT EXISTS modificacion_detalle text,
  ADD COLUMN IF NOT EXISTS fecha_cambio date;
