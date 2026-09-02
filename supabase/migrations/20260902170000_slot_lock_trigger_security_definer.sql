-- Reservas: cambiar el estado de una reserva cancelada a viva fallaba con
-- "new row violates row-level security policy for table reserva_slots_lock".
--
-- Causa: `liberar_slot_on_cancel` corre con los permisos del usuario que hace
-- el UPDATE. Cuando la reserva revive (CANCELADA -> CONFIRMADA) el trigger
-- INSERTA en `reserva_slots_lock`, y esa tabla solo tiene politica de SELECT:
-- cualquier escritura desde la app queda bloqueada por RLS.
--
-- `reserva_slots_lock` es un contador interno del motor de cupos: la app solo
-- lo lee (feed y resolver de Google RWG) y quien lo escribe es este trigger.
-- Por eso la funcion pasa a SECURITY DEFINER con search_path fijo, igual que
-- `empresas_del_usuario()`. El aislamiento por empresa no se toca: la fila que
-- se escribe siempre usa el `empresa_id` de la propia reserva, que ya paso por
-- la RLS de `reservas`.
--
-- Idempotente: CREATE OR REPLACE + DROP/CREATE del trigger.

create or replace function public.liberar_slot_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
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
