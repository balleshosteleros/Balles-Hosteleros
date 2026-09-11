-- Felicitación de cumpleaños al trabajador, con sus points de regalo.
--
-- Un solo interruptor manda sobre las dos cosas (mensaje y points): la regla
-- «Cumpleaños» de Points (RRHH → Points → Configuración → Reglas). Apagarla
-- deja mudo el cumpleaños entero; el número de points de la casilla es lo que
-- se regala.
--
-- Idempotente: se puede volver a pasar sin duplicar ni pisar lo que la empresa
-- haya cambiado a mano después.

-- ─── 1. El aviso de cumpleaños es un tipo propio ────────────────────────────
-- Sin esto la inserción muere con un 23514 y la felicitación se pierde en
-- silencio, que es justo lo que ya pasó con otros tipos inventados.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notificaciones'::regclass
      and conname = 'notificaciones_tipo_check'
      and pg_get_constraintdef(oid) like '%''cumpleanos''%'
  ) then
    alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
    alter table public.notificaciones add constraint notificaciones_tipo_check check (
      tipo = any (array[
        'info','alerta','error','exito','recordatorio','aviso_manual',
        'liquidacion','liquidacion_pagada','vencimiento','cronograma','comunicado','encuesta',
        'cambio_email_acceso',
        'gestoria_alta_enviada','gestoria_recordatorio','gestoria_contrato_subido',
        'gestoria_contrato_firmado','contratacion_iniciada','contrato_interno_enviado',
        'contrato_interno_firmado','reconocimiento_medico_enviado','reconocimiento_medico_firmado',
        'alta_completada','nueva_incorporacion',
        'entrega_material_firmada','devolucion_material_firmada',
        'prueba_aviso','prueba_ultima_llamada','prueba_evaluacion','prueba_cierre',
        'solicitud_pendiente','solicitud_resuelta','doc_pendiente','firma_pendiente',
        'resena_google','modelos_aeat','nominas_gestoria_subidas',
        'cumpleanos'
      ])
    );
  end if;
end $$;

-- ─── 2. La regla vive en TODAS las empresas ─────────────────────────────────
-- Points se sembró en su día solo en una empresa, así que en las demás no había
-- ni regla ni interruptor que tocar. Toda empresa parte igual.
insert into public.toques_reglas
  (empresa_id, codigo, nombre, descripcion, toques, periodicidad, categoria, activa)
select
  e.id,
  'cumpleanos_propio',
  'Cumpleaños',
  'El día de su cumpleaños recibe una felicitación y estos points de regalo. Apagar esto quita las dos cosas.',
  10,
  'hito',
  'antiguedad',
  true
from public.empresas e
on conflict (empresa_id, codigo) do nothing;

-- La que ya existía se sembró con 15 points, apagada y con una descripción que
-- no contaba lo del mensaje. Se deja en el punto de partida acordado: 10 points
-- y encendida.
update public.toques_reglas
set
  nombre = 'Cumpleaños',
  descripcion = 'El día de su cumpleaños recibe una felicitación y estos points de regalo. Apagar esto quita las dos cosas.',
  toques = 10,
  activa = true,
  updated_at = now()
where codigo = 'cumpleanos_propio'
  and descripcion <> 'El día de su cumpleaños recibe una felicitación y estos points de regalo. Apagar esto quita las dos cosas.';
