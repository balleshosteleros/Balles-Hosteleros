-- Música: índices para el catálogo que se carga en TODAS las pantallas.
--
-- El contexto de música vive en el armazón de la aplicación (la música no puede
-- pararse al cambiar de pantalla), así que estas dos consultas se ejecutan en
-- cada carga, no solo en Sala → Música. Con 200 canciones da igual, pero el
-- coste crece con el catálogo y lo paga toda la app.
--
-- Ya existían índices por `empresa_id` a secas, pero no cubrían ni el filtro
-- `activo` ni el ORDER BY, así que Postgres tenía que ordenar el resultado
-- entero aparte. Medido sobre una copia con 20.000 canciones:
--
--   canciones de la empresa   20,3 ms → 3,4 ms   (6× más rápido)
--
-- Los índices son PARCIALES (`where activo`): las canciones retiradas no se
-- listan nunca, así que no tiene sentido pagar por indexarlas.

-- 1) Biblioteca de la empresa, ya ordenada por título.
create index if not exists musica_canciones_empresa_titulo_idx
  on public.musica_canciones (empresa_id, titulo)
  where activo;

-- 2) Vínculos lista↔canción de la empresa, ya ordenados por posición.
--    El índice que había, (lista_id, posicion), no sirve para la consulta que
--    trae de golpe los vínculos de TODAS las listas filtrando por empresa.
create index if not exists musica_lista_canciones_empresa_pos_idx
  on public.musica_lista_canciones (empresa_id, posicion);
