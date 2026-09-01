-- El blindaje de los datos del ticket solo actuaba cuando la reserva venía de
-- un código canjeado (`ticket_compra_id` no nulo). Eso dejaba desprotegidas las
-- reservas de ticket compradas en el momento: su importe y su tipo se podían
-- cambiar a mano desde el panel.
--
-- Ahora protege TODA reserva marcada como de ticket, venga de un canje o de una
-- compra directa. Regla: si `es_ticket`, lo del ticket no se toca.
CREATE OR REPLACE FUNCTION public.reservas_ticket_inmutable()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- Reserva que no es de ticket: nada que proteger.
  IF COALESCE(OLD.es_ticket, FALSE) IS NOT TRUE AND OLD.ticket_compra_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.ticket_compra_id   IS DISTINCT FROM OLD.ticket_compra_id
     OR NEW.ticket_codigo      IS DISTINCT FROM OLD.ticket_codigo
     OR NEW.ticket_producto_id IS DISTINCT FROM OLD.ticket_producto_id
     OR NEW.ticket_importe     IS DISTINCT FROM OLD.ticket_importe
     OR NEW.ticket_unidades    IS DISTINCT FROM OLD.ticket_unidades
     OR NEW.ticket_iva         IS DISTINCT FROM OLD.ticket_iva
     OR NEW.es_ticket          IS DISTINCT FROM OLD.es_ticket
     OR NEW.tipo_categoria     IS DISTINCT FROM OLD.tipo_categoria
  THEN
    RAISE EXCEPTION 'Los datos del ticket de una reserva no se pueden modificar'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$fn$;
