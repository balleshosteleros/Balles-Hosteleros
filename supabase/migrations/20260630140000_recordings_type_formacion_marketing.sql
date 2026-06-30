-- Ampliar los tipos permitidos de `recordings.type` para incluir 'formacion'
-- y 'marketing' (antes solo 'grabacion' y 'onboarding'). Necesario para que los
-- vídeos de formación cuenten en la cuota por empresa.
ALTER TABLE public.recordings DROP CONSTRAINT IF EXISTS recordings_type_check;
ALTER TABLE public.recordings ADD CONSTRAINT recordings_type_check
  CHECK (type = ANY (ARRAY['grabacion'::text, 'onboarding'::text, 'formacion'::text, 'marketing'::text]));

-- formacion y marketing son por empresa (empresa_id no nulo), como grabacion.
-- onboarding sigue siendo global (empresa_id nulo).
ALTER TABLE public.recordings DROP CONSTRAINT IF EXISTS recordings_type_empresa_check;
ALTER TABLE public.recordings ADD CONSTRAINT recordings_type_empresa_check
  CHECK (
    (type = 'onboarding'::text AND empresa_id IS NULL)
    OR (type = ANY (ARRAY['grabacion'::text, 'formacion'::text, 'marketing'::text]) AND empresa_id IS NOT NULL)
  );
