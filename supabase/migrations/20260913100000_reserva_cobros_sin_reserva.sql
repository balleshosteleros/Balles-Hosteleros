-- Una compra de ticket PAGADA y sin canjear es dinero cobrado que todavía no
-- cuelga de ninguna reserva: el cliente pagó y aún no ha elegido día. Si hay
-- que devolvérselo, el movimiento no tenía dónde apuntarse, porque esta tabla
-- exigía una reserva.
--
-- Ahora `reserva_id` puede ir vacío mientras el dinero sea de una compra sin
-- canjear. La columna `compra_id` dice de cuál.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.reserva_cobros
  ALTER COLUMN reserva_id DROP NOT NULL;

ALTER TABLE public.reserva_cobros
  ADD COLUMN IF NOT EXISTS compra_id UUID
  REFERENCES public.reserva_ticket_compras(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.reserva_cobros.reserva_id IS
  'Reserva del movimiento. NULL cuando el dinero es de una compra de ticket todavía sin canjear (ver compra_id).';
COMMENT ON COLUMN public.reserva_cobros.compra_id IS
  'Compra de ticket del movimiento, cuando el cobro no cuelga de una reserva.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reserva_cobros_origen_chk'
  ) THEN
    ALTER TABLE public.reserva_cobros
      ADD CONSTRAINT reserva_cobros_origen_chk
      CHECK (reserva_id IS NOT NULL OR compra_id IS NOT NULL);
  END IF;
END $$;
