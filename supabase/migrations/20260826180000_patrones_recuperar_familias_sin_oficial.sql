-- Patrones de horario: recuperar familias que se quedaron SIN versión oficial.
--
-- `crearVersionPatron` desmarcaba la versión oficial anterior ANTES de insertar
-- la nueva, y solo revertía si fallaba esa inserción concreta. Si fallaba un
-- paso posterior (las semanas del patrón) o el proceso se cortaba, el
-- `es_oficial = false` ya estaba escrito y nadie lo deshacía: la familia se
-- quedaba sin ninguna versión oficial y el patrón desaparecía de todas las
-- listas (de Horarios y del selector de horario del puesto), aunque siguiera
-- teniendo empleados asignados.
--
-- Caso real: "COCINERO 1" de BACANAL, con un empleado asignado, invisible en
-- todas las pantallas.
--
-- Aquí se re-oficializa la versión más alta de cada familia huérfana. El fallo
-- de origen se corrigió en `patrones-actions.ts`: ahora, si fallan las semanas,
-- se borra la versión nueva y se devuelve el flag a la anterior.
--
-- NO toca `rrhh_patron_empleados`: los horarios ya asignados a los empleados se
-- quedan exactamente como están.
--
-- Idempotente: solo actúa sobre familias sin ninguna versión oficial.

BEGIN;

WITH huerfanas AS (
  SELECT familia_id, empresa_id
  FROM rrhh_patrones
  GROUP BY familia_id, empresa_id
  HAVING count(*) FILTER (WHERE es_oficial) = 0
),
a_oficializar AS (
  SELECT DISTINCT ON (pa.familia_id, pa.empresa_id) pa.id
  FROM rrhh_patrones pa
  JOIN huerfanas h ON h.familia_id = pa.familia_id AND h.empresa_id = pa.empresa_id
  ORDER BY pa.familia_id, pa.empresa_id, pa.version DESC, pa.created_at DESC
)
UPDATE rrhh_patrones
SET es_oficial = true
WHERE id IN (SELECT id FROM a_oficializar);

COMMIT;
