-- Zumos, frappes, milkshakes y los cocteles que llevaban foto equivocada.
--
-- Las fotos SI estaban en Agora: lo que fallaba era mi busqueda. Alli los
-- productos se llaman solo "Mango", "Sandia", "Fresa"... dentro de su
-- categoria, no "Natural Juice Mango", asi que buscar por el nombre de la
-- carta no encontraba nada. Buscando por CATEGORIA aparecieron las 14.
--
-- Se corrigen ademas cuatro cocteles que arrastraban recortes antiguos:
-- Banana Daiquiri, Mojito Habanero, Pink Limonade y Coco Colado —este ultimo
-- pasa a la foto del flambeado, que es la que se pidio—. Y el Papagayo toma
-- la misma foto que su version sin alcohol: es el mismo coctel a la vista.
--
-- Con la Margarita de BACANAL, las dos cartas quedan al 100% con foto.
--
-- Nombres: los zumos y frappes estaban en ingles y mal escritos
-- ("Natural Juice Sandia", "Frape Chocolate") conviviendo con uno bien puesto.
-- Los batidos pasan a llamarse como su categoria, Milkshake, mas el sabor.
update public.carta_items set nombre = 'Zumo natural de sandía',  updated_at = now() where nombre = 'Natural Juice Sandia';
update public.carta_items set nombre = 'Zumo natural de melón',   updated_at = now() where nombre = 'Natural Juice Melon';
update public.carta_items set nombre = 'Zumo natural de mango',   updated_at = now() where nombre = 'Natural Juice Mango';
update public.carta_items set nombre = 'Zumo natural de fresa',   updated_at = now() where nombre = 'Natural Juice Fresa';
update public.carta_items set nombre = 'Zumo natural de coco',    updated_at = now() where nombre = 'Natural Juice Coco';

update public.carta_items set nombre = 'Frappé de chocolate', updated_at = now() where nombre = 'Frape Chocolate';
update public.carta_items set nombre = 'Frappé de vainilla',  updated_at = now() where nombre = 'Frape Vainilla';
update public.carta_items set nombre = 'Frappé de caramelo',  updated_at = now() where nombre = 'Frape Caramelo';

update public.carta_items set nombre = 'Milkshake de plátano',   updated_at = now() where nombre = 'Batido de plátano';
update public.carta_items set nombre = 'Milkshake Oreo',         updated_at = now() where nombre = 'Batido Oreo';
update public.carta_items set nombre = 'Milkshake de fresa',     updated_at = now() where nombre = 'Batido Fresa';
update public.carta_items set nombre = 'Milkshake de chocolate', updated_at = now() where nombre = 'Batido Chocolate';
update public.carta_items set nombre = 'Milkshake de vainilla',  updated_at = now() where nombre = 'Batido Vainilla';
