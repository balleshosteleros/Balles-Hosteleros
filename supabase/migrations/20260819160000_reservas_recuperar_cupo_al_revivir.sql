-- Reservas: recuperar el cupo del turno cuando una reserva "revive".
--
-- Problema: `liberar_slot_on_cancel` RESTA del contador del turno al pasar a
-- CANCELADA / NO_SHOW / LIBERADA, pero no existía la operación inversa. Una
-- reserva cancelada que se vuelve a poner en CONFIRMADA (caso real: el cliente
-- llama para recuperar su mesa) volvía a ocupar mesa físicamente, pero el
-- contador `reserva_slots_lock` seguía descontado. El motor web y el canal de
-- Google leen ese contador, así que el turno quedaba sobrevendido.
--
-- Solución: mismo trigger, tratando ambos sentidos de la transición.
--   vivo  -> no-vivo  => restar (comportamiento actual, intacto)
--   no-vivo -> vivo   => sumar  (nuevo)
--
-- WALK_IN se mantiene fuera del lado "vivo" de origen, igual que antes: no
-- consume cupo del motor de reservas (se atiende en el momento, sin slot).
-- La fila de `reserva_slots_lock` puede no existir todavía si el cupo nunca se
-- reservó por el motor; en ese caso se inserta, para no perder la cuenta.
--
-- Idempotente: CREATE OR REPLACE + DROP/CREATE del trigger.

create or replace function public.liberar_slot_on_cancel()
returns trigger
language plpgsql
as $$
declare
  v_era_vivo boolean;
  v_es_vivo  boolean;
begin
  -- "Vivo" = ocupa cupo del turno. WALK_IN nunca lo ocupa.
  v_era_vivo := old.estado not in ('CANCELADA','NO_SHOW','LIBERADA','WALK_IN');
  v_es_vivo  := new.estado not in ('CANCELADA','NO_SHOW','LIBERADA','WALK_IN');

  if v_era_vivo and not v_es_vivo then
    -- Se libera la mesa: devolver el cupo.
    update public.reserva_slots_lock
       set personas_total = greatest(0, personas_total - new.personas),
           reservas_total = greatest(0, reservas_total - 1),
           updated_at = now()
     where empresa_id = new.empresa_id
       and fecha = new.fecha
       and turno = new.turno;

  elsif not v_era_vivo and v_es_vivo then
    -- La reserva revive: vuelve a consumir cupo.
    insert into public.reserva_slots_lock (
      empresa_id, fecha, turno, personas_total, reservas_total, updated_at
    )
    values (
      new.empresa_id, new.fecha, new.turno, new.personas, 1, now()
    )
    on conflict (empresa_id, fecha, turno) do update
       set personas_total = public.reserva_slots_lock.personas_total + new.personas,
           reservas_total = public.reserva_slots_lock.reservas_total + 1,
           updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_liberar_slot_on_cancel on public.reservas;
create trigger trg_liberar_slot_on_cancel
  after update of estado on public.reservas
  for each row execute function public.liberar_slot_on_cancel();
