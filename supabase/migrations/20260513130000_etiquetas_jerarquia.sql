-- ============================================================
-- 20260513130000_etiquetas_jerarquia.sql
-- Etiquetas de contabilidad: añade jerarquía (categoría → etiqueta),
-- emoji y orden. Una etiqueta es "categoría" si parent_id IS NULL.
-- Solo se permite 1 nivel de profundidad.
-- ============================================================

alter table public.etiquetas
  add column if not exists parent_id uuid references public.etiquetas(id) on delete cascade,
  add column if not exists emoji text,
  add column if not exists orden int not null default 0;

create index if not exists idx_etiquetas_parent on public.etiquetas(parent_id);
create index if not exists idx_etiquetas_empresa_parent_orden
  on public.etiquetas(empresa_id, parent_id, orden);

-- Permitir mismo nombre en distintas categorías.
alter table public.etiquetas drop constraint if exists etiquetas_empresa_id_nombre_key;
create unique index if not exists etiquetas_empresa_parent_nombre_uniq
  on public.etiquetas(empresa_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));

-- Forzar máximo 1 nivel: el padre de una etiqueta no puede tener padre.
create or replace function public.etiquetas_check_one_level()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Una etiqueta no puede ser padre de sí misma';
    end if;
    if exists (select 1 from public.etiquetas where id = new.parent_id and parent_id is not null) then
      raise exception 'Solo se permite 1 nivel de jerarquía en etiquetas';
    end if;
    if exists (select 1 from public.etiquetas where parent_id = new.id) then
      raise exception 'No se puede asignar padre a una etiqueta que ya tiene hijos';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_etiquetas_check_one_level on public.etiquetas;
create trigger trg_etiquetas_check_one_level
before insert or update of parent_id on public.etiquetas
for each row execute function public.etiquetas_check_one_level();
