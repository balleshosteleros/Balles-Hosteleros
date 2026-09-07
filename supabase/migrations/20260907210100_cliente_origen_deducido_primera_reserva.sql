-- Rellena el origen de los clientes que ya estaban, mirando su primera reserva.
--
-- El campo `clientes_sala.origen` nace vacío para las 18.889 fichas que vinieron
-- de CoverManager. El dato, sin embargo, se puede recuperar: si la primera vez
-- que supimos de esa persona fue una reserva por la web, por Google o por
-- teléfono, ese fue el canal por el que entró.
--
-- "Primera" es la reserva de FECHA más antigua, no la que se grabó antes: la
-- migración de Cward volcó veinte mil reservas el mismo día, así que `created_at`
-- no ordena nada. Se incluyen las canceladas a propósito — quien reservó por la
-- web y luego canceló, entró por la web igual.
--
-- Lo que NO se toca:
--   · quien ya tiene origen (esta migración solo rellena huecos, no reescribe),
--   · quien nunca reservó (unos 455 en BACANAL): son los que entraron por otra
--     vía y su canal solo lo sabe quien les dio de alta. Se quedan en NULL, que
--     es la verdad: no lo sabemos.
--
-- Idempotente: solo actúa sobre `origen IS NULL`, así que se puede repetir.

WITH primera AS (
  SELECT DISTINCT ON (r.cliente_id)
         r.cliente_id,
         r.origen
  FROM public.reservas r
  WHERE r.cliente_id IS NOT NULL
    AND r.origen IS NOT NULL
  ORDER BY r.cliente_id, r.fecha ASC NULLS LAST, r.created_at ASC
)
UPDATE public.clientes_sala cs
SET origen = primera.origen
FROM primera
WHERE cs.id = primera.cliente_id
  AND cs.origen IS NULL;
