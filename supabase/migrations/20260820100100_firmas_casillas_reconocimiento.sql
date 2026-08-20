-- Reconocimiento médico: posición de las casillas SÍ/NO dentro del PDF original.
-- Se guarda al generar el documento para poder ESTAMPAR la casilla elegida por el
-- trabajador en el momento de la firma. NULL en el resto de documentos. Idempotente.

alter table public.firmas_documentos
  add column if not exists casillas_reconocimiento jsonb;

comment on column public.firmas_documentos.casillas_reconocimiento is
  'Reconocimiento médico: posición de las casillas SI/NO en el PDF original, para estampar la elegida al firmar.';
