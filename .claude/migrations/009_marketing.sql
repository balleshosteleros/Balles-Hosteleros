-- ============================================================
-- 009_marketing.sql — Módulo de Marketing
-- Publicaciones, eventos de marketing y cuentas conectadas
-- en redes sociales.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.red_social as enum ('facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.publicacion_tipo_contenido as enum ('imagen', 'video', 'carrusel', 'story', 'reel', 'short', 'live', 'texto', 'enlace');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.publicacion_estado as enum ('borrador', 'programada', 'publicada', 'fallida', 'cancelada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.evento_marketing_tipo as enum ('publicidad', 'inicio_campana', 'fin_campana', 'directo', 'grabacion', 'sesion_fotos', 'reunion', 'lanzamiento', 'promocion');
exception when duplicate_object then null;
end $$;

-- ─── 1. CUENTAS DE REDES SOCIALES ──────────────────────────

create table if not exists public.cuentas_redes_sociales (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  red_social            public.red_social not null,
  nombre_cuenta         text not null,
  url_perfil            text not null default '',
  conectada             boolean not null default false,
  ultima_sincronizacion timestamptz,
  token_acceso          text, -- encriptado en producción
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_cuentas_redes_empresa on public.cuentas_redes_sociales(empresa_id);

-- ─── 2. CAMPAÑAS DE MARKETING ──────────────────────────────

create table if not exists public.campanas_marketing (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  descripcion     text not null default '',
  fecha_inicio    date,
  fecha_fin       date,
  presupuesto     numeric not null default 0,
  estado          text not null default 'planificada', -- 'planificada', 'activa', 'pausada', 'finalizada'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_campanas_marketing_empresa on public.campanas_marketing(empresa_id);

-- ─── 3. PUBLICACIONES ──────────────────────────────────────

create table if not exists public.publicaciones (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  cuenta_id           uuid references public.cuentas_redes_sociales(id) on delete set null,
  campana_id          uuid references public.campanas_marketing(id) on delete set null,
  red_social          public.red_social not null,
  tipo_contenido      public.publicacion_tipo_contenido not null default 'imagen',
  titulo              text not null default '',
  texto               text not null default '',
  descripcion         text not null default '',
  imagen_url          text,
  miniatura_url       text,
  enlace              text not null default '',
  hashtags            text[] not null default '{}',
  etiquetas           text[] not null default '{}',
  fecha_programada    date,
  hora_programada     time,
  estado              public.publicacion_estado not null default 'borrador',
  responsable         text not null default '',
  -- Métricas (se rellenan tras publicar)
  likes               integer not null default 0,
  comentarios_count   integer not null default 0,
  compartidos         integer not null default 0,
  alcance             integer not null default 0,
  -- Comentarios internos del equipo
  comentarios         jsonb not null default '[]',
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_publicaciones_empresa on public.publicaciones(empresa_id);
create index if not exists idx_publicaciones_estado  on public.publicaciones(empresa_id, estado);
create index if not exists idx_publicaciones_fecha   on public.publicaciones(empresa_id, fecha_programada desc);

-- ─── 4. EVENTOS DE MARKETING ───────────────────────────────

create table if not exists public.eventos_marketing (
  id                      uuid primary key default gen_random_uuid(),
  empresa_id              uuid not null references public.empresas(id) on delete cascade,
  campana_id              uuid references public.campanas_marketing(id) on delete set null,
  tipo_evento             public.evento_marketing_tipo not null,
  red_social_relacionada  public.red_social,
  titulo                  text not null,
  descripcion             text not null default '',
  fecha                   date not null,
  hora                    time,
  responsable             text not null default '',
  estado                  public.publicacion_estado not null default 'borrador',
  comentarios             jsonb not null default '[]',
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_eventos_marketing_empresa on public.eventos_marketing(empresa_id);
create index if not exists idx_eventos_marketing_fecha   on public.eventos_marketing(empresa_id, fecha desc);

-- ─── 5. RLS ────────────────────────────────────────────────

alter table public.cuentas_redes_sociales  enable row level security;
alter table public.campanas_marketing      enable row level security;
alter table public.publicaciones           enable row level security;
alter table public.eventos_marketing       enable row level security;

create policy "cuentas_redes_empresa" on public.cuentas_redes_sociales
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "campanas_marketing_empresa" on public.campanas_marketing
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "publicaciones_empresa" on public.publicaciones
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "eventos_marketing_empresa" on public.eventos_marketing
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

-- ─── 6. TRIGGERS updated_at ────────────────────────────────

create trigger cuentas_redes_updated_at
  before update on public.cuentas_redes_sociales
  for each row execute function public.set_updated_at();

create trigger campanas_marketing_updated_at
  before update on public.campanas_marketing
  for each row execute function public.set_updated_at();

create trigger publicaciones_updated_at
  before update on public.publicaciones
  for each row execute function public.set_updated_at();

create trigger eventos_marketing_updated_at
  before update on public.eventos_marketing
  for each row execute function public.set_updated_at();
