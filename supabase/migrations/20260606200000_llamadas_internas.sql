-- PRP-054 · Fase 1 — Llamadas internas por WebRTC entre empleados
-- Tabla de registro/estado de llamadas internas (la señalización SDP/ICE viaja
-- por Supabase Realtime Broadcast efímero, NO se persiste aquí).
-- Multi-tenant: RLS con empresas_del_usuario() (profiles ∪ user_empresas).

create table if not exists public.llamadas_internas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  caller_id     uuid not null references auth.users(id) on delete cascade,
  callee_id     uuid not null references auth.users(id) on delete cascade,
  tipo          text not null default 'voz' check (tipo in ('voz','video')),
  estado        text not null default 'iniciando'
                check (estado in ('iniciando','sonando','conectada','finalizada',
                                  'rechazada','perdida','cancelada','ocupado')),
  duracion_seg  integer not null default 0 check (duracion_seg >= 0),
  iniciada_at   timestamptz not null default now(),
  conectada_at  timestamptz,
  finalizada_at timestamptz,
  check (caller_id <> callee_id)
);

create index if not exists llamadas_internas_empresa_idx
  on public.llamadas_internas (empresa_id);
create index if not exists llamadas_internas_callee_idx
  on public.llamadas_internas (callee_id);
create index if not exists llamadas_internas_caller_idx
  on public.llamadas_internas (caller_id);
-- Historial reciente por empresa
create index if not exists llamadas_internas_empresa_fecha_idx
  on public.llamadas_internas (empresa_id, iniciada_at desc);

-- RLS: solo participantes y solo dentro de empresas del usuario
alter table public.llamadas_internas enable row level security;

drop policy if exists llamadas_internas_select on public.llamadas_internas;
create policy llamadas_internas_select on public.llamadas_internas
  for select using (
    empresa_id in (select empresas_del_usuario())
    and (auth.uid() = caller_id or auth.uid() = callee_id)
  );

drop policy if exists llamadas_internas_insert on public.llamadas_internas;
create policy llamadas_internas_insert on public.llamadas_internas
  for insert with check (
    empresa_id in (select empresas_del_usuario())
    and auth.uid() = caller_id
  );

drop policy if exists llamadas_internas_update on public.llamadas_internas;
create policy llamadas_internas_update on public.llamadas_internas
  for update using (
    empresa_id in (select empresas_del_usuario())
    and (auth.uid() = caller_id or auth.uid() = callee_id)
  )
  with check (
    empresa_id in (select empresas_del_usuario())
    and (auth.uid() = caller_id or auth.uid() = callee_id)
  );

-- Opt-in de push para llamadas (mismo patrón que push_comunicados/cronograma/solicitudes)
alter table public.profiles
  add column if not exists push_llamadas boolean not null default true;
