-- PRP-070 (corrección) · Onboarding = 4 columnas: Formación · Contratación · Prueba · Empleado.
--
-- Elimina los sub-estados internos de Contratación (que se mostraban como columnas)
-- y las columnas legacy Teórica/Práctica. El detalle del avance de contratos se
-- gestiona automáticamente y se ve en la ficha, no como columnas del pipeline.
-- Idempotente.

-- 1) Candidatos en sub-estados de contratación → "contratacion".
UPDATE public.candidatos
SET estado = 'contratacion'
WHERE estado IN (
  'alta_pendiente_revision', 'alta_enviada', 'contrato_interno_firmado',
  'contrato_oficial_subido', 'contrato_oficial_firmado', 'alta_completada'
);

-- 2) Candidatos legacy en teórica/práctica → "formacion" (por si quedó alguno).
UPDATE public.candidatos
SET estado = 'formacion'
WHERE estado IN ('teorica', 'practica');

-- 3) Plantilla de estados por empresa: reemplaza la lista de 11 estados antiguos
--    por las 4 columnas del onboarding + Selección + Descartado (8 columnas).
--    Solo afecta a las plantillas predeterminadas con los estados antiguos.
UPDATE public.reclutamiento_plantillas_estado
SET estados = '[
  {"key":"nuevo","label":"Nuevo","color":"hsl(220, 70%, 55%)","fase":"seleccion","orden":1},
  {"key":"elegido","label":"Elegido","color":"hsl(220, 70%, 55%)","fase":"seleccion","orden":2},
  {"key":"entrevista","label":"Entrevista","color":"hsl(220, 70%, 55%)","fase":"seleccion","orden":3},
  {"key":"documentacion","label":"Documentación","color":"hsl(220, 70%, 55%)","fase":"seleccion","orden":4},
  {"key":"formacion","label":"Formación","color":"hsl(145, 63%, 42%)","fase":"formacion","orden":5},
  {"key":"contratacion","label":"Contratación","color":"hsl(38, 92%, 50%)","fase":"contratacion","orden":6},
  {"key":"prueba","label":"Prueba","color":"hsl(265, 60%, 55%)","fase":"prueba","orden":7},
  {"key":"empleado","label":"Empleado","color":"hsl(145, 63%, 42%)","fase":"empleado","orden":8},
  {"key":"papelera","label":"Papelera","color":"hsl(0, 72%, 51%)","fase":"descartado","orden":9},
  {"key":"no_se_presenta","label":"No se presenta","color":"hsl(0, 72%, 51%)","fase":"descartado","orden":10},
  {"key":"suspenso_formacion","label":"Suspenso Formación","color":"hsl(0, 72%, 51%)","fase":"descartado","orden":11}
]'::jsonb
WHERE estados @> '[{"key":"teorica"}]'::jsonb
   OR estados @> '[{"key":"practica"}]'::jsonb
   OR estados @> '[{"key":"alta_enviada"}]'::jsonb;
