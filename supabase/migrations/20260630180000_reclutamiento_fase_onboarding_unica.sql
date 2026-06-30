-- PRP-070 (corrección) · 3 fases en el pipeline: Selección · Onboarding · Descartado.
--
-- «Onboarding» es UNA sola fase con 4 sub-columnas (Formación · Contratación ·
-- Prueba · Empleado). En la plantilla de estados (jsonb) cada uno de esos 4
-- estados pasa a `fase: "onboarding"`. Las fases/estados del pipeline son fijas
-- del software (la pestaña «Estados» se ha retirado), pero mantenemos la fila de
-- plantilla coherente para la asignación de emails por estado en cada vacante.
-- Idempotente.

UPDATE public.reclutamiento_plantillas_estado
SET estados = (
  SELECT jsonb_agg(
    CASE
      WHEN e->>'key' IN ('formacion','contratacion','prueba','empleado')
        THEN jsonb_set(e, '{fase}', '"onboarding"')
      ELSE e
    END
    ORDER BY (e->>'orden')::int
  )
  FROM jsonb_array_elements(estados) e
)
WHERE estados @> '[{"key":"formacion"}]'::jsonb
   OR estados @> '[{"key":"contratacion"}]'::jsonb;
