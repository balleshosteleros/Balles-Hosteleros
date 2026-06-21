-- PRP-064 Fase 2: el flag `pagado` deja de estar bloqueado por el trigger.
-- Motivo: tras enviar la liquidación, RRHH debe poder marcarla como Pagado
-- (botón Pagar→Pagado) aunque esté enviada. Los IMPORTES siguen bloqueados.
-- Recrea rrhh_pagos_lock_confirmado sin `pagado` en el set de campos congelados.
-- Idempotente.

create or replace function public.rrhh_pagos_lock_confirmado()
returns trigger
language plpgsql
as $$
begin
  if OLD.confirmacion_enviada_at is null or NEW.confirmacion_enviada_at is null then
    if NEW.confirmacion_enviada_at is null then
      NEW.confirmacion_aceptada_at := null;
      NEW.confirmacion_enviada_por := null;
    end if;
    return NEW;
  end if;

  -- Sigue enviado/bloqueado: los IMPORTES no pueden cambiar. `pagado` SÍ puede
  -- (es el estado de pago que fija RRHH tras la aprobación del empleado).
  if  NEW.empleado_nombre      is distinct from OLD.empleado_nombre
   or NEW.fijo                 is distinct from OLD.fijo
   or NEW.pago                 is distinct from OLD.pago
   or NEW.nomina               is distinct from OLD.nomina
   or NEW.horas_reales         is distinct from OLD.horas_reales
   or NEW.horas_trabajadas     is distinct from OLD.horas_trabajadas
   or NEW.propina              is distinct from OLD.propina
   or NEW.ajuste               is distinct from OLD.ajuste
   or NEW.horas_extras         is distinct from OLD.horas_extras
   or NEW.bonus                is distinct from OLD.bonus
   or NEW.propina_mes_anterior is distinct from OLD.propina_mes_anterior
   or NEW.total                is distinct from OLD.total
   or NEW.confirmacion_enviada_at is distinct from OLD.confirmacion_enviada_at
  then
    raise exception 'rrhh_pagos: liquidacion ya enviada; reabrir antes de modificar importes (pago %).', OLD.id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;
