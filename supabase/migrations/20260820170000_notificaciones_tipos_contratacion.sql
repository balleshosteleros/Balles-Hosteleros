-- ============================================================
-- Los avisos del flujo de contratación no llegaban nunca
-- ============================================================
--
-- `notificarRrhhGestoria` acepta seis tipos del flujo de Contratación
-- (PRP-070) que la base de datos NO reconocía: el CHECK de `tipo` se quedó sin
-- actualizar. El INSERT fallaba contra la restricción, pero el error se tragaba
-- en el try/catch de la propia función, así que el código daba el aviso por
-- enviado y a RRHH no le llegaba nada.
--
-- Faltaban:
--   contratacion_iniciada, contrato_interno_enviado, contrato_interno_firmado,
--   reconocimiento_medico_enviado, reconocimiento_medico_firmado, alta_completada
--
-- Se añaden también los dos tipos de las entregas de material, para que sus
-- avisos no repitan el mismo problema.
--
-- Idempotente: se recrea el CHECK completo.

alter table public.notificaciones
  drop constraint if exists notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check check (tipo in (
    -- Genéricos
    'info', 'alerta', 'error', 'exito', 'recordatorio', 'aviso_manual',
    -- Módulos
    'liquidacion', 'liquidacion_pagada', 'vencimiento', 'cronograma',
    'comunicado', 'encuesta', 'cambio_email_acceso',
    -- Gestoría
    'gestoria_alta_enviada', 'gestoria_recordatorio',
    'gestoria_contrato_subido', 'gestoria_contrato_firmado',
    -- Contratación (PRP-070)
    'contratacion_iniciada', 'contrato_interno_enviado', 'contrato_interno_firmado',
    'reconocimiento_medico_enviado', 'reconocimiento_medico_firmado',
    'alta_completada', 'nueva_incorporacion',
    -- Entregas de material y uniforme
    'entrega_material_firmada', 'devolucion_material_firmada'
  ));
