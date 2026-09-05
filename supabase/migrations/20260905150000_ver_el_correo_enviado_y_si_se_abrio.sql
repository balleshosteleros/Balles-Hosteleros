-- Ver el correo que se le envió al cliente, y si lo ha abierto.
--
-- Hasta ahora `reserva_email_envios` guardaba solo el rastro (a quién, cuándo,
-- qué asunto). Bastaba para saber QUE se envió algo, pero no para ver QUÉ vio
-- el cliente ni si le llegó. Cuando una reserva se quedaba sin correo no había
-- forma de comprobarlo desde la ficha.
--
-- · `cuerpo_html` — el HTML EXACTO que salió. Se guarda en vez de regenerarlo
--   al abrirlo porque la plantilla y los datos de la reserva cambian: al
--   reconstruirlo se vería el correo de hoy, no el que recibió el cliente.
-- · `abierto_at` / `aperturas` — primera apertura y cuántas van. Las marca el
--   píxel de seguimiento (ver `/api/email/abierto`).
--
-- Idempotente: se puede volver a aplicar sin romper nada.

alter table reserva_email_envios
  add column if not exists cuerpo_html text,
  add column if not exists abierto_at  timestamptz,
  add column if not exists aperturas   integer not null default 0;

comment on column reserva_email_envios.cuerpo_html is
  'HTML tal cual se envió. Congelado a propósito: la plantilla puede cambiar después.';
comment on column reserva_email_envios.abierto_at is
  'Primera vez que se cargó el píxel. Orientativo: Gmail/Apple precargan imágenes y Outlook las bloquea.';
comment on column reserva_email_envios.aperturas is
  'Número de veces que se ha cargado el píxel.';

-- El listado de la ficha pide los envíos de UNA reserva ordenados por fecha.
create index if not exists reserva_email_envios_reserva_enviado_idx
  on reserva_email_envios (reserva_id, enviado_at desc);
