-- Flexible day-less: un turno flexible indica SOLO horas por día (un número),
-- sin atarse a un día concreto. El día y la repetición se deciden luego en el
-- patrón o asignando el turno directo a días/empleados (igual que el fijo).
--
-- `flex_horas_dia` es la nueva fuente de la jornada flexible. Los turnos legacy
-- que aún usan `flex_horas` (mapa por día) + `flex_modo` siguen funcionando: el
-- motor lee `flex_horas_dia` si está, y si no, cae al modelo antiguo.

ALTER TABLE rrhh_turnos
  ADD COLUMN IF NOT EXISTS flex_horas_dia NUMERIC;

-- Backfill solo de los flexibles DIARIOS (su objetivo por día es uniforme):
-- toma el valor de horas que ya tenían. Los 'semanal' se dejan intactos (null)
-- para no cambiar su tope semanal de fichaje.
UPDATE rrhh_turnos t
SET flex_horas_dia = sub.h
FROM (
  SELECT id, max(value::numeric) AS h
  FROM rrhh_turnos, jsonb_each_text(coalesce(flex_horas, '{}'::jsonb))
  WHERE tipo_jornada = 'flexible' AND coalesce(flex_modo, 'diario') = 'diario'
  GROUP BY id
) sub
WHERE t.id = sub.id
  AND t.flex_horas_dia IS NULL;
