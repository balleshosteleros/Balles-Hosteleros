-- Normaliza empleado_locales: cada local debe vivir en la ficha (empleados.id)
-- de SU empresa. Un empleado multi-empresa tiene una fila por empresa; el fichaje
-- es agnóstico de empresa (geo -> local -> empresa) y resuelve el empleado.id a
-- partir de la fila que posee el local en el puente. Si un local quedaba colgado
-- de la ficha de otra empresa (p. ej. al guardar desde la tarjeta antes del fix),
-- el local aparecía duplicado y apuntaba a la ficha equivocada.
--
-- Idempotente: en una BD ya correcta no cambia nada.

-- 1) Asegura el local en la ficha de su empresa (si la persona tiene ficha allí).
INSERT INTO empleado_locales (empleado_id, local_id)
SELECT e2.id, el.local_id
FROM empleado_locales el
JOIN empleados e  ON e.id = el.empleado_id
JOIN locales   l  ON l.id = el.local_id
JOIN empleados e2 ON e2.user_id = e.user_id AND e2.empresa_id = l.empresa_id
WHERE l.empresa_id <> e.empresa_id
ON CONFLICT (empleado_id, local_id) DO NOTHING;

-- 2) Elimina la copia colgada de la ficha equivocada (solo si ya quedó cubierta
--    en la ficha correcta de su empresa).
DELETE FROM empleado_locales el
USING empleados e, locales l
WHERE el.empleado_id = e.id
  AND el.local_id = l.id
  AND l.empresa_id <> e.empresa_id
  AND EXISTS (
    SELECT 1 FROM empleados e2
    WHERE e2.user_id = e.user_id AND e2.empresa_id = l.empresa_id
  );
