-- Tipos de notificacion que el codigo emite y la BD rechazaba en silencio.
--
-- El catalogo del codigo (catalogo.ts) declaraba seis tipos que NO estaban en el
-- CHECK: solicitud_pendiente, doc_pendiente, firma_pendiente, resena_google,
-- modelos_aeat y nominas_gestoria_subidas. El INSERT fallaba con 23514 y el
-- error se lo tragaba el try/catch del emisor, asi que la notificacion se daba
-- por enviada y nunca llegaba a la campana. Comprobado en produccion: la tabla
-- solo tenia filas de 'liquidacion' y 'liquidacion_pagada'.
--
-- Se anade ademas 'solicitud_resuelta': el aviso al trabajador de que su
-- solicitud (de lo que sea) ha sido aprobada o denegada.
--
-- Idempotente: se recrea el CHECK completo.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (
  tipo = any (array[
    -- Genericos
    'info','alerta','error','exito','recordatorio','aviso_manual',
    -- Modulos
    'liquidacion','liquidacion_pagada','vencimiento','cronograma',
    'comunicado','encuesta','cambio_email_acceso',
    -- Gestoria
    'gestoria_alta_enviada','gestoria_recordatorio',
    'gestoria_contrato_subido','gestoria_contrato_firmado',
    -- Contratacion (PRP-070)
    'contratacion_iniciada','contrato_interno_enviado','contrato_interno_firmado',
    'reconocimiento_medico_enviado','reconocimiento_medico_firmado',
    'alta_completada','nueva_incorporacion',
    -- Entregas de material y uniforme
    'entrega_material_firmada','devolucion_material_firmada',
    -- Periodo de prueba
    'prueba_aviso','prueba_ultima_llamada','prueba_evaluacion','prueba_cierre',
    -- Solicitudes de personal: pendiente de validar y resuelta (aprobada/denegada)
    'solicitud_pendiente','solicitud_resuelta',
    -- Documentacion, firmas y avisos de otros modulos
    'doc_pendiente','firma_pendiente','resena_google','modelos_aeat',
    'nominas_gestoria_subidas'
  ])
);
