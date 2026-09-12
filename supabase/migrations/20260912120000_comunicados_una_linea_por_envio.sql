-- ─────────────────────────────────────────────────────────────────────────────
-- COMUNICADOS QUE SE REPITEN: UNA LÍNEA POR CADA VEZ QUE SALEN
--
-- Hasta ahora un comunicado mensual o anual era UNA sola línea: al publicarse
-- se adelantaba su fecha a la siguiente vez, así que la lista no decía cuándo
-- salió la última vez —decía cuándo sale la próxima— y de las veces anteriores
-- no quedaba rastro. El porcentaje de vistos era uno solo, mezclado de todas.
--
-- A partir de aquí se separan dos cosas:
--   · LA PLANTILLA: la línea que se escribe, con su texto, sus destinatarios y
--     cada cuánto se repite. Se queda esperando su próxima fecha.
--   · CADA SALIDA: una línea nueva, con el día que salió y SU propio alcance.
--     No se edita ni se borra: es constancia de lo que se dijo ese día.
--
-- `origen_id`            de qué plantilla nació esta salida (null = escrita a mano).
-- `repeticion_parada_at` cuándo se paró la repetición. Solo en la plantilla;
--                        null = sigue viva. Se para desde cualquier salida y no
--                        vuelve a salir nunca más, pero la plantilla NO se
--                        borra: queda parada, lista para volver a arrancar.
-- (Iván, 12-09-2026)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.comunicados
  add column if not exists origen_id uuid
    references public.comunicados(id) on delete set null,
  add column if not exists repeticion_parada_at timestamptz;

comment on column public.comunicados.origen_id is
  'Plantilla de la que nació esta salida. Null = comunicado escrito a mano.';
comment on column public.comunicados.repeticion_parada_at is
  'Cuándo se paró la repetición de esta plantilla. Null = se sigue repitiendo.';

-- El historial de una plantilla se lee por aquí, y el cron busca las plantillas
-- vivas que les toca salir.
create index if not exists idx_comunicados_origen
  on public.comunicados(origen_id) where origen_id is not null;
create index if not exists idx_comunicados_recurrentes_vivos
  on public.comunicados(envio)
  where recurrencia <> 'sin_repeticion' and repeticion_parada_at is null;
