-- Fuera el formato horizontal: solo cuadrada o vertical.
--
-- Una foto apaisada deja la tarjeta baja y el plato pequeño, y la carta vive
-- de que la foto se vea. La cuadrada le va bien a la comida, que se fotografia
-- a lo ancho, y la vertical a copas y botellas.
--
-- Lo que estaba en horizontal pasa a cuadrada: de una foto apaisada, el
-- recorte cuadrado conserva bastante mas del plato que el vertical.
--
-- (En el codigo, "vertical" son 2:3 y no 3:4. Las fotos de coctel se disparan
-- justo en 2:3, asi que entran enteras; con 3:4 habia que recortar y lo que se
-- perdia era el pie de la copa, con el coctel flotando.)
update public.carta_categorias set formato_foto = 'cuadrada', updated_at = now()
where formato_foto = 'horizontal';

update public.empresas set carta_formato_foto = 'cuadrada'
where carta_formato_foto = 'horizontal';

alter table public.empresas alter column carta_formato_foto set default 'cuadrada';

alter table public.empresas drop constraint if exists empresas_carta_formato_foto_chk;
alter table public.empresas add constraint empresas_carta_formato_foto_chk
  check (carta_formato_foto in ('cuadrada','vertical'));

alter table public.carta_categorias drop constraint if exists carta_categorias_formato_foto_chk;
alter table public.carta_categorias add constraint carta_categorias_formato_foto_chk
  check (formato_foto is null or formato_foto in ('cuadrada','vertical'));

comment on column public.empresas.carta_formato_foto is
  'Formato de foto por defecto de la carta digital: cuadrada o vertical.';
comment on column public.carta_categorias.formato_foto is
  'Formato de foto de esta categoria. NULL = usa el de la carta.';
