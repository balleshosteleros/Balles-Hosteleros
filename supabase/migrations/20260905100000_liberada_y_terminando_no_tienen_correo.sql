-- LIBERADA y TERMINANDO dejan de tener correo.
--
-- Son estados de SERVICIO, no noticias para el cliente: "tu mesa ya está
-- libre" le llega cuando acaba de levantarse de ella, y "tu reserva está
-- terminando" mientras aún está sentado cenando. Nada que el cliente pueda
-- hacer, y además el correo de LIBERADA se anunciaba como "cerrada", una
-- palabra que no existe en ningún otro sitio del software.
--
-- Los ESTADOS siguen existiendo y funcionando igual en Sala. Lo que se borra
-- es únicamente su correo.
--
-- Sin pérdida de datos: comprobado antes de escribir esto, ninguna reserva
-- tenía sello de envío en esas columnas (0 y 0), así que nunca llegó a salir
-- uno de estos correos a un cliente real.

-- 1) Las plantillas de las empresas.
delete from reserva_email_plantillas
where tipo in ('LIBERADA', 'TERMINANDO');

-- 2) El CHECK, para que no se puedan volver a crear.
alter table reserva_email_plantillas
  drop constraint if exists reserva_email_plantillas_tipo_chk;

alter table reserva_email_plantillas
  add constraint reserva_email_plantillas_tipo_chk
  check (tipo = any (array[
    'CONFIRMADA', 'RECONFIRMADA', 'NO_RECONFIRMADA', 'LISTA_ESPERA',
    'NO_SHOW', 'RECORDATORIO', 'CANCELADA',
    'GARANTIA_PENDIENTE', 'GARANTIA_SOLICITUD', 'GARANTIA_CADUCADA',
    'SOLICITUD_VALORACION', 'TICKET_COMPRA', 'TICKET_RESERVA'
  ]));

-- 3) Las columnas de auditoría, que ya no las lee ni las escribe nadie.
alter table reservas
  drop column if exists email_liberada_at,
  drop column if exists email_terminando_at;
