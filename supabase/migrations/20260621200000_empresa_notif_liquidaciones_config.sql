-- PRP-064 Fase 0: configuración (general de empresa) de notificaciones de liquidación.
-- Vive en columnas de `empresas` (más simple que tabla aparte). Los DEFAULT NOT NULL
-- rellenan automáticamente las empresas existentes (Habana, Bacanal) y las futuras.
-- Idempotente.

alter table public.empresas
  add column if not exists notif_liquidaciones_activo            boolean not null default true,
  add column if not exists notif_liquidaciones_requiere_aprobacion boolean not null default true,
  add column if not exists notif_liquidaciones_pagado_activo      boolean not null default true,
  add column if not exists notif_liquidaciones_texto_liquidar     text not null
    default 'Las liquidaciones se emiten siempre el primer miércoles del mes.';

comment on column public.empresas.notif_liquidaciones_activo             is 'Avisar por notificación al emitir liquidaciones.';
comment on column public.empresas.notif_liquidaciones_requiere_aprobacion is 'Exigir que el empleado pulse LIQUIDAR para aprobar la liquidación.';
comment on column public.empresas.notif_liquidaciones_pagado_activo      is 'Avisar por notificación cuando se marque la liquidación como Pagado.';
comment on column public.empresas.notif_liquidaciones_texto_liquidar     is 'Texto del pop-up que ve el empleado al pulsar LIQUIDAR (editable por empresa).';
