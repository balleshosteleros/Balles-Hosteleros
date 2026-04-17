-- ============================================================
-- 040_carta_publica_rpc.sql — RPC pública para Carta Digital
-- (PRP-028 fix)
--
-- Motivo: la tabla `empresas` tiene RLS y no permite SELECT a anon,
-- por lo que la query pública falla aunque las tablas hijas (carta_*)
-- sí permitan anon. Esta RPC es SECURITY DEFINER y devuelve sólo
-- los campos públicos necesarios para renderizar la carta.
-- ============================================================

create or replace function public.get_carta_empresa_by_slug(p_slug text)
returns table (
  id uuid,
  nombre text,
  carta_slug text,
  carta_publicada boolean,
  carta_horarios jsonb,
  carta_descripcion text
)
language sql
security definer
set search_path = public
stable
as $$
  select e.id, e.nombre, e.carta_slug, e.carta_publicada, e.carta_horarios, e.carta_descripcion
  from public.empresas e
  where e.carta_slug = p_slug
    and e.carta_publicada = true
  limit 1;
$$;

revoke all on function public.get_carta_empresa_by_slug(text) from public;
grant execute on function public.get_carta_empresa_by_slug(text) to anon, authenticated;
