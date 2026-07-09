-- Backfill ADITIVO: añade los estados de la nueva fase Offboarding (Preaviso ·
-- Baja contrato · Entregas · Finiquito) y el estado Ex-empleados (fase Descartado)
-- a las plantillas de estado ya guardadas que aún no los tienen. No pisa estados
-- existentes ni cambia su orden. Idempotente (solo anexa las claves que faltan).
WITH nuevos(estado) AS (
  VALUES
    ('{"key":"preaviso","label":"Preaviso","color":"hsl(25, 85%, 52%)","fase":"offboarding","orden":9}'::jsonb),
    ('{"key":"baja_contrato","label":"Baja contrato","color":"hsl(25, 85%, 52%)","fase":"offboarding","orden":10}'::jsonb),
    ('{"key":"entregas","label":"Entregas","color":"hsl(25, 85%, 52%)","fase":"offboarding","orden":11}'::jsonb),
    ('{"key":"finiquito","label":"Finiquito","color":"hsl(25, 85%, 52%)","fase":"offboarding","orden":12}'::jsonb),
    ('{"key":"ex_empleado","label":"Ex-empleados","color":"hsl(0, 72%, 51%)","fase":"descartado","orden":16}'::jsonb)
)
UPDATE public.reclutamiento_plantillas_estado p
SET estados = p.estados || (
  SELECT COALESCE(jsonb_agg(n.estado), '[]'::jsonb)
  FROM nuevos n
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.estados) e
    WHERE e->>'key' = n.estado->>'key'
  )
)
WHERE EXISTS (
  SELECT 1 FROM nuevos n
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.estados) e
    WHERE e->>'key' = n.estado->>'key'
  )
);
