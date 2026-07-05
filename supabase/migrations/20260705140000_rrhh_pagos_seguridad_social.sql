-- Coste de Seguridad Social por pago (rrhh_pagos).
-- Añade el importe de SS que aporta el TRABAJADOR (se descuenta de su nómina) y
-- el que aporta la EMPRESA por ese trabajador. Ambos son INFORMATIVOS: NO entran
-- en el cálculo del `total` del pago (que sigue siendo el neto de negocio). Sirven
-- para conocer el coste real de la SS de cada empleado y del conjunto.
--
-- Se pueden rellenar leyendo la nómina con IA (endpoint /api/nominas/extraer) y
-- luego corregir a mano. El "Total SS" (empleado + empresa) se calcula en la UI,
-- no se persiste (evita datos derivados desincronizados).
--
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_pagos
  add column if not exists ss_empleado numeric(12,2) not null default 0,
  add column if not exists ss_empresa  numeric(12,2) not null default 0;

comment on column public.rrhh_pagos.ss_empleado is 'Seguridad Social que paga el trabajador (se descuenta de su nómina). Informativo, no entra en el total.';
comment on column public.rrhh_pagos.ss_empresa  is 'Seguridad Social que paga la empresa por el trabajador. Informativo, no entra en el total.';

-- El trigger de bloqueo (liquidación enviada = inmutable) debe cubrir también los
-- nuevos importes de SS: una vez enviada la liquidación no se pueden modificar.
create or replace function public.rrhh_pagos_lock_confirmado()
returns trigger
language plpgsql
as $$
begin
  -- No bloqueado todavia, o se esta reabriendo (enviada -> NULL): permitir todo.
  if OLD.confirmacion_enviada_at is null or NEW.confirmacion_enviada_at is null then
    -- Si se reabre, la aceptacion previa deja de tener valor.
    if NEW.confirmacion_enviada_at is null then
      NEW.confirmacion_aceptada_at := null;
      NEW.confirmacion_enviada_por := null;
    end if;
    return NEW;
  end if;

  -- Sigue enviado/bloqueado: ningun campo economico ni el destinatario pueden cambiar.
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
   or NEW.ss_empleado          is distinct from OLD.ss_empleado
   or NEW.ss_empresa           is distinct from OLD.ss_empresa
   or NEW.total                is distinct from OLD.total
   or NEW.pagado               is distinct from OLD.pagado
   or NEW.confirmacion_enviada_at is distinct from OLD.confirmacion_enviada_at
  then
    raise exception 'rrhh_pagos: liquidacion ya enviada; reabrir antes de modificar (pago %).', OLD.id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;
