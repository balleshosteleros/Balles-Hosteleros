-- ============================================================
-- 056_fichajes.sql
-- Mi Panel: Fichajes diarios (entrada/salida + pausas).
--
-- Compatible con el código actual de
--   src/features/mi-panel/actions/mi-panel-actions.ts
--
-- - empleado_id apunta a auth.users (consistente con 050_mi_panel_solicitudes).
-- - hora_entrada / hora_salida son timestamptz (el código manda toISOString()).
-- - pausa_inicio / pausa_fin son time (el código manda toTimeString().slice(0,8)).
-- ============================================================

create table if not exists public.fichajes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',
  fecha           date not null,
  hora_entrada    timestamptz,
  hora_salida     timestamptz,
  pausa_inicio    time,
  pausa_fin       time,
  horas_totales   numeric not null default 0,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','trabajando','pausa','completado')),
  incidencia      text,
  observaciones   text not null default '',
  departamento    text not null default '',
  centro          text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_fichajes_empresa
  on public.fichajes(empresa_id);
create index if not exists idx_fichajes_empleado_fecha
  on public.fichajes(empleado_id, fecha desc);
create index if not exists idx_fichajes_empresa_fecha
  on public.fichajes(empresa_id, fecha desc);

create or replace function public.set_fichajes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists fichajes_updated_at on public.fichajes;
create trigger fichajes_updated_at
  before update on public.fichajes
  for each row execute function public.set_fichajes_updated_at();

-- ─── RLS ───────────────────────────────────────────────────
alter table public.fichajes enable row level security;

drop policy if exists "fichajes_read_empresa" on public.fichajes;
create policy "fichajes_read_empresa" on public.fichajes
  for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

drop policy if exists "fichajes_insert_own" on public.fichajes;
create policy "fichajes_insert_own" on public.fichajes
  for insert to authenticated
  with check (
    empleado_id = auth.uid()
    and empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

drop policy if exists "fichajes_update_own" on public.fichajes;
create policy "fichajes_update_own" on public.fichajes
  for update to authenticated
  using (
    empleado_id = auth.uid()
  )
  with check (
    empleado_id = auth.uid()
  );

drop policy if exists "fichajes_manage_empresa" on public.fichajes;
create policy "fichajes_manage_empresa" on public.fichajes
  for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

comment on table public.fichajes is
  'Registros de fichaje diario por empleado. empleado_id = auth.users.id (consistente con solicitudes_personal). Una fila por día por empleado en el camino normal.';
