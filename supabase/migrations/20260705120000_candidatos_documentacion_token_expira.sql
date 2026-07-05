-- Caducidad del enlace de documentación del candidato.
--
-- El enlace `/documentacion/<token>` era válido indefinidamente. Ahora se marca
-- una fecha de expiración al enviarlo (7 días completos desde el envío). Pasada
-- esa fecha el enlace deja de resolver y el candidato debe pedir uno nuevo.
--
-- Aditivo e idempotente. Los tokens existentes que no tengan fecha quedan sin
-- caducidad (comportamiento previo) hasta que se reenvíe el correo.
ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS documentacion_token_expira_en timestamptz;

COMMENT ON COLUMN public.candidatos.documentacion_token_expira_en IS
  'Caducidad del enlace de documentación (/documentacion/<token>). Se fija a +7 días al enviar el correo. NULL = sin caducidad (tokens antiguos).';
