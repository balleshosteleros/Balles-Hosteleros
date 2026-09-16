-- ============================================================
-- 20260915140000_devolver_stock_cupon.sql
--
-- Devolverle el cupón a quien no ha llegado a reservar.
--
-- `consumir_stock_cupon` lo gasta justo antes de crear la reserva, pero si el
-- guardado se cae en ese último paso, el uso ya estaba descontado: la persona
-- perdía su cupón sin tener mesa y, al volver a intentarlo, el sistema le decía
-- «este código ya se ha usado». Con los de cumpleaños —personales y de un solo
-- uso— eso es quedarse sin el regalo.
--
-- Espejo exacto de `consumir_stock_cupon`: misma cuenta según `unidad_stock`,
-- misma fila bloqueada. Nunca baja de cero, así que llamarla dos veces no
-- regala usos que no existían.
--
-- Idempotente.
-- ============================================================

create or replace function public.devolver_stock_cupon(
  p_codigo_id uuid,
  p_personas  integer
)
returns public.reserva_codigos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row      public.reserva_codigos;
  v_devuelve int;
begin
  if p_personas < 1 then
    raise exception 'personas inválidas';
  end if;

  select * into v_row from public.reserva_codigos where id = p_codigo_id for update;
  if v_row.id is null then
    raise exception 'NO_EXISTE' using errcode = 'P0001';
  end if;

  v_devuelve := case when v_row.unidad_stock = 'personas' then p_personas else 1 end;

  update public.reserva_codigos
     set stock_consumido = greatest(stock_consumido - v_devuelve, 0),
         updated_at      = now()
   where id = p_codigo_id
   returning * into v_row;

  return v_row;
end;
$function$;

comment on function public.devolver_stock_cupon(uuid, integer) is
  'Deshace un consumir_stock_cupon cuando la reserva no llega a crearse. Nunca baja de cero.';
