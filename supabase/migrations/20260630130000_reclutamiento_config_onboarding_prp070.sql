-- PRP-070 · Config de onboarding por empresa (Ajustes → RRHH → Reclutamiento).
-- Se persisten en la misma fila por empresa de `reclutamiento_config`.
-- Idempotente.

-- Fase Formación: destino del botón "Acceder a la formación" del Email 1.
alter table public.reclutamiento_config
  add column if not exists formacion_url text;

-- Fase Contratación: cuerpo configurable del contrato interno (PLANTILLAS →
-- Documentos → Contrato interno). NULL = se usa el texto por defecto del sistema.
alter table public.reclutamiento_config
  add column if not exists contrato_interno_plantilla text;

-- Fase Prueba: duración y aviso automático a RRHH.
alter table public.reclutamiento_config
  add column if not exists prueba_duracion_dias integer not null default 30;
alter table public.reclutamiento_config
  add column if not exists prueba_aviso_dias integer not null default 10;
-- Canal del aviso: 'notificacion' | 'email' | 'ambos'.
alter table public.reclutamiento_config
  add column if not exists prueba_aviso_canal text not null default 'ambos';
alter table public.reclutamiento_config
  add column if not exists prueba_aviso_activo boolean not null default true;

comment on column public.reclutamiento_config.formacion_url is
  'URL destino del botón "Acceder a la formación" del email de la fase Formación.';
comment on column public.reclutamiento_config.contrato_interno_plantilla is
  'Cuerpo (texto con placeholders) del contrato interno. NULL = texto por defecto del sistema.';
comment on column public.reclutamiento_config.prueba_duracion_dias is
  'Duración del periodo de prueba en días (usado en el email y el cálculo de avisos).';
comment on column public.reclutamiento_config.prueba_aviso_dias is
  'Avisar a RRHH cuando el trabajador lleve X días en periodo de prueba.';
comment on column public.reclutamiento_config.prueba_aviso_canal is
  'Canal del aviso de periodo de prueba: notificacion | email | ambos.';
comment on column public.reclutamiento_config.prueba_aviso_activo is
  'Si true, el cron emite el aviso de periodo de prueba a RRHH.';
