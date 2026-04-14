-- ============================================================
-- 004_cocina.sql — Módulo de Cocina
-- Fichas técnicas, ingredientes, partidas, equipos de frío
-- y registros de temperatura APPCC.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.ficha_tecnica_estado as enum ('activa', 'inactiva', 'en_revision', 'borrador');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.partida_area as enum ('COCINA', 'BARRA');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.partida_estado as enum ('activa', 'inactiva', 'en_revision');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.temperatura_estado as enum ('OK', 'ALERTA', 'CRITICO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.equipo_frio_tipo as enum ('CAMARA_FRIO', 'CAMARA_CONGELACION', 'ARCÓN', 'VITRINA', 'OTRO');
exception when duplicate_object then null;
end $$;

-- ─── 1. FICHAS TÉCNICAS ────────────────────────────────────

create table if not exists public.fichas_tecnicas (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  nombre                text not null,
  categoria_id          text,
  delicatessen          boolean not null default false,
  estado                public.ficha_tecnica_estado not null default 'activa',
  responsable           text not null default '',
  partida               text not null default '',
  elaboracion           text not null default '',
  guarnicion            text not null default '',
  decoracion            text not null default '',
  menaje                text not null default '',
  presentacion_mesa     text not null default '',
  alergenos             text[] not null default '{}',
  recomendaciones       text[] not null default '{}',
  pvp                   numeric not null default 0,
  coste_total           numeric not null default 0,
  foto_url              text,
  share_token           text unique,
  share_enabled         boolean not null default false,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_fichas_tecnicas_empresa on public.fichas_tecnicas(empresa_id);
create index if not exists idx_fichas_tecnicas_estado on public.fichas_tecnicas(empresa_id, estado);

-- ─── 2. INGREDIENTES DE FICHA TÉCNICA ──────────────────────

create table if not exists public.ficha_ingredientes (
  id              uuid primary key default gen_random_uuid(),
  ficha_id        uuid not null references public.fichas_tecnicas(id) on delete cascade,
  nombre          text not null,
  cantidad        numeric not null default 0,
  unidad          text not null default 'g',
  precio_kg       numeric not null default 0,
  coste           numeric not null default 0,
  merma_pct       numeric not null default 0,
  coste_con_merma numeric not null default 0,
  proveedor       text,
  orden           integer not null default 0
);

create index if not exists idx_ficha_ingredientes_ficha on public.ficha_ingredientes(ficha_id);

-- ─── 3. PARTIDAS DE COCINA ─────────────────────────────────

create table if not exists public.partidas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  area            public.partida_area not null default 'COCINA',
  estado          public.partida_estado not null default 'activa',
  creador         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_partidas_empresa on public.partidas(empresa_id);

-- ─── 4. PRODUCTOS DE PARTIDA (mise en place) ───────────────

create table if not exists public.partida_productos (
  id              uuid primary key default gen_random_uuid(),
  partida_id      uuid not null references public.partidas(id) on delete cascade,
  nombre          text not null,
  cantidad        text not null default '',
  unidad          text not null default '',
  estado          text not null default 'pendiente',
  orden           integer not null default 0
);

create index if not exists idx_partida_productos_partida on public.partida_productos(partida_id);

-- ─── 5. EQUIPOS DE FRÍO ────────────────────────────────────

create table if not exists public.equipos_frio (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  tipo            public.equipo_frio_tipo not null default 'CAMARA_FRIO',
  ubicacion       text not null default '',
  rango_min       numeric not null default -2,
  rango_max       numeric not null default 5,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_equipos_frio_empresa on public.equipos_frio(empresa_id);

-- ─── 6. REGISTROS DE TEMPERATURA (APPCC) ───────────────────

create table if not exists public.registros_temperatura (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  equipo_id       uuid not null references public.equipos_frio(id) on delete cascade,
  fecha           date not null,
  hora            time not null,
  temperatura     numeric not null,
  estado          public.temperatura_estado not null default 'OK',
  empleado        text not null default '',
  medidas_tomadas text not null default '',
  observaciones   text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists idx_registros_temp_empresa on public.registros_temperatura(empresa_id);
create index if not exists idx_registros_temp_equipo  on public.registros_temperatura(equipo_id, fecha desc);

-- ─── 7. RLS ────────────────────────────────────────────────

alter table public.fichas_tecnicas        enable row level security;
alter table public.ficha_ingredientes     enable row level security;
alter table public.partidas               enable row level security;
alter table public.partida_productos      enable row level security;
alter table public.equipos_frio           enable row level security;
alter table public.registros_temperatura  enable row level security;

-- Fichas técnicas
create policy "fichas_tecnicas_empresa" on public.fichas_tecnicas
  for all using (
    empresa_id in (select empresa_id from public.profiles where id = auth.uid())
  );

-- Ingredientes (hereda vía ficha)
create policy "ficha_ingredientes_empresa" on public.ficha_ingredientes
  for all using (
    ficha_id in (
      select id from public.fichas_tecnicas
      where empresa_id in (select empresa_id from public.profiles where id = auth.uid())
    )
  );

-- Partidas
create policy "partidas_empresa" on public.partidas
  for all using (
    empresa_id in (select empresa_id from public.profiles where id = auth.uid())
  );

-- Productos de partida
create policy "partida_productos_empresa" on public.partida_productos
  for all using (
    partida_id in (
      select id from public.partidas
      where empresa_id in (select empresa_id from public.profiles where id = auth.uid())
    )
  );

-- Equipos de frío
create policy "equipos_frio_empresa" on public.equipos_frio
  for all using (
    empresa_id in (select empresa_id from public.profiles where id = auth.uid())
  );

-- Registros de temperatura
create policy "registros_temp_empresa" on public.registros_temperatura
  for all using (
    empresa_id in (select empresa_id from public.profiles where id = auth.uid())
  );

-- ─── 8. TRIGGERS updated_at ────────────────────────────────

create trigger fichas_tecnicas_updated_at
  before update on public.fichas_tecnicas
  for each row execute function public.set_updated_at();

create trigger partidas_updated_at
  before update on public.partidas
  for each row execute function public.set_updated_at();

create trigger equipos_frio_updated_at
  before update on public.equipos_frio
  for each row execute function public.set_updated_at();
