-- PRP-082 · Sin tarjeta no hay reserva.
--
-- Antes la reserva se creaba CONFIRMADA y luego se pedía la tarjeta: si el
-- cliente abandonaba, quedaba ocupando mesa sin garantía y sin haber recibido
-- ni un correo. Para el restaurante parecía una reserva normal.
--
-- Ahora nace PROVISIONAL: aparta la mesa mientras el cliente paga, pero no
-- cuenta como reserva viva. Si no paga en el plazo, se borra sola y la mesa
-- vuelve al cupo.

alter table public.reservas
  add column if not exists provisional_hasta timestamptz;

comment on column public.reservas.provisional_hasta is
  'Reserva a la espera de tarjeta: si llega esta hora sin pagarse, se borra y se libera la mesa. NULL = reserva normal.';

create index if not exists idx_reservas_provisional
  on public.reservas (provisional_hasta)
  where provisional_hasta is not null;

-- La limpieza DEVUELVE el cupo al borrar: el trigger que lo hace solo salta al
-- cambiar el estado a cancelada, no al borrar la fila. Sin esto, cada cliente
-- que abandonase el pago se llevaría plazas del turno para siempre.
create or replace function public.limpiar_reservas_provisionales()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_fila record;
  v_borradas integer := 0;
begin
  for v_fila in
    delete from public.reservas
    where provisional_hasta is not null
      and provisional_hasta < now()
    returning empresa_id, fecha, turno, personas
  loop
    begin
      perform public.liberar_slot_manual(
        p_empresa_id := v_fila.empresa_id,
        p_fecha      := v_fila.fecha,
        p_turno      := v_fila.turno,
        p_personas   := v_fila.personas
      );
    exception when others then
      -- Que un fallo al devolver el cupo no deje la fila sin borrar: la mesa
      -- libre importa más, y el cupo se recalcula igualmente cada día.
      raise warning 'limpiar_reservas_provisionales: no se pudo liberar cupo de %', v_fila.empresa_id;
    end;
    v_borradas := v_borradas + 1;
  end loop;

  return v_borradas;
end;
$fn$;

revoke execute on function public.limpiar_reservas_provisionales() from public, anon, authenticated;
grant execute on function public.limpiar_reservas_provisionales() to service_role;
