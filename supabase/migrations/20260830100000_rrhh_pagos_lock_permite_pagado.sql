-- El botón "Pagar" volvía a estar bloqueado tras enviar la liquidación.
--
-- La migración 20260621220000 ya quitó `pagado` del conjunto de campos
-- congelados, pero la función que corre en la base de datos había sido
-- recreada después a mano y volvía a incluirlo (junto a `ss_empleado`,
-- `ss_empresa`, `irpf` y `nomina_path`). Además aquella migración nombraba
-- `propina`/`propina_mes_anterior`, columnas que hoy se llaman
-- `complemento`/`complemento_mes_anterior`, así que no se puede re-aplicar
-- tal cual.
--
-- Esta versión parte del esquema REAL y deja fuera del bloqueo únicamente el
-- estado de pago (`pagado`, `pagado_at`, `pagado_por`): es lo que RRHH fija
-- DESPUÉS de que el empleado apruebe, así que congelarlo dejaba el flujo sin
-- salida (solo se podía marcar pagado reabriendo la liquidación, lo que anula
-- la aprobación del trabajador).
--
-- Los IMPORTES siguen congelados, que es el objetivo del trigger.
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

  -- Sigue enviada: los IMPORTES no pueden cambiar. El estado de pago SÍ.
  if  NEW.empleado_nombre          is distinct from OLD.empleado_nombre
   or NEW.fijo                     is distinct from OLD.fijo
   or NEW.pago                     is distinct from OLD.pago
   or NEW.nomina                   is distinct from OLD.nomina
   or NEW.horas_reales             is distinct from OLD.horas_reales
   or NEW.horas_trabajadas         is distinct from OLD.horas_trabajadas
   or NEW.complemento              is distinct from OLD.complemento
   or NEW.ajuste                   is distinct from OLD.ajuste
   or NEW.horas_extras             is distinct from OLD.horas_extras
   or NEW.bonus                    is distinct from OLD.bonus
   or NEW.complemento_mes_anterior is distinct from OLD.complemento_mes_anterior
   or NEW.ss_empleado              is distinct from OLD.ss_empleado
   or NEW.ss_empresa               is distinct from OLD.ss_empresa
   or NEW.irpf                     is distinct from OLD.irpf
   or NEW.total                    is distinct from OLD.total
   or NEW.confirmacion_enviada_at  is distinct from OLD.confirmacion_enviada_at
  then
    raise exception 'rrhh_pagos: liquidacion ya enviada; reabrir antes de modificar importes (pago %).', OLD.id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;
