-- Estado SENTADA: el cliente ya está en la mesa.
--
-- POR QUÉ: hasta ahora no había forma de registrar que un cliente se había
-- sentado. La vista de sala usaba WALK_IN para eso, y WALK_IN no es eso:
-- es el ORIGEN de la reserva (cliente que entra sin haber reservado). Marcar
-- "sentada" con WALK_IN machacaba el origen real de la reserva —
-- `updateReserva` fuerza `origen = 'WALKIN'` al pasar a ese estado— y hacía
-- perder por dónde había entrado el cliente (web, teléfono, Google...).
--
-- Con SENTADA, cada cosa queda en su sitio:
--   · WALK_IN   = cómo llegó (sin reserva previa).
--   · SENTADA   = dónde está ahora (en la mesa, comiendo).
--   · TERMINANDO= a punto de acabar; la mesa se va a liberar.
--
-- Es lo que enciende el contador de ocupación de la mesa (columna TIEMPO del
-- listado), que cuenta desde la HORA DE LA RESERVA, no desde el momento en que
-- se pulsa el botón.

do $$
begin
  -- El CHECK de estado se sustituye para añadir SENTADA. Se hace en dos pasos
  -- (drop + add) porque un CHECK no se puede ampliar in situ. Idempotente: si
  -- ya admite SENTADA, no toca nada.
  if not exists (
    select 1 from pg_constraint
    where conname = 'reservas_estado_check'
      and conrelid = 'public.reservas'::regclass
      and pg_get_constraintdef(oid) like '%SENTADA%'
  ) then
    alter table public.reservas
      drop constraint if exists reservas_estado_check;

    alter table public.reservas
      add constraint reservas_estado_check
      check (estado in (
        'CONFIRMADA',
        'RECONFIRMADA',
        'NO_RECONFIRMADA',
        'LISTA_ESPERA',
        'SENTADA',
        'LIBERADA',
        'WALK_IN',
        'TERMINANDO',
        'NO_SHOW',
        'CANCELADA'
      ));
  end if;
end $$;
