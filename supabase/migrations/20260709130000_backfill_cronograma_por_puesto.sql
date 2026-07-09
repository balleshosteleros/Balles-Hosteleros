-- Backfill: garantiza la relación 1:1 PUESTO ↔ CRONOGRAMA.
--
-- Todo puesto debe tener su cronograma (al menos una fila placeholder). El alta
-- de puesto ya lo crea al momento vía crearCronogramaParaPuesto(), pero los
-- puestos creados antes de esa lógica (o cuya creación falló a mitad) quedaron
-- sin cronograma. Esto los repara.
--
-- Replica exactamente el placeholder de crearCronogramaParaPuesto
-- (vacantes-actions.ts): rol = nombre del puesto, departamento = nombre real
-- del departamento, tarea = "Añadir misión de <rol>", frecuencia OTRO, orden 1.
--
-- Idempotente: solo inserta para puestos que NO tienen ninguna fila en
-- cronogramas_operativos (por puesto_id). Re-ejecutarlo no duplica nada.

INSERT INTO public.cronogramas_operativos (
  empresa_id,
  puesto_id,
  rol,
  departamento,
  tarea,
  frecuencia,
  tiempo_requerido,
  id_visible,
  orden,
  parent_id
)
SELECT
  p.empresa_id,
  p.id,
  trim(p.nombre),
  coalesce(d.nombre, ''),
  'Añadir misión de ' || trim(p.nombre),
  'OTRO',
  '',
  '1',
  1,
  NULL
FROM public.puestos p
LEFT JOIN public.departamentos d ON d.id = p.departamento_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cronogramas_operativos c
  WHERE c.puesto_id = p.id
);
