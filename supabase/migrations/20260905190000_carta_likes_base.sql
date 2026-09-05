-- Número de arranque de "me gusta" por plato.
--
-- El contador que ve el comensal es `likes_base + likes_count`. La base la fija
-- la empresa desde Carta digital y NO es un voto: no toca `likes_count` ni
-- aparece en las estadísticas, que se calculan siempre sobre `carta_item_likes`
-- —los votos reales, con su fecha y su dispositivo—. Así el ranking sigue
-- diciendo qué gusta de verdad aunque el número de la carta arranque más alto.
alter table carta_items
  add column if not exists likes_base integer not null default 0;

comment on column carta_items.likes_base is
  'Numero de arranque que se SUMA al contador visible. No es un voto: no entra en likes_count ni en las estadisticas, que solo cuentan carta_item_likes reales.';
