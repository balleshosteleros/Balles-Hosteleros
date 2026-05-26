-- ============================================================
-- Snapshot del schema real de horarios RRHH en producción
-- ============================================================
--
-- Origen: tablas creadas manualmente en Supabase fuera del control
-- de versiones. Este migration documenta el estado real verificado
-- el 2026-05-26 via Management API (POST /v1/projects/{ref}/database/query).
--
-- Sustituye los migrations previos (20260526210000, 20260526210100,
-- 20260526220000) que fueron revertidos por desalineación con prod
-- (schema inferido del código, no del estado real). Ver discovery
-- en docs/rrhh-consolidacion/DISCOVERY_TASK003_2026-05-26.md y los
-- commits de revert acccf62 + d805a7b.
--
-- Idempotente: CREATE IF NOT EXISTS para tablas/índices, DROP IF
-- EXISTS + CREATE para policies (contenido idéntico al de prod,
-- el ciclo drop/create no cambia comportamiento).
--
-- NO incluye datos seed: en prod ya hay 43 turnos BACANAL + 3
-- cuadrantes + 12 descansos con horas reales. El seed se gestiona
-- aparte (ver Anexo al final).
--
-- Diferencias relevantes vs migrations canónicos del proyecto:
--   - ID de cuadrantes/turnos/descansos es TEXT (no uuid), generado
--     client-side por makeTurnoId/makeDescansoId en el código.
--   - Policies sobre rol public (no authenticated), con UNION de
--     user_empresas y profiles para multi-empresa real.
--   - Sin triggers updated_at: el código gestiona ese campo
--     manualmente en updateTurno/updateDescanso.
--   - Sin CHECK en rrhh_turnos.color (los validos están en el
--     enum TS TurnoTono pero no se enforce en BD).
-- ============================================================

-- ─── rrhh_cuadrantes ────────────────────────────────────────
create table if not exists public.rrhh_cuadrantes (
  id          text primary key,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  activo      boolean not null default true,
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
  for select to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_cuadrantes_insert" on public.rrhh_cuadrantes
  for insert to public
  with check (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_cuadrantes_update" on public.rrhh_cuadrantes
  for update to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_cuadrantes_delete" on public.rrhh_cuadrantes
  for delete to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

-- ─── rrhh_turnos ────────────────────────────────────────────
create table if not exists public.rrhh_turnos (
  id            text primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null,
  codigo        text not null,
  tramos        jsonb not null default '[]'::jsonb,
  color         text not null default 'stone',
  es_guardia    boolean not null default false,
  cuadrante_id  text references public.rrhh_cuadrantes(id) on delete set null,
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
  for select to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_turnos_insert" on public.rrhh_turnos
  for insert to public
  with check (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_turnos_update" on public.rrhh_turnos
  for update to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_turnos_delete" on public.rrhh_turnos
  for delete to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

-- ─── rrhh_descansos ─────────────────────────────────────────
create table if not exists public.rrhh_descansos (
  id                text primary key,
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  nombre            text not null,
  icono             text not null default '☕',
  color             text not null default '#FCA98E',
  remunerado        boolean not null default false,
  cuando_fichar     text not null default 'intervalo'
                      check (cuando_fichar in ('cualquier','intervalo')),
  intervalo_inicio  text not null default '12:00',
  intervalo_fin     text not null default '16:00',
  duracion_tipo     text not null default 'sin_limite'
                      check (duracion_tipo in ('sin_limite','duracion')),
  duracion_minutos  integer,
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
  for select to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_descansos_insert" on public.rrhh_descansos
  for insert to public
  with check (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_descansos_update" on public.rrhh_descansos
  for update to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

create policy "rrhh_descansos_delete" on public.rrhh_descansos
  for delete to public
  using (
    empresa_id in (
      select user_empresas.empresa_id from public.user_empresas where user_empresas.user_id = auth.uid()
      union
      select profiles.empresa_id from public.profiles where profiles.user_id = auth.uid()
    )
  );

-- ─── Comentarios documentales ───────────────────────────────
comment on table public.rrhh_cuadrantes is
  'Cuadrantes (agrupaciones de turnos) por empresa. Modelo temporal en BACANAL: diario / fines de semana. ID text.';
comment on table public.rrhh_turnos is
  'Turnos por empresa. ID text generado client-side (makeTurnoId). En prod hay 43 turnos BACANAL con tramos reales y referencias a cuadrantes diario/fines.';
comment on table public.rrhh_descansos is
  'Descansos configurables por empresa. turnos jsonb son referencias blandas a rrhh_turnos.id.';

-- ============================================================
-- Anexo: Seed actual (NO se incluye en este migration)
-- ============================================================
-- Producción tiene poblados:
--   - 43 turnos BACANAL (bt-art-cenas, bt-art-comidas, bt-cal,
--     bt-cam-{vie,sab,dom}, bt-coc-{lun,mar,jue,vie,sab,dom},
--     bt-con, bt-edm-dom, bt-emd-diario, bt-en1-sab, bt-en2-{vie,sab},
--     bt-enc-{vie,dom}, bt-etd-diario, bt-jc1-{lun,mar,mie,jue,vie,sab,dom},
--     bt-jc2-{lun,mar,mie,jue,vie,sab,dom}, bt-jc3-{vie,sab,dom},
--     bt-jef-{vie,sab}, bt-jf2-vie, bt-lim-diario, bt-lpo-{vie,sab,dom},
--     bt-man-diario) con tramos reales.
--   - 3 cuadrantes: cuad-bacanal-diario, cuad-bacanal-fines,
--     cuad-habana-general.
--   - 12 descansos BACANAL.
--
-- Si se aprovisiona un entorno nuevo (staging/dev) y se quiere
-- replicar BACANAL, abrir un seed dedicado tras exportar los
-- datos reales:
--   ./scripts/supabase-mgmt-query.sh -f sql/export-bacanal-horarios.sql
