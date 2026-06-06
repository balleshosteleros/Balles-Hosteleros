-- Configuración de RECONFIRMACIÓN automática por correo.
--
-- Reglas de producto:
--   · `reconfirmacion_activa` es el master toggle. Si es false, no se envía
--     ningún correo de reconfirmación (ni el cron ni el inmediato).
--   · Cuando está activa, el correo se envía SIEMPRE a la misma hora de la
--     reserva, X días antes (1–7) según `reconfirmacion_dias_antes`.
--   · Para reservas creadas con MENOS antelación que ese lead time, no da
--     tiempo a programar el envío. El flag `reconfirmacion_envio_inmediato`
--     decide qué hacer en ese caso:
--       - true:  se envía la reconfirmación INMEDIATAMENTE tras el correo
--                de confirmación.
--       - false: NO se envía reconfirmación.
--     Para reservas con antelación >= lead time, el cron envía siempre a la
--     hora programada, independientemente de este flag.

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS reconfirmacion_activa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reconfirmacion_dias_antes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reconfirmacion_envio_inmediato boolean NOT NULL DEFAULT false;

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_reconfirmacion_dias_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_reconfirmacion_dias_chk
  CHECK (reconfirmacion_dias_antes BETWEEN 1 AND 7);

COMMENT ON COLUMN public.empresa_reservas_config.reconfirmacion_activa IS
  'Master toggle: si false, no se envía ningún correo de reconfirmación.';
COMMENT ON COLUMN public.empresa_reservas_config.reconfirmacion_dias_antes IS
  'Días de antelación a los que se envía el correo de reconfirmación (1-7). El correo se envía a la misma hora de la reserva. Default 1.';
COMMENT ON COLUMN public.empresa_reservas_config.reconfirmacion_envio_inmediato IS
  'Si true, las reservas creadas con menos antelación que reconfirmacion_dias_antes reciben el correo de reconfirmación inmediatamente tras el de confirmación. Si false, esas reservas NO reciben reconfirmación.';
