-- Carta digital: familias (COMIDA/BEBIDA), categorías destacadas y horarios.
--
-- POR QUÉ:
--  · La carta mezclaba 23 categorías en una sola lista lateral. Separarlas en
--    dos familias deja al comensal elegir primero "qué quiero" y luego el tipo.
--  · Las dietas especiales (celíacos, veganos, niños) se buscan de otra forma:
--    quien las necesita las localiza si su botón se distingue del resto.
--  · El menú del día solo existe de lunes a viernes a mediodía. Enseñarlo un
--    sábado por la noche es prometer algo que no se sirve.
alter table carta_categorias
  add column if not exists familia text check (familia in ('comida','bebida')),
  add column if not exists destacada boolean not null default false,
  add column if not exists dias_semana smallint[],
  add column if not exists hora_desde time,
  add column if not exists hora_hasta time;

comment on column carta_categorias.familia is 'Agrupa la categoria bajo COMIDA o BEBIDA en la carta publica.';
comment on column carta_categorias.destacada is 'Dietas especiales (celiacos, veganos, ninos): boton con estilo propio.';
comment on column carta_categorias.dias_semana is 'Dias en que se muestra (1=lunes..7=domingo). NULL = todos.';
comment on column carta_categorias.hora_desde is 'Hora de inicio de visibilidad. NULL = sin restriccion.';
comment on column carta_categorias.hora_hasta is 'Hora de fin de visibilidad. NULL = sin restriccion.';

-- Tercera familia: shishas y vapers no son ni comida ni bebida.
alter table carta_categorias drop constraint if exists carta_categorias_familia_check;
alter table carta_categorias add constraint carta_categorias_familia_check
  check (familia in ('comida','bebida','otros'));
