-- El CHECK de `tipo` no contemplaba SOLICITUD_VALORACION, así que guardar esa
-- plantilla personalizada habría fallado. Se reescribe incluyéndolo.
ALTER TABLE reserva_email_plantillas
  DROP CONSTRAINT IF EXISTS reserva_email_plantillas_tipo_chk;

ALTER TABLE reserva_email_plantillas
  ADD CONSTRAINT reserva_email_plantillas_tipo_chk
  CHECK (tipo = ANY (ARRAY[
    'CONFIRMACION'::text,
    'RECONFIRMACION'::text,
    'RECORDATORIO'::text,
    'CANCELACION'::text,
    'POLITICA_AVISO'::text,
    'CUPON_PAGADO'::text,
    'SOLICITUD_VALORACION'::text
  ]));
