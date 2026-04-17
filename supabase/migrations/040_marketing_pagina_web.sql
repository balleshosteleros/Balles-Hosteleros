-- ============================================================
-- 040_marketing_pagina_web.sql — Submódulo Página Web (PRP-029)
--
-- Tablas nuevas:
--   paginas_web             (páginas CMS multi-tenant + bloques JSONB)
--   paginas_web_dominios    (custom domains vía Vercel Domains API)
--   paginas_web_versiones   (historial/rollback de publicaciones)
--   leads_web               (capturas de formularios públicos, RGPD)
--
-- Reutiliza: empresas, profiles, carta_items (para bloque menu)
-- Idempotente: DO $$ ... $$ para enums, IF NOT EXISTS para tablas
-- ============================================================

-- ─── 0. Enums ────────────────────────────────────────────────
do $$ begin
  create type pagina_web_tipo as enum ('WEB_PRINCIPAL', 'ONE_PAGE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pagina_web_estado as enum ('BORRADOR', 'PUBLICADA', 'ARCHIVADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bloque_tipo as enum (
    'hero','galeria','menu','reservas','testimonios',
    'cta','formulario','mapa','footer','texto_libre','video'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dominio_estado as enum ('PENDIENTE_DNS','VERIFICADO','ERROR');
exception when duplicate_object then null; end $$;

-- ─── 1. Páginas ──────────────────────────────────────────────
create table if not exists public.paginas_web (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  tipo           pagina_web_tipo not null,
  nombre         text not null,
  slug_interno   text not null,
  bloques        jsonb not null default '[]'::jsonb,
  branding       jsonb,
  seo            jsonb,
  estado         pagina_web_estado not null default 'BORRADOR',
  publicada_at   timestamptz,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (empresa_id, slug_interno)
);

create index if not exists idx_paginas_web_empresa
  on public.paginas_web(empresa_id, estado);

-- ─── 2. Dominios ─────────────────────────────────────────────
create table if not exists public.paginas_web_dominios (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  pagina_id        uuid not null references public.paginas_web(id) on delete cascade,
  hostname         text not null unique,
  es_principal     boolean not null default false,
  estado           dominio_estado not null default 'PENDIENTE_DNS',
  vercel_domain_id text,
  dns_hint         jsonb,
  ssl_activo       boolean not null default false,
  verificado_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_paginas_web_dom_hostname
  on public.paginas_web_dominios(hostname);
create index if not exists idx_paginas_web_dom_pagina
  on public.paginas_web_dominios(pagina_id);

-- ─── 3. Leads públicos ───────────────────────────────────────
create table if not exists public.leads_web (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  pagina_id   uuid references public.paginas_web(id) on delete set null,
  bloque_id   text,
  nombre      text,
  email       text,
  telefono    text,
  mensaje     text,
  payload     jsonb not null default '{}'::jsonb,
  utm         jsonb,
  referrer    text,
  user_agent  text,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_leads_web_empresa_created
  on public.leads_web(empresa_id, created_at desc);

create index if not exists idx_leads_web_iphash_recent
  on public.leads_web(ip_hash, created_at desc);

-- ─── 4. Versiones (historial) ────────────────────────────────
create table if not exists public.paginas_web_versiones (
  id          uuid primary key default gen_random_uuid(),
  pagina_id   uuid not null references public.paginas_web(id) on delete cascade,
  version     integer not null,
  snapshot    jsonb not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (pagina_id, version)
);

create index if not exists idx_paginas_web_ver_pagina
  on public.paginas_web_versiones(pagina_id, version desc);

-- ─── 5. RLS ──────────────────────────────────────────────────
alter table public.paginas_web            enable row level security;
alter table public.paginas_web_dominios   enable row level security;
alter table public.paginas_web_versiones  enable row level security;
alter table public.leads_web              enable row level security;

-- ADMIN: solo su empresa (derivado de profiles.empresa_id)
drop policy if exists "paginas_web_admin_rw" on public.paginas_web;
create policy "paginas_web_admin_rw" on public.paginas_web
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "paginas_web_dom_admin_rw" on public.paginas_web_dominios;
create policy "paginas_web_dom_admin_rw" on public.paginas_web_dominios
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "paginas_web_ver_admin_rw" on public.paginas_web_versiones;
create policy "paginas_web_ver_admin_rw" on public.paginas_web_versiones
  for all to authenticated
  using (pagina_id in (
    select pw.id from public.paginas_web pw
    join public.profiles p on p.empresa_id = pw.empresa_id
    where p.user_id = auth.uid()
  ))
  with check (pagina_id in (
    select pw.id from public.paginas_web pw
    join public.profiles p on p.empresa_id = pw.empresa_id
    where p.user_id = auth.uid()
  ));

-- Leads: lectura admin
drop policy if exists "leads_web_admin_read" on public.leads_web;
create policy "leads_web_admin_read" on public.leads_web
  for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- PÚBLICO ANÓNIMO — lectura de páginas publicadas con dominio verificado
drop policy if exists "paginas_web_public_read" on public.paginas_web;
create policy "paginas_web_public_read" on public.paginas_web
  for select to anon, authenticated
  using (
    estado = 'PUBLICADA'
    and id in (select pagina_id from public.paginas_web_dominios where estado = 'VERIFICADO')
  );

drop policy if exists "paginas_web_dom_public_read" on public.paginas_web_dominios;
create policy "paginas_web_dom_public_read" on public.paginas_web_dominios
  for select to anon, authenticated
  using (estado = 'VERIFICADO');

-- Inserts de leads: server-side con service_role. No se expone policy anon de insert.

-- ─── 6. Triggers ─────────────────────────────────────────────
create or replace function public.paginas_web_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_paginas_web_touch on public.paginas_web;
create trigger trg_paginas_web_touch
  before update on public.paginas_web
  for each row execute function public.paginas_web_touch();

drop trigger if exists trg_paginas_web_dom_touch on public.paginas_web_dominios;
create trigger trg_paginas_web_dom_touch
  before update on public.paginas_web_dominios
  for each row execute function public.paginas_web_touch();

-- Snapshot automático a versiones cuando se publica
create or replace function public.paginas_web_snapshot_on_publish()
returns trigger language plpgsql as $$
declare
  next_ver integer;
begin
  if new.estado = 'PUBLICADA'
     and (old.estado is distinct from 'PUBLICADA'
          or old.bloques is distinct from new.bloques) then
    select coalesce(max(version), 0) + 1 into next_ver
      from public.paginas_web_versiones where pagina_id = new.id;
    insert into public.paginas_web_versiones (pagina_id, version, snapshot, created_by)
      values (new.id, next_ver,
              jsonb_build_object('bloques', new.bloques, 'seo', new.seo, 'branding', new.branding),
              new.created_by);
  end if;
  return new;
end $$;

drop trigger if exists trg_paginas_web_snapshot on public.paginas_web;
create trigger trg_paginas_web_snapshot
  after update on public.paginas_web
  for each row execute function public.paginas_web_snapshot_on_publish();

-- ─── 7. Storage bucket paginas-web-assets ────────────────────
insert into storage.buckets (id, name, public)
values ('paginas-web-assets', 'paginas-web-assets', true)
on conflict (id) do nothing;

drop policy if exists "paginas_web_assets_public_read" on storage.objects;
create policy "paginas_web_assets_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'paginas-web-assets');

drop policy if exists "paginas_web_assets_auth_upload" on storage.objects;
create policy "paginas_web_assets_auth_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'paginas-web-assets');

drop policy if exists "paginas_web_assets_auth_update" on storage.objects;
create policy "paginas_web_assets_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'paginas-web-assets');

drop policy if exists "paginas_web_assets_auth_delete" on storage.objects;
create policy "paginas_web_assets_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'paginas-web-assets');
