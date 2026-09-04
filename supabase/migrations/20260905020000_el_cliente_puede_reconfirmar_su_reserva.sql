-- El cliente necesita poder reconfirmar. Hasta ahora no podia: el correo se
-- llamaba "RECONFIRMADA" y le decia "nos has confirmado que vienes", pero no
-- llevaba ningun boton — solo el de cancelar. El estado RECONFIRMADA existia y
-- nada lo activaba nunca.
--
-- Este token identifica al cliente en la pagina publica de reconfirmar, igual
-- que `cancelacion_token` en la de cancelar. Mismo patron que `valoracion_token`:
-- texto opaco sin guiones, generado la primera vez que se le pide reconfirmar.
--
-- Idempotente: se puede volver a aplicar sin romper nada.

alter table reservas
  add column if not exists reconfirmacion_token text;

comment on column reservas.reconfirmacion_token is
  'Token publico para que el cliente reconfirme o rechace su reserva desde el correo (/reconfirmar/[token]). Se genera al enviar la reconfirmacion.';

-- Unico: el token ES la identidad del cliente en esa pagina. Dos reservas con
-- el mismo token dejarian que una persona tocara la reserva de otra.
create unique index if not exists reservas_reconfirmacion_token_key
  on reservas (reconfirmacion_token)
  where reconfirmacion_token is not null;
