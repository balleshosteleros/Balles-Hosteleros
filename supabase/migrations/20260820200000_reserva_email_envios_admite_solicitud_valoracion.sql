-- El histórico de correos enviados no contemplaba SOLICITUD_VALORACION, así
-- que el registro del envío se habría rechazado y el correo no aparecería en
-- el listado de la reserva (el mailer traza el fallo pero no aborta el envío,
-- de modo que habría salido el correo SIN quedar registrado).
ALTER TABLE reserva_email_envios
  DROP CONSTRAINT IF EXISTS reserva_email_envios_tipo_chk;

ALTER TABLE reserva_email_envios
  ADD CONSTRAINT reserva_email_envios_tipo_chk
  CHECK (tipo = ANY (ARRAY[
    'CONFIRMACION'::text,
    'RECONFIRMACION'::text,
    'RECORDATORIO'::text,
    'CANCELACION'::text,
    'SOLICITUD_VALORACION'::text
  ]));
