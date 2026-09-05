-- Reconfirmación EL MISMO DÍA de la reserva.
--
-- Antes el mínimo era "1 día antes", y ahí había un agujero por el que se
-- caían clientes: la pasada de las 10:00 que le tocaba a una reserva ocurría
-- el día ANTERIOR, así que quien reservaba por la tarde/noche —cuando esa
-- pasada ya había ocurrido— no lo recogía nadie. La pasada del día siguiente
-- miraba ya al día de después y lo dejaba atrás para siempre. En Sala salía
-- como CONFIRMADA, igual que quien sí había sido preguntado.
--
-- Con `reconfirmacion_dias_antes = 0` el correo sale a las 10:00 del MISMO día
-- de la reserva ("El mismo día" en Ajustes), que es lo natural en un
-- restaurante: por la mañana se pregunta por los servicios de hoy. Quien
-- reserva después de esa hora lo sigue recibiendo al instante, vía
-- `reconfirmacion_envio_inmediato`.
--
-- La hora sigue siendo configurable por empresa en `reconfirmacion_hora_envio`.

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_reconfirmacion_dias_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_reconfirmacion_dias_chk
  CHECK (reconfirmacion_dias_antes BETWEEN 0 AND 7);

ALTER TABLE public.empresa_reservas_config
  ALTER COLUMN reconfirmacion_dias_antes SET DEFAULT 0;

COMMENT ON COLUMN public.empresa_reservas_config.reconfirmacion_dias_antes IS
  'Días de antelación a los que se envía el correo de reconfirmación (0-7). 0 = el mismo día de la reserva, a la hora de reconfirmacion_hora_envio. Default 0.';
COMMENT ON COLUMN public.empresa_reservas_config.reconfirmacion_envio_inmediato IS
  'Si true, las reservas que entran cuando su pasada de envío ya ha pasado reciben el correo de reconfirmación inmediatamente tras el de confirmación. Si false, esas reservas NO reciben reconfirmación.';
