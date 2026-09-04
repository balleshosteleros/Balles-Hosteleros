-- pos_tickets: las columnas de origen Ágora existen en PRODUCCIÓN pero nunca
-- tuvieron migración (PRP-056 las planificó y el fichero no llegó a escribirse).
--
-- CONSECUENCIA de no tenerlas versionadas: un entorno recreado desde migraciones
-- arranca sin ellas y rompe en silencio dos cosas que sí están en el código:
--   · la ingesta diaria (`agora-ventas-ingesta.ts` escribe origen/agora_serie/agora_numero)
--   · el descuento de stock (`agora-descuento-dia.ts` filtra por origen = 'agora')
-- Es el mismo caso que el índice de `productos.agora_id` (20260828100000): en
-- producción no se nota, y el problema sale en el peor sitio — un entorno nuevo.
--
-- Espejo EXACTO de lo que hay hoy en producción (verificado contra
-- information_schema y pg_indexes el 2026-09-04), así que allí es un no-op:
--   origen        text NOT NULL DEFAULT 'pos'
--   agora_serie   text NULL
--   agora_numero  bigint NULL
--   idx_pos_tickets_origen (empresa_id, origen)

alter table public.pos_tickets
  add column if not exists origen       text not null default 'pos',
  add column if not exists agora_serie  text,
  add column if not exists agora_numero bigint;

comment on column public.pos_tickets.origen is
  '''pos'' = TPV propio · ''agora'' = ingesta diaria desde Ágora (PRP-056)';

create index if not exists idx_pos_tickets_origen
  on public.pos_tickets (empresa_id, origen);
