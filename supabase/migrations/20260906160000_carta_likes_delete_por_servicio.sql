-- Retirar un "me gusta" pasa por el servidor, no por el cliente.
--
-- `carta_item_likes` solo tiene politica de INSERT y SELECT para anon. Al
-- quitar el voto desde el cliente publico, Postgres no borraba la fila y
-- tampoco daba error: devolvia cero filas afectadas en silencio. El corazon
-- se apagaba, el numero bajaba un instante y volvia a subir al releer el
-- total del servidor, que seguia contando el voto.
--
-- NO se anade politica de DELETE para anon a proposito: con ella cualquiera
-- podria borrar los votos de los demas conociendo el id. El borrado lo hace
-- la server action con clave de servicio, comprobando que el voto es del
-- mismo dispositivo que lo puso.
--
-- Aqui solo se recalculan los contadores, por si quedo alguno descuadrado de
-- los votos que no llegaron a borrarse.
update public.carta_items ci
set likes_count = sub.n
from (
  select i.id, coalesce(count(l.id), 0) as n
  from public.carta_items i
  left join public.carta_item_likes l on l.item_id = i.id
  group by i.id
) sub
where ci.id = sub.id and ci.likes_count is distinct from sub.n;
