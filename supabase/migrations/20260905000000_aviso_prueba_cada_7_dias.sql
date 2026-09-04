-- Aviso del periodo de prueba: recordatorio PERIÓDICO cada 7 días.
--
-- Antes `prueba_aviso_dias` era un umbral ("a partir del día N"), y como el cron
-- corre a diario el aviso se repetía TODOS los días hasta el final del periodo.
-- Ahora es una periodicidad: con 7 y un periodo de 30, avisa los días 7, 14, 21
-- y 28. La víspera del fin (día 29) sale un aviso aparte de última llamada para
-- desistir, y el día 30 lo cubre el aviso de cierre.
--
-- Idempotente: se puede reejecutar sin efecto.

alter table reclutamiento_config alter column prueba_aviso_dias set default 7;

-- Las empresas que seguían con el valor por defecto anterior (10) pasan a 7.
-- No se toca a quien lo haya ajustado a mano a otro valor.
update reclutamiento_config
   set prueba_aviso_dias = 7,
       updated_at = now()
 where prueba_aviso_dias = 10;

-- Los tipos del periodo de prueba faltaban en el CHECK de `notificaciones`:
-- el catálogo del código los declara, pero la BD los rechazaba, así que TODAS
-- estas notificaciones fallaban en silencio (el cron captura el error y sigue).
-- Por eso el aviso llegaba solo por email y nunca a la campanita.
alter table notificaciones drop constraint if exists notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check check (
  tipo = any (array[
    'info','alerta','error','exito','recordatorio','aviso_manual',
    'liquidacion','liquidacion_pagada','vencimiento','cronograma',
    'comunicado','encuesta','cambio_email_acceso',
    'gestoria_alta_enviada','gestoria_recordatorio',
    'gestoria_contrato_subido','gestoria_contrato_firmado',
    'contratacion_iniciada','contrato_interno_enviado','contrato_interno_firmado',
    'reconocimiento_medico_enviado','reconocimiento_medico_firmado',
    'alta_completada','nueva_incorporacion',
    'entrega_material_firmada','devolucion_material_firmada',
    'prueba_aviso','prueba_ultima_llamada','prueba_evaluacion','prueba_cierre'
  ])
);
