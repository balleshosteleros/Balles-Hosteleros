-- Duración por defecto de una reserva (en minutos). Se usa para detectar
-- solapamientos al asignar mesa: una reserva ocupa la mesa desde su hora
-- hasta hora + duracion_reserva_min. Valor único por empresa, aplicable a
-- todos los planos y todas las reservas.
--
-- Rango admitido: 15 min (mínimo) – 360 min (6 h, máximo). Default 120 min.

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS duracion_reserva_min integer NOT NULL DEFAULT 120;

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_duracion_reserva_min_chk;

ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_duracion_reserva_min_chk
  CHECK (duracion_reserva_min BETWEEN 15 AND 360);

COMMENT ON COLUMN public.empresa_reservas_config.duracion_reserva_min IS
  'Duración por defecto de la reserva en minutos (15–360). Se usa para detectar solape al asignar mesa. Default 120.';
