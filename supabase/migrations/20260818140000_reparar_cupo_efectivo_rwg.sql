-- Repara `cupo_efectivo`, que estaba ROTA y tumbaba toda la integración con Google.
--
-- La versión anterior consultaba `empresa_reservas_excepciones` y columnas
-- `<dia>_cupo_<turno>` que NO EXISTEN en la base de datos. Cualquier llamada
-- terminaba en «relation does not exist», y como `try_reservar_slot` la invoca
-- antes de aceptar una reserva, NINGUNA reserva entrante de Google podía
-- crearse y el feed de disponibilidad no se podía calcular.
--
-- Nueva definición: el cupo del turno es el TOPE DE PERSONAS POR HORA que la
-- empresa ya configura en Sala → Reservas (`max_personas_hora_*`), que es el
-- único límite de aforo que el producto expone hoy. Si la empresa no lo tiene
-- activado, devuelve NULL = sin tope (el límite real serán las mesas, que se
-- comprueban en la asignación).
--
-- Idempotente: CREATE OR REPLACE.

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
  -- DIA_COMPLETO no es un turno real de aforo: sin tope.
  if p_turno = 'DIA_COMPLETO' then
    return null;
  end if;

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
  'Cupo de personas del turno para el motor externo (Google RwG). Sale del tope por hora de Sala → Reservas. NULL = sin tope.';
