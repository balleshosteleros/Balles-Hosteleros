-- PRP-082 · La política de cancelación GUARDA la tarjeta, no retiene dinero.
--
-- Para poder cobrarla después hacen falta dos identificadores de Revolut: el
-- cliente y el método de pago. Sin ellos la tarjeta queda guardada en Revolut
-- pero nosotros no sabríamos a quién cobrar.
--
-- NO son datos de la tarjeta: son referencias. Con ellos se puede cobrar desde
-- el software, que es justo lo que se busca, pero no revelan ningún número.

alter table public.reservas
  add column if not exists cancelacion_customer_id text,
  add column if not exists cancelacion_payment_method_id text;

comment on column public.reservas.cancelacion_customer_id is
  'Cliente en Revolut. Con él se cobra la tarjeta guardada si no se presenta.';
comment on column public.reservas.cancelacion_payment_method_id is
  'Método de pago guardado en Revolut. No contiene datos de la tarjeta.';
