-- Amplía notificaciones_tipo_check para admitir el tipo 'cambio_email_acceso'
-- (aviso in-app al empleado cuando cambia su correo de login en auth.users).
--
-- Contexto: al cambiar el email de empresa de un empleado (desde la ficha en RRHH
-- o desde Ajustes → Usuarios), el sistema resincroniza el login (auth.users) con
-- la regla canónica empresa ?? personal, conserva la contraseña y avisa in-app.
-- El catálogo TS (features/notificaciones/lib/catalogo.ts) ya define este tipo;
-- sin este cambio el INSERT en `notificaciones` viola el CHECK.
--
-- Se aprovecha para incluir también los tipos gestoria_* y 'sistema', que ya
-- existen en el catálogo TS pero faltaban en el constraint de BD (deuda: el
-- constraint quedó desalineado del catálogo).
--
-- Idempotente: se puede re-ejecutar sin efecto.

ALTER TABLE public.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'info'::text,
    'alerta'::text,
    'error'::text,
    'exito'::text,
    'recordatorio'::text,
    'liquidacion'::text,
    'liquidacion_pagada'::text,
    'aviso_manual'::text,
    'vencimiento'::text,
    'cronograma'::text,
    'comunicado'::text,
    'encuesta'::text,
    'gestoria_alta_enviada'::text,
    'gestoria_recordatorio'::text,
    'gestoria_contrato_subido'::text,
    'gestoria_contrato_firmado'::text,
    'cambio_email_acceso'::text
  ]));
