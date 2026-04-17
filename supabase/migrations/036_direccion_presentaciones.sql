-- ============================================================
-- 036_direccion_presentaciones.sql
-- Módulo Dirección → submódulo Presentaciones.
--
-- Genera presentaciones con Google Gemini aplicando branding
-- persistente por empresa (logo, colores, tipografías).
--
-- TABLAS:
--   - empresa_branding      : identidad visual persistente por empresa
--   - presentaciones        : biblioteca por empresa
--   - presentacion_slides   : slides individuales (editables/reordenables)
-- ============================================================

-- ─── 1. BRANDING POR EMPRESA ───────────────────────────────
-- Imagen de marca aplicada automáticamente a cada presentación.
-- 1 fila por empresa (PK = empresa_id).

create table if not exists public.empresa_branding (
  empresa_id        uuid primary key references public.empresas(id) on delete cascade,
  logo_url          text,                              -- Supabase Storage (bucket empresa-logos)
  color_primario    text not null default '#0F172A',
  color_secundario  text not null default '#3B82F6',
  color_fondo       text not null default '#FFFFFF',
  color_texto       text not null default '#0F172A',
  tipografia_titulo text not null default 'Inter',
  tipografia_cuerpo text not null default 'Inter',
  fondo_url         text,                              -- imagen de fondo opcional
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function public.set_branding_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists branding_updated_at on public.empresa_branding;
create trigger branding_updated_at
  before update on public.empresa_branding
  for each row execute function public.set_branding_updated_at();

comment on table public.empresa_branding is
  'Imagen de marca persistente por empresa. Aplicada a presentaciones vía branding_snapshot.';

-- ─── 2. PRESENTACIONES (biblioteca) ────────────────────────

create table if not exists public.presentaciones (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,

  -- metadatos de creación
  titulo            text not null,
  prompt_original   text not null,
  audiencia         text,
  tono              text not null default 'formal'
                      check (tono in ('formal','cercano','motivacional','tecnico')),
  idioma            text not null default 'es',
  num_slides        integer not null default 10 check (num_slides between 3 and 30),

  -- estado
  estado            text not null default 'borrador'
                      check (estado in ('borrador','generando','listo','fallida','archivada')),
  error_mensaje     text,

  -- IA
  modelo_ia         text default 'gemini-2.0-flash',
  tokens_input      integer,
  tokens_output     integer,

  -- snapshot del branding al generar (para que editar el branding
  -- no afecte presentaciones antiguas)
  branding_snapshot jsonb not null default '{}',

  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pres_empresa
  on public.presentaciones(empresa_id, created_at desc);
create index if not exists idx_pres_estado
  on public.presentaciones(empresa_id, estado);

create or replace function public.set_presentaciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists presentaciones_updated_at on public.presentaciones;
create trigger presentaciones_updated_at
  before update on public.presentaciones
  for each row execute function public.set_presentaciones_updated_at();

comment on table public.presentaciones is
  'Biblioteca de presentaciones generadas con IA. Slides en presentacion_slides.';

-- ─── 3. SLIDES ─────────────────────────────────────────────
-- Cada slide es una fila. Contenido en JSONB para flexibilidad por layout.

create table if not exists public.presentacion_slides (
  id              uuid primary key default gen_random_uuid(),
  presentacion_id uuid not null references public.presentaciones(id) on delete cascade,
  orden           integer not null,
  layout          text not null default 'bullets'
                    check (layout in ('portada','bullets','cita','comparacion','imagen','cierre')),
  titulo          text,
  contenido       jsonb not null default '{}',   -- { bullets: [], cuerpo, cita, etc. }
  notas           text,                          -- notas del ponente
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (presentacion_id, orden)
);

create index if not exists idx_slides_pres
  on public.presentacion_slides(presentacion_id, orden);

create or replace function public.set_slides_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists slides_updated_at on public.presentacion_slides;
create trigger slides_updated_at
  before update on public.presentacion_slides
  for each row execute function public.set_slides_updated_at();

comment on table public.presentacion_slides is
  'Slides individuales de cada presentación. Editables y reordenables.';

-- ─── 4. RLS ────────────────────────────────────────────────

alter table public.empresa_branding      enable row level security;
alter table public.presentaciones        enable row level security;
alter table public.presentacion_slides   enable row level security;

-- empresa_branding
create policy "brand_read" on public.empresa_branding for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "brand_manage" on public.empresa_branding for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- presentaciones
create policy "pres_read" on public.presentaciones for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pres_manage" on public.presentaciones for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- slides (acceso vía presentación)
create policy "slides_read" on public.presentacion_slides for select to authenticated
  using (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));
create policy "slides_manage" on public.presentacion_slides for all to authenticated
  using (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ))
  with check (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));

-- ─── 5. SEED: branding por defecto para empresas existentes ───

insert into public.empresa_branding (empresa_id)
select id from public.empresas
on conflict (empresa_id) do nothing;
