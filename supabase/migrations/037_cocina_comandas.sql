-- ============================================================
-- 037_cocina_comandas.sql — Panel Comandas (KDS) — submódulo Cocina
-- PRP-027 · Fase 1
--
-- Extiende: pos_ticket_lineas (añade estado_cocina + timestamps + partida + prioridad)
-- Nuevas tablas:
--   cocina_alarmas_config  (umbrales por empresa)
-- Publication:
--   supabase_realtime += pos_ticket_lineas, pos_tickets
-- Trigger:
--   pos_linea_sync_timestamps  (rellena preparando_at/listo_at/servido_at)
-- ============================================================

-- ─── 0. ENUM estado_cocina ───────────────────────────────────
do $$ begin
  create type public.linea_estado_cocina as enum (
    'PENDIENTE','PREPARANDO','LISTO','SERVIDO','CANCELADA'
  );
exception when duplicate_object then null; end $$;

-- ─── 1. Columnas nuevas en pos_ticket_lineas ─────────────────
alter table public.pos_ticket_lineas
  add column if not exists estado_cocina public.linea_estado_cocina not null default 'PENDIENTE',
  add column if not exists preparando_at timestamptz,
  add column if not exists listo_at      timestamptz,
  add column if not exists servido_at    timestamptz,
  add column if not exists partida_id    uuid,
  add column if not exists prioridad     smallint not null default 0;

-- FK opcional a partidas (si existe la tabla)
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='partidas')
     and not exists (select 1 from information_schema.table_constraints
                     where constraint_name='pos_lineas_partida_fkey' and table_name='pos_ticket_lineas') then
    alter table public.pos_ticket_lineas
      add constraint pos_lineas_partida_fkey
      foreign key (partida_id) references public.partidas(id) on delete set null;
  end if;
end $$;

-- Índice parcial para el board (sólo líneas activas del día)
create index if not exists idx_pos_lineas_kds_activas
  on public.pos_ticket_lineas(ticket_id, estado_cocina)
  where enviada_at is not null and estado_cocina <> 'SERVIDO';

-- ─── 2. Tabla de umbrales de alarma por empresa ──────────────
create table if not exists public.cocina_alarmas_config (
  empresa_id          uuid primary key references public.empresas(id) on delete cascade,
  umbral_ambar_min    smallint not null default 8,
  umbral_rojo_min     smallint not null default 15,
  umbral_parpadeo_min smallint not null default 20,
  sonido_activo       boolean  not null default true,
  updated_at          timestamptz not null default now()
);

alter table public.cocina_alarmas_config enable row level security;

drop policy if exists "cocina_alarmas_empresa" on public.cocina_alarmas_config;
create policy "cocina_alarmas_empresa" on public.cocina_alarmas_config
  for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

-- ─── 3. Realtime publication ─────────────────────────────────
-- Idempotente: añade tablas sólo si no están ya en la publication.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pos_ticket_lineas'
  ) then
    execute 'alter publication supabase_realtime add table public.pos_ticket_lineas';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pos_tickets'
  ) then
    execute 'alter publication supabase_realtime add table public.pos_tickets';
  end if;
end $$;

-- ─── 4. Trigger: sincronizar timestamps al cambiar estado_cocina
create or replace function public.pos_linea_sync_timestamps()
returns trigger language plpgsql as $$
begin
  if new.estado_cocina = 'PREPARANDO' and coalesce(old.estado_cocina::text, '') <> 'PREPARANDO' then
    new.preparando_at := coalesce(new.preparando_at, now());
  end if;
  if new.estado_cocina = 'LISTO' and coalesce(old.estado_cocina::text, '') <> 'LISTO' then
    new.listo_at := coalesce(new.listo_at, now());
  end if;
  if new.estado_cocina = 'SERVIDO' and coalesce(old.estado_cocina::text, '') <> 'SERVIDO' then
    new.servido_at := coalesce(new.servido_at, now());
  end if;
  return new;
end $$;

drop trigger if exists trg_pos_linea_sync_ts on public.pos_ticket_lineas;
create trigger trg_pos_linea_sync_ts
  before update on public.pos_ticket_lineas
  for each row execute function public.pos_linea_sync_timestamps();

-- ─── FIN 037_cocina_comandas.sql ─────────────────────────────
