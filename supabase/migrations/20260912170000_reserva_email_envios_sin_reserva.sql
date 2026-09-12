-- El correo con el CÓDIGO de un ticket se manda al comprar, cuando todavía no
-- existe ninguna reserva a la que colgarlo. Con `reserva_id` obligatorio no
-- había dónde apuntarlo, así que ese correo no dejaba copia ni seguimiento de
-- lectura: en la ficha salía "Sin abrir" y "no se guardó copia" de un correo
-- que el cliente sí había abierto.
--
-- Ahora la fila se crea al ENVIAR (sin reserva) y al canjear el código se le
-- pone la reserva. De paso, los tickets que nunca se canjean también dejan su
-- rastro.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.reserva_email_envios
  ALTER COLUMN reserva_id DROP NOT NULL;

COMMENT ON COLUMN public.reserva_email_envios.reserva_id IS
  'Reserva a la que pertenece el correo. NULL mientras el correo es de una compra de ticket todavía sin canjear.';
