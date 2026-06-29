-- Snapshot inmutable del correo enviado al candidato.
--
-- Hasta ahora candidato_historial guardaba solo `email_enviado` (flag) y
-- `email_asunto`. Eso no permite VER el correo que recibió el candidato tal cual,
-- y si la plantilla cambia, el correo histórico se pierde para siempre.
--
-- `email_html` guarda el HTML EXACTO que se envió (cabecera de marca incluida),
-- congelado en el momento del envío. Es un registro histórico: una vez escrito,
-- no debe modificarse aunque la plantilla cambie después.
ALTER TABLE public.candidato_historial
  ADD COLUMN IF NOT EXISTS email_html TEXT;

COMMENT ON COLUMN public.candidato_historial.email_html IS
  'HTML exacto del correo enviado al candidato (snapshot inmutable). NULL si no se envió correo en este evento.';
