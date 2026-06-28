-- Guarda el ASUNTO del correo enviado en cada cambio de fase del candidato,
-- para que el "Historial de actividad" muestre qué email se envió (no solo que
-- se envió uno). Idempotente.
alter table public.candidato_historial
  add column if not exists email_asunto text;
