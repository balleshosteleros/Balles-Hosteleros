-- ============================================================
-- rrhh_patrones: patrones de horario por empresa
-- Estructura:
--   rrhh_patrones         (header: nombre, tipo, creador snapshot)
--   rrhh_patron_semanas   (filas con array de 7 turno_ids para semanal;
--                          o array variable para libre)
--   rrhh_patron_empleados (asignaciones)
-- creado_por_nombre = snapshot del nombre del creador, no cambia
-- aunque el usuario sea dado de baja.
-- ============================================================

create table if not exists public.rrhh_patrones (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references public.empresas(id) on delete cascade,
  nombre               text not null,
  tipo                 text not null check (tipo in ('semanal', 'libre')),
  creado_por_user_id   uuid references auth.users(id) on delete set null,
  creado_por_nombre    text not null,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column public.rrhh_patrones.creado_por_nombre is
  'Snapshot del nombre del creador. No cambia si el usuario es dado de baja.';

create index if not exists idx_rrhh_patrones_empresa
  on public.rrhh_patrones(empresa_id);

alter table public.rrhh_patrones enable row level security;

drop policy if exists "rrhh_patrones_select" on public.rrhh_patrones;
drop policy if exists "rrhh_patrones_insert" on public.rrhh_patrones;
drop policy if exists "rrhh_patrones_update" on public.rrhh_patrones;
drop policy if exists "rrhh_patrones_delete" on public.rrhh_patrones;

create policy "rrhh_patrones_select" on public.rrhh_patrones
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_patrones_insert" on public.rrhh_patrones
  for insert to authenticated
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_patrones_update" on public.rrhh_patrones
  for update to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_patrones_delete" on public.rrhh_patrones
  for delete to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── rrhh_patron_semanas ─────────────────────────────────────
-- Para tipo "semanal": una fila por semana, dias = array de 7 elementos
--   (L,M,X,J,V,S,D), cada uno turno_id text o null.
-- Para tipo "libre":   una sola fila orden=0, dias = array de N elementos.
create table if not exists public.rrhh_patron_semanas (
  id          uuid primary key default gen_random_uuid(),
  patron_id   uuid not null references public.rrhh_patrones(id) on delete cascade,
  orden       integer not null,
  dias        jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (patron_id, orden)
);

create index if not exists idx_rrhh_patron_semanas_patron
  on public.rrhh_patron_semanas(patron_id);

alter table public.rrhh_patron_semanas enable row level security;

drop policy if exists "rrhh_patron_semanas_all" on public.rrhh_patron_semanas;

create policy "rrhh_patron_semanas_all" on public.rrhh_patron_semanas
  for all to authenticated
  using (
    patron_id in (
      select rp.id from public.rrhh_patrones rp
      join public.profiles p on p.empresa_id = rp.empresa_id
      where p.user_id = auth.uid()
    )
  )
  with check (
    patron_id in (
      select rp.id from public.rrhh_patrones rp
      join public.profiles p on p.empresa_id = rp.empresa_id
      where p.user_id = auth.uid()
    )
  );

-- ─── rrhh_patron_empleados ───────────────────────────────────
create table if not exists public.rrhh_patron_empleados (
  patron_id            uuid not null references public.rrhh_patrones(id) on delete cascade,
  empleado_id          uuid not null references public.empleados(id) on delete cascade,
  asignado_at          timestamptz not null default now(),
  asignado_por_user_id uuid references auth.users(id) on delete set null,
  primary key (patron_id, empleado_id)
);

create index if not exists idx_rrhh_patron_empleados_patron
  on public.rrhh_patron_empleados(patron_id);
create index if not exists idx_rrhh_patron_empleados_empleado
  on public.rrhh_patron_empleados(empleado_id);

alter table public.rrhh_patron_empleados enable row level security;

drop policy if exists "rrhh_patron_empleados_all" on public.rrhh_patron_empleados;

create policy "rrhh_patron_empleados_all" on public.rrhh_patron_empleados
  for all to authenticated
  using (
    patron_id in (
      select rp.id from public.rrhh_patrones rp
      join public.profiles p on p.empresa_id = rp.empresa_id
      where p.user_id = auth.uid()
    )
  )
  with check (
    patron_id in (
      select rp.id from public.rrhh_patrones rp
      join public.profiles p on p.empresa_id = rp.empresa_id
      where p.user_id = auth.uid()
    )
  );

-- ─── Trigger updated_at ──────────────────────────────────────
create or replace function public.rrhh_patrones_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_rrhh_patrones_updated on public.rrhh_patrones;
create trigger trg_rrhh_patrones_updated
  before update on public.rrhh_patrones
  for each row execute function public.rrhh_patrones_set_updated_at();
