-- Retención de IRPF por pago (rrhh_pagos).
-- Es la retención de IRPF que se le practica al TRABAJADOR en su nómina (la
-- empresa la ingresa a Hacienda en su nombre). INFORMATIVA: NO entra en el
-- cálculo del `total` del pago (igual que ss_empleado/ss_empresa). Se rellena
-- leyendo la nómina con IA (endpoint /api/nominas/extraer) o a mano.
--
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_pagos
  add column if not exists irpf numeric(12,2) not null default 0;

comment on column public.rrhh_pagos.irpf is
  'Retención de IRPF practicada al trabajador en su nómina. Informativa, no entra en el total.';

-- El trigger de bloqueo (liquidación enviada = inmutable) debe cubrir también el IRPF.
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
   or NEW.irpf                 is distinct from OLD.irpf
   or NEW.total                is distinct from OLD.total
   or NEW.pagado               is distinct from OLD.pagado
   or NEW.nomina_path          is distinct from OLD.nomina_path
   or NEW.confirmacion_enviada_at is distinct from OLD.confirmacion_enviada_at
  then
    raise exception 'rrhh_pagos: liquidacion ya enviada; reabrir antes de modificar (pago %).', OLD.id
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;
