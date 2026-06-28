-- Paso «Documentación» del pipeline de reclutamiento (fase Formación, antes de
-- Teórica). El candidato recibe un enlace personal y aporta su documentación:
--   · DNI/NIE (anverso + reverso) — o pasaporte si es extranjero,
--   · número de cuenta bancaria (IBAN),
--   · número de la Seguridad Social.
--
-- Los DOCUMENTOS (fotos o PDF) se suben al bucket privado
-- `documentacion-candidatos` (ver migración del bucket); aquí solo guardamos los
-- paths de storage y los NÚMEROS extraídos por IA y VALIDADOS por la persona.
--
-- Idempotente y aditivo: solo añade columnas si faltan; no rompe históricos.

ALTER TABLE public.candidatos
  -- Token público del enlace de subida (URL: /documentacion/<token>). Se genera
  -- al enviar el correo del estado `documentacion`. Único y opcional.
  ADD COLUMN IF NOT EXISTS documentacion_token uuid,
  -- Números aportados (extraídos por IA, confirmados por el candidato).
  -- `dni_nie` ya existe en la tabla; aquí solo añadimos IBAN y nº SS.
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS num_seguridad_social text,
  -- Paths en el bucket privado `documentacion-candidatos`.
  ADD COLUMN IF NOT EXISTS doc_dni_anverso_path text,
  ADD COLUMN IF NOT EXISTS doc_dni_reverso_path text,
  ADD COLUMN IF NOT EXISTS doc_iban_path text,
  ADD COLUMN IF NOT EXISTS doc_ss_path text,
  -- Sello de "documentación recibida" (no null = completada).
  ADD COLUMN IF NOT EXISTS documentacion_completada_at timestamptz;

-- El token es único cuando existe (índice parcial: ignora los NULL de candidatos
-- que aún no están en el paso de documentación).
CREATE UNIQUE INDEX IF NOT EXISTS candidatos_documentacion_token_unq
  ON public.candidatos (documentacion_token)
  WHERE documentacion_token IS NOT NULL;
