-- Alta a la gestoría configurable (Ajustes → Departamentos → RRHH → Reclutamiento).
-- 1) Toggle para activar/desactivar el envío automático del alta de contrato.
-- 2) Selección por campos (jsonb) de QUÉ datos se incluyen en el correo a la gestoría.
--    Por defecto todos activados (NULL en BD = "todos"; la app normaliza).
-- Idempotente. Se persiste en la misma fila por empresa de `reclutamiento_config`.

alter table public.reclutamiento_config
  add column if not exists gestoria_envio_auto boolean not null default true;

alter table public.reclutamiento_config
  add column if not exists gestoria_campos jsonb;

comment on column public.reclutamiento_config.gestoria_envio_auto is
  'Si true, al contratar a un candidato se envía automáticamente el alta de contrato a la gestoría.';
comment on column public.reclutamiento_config.gestoria_campos is
  'Mapa { campo: boolean } de qué datos del trabajador se incluyen en el correo a la gestoría. NULL = todos.';
