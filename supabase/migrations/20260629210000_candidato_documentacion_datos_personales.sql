-- Datos personales adicionales del paso «Documentación» del candidato:
--   · foto de perfil (la que se quitó de la candidatura inicial)
--   · dirección postal
--   · fecha de nacimiento
-- Se rellenan en el formulario público /documentacion/<token>.
-- Idempotente.

ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS foto_perfil_path text,
  ADD COLUMN IF NOT EXISTS direccion        text,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

COMMENT ON COLUMN public.candidatos.foto_perfil_path IS
  'Path en el bucket documentacion-candidatos de la foto de perfil del candidato.';
COMMENT ON COLUMN public.candidatos.direccion IS
  'Dirección postal completa declarada por el candidato en el paso Documentación.';
COMMENT ON COLUMN public.candidatos.fecha_nacimiento IS
  'Fecha de nacimiento declarada por el candidato en el paso Documentación.';
