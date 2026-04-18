-- ============================================================
-- 041_gestoria_modelos_aeat.sql — Submódulo MODELOS (PRP-030)
-- Modelos oficiales AEAT (303, 130, 111, 115, 390, 347) con
-- categorización IA de facturas a casillas.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.modelo_aeat_tipo as enum ('303','130','111','115','390','347');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.modelo_aeat_periodo as enum ('Q1','Q2','Q3','Q4','ANUAL');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.modelo_aeat_estado as enum ('BORRADOR','REVISADO','PRESENTADO');
exception when duplicate_object then null;
end $$;

-- ─── 1. MODELOS AEAT ───────────────────────────────────────
-- Un registro = un modelo de un periodo concreto para una empresa

create table if not exists public.modelos_aeat (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  tipo                public.modelo_aeat_tipo not null,
  periodo             public.modelo_aeat_periodo not null,
  ejercicio           integer not null,
  estado              public.modelo_aeat_estado not null default 'BORRADOR',
  casillas            jsonb not null default '{}'::jsonb,
  snapshot_empresa    jsonb,
  fecha_presentacion  timestamptz,
  hash_snapshot       text,
  pdf_url             text,
  fichero_aeat_url    text,
  ia_corrida_en       timestamptz,
  ia_tokens_input     integer,
  ia_tokens_output    integer,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (empresa_id, tipo, periodo, ejercicio)
);

create index if not exists idx_modelos_aeat_empresa on public.modelos_aeat(empresa_id);
create index if not exists idx_modelos_aeat_ejercicio on public.modelos_aeat(empresa_id, ejercicio desc);
create index if not exists idx_modelos_aeat_estado on public.modelos_aeat(empresa_id, estado);

-- ─── 2. ASIGNACIONES factura → casilla ─────────────────────
-- Una fila por cada factura que entra en un modelo (con su casilla)

-- Nota: factura_id es uuid sin FK porque la tabla facturas puede no existir aún
-- en todas las instalaciones. La integridad se garantiza desde la app.
create table if not exists public.asignaciones_modelo (
  id              uuid primary key default gen_random_uuid(),
  modelo_id       uuid not null references public.modelos_aeat(id) on delete cascade,
  factura_id      uuid not null,
  casilla         text not null,
  importe         numeric not null default 0,
  tipo_aporte     text not null default 'base',
  origen          text not null default 'ia',
  confianza_ia    numeric,
  explicacion_ia  text,
  creada_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_asignaciones_modelo_id on public.asignaciones_modelo(modelo_id);
create index if not exists idx_asignaciones_factura_id on public.asignaciones_modelo(factura_id);
create index if not exists idx_asignaciones_modelo_casilla on public.asignaciones_modelo(modelo_id, casilla);

-- ─── 3. REGLAS APRENDIDAS DE CORRECCIONES HUMANAS ──────────

create table if not exists public.reglas_categorizacion_ia (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  patron          jsonb not null,
  modelo_tipo     public.modelo_aeat_tipo not null,
  casilla         text not null,
  activa          boolean not null default true,
  veces_aplicada  integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_reglas_categorizacion_empresa
  on public.reglas_categorizacion_ia(empresa_id);

-- ─── 4. CAMPO IVA DEDUCIBLE PARCIAL EN FACTURAS ────────────
-- Para vehículos al 50 %, gastos mixtos etc. (gotcha del PRP).
-- Sólo se añade si la tabla facturas existe ya.

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'facturas') then
    alter table public.facturas
      add column if not exists iva_deducible_pct numeric not null default 100;
  end if;
exception when others then null;
end $$;

-- ─── 4b. CAMPOS FISCALES EN EMPRESAS (para snapshot AEAT) ──

do $$ begin
  alter table public.empresas
    add column if not exists razon_social text,
    add column if not exists nif text,
    add column if not exists direccion text,
    add column if not exists epigrafe_iae text,
    add column if not exists logo_url text;
exception when others then null;
end $$;

-- ─── 5. RLS ────────────────────────────────────────────────

alter table public.modelos_aeat enable row level security;
alter table public.asignaciones_modelo enable row level security;
alter table public.reglas_categorizacion_ia enable row level security;

drop policy if exists "modelos_aeat_empresa" on public.modelos_aeat;
create policy "modelos_aeat_empresa" on public.modelos_aeat
  for all to authenticated
  using (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  )
  with check (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "asignaciones_modelo_empresa" on public.asignaciones_modelo;
create policy "asignaciones_modelo_empresa" on public.asignaciones_modelo
  for all to authenticated
  using (
    modelo_id in (
      select id from public.modelos_aeat
      where empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
    )
  )
  with check (
    modelo_id in (
      select id from public.modelos_aeat
      where empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
    )
  );

drop policy if exists "reglas_categorizacion_empresa" on public.reglas_categorizacion_ia;
create policy "reglas_categorizacion_empresa" on public.reglas_categorizacion_ia
  for all to authenticated
  using (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  )
  with check (
    empresa_id in (select empresa_id from public.profiles where user_id = auth.uid())
  );

-- ─── 6. TRIGGERS updated_at ────────────────────────────────

drop trigger if exists modelos_aeat_updated_at on public.modelos_aeat;
create trigger modelos_aeat_updated_at
  before update on public.modelos_aeat
  for each row execute function public.set_updated_at();

-- ─── 7. BLOQUEO DE EDICIÓN EN MODELOS PRESENTADOS ──────────
-- Un modelo PRESENTADO es inmutable (snapshot + hash).

create or replace function public.prevent_update_presentado()
returns trigger language plpgsql as $$
begin
  if old.estado = 'PRESENTADO' and old.hash_snapshot is not null then
    if new.estado <> old.estado
       or new.casillas <> old.casillas
       or new.snapshot_empresa is distinct from old.snapshot_empresa then
      raise exception 'Modelo AEAT presentado (hash=%) es inmutable', old.hash_snapshot;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists modelos_aeat_inmutable on public.modelos_aeat;
create trigger modelos_aeat_inmutable
  before update on public.modelos_aeat
  for each row execute function public.prevent_update_presentado();
