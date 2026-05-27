-- ============================================================
-- TASK-008 (3c): UNIQUE INDEX en firmas_tokens.token_hash
--
-- El gap #12 del DISCOVERY_TASK004 documentó que el index existente
-- es btree no UNIQUE. La colisión es 2⁻²⁵⁶ (despreciable), pero la
-- garantía de unicidad evita corrupción silenciosa si en el futuro
-- se rotan peppers o cambia el algoritmo.
--
-- Sustituye el index ordinario por uno UNIQUE. Verifica primero que
-- no haya duplicados antes de crear UNIQUE.
-- ============================================================

do $$
declare
  v_dups int;
begin
  -- Validar que no haya hashes duplicados antes de crear UNIQUE
  select count(*) into v_dups from (
    select token_hash from public.firmas_tokens
    group by token_hash having count(*) > 1
  ) sub;
  if v_dups > 0 then
    raise exception 'firmas_tokens tiene % token_hash duplicados — limpiar antes de aplicar UNIQUE', v_dups;
  end if;
end $$;

-- Drop del index ordinario si existe
drop index if exists public.idx_firmas_tokens_hash;

-- Crea UNIQUE INDEX (reemplaza al ordinario y añade restricción)
create unique index if not exists uniq_firmas_tokens_token_hash
  on public.firmas_tokens(token_hash);
