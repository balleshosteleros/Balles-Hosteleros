-- El modelo canónico de fases del pipeline de reclutamiento usa
-- 'seleccion' / 'formacion' / 'descartado'. El CHECK antiguo solo admitía
-- los nombres legacy ('nuevo','en_progreso','oferta','seleccionado','descartado'),
-- por lo que mover un candidato a Selección o Formación violaba la
-- restricción y el UPDATE lanzaba error (enmascarado como "Error desconocido").
-- Ampliamos el CHECK para admitir las 3 fases canónicas + los alias legacy
-- (datos antiguos) de forma idempotente.
ALTER TABLE public.candidatos DROP CONSTRAINT IF EXISTS candidatos_fase_check;
ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_fase_check CHECK (
  fase = ANY (ARRAY[
    'seleccion'::text,
    'formacion'::text,
    'descartado'::text,
    -- alias legacy conservados por compatibilidad con datos antiguos
    'nuevo'::text,
    'en_progreso'::text,
    'oferta'::text,
    'seleccionado'::text
  ])
);
