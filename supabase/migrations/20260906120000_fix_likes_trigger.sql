-- El contador de "me gusta" no subía al votar.
--
-- El disparador corría con los permisos de quien vota (anon), que sobre
-- `carta_items` solo tiene SELECT: el UPDATE se descartaba en silencio y
-- `likes_count` se quedaba en 0 aunque el voto sí se guardara. Con
-- SECURITY DEFINER el contador se actualiza siempre.
create or replace function public.carta_likes_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    update public.carta_items set likes_count = likes_count + 1, updated_at = now() where id = new.item_id;
  elsif tg_op = 'DELETE' then
    update public.carta_items set likes_count = greatest(likes_count - 1, 0), updated_at = now() where id = old.item_id;
  end if;
  return null;
end $function$;

-- Recuperar los votos que se perdieron mientras no podía escribir.
update carta_items ci
set likes_count = (select count(*) from carta_item_likes l where l.item_id = ci.id);
