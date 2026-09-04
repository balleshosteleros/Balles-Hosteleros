-- Música: modo aleatorio por local.
--
-- Un disco de 100 temas que suena todos los días arranca siempre por la misma
-- canción y en el mismo orden: en una semana el equipo se lo sabe de memoria.
--
-- Se guarda en `musica_reproductor` (y no en la lista) porque es una preferencia
-- de CÓMO se está escuchando ahora en ESE local, no de la lista en sí: el mismo
-- Chill Out puede ir en orden en la comida y aleatorio en las copas.

alter table public.musica_reproductor
  add column if not exists aleatorio boolean not null default false;

comment on column public.musica_reproductor.aleatorio is
  'Si true, al acabar una canción entra otra al azar en vez de la siguiente.';
