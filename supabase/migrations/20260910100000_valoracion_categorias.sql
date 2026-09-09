-- Catalogo de categorias que puede puntuar el cliente en la encuesta de visita.
--
-- Es CERRADO a proposito: el local elige cuales aparecen, pero no inventa
-- nombres. Con texto libre, "Copas" y "Bebida" serian dos columnas distintas
-- en el informe y no se podrian comparar locales entre si ni un ano con otro.
--
-- Cada categoria guarda su nota en su propia columna de `resenas`. La bebida va
-- SEPARADA de la comida y no renombrando aquella: en BACANAL se quieren las dos
-- por separado (un plato flojo y un coctel flojo no se arreglan igual), y
-- mezclarlas repetiria el problema que ya traia CoverManager.
alter table public.resenas
  add column if not exists rating_bebida integer,
  add column if not exists rating_musica integer,
  add column if not exists rating_espectaculo integer;

comment on column public.resenas.rating_bebida is 'Nota de la bebida (1-5).';
comment on column public.resenas.rating_musica is 'Nota de la musica (1-5).';
comment on column public.resenas.rating_espectaculo is 'Nota del espectaculo (1-5).';

alter table public.empresa_reservas_config
  add column if not exists valoracion_pide_bebida boolean not null default false,
  add column if not exists valoracion_pide_musica boolean not null default false,
  add column if not exists valoracion_pide_espectaculo boolean not null default false;
