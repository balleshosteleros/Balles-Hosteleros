-- Una devolución también puede ser de un TICKET, no solo de una garantía o de
-- una política de cancelación. Sin esto, devolverle el dinero a quien compró
-- un ticket no se podía apuntar en el registro de cobros: el movimiento salía
-- de la cuenta y en el software no quedaba rastro, que es justo el fallo que
-- esta tabla existe para evitar.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.reserva_cobros
  DROP CONSTRAINT IF EXISTS reserva_cobros_concepto_check;

ALTER TABLE public.reserva_cobros
  ADD CONSTRAINT reserva_cobros_concepto_check
  CHECK (concepto IN ('garantia', 'cancelacion', 'ticket'));
