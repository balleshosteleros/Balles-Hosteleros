-- ============================================================
-- 050_mi_panel_solicitudes.sql
-- Mi Panel: Solicitudes personales (ausencias y trabajo).
--
-- Cubre dos familias:
--   1. AUSENCIA: baja_medica, vacaciones, permiso
--   2. TRABAJO: horas_extras, dia_trabajado (excepcional —
--      el camino normal es el fichaje diario)
--
-- user_id apunta a auth.users (consistente con `fichajes`,
-- que en producción usa user.id como empleado_id).
-- ============================================================

create table if not exists public.solicitudes_personal (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',

  tipo            text not null check (tipo in ('ausencia','trabajo')),
  subtipo         text not null check (subtipo in (
    'baja_medica','vacaciones','permiso',
    'horas_extras','dia_trabajado'
  )),

  fecha_inicio    date not null,
  fecha_fin       date,
  horas           numeric(5,2),

  motivo          text not null default '',
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','aprobada','rechazada','anulada')),
  revisado_por    uuid references auth.users(id) on delete set null,
  revisado_at     timestamptz,
  notas_revision  text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index if not exists idx_solicitudes_personal_empresa
  on public.solicitudes_personal(empresa_id);
create index if not exists idx_solicitudes_personal_user
  on public.solicitudes_personal(user_id, fecha_inicio desc);
create index if not exists idx_solicitudes_personal_estado
  on public.solicitudes_personal(empresa_id, estado);

create or replace function public.set_solicitudes_personal_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists solicitudes_personal_updated_at on public.solicitudes_personal;
create trigger solicitudes_personal_updated_at
  before update on public.solicitudes_personal
  for each row execute function public.set_solicitudes_personal_updated_at();

alter table public.solicitudes_personal enable row level security;

drop policy if exists "solicitudes_personal_read" on public.solicitudes_personal;
create policy "solicitudes_personal_read" on public.solicitudes_personal
  for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

drop policy if exists "solicitudes_personal_insert_own" on public.solicitudes_personal;
create policy "solicitudes_personal_insert_own" on public.solicitudes_personal
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

drop policy if exists "solicitudes_personal_update_own_pending" on public.solicitudes_personal;
create policy "solicitudes_personal_update_own_pending" on public.solicitudes_personal
  for update to authenticated
  using (
    user_id = auth.uid()
    and estado = 'pendiente'
  )
  with check (
    user_id = auth.uid()
  );

drop policy if exists "solicitudes_personal_manage" on public.solicitudes_personal;
create policy "solicitudes_personal_manage" on public.solicitudes_personal
  for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

comment on table public.solicitudes_personal is
  'Solicitudes personales de cada usuario: ausencias (baja, vacaciones, permiso) y trabajo (horas extras, día trabajado excepcional).';
