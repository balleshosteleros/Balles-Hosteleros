-- El código usa la fase principal 'onboarding' (Formación/Contratación/Prueba/
-- Empleado unificadas en una sola fase del Kanban), pero el CHECK de
-- candidatos.fase no la permitía: mover un candidato a Formación fallaba con
-- "new row for relation candidatos violates check constraint candidatos_fase_check".
-- Añadimos 'onboarding' y conservamos los valores legacy existentes. Idempotente.
ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_fase_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_fase_check
  CHECK (fase = ANY (ARRAY[
    'seleccion'::text,
    'onboarding'::text,
    'descartado'::text,
    -- Legacy (datos históricos y aliases que aún pueden aparecer):
    'formacion'::text,
    'contratacion'::text,
    'prueba'::text,
    'empleado'::text,
    'nuevo'::text,
    'en_progreso'::text,
    'oferta'::text,
    'seleccionado'::text
  ]));
