-- Reservas: el tope de comensales por turno vuelve a leer SUS reglas.
--
-- Problema detectado en producción: `cupo_efectivo()` no miraba la tabla de
-- reglas (`empresa_reservas_reglas`, métrica 'cupo') sino la configuración de
-- "máximo de personas por hora" (`max_personas_hora_*`), que es OTRA cosa: un
-- tope por franja horaria, no por turno.
--
-- Consecuencia: una regla de cupo activa (p.ej. 100 pax en comida) se ignoraba
-- por completo y `try_reservar_slot` concedía siempre, así que el turno se
-- sobrevendía. Verificado contra datos reales: la regla decía 100 y
-- `cupo_efectivo` devolvía NULL (= sin límite).
--
-- Además, en modo "diferente por tramo" tomaba el MAYOR de todos los tramos,
-- que es justo el tope más permisivo: si un tramo admitía 50 y otro 10, aplicaba
-- 50 al turno entero.
--
-- Solución: delegar en `resolver_valor_efectivo`, que ya implementa la cascada
-- de vigencia (fecha concreta → rango → día de la semana → general → prioridad)
-- y es la misma que usa la UI para mostrar el cupo. Una sola fuente de verdad.
--
-- Sin regla activa devuelve NULL = sin tope: el cupo se puede tener apagado y
-- entonces el límite real son las mesas.
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
  v_cupo int;
begin
  -- Fuente única: las reglas de cupo con su cascada de vigencia.
  v_cupo := public.resolver_valor_efectivo(p_empresa_id, p_fecha, p_turno, 'cupo');
  if coalesce(v_cupo, 0) > 0 then
    return v_cupo;
  end if;
  return null;
end;
$$;
