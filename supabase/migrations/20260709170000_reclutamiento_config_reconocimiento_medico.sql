-- Fase Contratación · cuerpo configurable del RECONOCIMIENTO MÉDICO (PLANTILLAS →
-- Documentos → Reconocimiento médico). Se firma junto al contrato interno.
-- NULL = se usa el texto por defecto del sistema. Idempotente.

alter table public.reclutamiento_config
  add column if not exists reconocimiento_medico_plantilla text;

comment on column public.reclutamiento_config.reconocimiento_medico_plantilla is
  'Cuerpo (texto con placeholders) del reconocimiento médico. NULL = texto por defecto del sistema.';
