-- Bloqueos de mesas/zonas para reservas (PRP-051).
--
-- Sustituyen al "blackout" manual que cada empresa hacía a mano. Cada fila es
-- un bloqueo con una vigencia (mismo modelo que el VigenciaSelector que ya
-- usamos para reglas y planos) y un turno (COMIDA/CENA/AMBOS). El alcance
-- puede ser zonas completas, mesas concretas, o ambas en la misma fila.
--
-- Prevalece sobre el plano vigente: si una mesa cae en un bloqueo activo para
-- (fecha, hora) → no es reservable.

create table if not exists empresa_reservas_bloqueos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  local_id uuid not null references locales(id) on delete cascade,

  -- Periodicidad (misma forma que VigenciaSpec)
  modo_vigencia text not null check (
    modo_vigencia in ('siempre','hoy','todos_los_dia','todos_los_dias','rango','fechas')
  ),
  fecha_desde date,
  fecha_hasta date,
  dias_semana int[],     -- ISODOW 1..7
  fechas_extra date[],

  -- Turno
  turno text not null check (turno in ('COMIDA','CENA','AMBOS')),

  -- Alcance: zonas y/o mesas concretas (al menos uno con elementos)
  zona_ids uuid[] not null default '{}',
  mesa_ids uuid[] not null default '{}',

  motivo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (cardinality(zona_ids) > 0 or cardinality(mesa_ids) > 0)
);

create index if not exists empresa_reservas_bloqueos_empresa_idx
  on empresa_reservas_bloqueos(empresa_id);
create index if not exists empresa_reservas_bloqueos_local_idx
  on empresa_reservas_bloqueos(local_id);

-- Touch updated_at en cada update.
create or replace function empresa_reservas_bloqueos_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists empresa_reservas_bloqueos_touch_t on empresa_reservas_bloqueos;
create trigger empresa_reservas_bloqueos_touch_t
  before update on empresa_reservas_bloqueos
  for each row execute function empresa_reservas_bloqueos_touch();

-- RLS: solo empresas del usuario.
alter table empresa_reservas_bloqueos enable row level security;

drop policy if exists reservas_bloqueos_select on empresa_reservas_bloqueos;
create policy reservas_bloqueos_select on empresa_reservas_bloqueos
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists reservas_bloqueos_insert on empresa_reservas_bloqueos;
create policy reservas_bloqueos_insert on empresa_reservas_bloqueos
  for insert with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists reservas_bloqueos_update on empresa_reservas_bloqueos;
create policy reservas_bloqueos_update on empresa_reservas_bloqueos
  for update using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists reservas_bloqueos_delete on empresa_reservas_bloqueos;
create policy reservas_bloqueos_delete on empresa_reservas_bloqueos
  for delete using (empresa_id in (select empresas_del_usuario()));
