-- PRP-065 Fase 0: motor de alertas universal — catálogo de tipos + config.
-- Construye ENCIMA de PRP-064 (tabla `notificaciones` ya existe y es genérica).
-- Idempotente.

-- 1) Ampliar los tipos permitidos con los del motor de alertas (manual + emisores v1).
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check
  check (tipo = any (array[
    -- existentes (PRP-064 y previos)
    'info','alerta','error','exito','recordatorio','liquidacion','liquidacion_pagada',
    -- motor de alertas (PRP-065)
    'aviso_manual','vencimiento','cronograma','comunicado','encuesta'
  ]));

-- 2) Toggles de alertas por empresa (un bool por tipo automático v1), patrón
--    notif_liquidaciones_*. Default true → todas las empresas presentes y
--    futuras emiten salvo que lo apaguen.
alter table public.empresas
  add column if not exists notif_vencimientos_activo boolean not null default true,
  add column if not exists notif_cronogramas_activo  boolean not null default true,
  add column if not exists notif_comunicados_activo   boolean not null default true,
  add column if not exists notif_encuestas_activo     boolean not null default true;

-- 3) Opt-in de push del nuevo canal "alertas" en usuarios (patrón push_*).
alter table public.usuarios
  add column if not exists push_alertas boolean not null default true;
