-- Enlace público de FORMACIÓN del candidato (fase «Formación» del onboarding).
--
-- En la fase Formación el candidato AÚN NO tiene cuenta en el sistema (el usuario
-- se crea al entrar en «Contratación»). Para que pueda ver el curso de su puesto
-- sin login, recibe un enlace personal `/formacion/<token>` — mismo patrón que
-- `/documentacion/<token>`: un token uuid único guardado en el candidato + una
-- fecha de caducidad que se renueva a +7 días en cada envío del correo.
--
-- El curso concreto se deriva del puesto de su vacante (candidato → vacante →
-- puesto → curso, relación 1 puesto = 1 curso), así que no se guarda aquí.
--
-- Aditivo e idempotente: solo añade dos columnas nullable, no toca datos ni RLS.
ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS formacion_token text,
  ADD COLUMN IF NOT EXISTS formacion_token_expira_en timestamptz;

COMMENT ON COLUMN public.candidatos.formacion_token IS
  'Token uuid del enlace público de formación (/formacion/<token>). Se genera de forma perezosa al enviar el correo de la fase «Formación».';
COMMENT ON COLUMN public.candidatos.formacion_token_expira_en IS
  'Caducidad del enlace de formación. Se fija a +7 días al enviar el correo. NULL = sin caducidad.';

-- Búsqueda por token en el flujo público (service-role, sin sesión).
CREATE UNIQUE INDEX IF NOT EXISTS candidatos_formacion_token_uidx
  ON public.candidatos (formacion_token)
  WHERE formacion_token IS NOT NULL;
