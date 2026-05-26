-- ============================================================
-- TASK-007: rrhh_turnos / rrhh_cuadrantes / rrhh_descansos
--
-- Cierra el gap detectado en DISCOVERY_TASK003: las server actions
-- turnos-actions.ts y descansos-actions.ts consultaban estas tablas
-- sin migración versionada. Schema reconstruido a partir de los
-- mappers rowToTurno / rowToCuadrante / rowToDescanso y los inserts
-- de createTurno / createDescanso.
--
-- IDs: rrhh_cuadrantes usa uuid (sin helper en código).
-- rrhh_turnos y rrhh_descansos usan TEXT generado client-side
-- (makeTurnoId → "t-{empresa4}-{ts36}-{rand4}", también admite
-- IDs legacy "bt-*" del seed de patrones BACANAL).
--
-- RLS: patrón idéntico al de rrhh_patrones (multi-empresa via
-- profiles.empresa_id). FK ON DELETE CASCADE desde empresa.
-- ============================================================

-- ─── rrhh_cuadrantes ────────────────────────────────────────
create table if not exists public.rrhh_cuadrantes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_rrhh_cuadrantes_empresa
  on public.rrhh_cuadrantes(empresa_id);

alter table public.rrhh_cuadrantes enable row level security;

drop policy if exists "rrhh_cuadrantes_select" on public.rrhh_cuadrantes;
drop policy if exists "rrhh_cuadrantes_insert" on public.rrhh_cuadrantes;
drop policy if exists "rrhh_cuadrantes_update" on public.rrhh_cuadrantes;
drop policy if exists "rrhh_cuadrantes_delete" on public.rrhh_cuadrantes;

create policy "rrhh_cuadrantes_select" on public.rrhh_cuadrantes
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_cuadrantes_insert" on public.rrhh_cuadrantes
  for insert to authenticated
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_cuadrantes_update" on public.rrhh_cuadrantes
  for update to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_cuadrantes_delete" on public.rrhh_cuadrantes
  for delete to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── rrhh_turnos ────────────────────────────────────────────
-- id text porque el código generador (makeTurnoId) emite strings
-- como "t-9c7a-mq8h2z-4y6r" y el seed legacy usa "bt-coc-lun" etc.
create table if not exists public.rrhh_turnos (
  id            text primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null,
  codigo        text not null,
  tramos        jsonb not null default '[]'::jsonb,
  color         text not null default 'stone'
                  check (color in ('stone','emerald','violet','rose','teal','sky','amber')),
  es_guardia    boolean not null default false,
  cuadrante_id  uuid references public.rrhh_cuadrantes(id) on delete set null,
  activo        boolean not null default true,
  centro        text,
  departamento  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_rrhh_turnos_empresa
  on public.rrhh_turnos(empresa_id);
create index if not exists idx_rrhh_turnos_cuadrante
  on public.rrhh_turnos(cuadrante_id);

alter table public.rrhh_turnos enable row level security;

drop policy if exists "rrhh_turnos_select" on public.rrhh_turnos;
drop policy if exists "rrhh_turnos_insert" on public.rrhh_turnos;
drop policy if exists "rrhh_turnos_update" on public.rrhh_turnos;
drop policy if exists "rrhh_turnos_delete" on public.rrhh_turnos;

create policy "rrhh_turnos_select" on public.rrhh_turnos
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_turnos_insert" on public.rrhh_turnos
  for insert to authenticated
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_turnos_update" on public.rrhh_turnos
  for update to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_turnos_delete" on public.rrhh_turnos
  for delete to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── rrhh_descansos ─────────────────────────────────────────
-- id text porque makeDescansoId emite strings "d-{empresa4}-...".
-- turnos jsonb almacena array de turno_ids como referencias blandas
-- (no se aplica FK porque jsonb no la admite directamente; la
-- integridad la mantiene el código de UI).
create table if not exists public.rrhh_descansos (
  id                text primary key,
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  nombre            text not null,
  icono             text not null default '',
  color             text not null default '',
  remunerado        boolean not null default false,
  cuando_fichar     text not null default 'intervalo'
                      check (cuando_fichar in ('cualquier','intervalo')),
  intervalo_inicio  text not null default '12:00',
  intervalo_fin     text not null default '16:00',
  duracion_tipo     text not null default 'sin_limite'
                      check (duracion_tipo in ('sin_limite','duracion')),
  duracion_minutos  integer check (duracion_minutos is null or duracion_minutos > 0),
  dias              jsonb not null default '[]'::jsonb,
  turnos            jsonb not null default '[]'::jsonb,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_rrhh_descansos_empresa
  on public.rrhh_descansos(empresa_id);

alter table public.rrhh_descansos enable row level security;

drop policy if exists "rrhh_descansos_select" on public.rrhh_descansos;
drop policy if exists "rrhh_descansos_insert" on public.rrhh_descansos;
drop policy if exists "rrhh_descansos_update" on public.rrhh_descansos;
drop policy if exists "rrhh_descansos_delete" on public.rrhh_descansos;

create policy "rrhh_descansos_select" on public.rrhh_descansos
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_descansos_insert" on public.rrhh_descansos
  for insert to authenticated
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_descansos_update" on public.rrhh_descansos
  for update to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "rrhh_descansos_delete" on public.rrhh_descansos
  for delete to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── Triggers updated_at ────────────────────────────────────
create or replace function public.rrhh_horarios_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_rrhh_cuadrantes_updated on public.rrhh_cuadrantes;
create trigger trg_rrhh_cuadrantes_updated
  before update on public.rrhh_cuadrantes
  for each row execute function public.rrhh_horarios_set_updated_at();

drop trigger if exists trg_rrhh_turnos_updated on public.rrhh_turnos;
create trigger trg_rrhh_turnos_updated
  before update on public.rrhh_turnos
  for each row execute function public.rrhh_horarios_set_updated_at();

drop trigger if exists trg_rrhh_descansos_updated on public.rrhh_descansos;
create trigger trg_rrhh_descansos_updated
  before update on public.rrhh_descansos
  for each row execute function public.rrhh_horarios_set_updated_at();

-- ─── Comentarios documentales ───────────────────────────────
comment on table public.rrhh_cuadrantes is
  'Cuadrantes (agrupaciones de turnos) por empresa. Solo READ desde app, pre-seed manual o por DBA.';
comment on table public.rrhh_turnos is
  'Turnos por empresa. ID text (formato t-* nuevo o bt-* legacy del seed BACANAL).';
comment on table public.rrhh_descansos is
  'Descansos configurables por empresa. turnos jsonb son referencias blandas a rrhh_turnos.id (no FK).';
