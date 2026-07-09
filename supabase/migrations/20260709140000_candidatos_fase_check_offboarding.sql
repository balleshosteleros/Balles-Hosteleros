-- Nueva fase «Offboarding» (Preaviso · Baja contrato · Entregas · Finiquito) y
-- nuevo estado «Ex-empleados» dentro de «Descartado». La columna candidatos.fase
-- guarda en realidad el ESTADO/columna del candidato, así que el CHECK debe
-- admitir los nuevos valores; sin esto, mover un candidato a cualquiera de ellos
-- fallaría con "violates check constraint candidatos_fase_check".
-- Conservamos todos los valores anteriores (canónicos y legacy). Idempotente.
ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_fase_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_fase_check
  CHECK (fase = ANY (ARRAY[
    -- Selección
    'nuevo'::text,
    'elegido'::text,
    'entrevista'::text,
    'documentacion'::text,
    'seleccion'::text,
    -- Onboarding
    'onboarding'::text,
    'formacion'::text,
    'contratacion'::text,
    'prueba'::text,
    'empleado'::text,
    -- Offboarding (nueva fase)
    'offboarding'::text,
    'preaviso'::text,
    'baja_contrato'::text,
    'entregas'::text,
    'finiquito'::text,
    -- Descartado (+ nuevo estado ex_empleado)
    'descartado'::text,
    'papelera'::text,
    'no_se_presenta'::text,
    'suspenso_formacion'::text,
    'ex_empleado'::text,
    -- Legacy (datos históricos y aliases que aún pueden aparecer)
    'en_progreso'::text,
    'oferta'::text,
    'seleccionado'::text
  ]));
