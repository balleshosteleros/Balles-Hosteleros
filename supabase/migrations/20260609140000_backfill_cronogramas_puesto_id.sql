-- ============================================================================
-- Migración legacy: crear puestos desde los combos (departamento, rol) de los
-- cronogramas existentes y enlazar cada fila de cronograma a su puesto.
-- Cada fila de cronogramas_operativos es UNA TAREA; el conjunto de filas con el
-- mismo puesto_id forma "el cronograma" de ese puesto (1:1 puesto↔cronograma).
-- Idempotente: ON CONFLICT en puestos + solo toca filas con puesto_id NULL.
-- Aplicada al remoto el 2026-06-09 (18 puestos creados, 712 filas enlazadas).
-- ============================================================================

-- 1) Crear puestos faltantes a partir de los combos legacy
INSERT INTO public.puestos (empresa_id, departamento_id, nombre, estado)
SELECT DISTINCT c.empresa_id, d.id, c.rol, 'activo'
FROM public.cronogramas_operativos c
JOIN public.departamentos d
  ON d.empresa_id = c.empresa_id AND d.nombre = c.departamento
WHERE c.puesto_id IS NULL
  AND c.rol IS NOT NULL AND trim(c.rol) <> ''
ON CONFLICT (empresa_id, nombre) DO NOTHING;

-- 2) Backfill puesto_id en cada fila de cronograma
UPDATE public.cronogramas_operativos c
SET puesto_id = p.id
FROM public.puestos p
JOIN public.departamentos d ON d.id = p.departamento_id
WHERE c.puesto_id IS NULL
  AND p.empresa_id = c.empresa_id
  AND p.nombre = c.rol
  AND d.nombre = c.departamento;
