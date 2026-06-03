-- Configuración de RECONFIRMACIÓN automática por correo.
--
-- Reglas de producto:
--   · El correo de reconfirmación se envía SIEMPRE a la misma hora de la
--     reserva, X días antes (1–7). Por eso el mínimo de antelación es 24 h
--     y la opción más cercana en el tiempo es "1 día antes".
--   · Para reservas creadas con menos de 24 h de antelación NO da tiempo a
--     enviar el correo a "X días antes". El flag `reconfirmacion_lt_24h_inmediata`
--     decide qué hacer en ese caso:
--       - true:  se envía un correo de reconfirmación INMEDIATAMENTE después
--                del de confirmación.
--       - false: NO se envía correo de reconfirmación.
--     Para reservas con ≥24 h de antelación el correo siempre se envía a la
--     hora programada, independientemente de este flag.

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS reconfirmacion_dias_antes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reconfirmacion_lt_24h_inmediata boolean NOT NULL DEFAULT false;

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_reconfirmacion_dias_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_reconfirmacion_dias_chk
  CHECK (reconfirmacion_dias_antes BETWEEN 1 AND 7);

COMMENT ON COLUMN public.empresa_reservas_config.reconfirmacion_dias_antes IS
  'Días de antelación a los que se envía el correo de reconfirmación (1–7). El correo se envía a la misma hora de la reserva. Default 1.';
COMMENT ON COLUMN public.empresa_reservas_config.reconfirmacion_lt_24h_inmediata IS
  'Si true, las reservas creadas con <24 h reciben el correo de reconfirmación inmediatamente después del de confirmación. Si false, no reciben reconfirmación.';
