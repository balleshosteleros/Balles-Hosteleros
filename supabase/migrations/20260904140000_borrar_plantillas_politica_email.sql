-- Las condiciones económicas (plazo e importe) viven DENTRO de la confirmación
-- de la reserva, que es el correo que el cliente guarda. Los correos aparte
-- POLITICA_CANCELACION y POLITICA_GARANTIA le decían lo mismo por segunda vez
-- al mismo cliente, así que dejan de existir.
--
-- Idempotente: se puede volver a ejecutar sin efecto ni error.

delete from reserva_email_plantillas
where tipo in ('POLITICA_CANCELACION', 'POLITICA_GARANTIA');

-- El CHECK deja de admitirlos, para que no puedan volver a crearse.
alter table reserva_email_plantillas
  drop constraint if exists reserva_email_plantillas_tipo_chk;

alter table reserva_email_plantillas
  add constraint reserva_email_plantillas_tipo_chk check (
    tipo = any (array[
      'CONFIRMADA', 'RECONFIRMADA', 'NO_RECONFIRMADA', 'LISTA_ESPERA',
      'LIBERADA', 'TERMINANDO', 'NO_SHOW', 'RECORDATORIO', 'CANCELADA',
      'GARANTIA_PENDIENTE', 'GARANTIA_SOLICITUD', 'GARANTIA_CADUCADA',
      'SOLICITUD_VALORACION', 'TICKET_COMPRA', 'TICKET_RESERVA'
    ])
  );
