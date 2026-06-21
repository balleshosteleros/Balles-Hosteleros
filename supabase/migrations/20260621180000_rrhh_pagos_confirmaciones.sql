-- Confirmaciones de liquidacion en rrhh_pagos.
-- RRHH envia la liquidacion al empleado ("Enviar confirmaciones", individual o a
-- todos). Al enviarse, ese pago queda BLOQUEADO: no se pueden tocar importes ni
-- el flag pagado (por seguridad, para evitar modificaciones a posteriori). El
-- empleado debe ACEPTAR la liquidacion desde su app (confirmacion_aceptada_at).
--
-- Desbloqueo manual: solo un director puede "reabrir" un pago (poner
-- confirmacion_enviada_at = NULL), lo que limpia tambien la aceptacion y vuelve
-- a permitir la edicion para corregir y reenviar.
--
-- El bloqueo se garantiza a nivel BD con un trigger, no solo en la UI.
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_pagos
  add column if not exists confirmacion_enviada_at  timestamptz,
  add column if not exists confirmacion_enviada_por uuid,
  add column if not exists confirmacion_aceptada_at timestamptz;

comment on column public.rrhh_pagos.confirmacion_enviada_at  is 'Cuando RRHH envio la liquidacion al empleado. No NULL = pago bloqueado.';
comment on column public.rrhh_pagos.confirmacion_enviada_por is 'Usuario (auth) que envio la confirmacion.';
comment on column public.rrhh_pagos.confirmacion_aceptada_at is 'Cuando el empleado acepto la liquidacion desde su app.';

-- Trigger de bloqueo: mientras el pago siga enviado (no reabierto), prohibe
-- cambiar importes / flags. Solo deja avanzar confirmacion_aceptada_at (la
-- aceptacion del empleado). Reabrir = NEW.confirmacion_enviada_at IS NULL, y eso
-- queda permitido (lo controla el server, gateado a director).
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

drop trigger if exists trg_rrhh_pagos_lock on public.rrhh_pagos;
create trigger trg_rrhh_pagos_lock
  before update on public.rrhh_pagos
  for each row execute function public.rrhh_pagos_lock_confirmado();

create index if not exists idx_rrhh_pagos_confirm_pendiente
  on public.rrhh_pagos(empleado_id)
  where confirmacion_enviada_at is not null and confirmacion_aceptada_at is null;
