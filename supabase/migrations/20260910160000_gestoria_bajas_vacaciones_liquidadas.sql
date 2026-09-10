-- Dias de vacaciones que se liquidan en la nomina de fin de contrato.
--
-- Cuando la baja se comunica a la gestoria se le manda el numero de dias que le
-- quedan sin disfrutar, y esos dias se pagan en el finiquito. A partir de ese
-- momento ya no son dias que pueda coger: quedan apuntados aqui para que su
-- calendario los muestre como liquidados y su saldo baje a cero, en vez de
-- seguir ensenando dias disponibles que en realidad ya estan pagados.
--
-- Idempotente.
alter table public.gestoria_bajas
  add column if not exists vacaciones_liquidadas integer;

comment on column public.gestoria_bajas.vacaciones_liquidadas is
  'Dias de vacaciones pendientes comunicados a la gestoria y liquidados en la nomina de fin de contrato.';
