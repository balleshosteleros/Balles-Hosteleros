-- ACUSE DE LECTURA de un documento que no es obligatorio firmar.
--
-- La comunicacion de baja que causa la empresa no exige firma: un trabajador
-- puede negarse a firmar su despido y esa negativa no lo invalida. Lo que si
-- hay que poder acreditar es que se le informo y que lo leyo. Por eso el
-- documento puede cerrarse de dos maneras: firmandolo, o dandolo por leido.
--
-- 'leido' como ESTADO del documento (queda cerrado, ni firmado ni pendiente
-- eterno) y como EVENTO del registro de auditoria (con su hora, IP y hash, que
-- es lo que acaba impreso en el acta).
--
-- Idempotente.
alter table public.firmas_documentos drop constraint if exists firmas_documentos_estado_check;
alter table public.firmas_documentos add constraint firmas_documentos_estado_check
  check (estado = any (array['borrador'::text, 'pendiente'::text, 'firmado'::text, 'leido'::text, 'rechazado'::text, 'expirado'::text]));

alter table public.firmas_eventos drop constraint if exists firmas_eventos_tipo_check;
alter table public.firmas_eventos add constraint firmas_eventos_tipo_check
  check (tipo = any (array['creado'::text, 'enviado'::text, 'reenviado'::text, 'abierto'::text,
    'otp_enviado'::text, 'otp_validado'::text, 'otp_fallido'::text, 'otp_bloqueado'::text,
    'firmado'::text, 'leido'::text, 'rechazado'::text, 'expirado'::text]));
