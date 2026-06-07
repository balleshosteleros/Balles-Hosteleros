-- ============================================================================
-- Versionado de patrones (igual que turnos, PRP-053)
-- ----------------------------------------------------------------------------
-- Un patrón pasa a ser una "versión" de una familia: una única versión oficial
-- por familia, numeradas 1,2,3… Editar un patrón NO se hace en sitio: crea una
-- versión nueva (oficial) y la anterior queda como histórico no editable. La
-- lista muestra siempre la versión oficial (la última). Como el horario real es
-- foto fija (libreta), versionar el molde no cambia lo ya puesto.
--
-- Idempotente y aditivo. RLS ya correcta (no se toca).
-- ============================================================================

alter table public.rrhh_patrones
  add column if not exists familia_id uuid,
  add column if not exists version    integer not null default 1,
  add column if not exists es_oficial boolean not null default true;

-- backfill: cada patrón existente es su propia familia, versión 1, oficial
update public.rrhh_patrones
  set familia_id = id
  where familia_id is null;

alter table public.rrhh_patrones
  alter column familia_id set not null;

-- Toda inserción sin familia_id hereda su propio id como familia (1ª versión).
create or replace function public.rrhh_patrones_set_familia()
returns trigger
language plpgsql
as $$
begin
  if new.familia_id is null then
    new.familia_id := new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rrhh_patrones_familia on public.rrhh_patrones;
create trigger trg_rrhh_patrones_familia
  before insert on public.rrhh_patrones
  for each row execute function public.rrhh_patrones_set_familia();

-- Exactamente una versión oficial por familia.
create unique index if not exists uq_rrhh_patrones_familia_oficial
  on public.rrhh_patrones(familia_id)
  where es_oficial;

create index if not exists idx_rrhh_patrones_familia
  on public.rrhh_patrones(familia_id);
