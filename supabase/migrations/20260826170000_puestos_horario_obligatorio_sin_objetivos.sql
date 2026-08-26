-- Puestos: el HORARIO pasa a ser obligatorio y OBJETIVOS desaparece.
--
-- El horario del puesto se hereda al empleado que se contrate, así que un
-- puesto sin horario dejaba al empleado sin cuadrante. Se rellenan los que
-- estaban vacíos con el patrón oficial más afín de su propia empresa:
--   1º) un patrón cuyo nombre case con el del puesto (CAMAREROS → CAMARERO 1),
--   2º) si no hay, el primer patrón oficial de la empresa (relleno a revisar).
--
-- `puesto_salarios.objetivos` deja de usarse en la aplicación: el campo se
-- eliminó de la ficha del puesto. La columna NO se borra (conserva el histórico
-- y el borrado sería irreversible): simplemente ya no se lee ni se escribe.
--
-- Idempotente: solo toca los puestos que no tienen horario.

BEGIN;

WITH oficiales AS (
  SELECT pa.empresa_id, pa.familia_id, upper(btrim(pa.nombre)) AS nombre
  FROM rrhh_patrones pa
  WHERE pa.es_oficial = true AND pa.puesto_id IS NULL
),
afin AS (
  SELECT DISTINCT ON (p.id) p.id AS puesto_id, o.familia_id
  FROM puestos p
  JOIN puesto_salarios s ON s.puesto_id = p.id AND s.patron_familia_id IS NULL
  JOIN oficiales o ON o.empresa_id = p.empresa_id
   AND (o.nombre LIKE upper(btrim(p.nombre)) || '%'
     OR upper(btrim(p.nombre)) LIKE regexp_replace(o.nombre, '\s+\d+$', '') || '%')
  ORDER BY p.id, o.nombre
),
fallback AS (
  SELECT DISTINCT ON (empresa_id) empresa_id, familia_id
  FROM oficiales
  ORDER BY empresa_id, nombre
)
UPDATE puesto_salarios s
SET patron_familia_id = COALESCE(a.familia_id, f.familia_id),
    updated_at = now()
FROM puestos p
LEFT JOIN afin a ON a.puesto_id = p.id
LEFT JOIN fallback f ON f.empresa_id = p.empresa_id
WHERE s.puesto_id = p.id
  AND s.patron_familia_id IS NULL
  AND COALESCE(a.familia_id, f.familia_id) IS NOT NULL;

COMMIT;
