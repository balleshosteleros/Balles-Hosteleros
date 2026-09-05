-- Top 5 de platos más votados en un periodo.
--
-- Cuenta filas de `carta_item_likes` —votos reales, con su fecha— y NO el
-- contador de la carta: ese incluye `likes_base`, que es un arranque visual y
-- no diría nada sobre qué gusta de verdad. El ranking tiene que poder guiar
-- decisiones de cocina, así que solo mira lo que ha pulsado gente.
create or replace function carta_ranking_likes(p_empresa uuid, p_desde timestamptz)
returns table (item_id uuid, nombre text, categoria text, votos bigint)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.nombre, cc.nombre, count(l.id)
  from carta_items ci
  join carta_categorias cc on cc.id = ci.categoria_id
  join carta_item_likes l on l.item_id = ci.id
  where ci.empresa_id = p_empresa and l.created_at >= p_desde
  group by ci.id, ci.nombre, cc.nombre
  having count(l.id) > 0
  order by count(l.id) desc, ci.nombre
  limit 5;
$$;

comment on function carta_ranking_likes is
  'Top 5 platos por votos REALES desde una fecha. No cuenta likes_base: eso es un arranque visual, no un voto.';

revoke all on function carta_ranking_likes(uuid, timestamptz) from public, anon;
grant execute on function carta_ranking_likes(uuid, timestamptz) to authenticated;
