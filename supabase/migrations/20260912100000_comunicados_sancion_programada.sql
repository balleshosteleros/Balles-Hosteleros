-- COMUNICADOS: una sanción se puede dejar PROGRAMADA para otro día.
--
-- Iván, 12-09-2026: la sanción es un tipo de comunicado y, como cualquier otro,
-- tiene que poder programarse para que salga el día que toca en vez de ahora.
--
-- El problema era que una sanción necesita tres datos que ningún comunicado
-- había necesitado nunca —la calificación de la falta, el día de los hechos y
-- los días que tiene para firmarla— y no tenían dónde esperar hasta ese día.
-- Aquí van, y el día que el cron la publica se monta con ellos el documento.
--
-- {"gravedad":"grave","fechaHechos":"2026-09-01","plazoDias":15}
--
-- Solo añade: los comunicados que ya existen se quedan con el campo vacío y no
-- cambia nada de lo suyo. Idempotente: se puede pasar dos veces.

alter table public.comunicados
  add column if not exists sancion jsonb;

comment on column public.comunicados.sancion is
  'Solo en los comunicados de tipo sancion: calificacion de la falta, fecha de los hechos y dias de plazo para firmarla. Vacio en el resto.';
