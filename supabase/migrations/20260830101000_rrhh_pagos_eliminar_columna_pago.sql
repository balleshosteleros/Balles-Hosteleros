-- Retira el concepto `pago` de las liquidaciones.
--
-- Qué era: un campo que entraba en `total` pero no tenía NINGUNA superficie
-- visible (ni columna en la tabla, ni campo editable, ni línea en el correo al
-- trabajador, ni en su histórico). En 78 de las 109 filas con valor, `pago` era
-- exactamente `nomina + complemento`: el mismo sueldo sumado dos veces. Borja
-- Garrido en mayo cobraba 1.945 € y su total decía 3.845 €. Desde junio-2026
-- dejó de rellenarse y los totales ya salían bien.
--
-- Regla confirmada: total = nomina + complemento + horas_extras + bonus + ajuste.
--
-- Ninguna liquidación afectada se había enviado al trabajador (0 enviadas,
-- 0 aprobadas, 0 con fecha de abono): el importe inflado nunca salió.
--
-- Idempotente.

-- 1) El trigger de bloqueo deja de mencionar la columna (si no, falla el DROP).
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

  if  NEW.empleado_nombre          is distinct from OLD.empleado_nombre
   or NEW.fijo                     is distinct from OLD.fijo
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

create or replace function public.rrhh_pagos_lock_nomina()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.mes_nominas_confirmado(new.empresa_id, new.periodo) then
    if new.nomina is distinct from old.nomina
       or new.ss_empleado is distinct from old.ss_empleado
       or new.ss_empresa  is distinct from old.ss_empresa
       or new.irpf        is distinct from old.irpf
       or new.total       is distinct from old.total
       or new.complemento is distinct from old.complemento
       or new.ajuste      is distinct from old.ajuste
       or new.horas_extras is distinct from old.horas_extras
       or new.bonus       is distinct from old.bonus then
      raise exception 'Las nóminas de % ya están confirmadas: la liquidación no se puede modificar.', new.periodo
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- 2) El total pasa a ser la suma REAL de los conceptos que el usuario ve. Los
--    triggers se desactivan SOLO para esta corrección (protegen meses ya
--    confirmados, y esto es justo un arreglo de esos meses).
alter table public.rrhh_pagos disable trigger user;

update public.rrhh_pagos
   set total = round((
         coalesce(nomina,0) + coalesce(complemento,0) + coalesce(horas_extras,0)
       + coalesce(bonus,0) + coalesce(complemento_mes_anterior,0) + coalesce(ajuste,0)
       )::numeric, 2)
 where coalesce(pago,0) <> 0;

alter table public.rrhh_pagos enable trigger user;

-- 3) Fuera la columna.
alter table public.rrhh_pagos drop column if exists pago;
