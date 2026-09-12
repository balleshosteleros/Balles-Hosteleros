-- Formato de foto de la carta: cuadrada, horizontal o vertical.
--
-- Hasta ahora cada foto se enseñaba con SU proporcion y las tarjetas de una
-- misma fila salian a distinta altura: la rejilla quedaba escalonada. El
-- formato pasa a decidirlo la casa desde Ajustes, no el archivo.
--
-- Se elige POR CATEGORIA porque no todo se fotografia igual: una botella pide
-- vertical y un plato horizontal. Dentro de una categoria todas comparten
-- forma, que es lo que hace que la fila cuadre. Si la categoria no dice nada
-- manda el de la carta, y si la carta tampoco, horizontal, que es como nacio.
alter table public.empresas
  add column if not exists carta_formato_foto text not null default 'horizontal';

alter table public.carta_categorias
  add column if not exists formato_foto text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_carta_formato_foto_chk') then
    alter table public.empresas add constraint empresas_carta_formato_foto_chk
      check (carta_formato_foto in ('cuadrada','horizontal','vertical'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carta_categorias_formato_foto_chk') then
    alter table public.carta_categorias add constraint carta_categorias_formato_foto_chk
      check (formato_foto is null or formato_foto in ('cuadrada','horizontal','vertical'));
  end if;
end $$;

comment on column public.empresas.carta_formato_foto is
  'Formato de foto por defecto de la carta digital: cuadrada, horizontal o vertical.';
comment on column public.carta_categorias.formato_foto is
  'Formato de foto de esta categoria. NULL = usa el de la carta.';

-- Punto de partida: comida en horizontal (el plato es ancho), bebida en
-- vertical (copa y botella son altas) y vapers en cuadrada, que es como vienen
-- las fotos de producto. Cada casa puede cambiarlo desde Ajustes.
update public.carta_categorias cc
set formato_foto = case
      when cc.nombre = 'Vapers' then 'cuadrada'
      when cc.familia = 'comida' then 'horizontal'
      else 'vertical'
    end,
    updated_at = now()
where cc.formato_foto is null;
