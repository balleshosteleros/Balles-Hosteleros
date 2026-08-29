-- Retira `complemento_mes_anterior` (en el código, `propinaMantenimiento`).
--
-- Verificado antes de borrar: la columna estaba VACÍA en las 138 filas (suma
-- 0,00 €) y también lo estaba antes de los cambios del día, así que nunca se
-- apuntó nada en ella. Resto de la cadena de propinas ya retirado.
--
-- El total pasa a ser: nomina + complemento + horas_extras + bonus + ajuste.
-- No hace falta recalcular: el sumando siempre valió 0.
--
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

  if  NEW.empleado_nombre     is distinct from OLD.empleado_nombre
   or NEW.fijo                is distinct from OLD.fijo
   or NEW.nomina              is distinct from OLD.nomina
   or NEW.horas_reales        is distinct from OLD.horas_reales
   or NEW.horas_trabajadas    is distinct from OLD.horas_trabajadas
   or NEW.complemento         is distinct from OLD.complemento
   or NEW.ajuste              is distinct from OLD.ajuste
   or NEW.horas_extras        is distinct from OLD.horas_extras
   or NEW.bonus               is distinct from OLD.bonus
   or NEW.ss_empleado         is distinct from OLD.ss_empleado
   or NEW.ss_empresa          is distinct from OLD.ss_empresa
   or NEW.irpf                is distinct from OLD.irpf
   or NEW.total               is distinct from OLD.total
   or NEW.confirmacion_enviada_at is distinct from OLD.confirmacion_enviada_at
  then
    raise exception 'rrhh_pagos: liquidacion ya enviada; reabrir antes de modificar importes (pago %).', OLD.id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

alter table public.rrhh_pagos drop column if exists complemento_mes_anterior;
