-- Elimina el turno DIA_COMPLETO del modelo de reservas.
--
-- Solo existen DOS turnos: COMIDA y CENA. DIA_COMPLETO era un tercer valor
-- heredado del enum original (.claude/migrations/006_sala.sql) que nunca se
-- llegó a usar: 0 reservas grabadas con ese turno.
--
-- Además ROMPÍA el alta de reservas desde el back-office: el formulario interno
-- hereda el turno de la barra superior, y el cálculo de zonas disponibles
-- descartaba cualquier turno que no fuera COMIDA o CENA devolviendo lista
-- vacía. Con DIA_COMPLETO activo no se podía elegir ni zona ni mesa.
--
-- Las columnas `turno` son `text` (no enum) en todas las tablas, así que no hay
-- tipo que alterar. Se limpia lo único que quedaba en BD: la rama muerta dentro
-- de `cupo_efectivo`.
--
-- Idempotente: CREATE OR REPLACE. Cuerpo idéntico al de
-- 20260818140000_reparar_cupo_efectivo_rwg.sql salvo el guard eliminado.

create or replace function public.cupo_efectivo(
  p_empresa_id uuid,
  p_fecha date,
  p_turno text
)
returns int
language plpgsql
stable
as $$
declare
  v_activo boolean;
  v_modo text;
  v_global int;
  v_reglas jsonb;
  v_cupo int;
begin
  select max_personas_hora_activo,
         max_personas_hora_modo,
         max_personas_hora_global,
         max_personas_hora_reglas
    into v_activo, v_modo, v_global, v_reglas
    from public.empresa_reservas_config
   where empresa_id = p_empresa_id;

  -- Sin fila de config o tope desactivado => sin límite por cupo.
  if v_activo is null or v_activo = false then
    return null;
  end if;

  -- Modo "mismo": un único tope global por hora.
  if coalesce(v_modo, 'mismo') = 'mismo' then
    if coalesce(v_global, 0) > 0 then
      return v_global;
    end if;
    return null;
  end if;

  -- Modos por reglas ("diferente_hora" / "diferente_tramo"): el cupo del turno
  -- es el MAYOR de los topes definidos, porque el turno agrupa varias horas y
  -- pasarse de largo aquí se corrige después al asignar mesa. Quedarse corto,
  -- en cambio, cerraría Google con sitio libre.
  select max((r->>'max')::int)
    into v_cupo
    from jsonb_array_elements(coalesce(v_reglas, '[]'::jsonb)) r
   where coalesce((r->>'max')::int, 0) > 0;

  if coalesce(v_cupo, 0) > 0 then
    return v_cupo;
  end if;

  return null;
end;
$$;

comment on function public.cupo_efectivo(uuid, date, text) is
  'Cupo de personas del turno (COMIDA|CENA) para el motor externo (Google RwG). Sale del tope por hora de Sala → Reservas. NULL = sin tope.';
