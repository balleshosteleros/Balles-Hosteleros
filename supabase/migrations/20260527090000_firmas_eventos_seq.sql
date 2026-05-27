-- ============================================================
-- TASK-008 (R2): añade columna `seq` a firmas_eventos para orden
-- determinista de la hash chain.
--
-- Origen del gap: audit.registrarEvento ordenaba por ocurrido_en
-- desc para encontrar prev_hash. Dos INSERTs concurrentes con
-- timestamp idéntico al microsegundo ven el mismo prev_hash y
-- bifurcan la cadena (DISCOVERY_TASK004 gap #6).
--
-- Diseño:
--   1. Columna `seq integer` nullable + backfill cronológico.
--   2. Trigger BEFORE INSERT que calcula seq=MAX(seq)+1 por doc
--      si el INSERT llega con seq=NULL (retrocompatible).
--   3. UNIQUE (documento_id, seq): detecta colisiones de carrera;
--      el caller (audit.registrarEvento) reintenta 1 vez.
--   4. NOT NULL una vez backfill + trigger garantizan valor.
--
-- Idempotente: IF NOT EXISTS en columna/índice/función/trigger;
-- update solo backfilla filas con seq IS NULL (en prod hay 0 hoy).
-- ============================================================

-- 1. Columna nullable inicial
alter table public.firmas_eventos
  add column if not exists seq integer;

-- 2. Backfill por documento basado en orden cronológico actual.
--    Para 0 filas en prod = no-op. Para entornos con datos = orden
--    coherente con la chain previa.
update public.firmas_eventos t
set seq = sub.row_num
from (
  select id,
         row_number() over (partition by documento_id order by ocurrido_en, id) as row_num
  from public.firmas_eventos
) sub
where t.id = sub.id and t.seq is null;

-- 3. Trigger BEFORE INSERT que calcula seq si null.
--    set search_path = '' para cumplir linter (function_search_path_mutable).
create or replace function public.firmas_eventos_set_seq()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_next int;
begin
  if new.seq is null then
    select coalesce(max(seq), 0) + 1 into v_next
    from public.firmas_eventos
    where documento_id = new.documento_id;
    new.seq = v_next;
  end if;
  return new;
end;
$$;

drop trigger if exists firmas_eventos_set_seq_trigger on public.firmas_eventos;
create trigger firmas_eventos_set_seq_trigger
  before insert on public.firmas_eventos
  for each row execute function public.firmas_eventos_set_seq();

-- 4. NOT NULL — seguro tras backfill + trigger.
alter table public.firmas_eventos
  alter column seq set not null;

-- 5. UNIQUE per documento para detectar carreras.
create unique index if not exists uniq_firmas_eventos_doc_seq
  on public.firmas_eventos(documento_id, seq);

comment on column public.firmas_eventos.seq is
  'Secuencia monotónica por documento. Calculada por trigger BEFORE INSERT si NULL. UNIQUE (documento_id, seq) detecta carreras. Usado por audit.listarEventos para orden determinista de la hash chain (TASK-008/R2).';
