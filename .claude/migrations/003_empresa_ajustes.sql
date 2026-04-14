-- ============================================================
-- 003_empresa_ajustes.sql — Ajustes de empresa, departamentos,
-- roles con permisos y auditoría de cambios.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.empresa_estado as enum ('Activa', 'Inactiva');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.usuario_estado as enum ('Activo', 'Invitado', 'Bloqueado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.departamento_estado as enum ('Activo', 'Inactivo');
exception when duplicate_object then null;
end $$;

-- ─── 1. EMPRESA_AJUSTES (datos generales + config operativa) ────────────────

create table if not exists public.empresa_ajustes (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,

  -- Datos generales
  nombre_comercial      text not null default '',
  razon_social          text not null default '',
  cif                   text not null default '',
  direccion_fiscal      text not null default '',
  direccion_local       text not null default '',
  telefono_principal    text not null default '',
  telefono_secundario   text not null default '',
  correo_general        text not null default '',
  correo_admin          text not null default '',
  correo_rrhh           text not null default '',
  correo_contabilidad   text not null default '',
  correo_marketing      text not null default '',
  correo_juridico       text not null default '',
  correo_reservas       text not null default '',
  correo_incidencias    text not null default '',
  web                   text not null default '',
  whatsapp              text not null default '',
  instagram             text not null default '',
  facebook              text not null default '',
  tiktok                text not null default '',
  ciudad                text not null default 'Madrid',
  provincia             text not null default 'Madrid',
  pais                  text not null default 'España',
  codigo_postal         text not null default '',
  estado                public.empresa_estado not null default 'Activa',
  gerente               text not null default '',
  horario_general       text not null default '',
  observaciones         text not null default '',
  logo_url              text not null default '',

  -- Config operativa
  moneda                text not null default 'EUR (€)',
  idioma                text not null default 'Español',
  zona_horaria          text not null default 'Europe/Madrid',
  formato_fecha         text not null default 'DD/MM/AAAA',
  primer_dia_semana     text not null default 'Lunes',
  locales_asociados     text not null default '',
  etiquetas_internas    text not null default '',
  color_primario        text not null default '#3B82F6',

  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id) on delete set null,

  unique (empresa_id)
);

create index if not exists idx_empresa_ajustes_empresa on public.empresa_ajustes(empresa_id);

-- ─── 2. EMPRESA_DEPARTAMENTOS ───────────────────────────────

create table if not exists public.empresa_departamentos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null,
  responsable   text not null default '',
  correo        text not null default '',
  telefono      text not null default '',
  descripcion   text not null default '',
  estado        public.departamento_estado not null default 'Activo',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_empresa_departamentos_empresa on public.empresa_departamentos(empresa_id);

-- ─── 3. EMPRESA_ROLES ──────────────────────────────────────

create table if not exists public.empresa_roles (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null,
  descripcion   text not null default '',
  -- permisos: [{modulo, ver, editar}]
  permisos      jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_empresa_roles_empresa on public.empresa_roles(empresa_id);

-- ─── 4. EMPRESA_AUDITORIA ──────────────────────────────────

create table if not exists public.empresa_auditoria (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  usuario       text not null,
  accion        text not null,
  apartado      text not null,
  fecha         timestamptz not null default now()
);

create index if not exists idx_empresa_auditoria_empresa on public.empresa_auditoria(empresa_id);
create index if not exists idx_empresa_auditoria_fecha on public.empresa_auditoria(fecha desc);

-- ─── 5. RLS ────────────────────────────────────────────────

alter table public.empresa_ajustes       enable row level security;
alter table public.empresa_departamentos enable row level security;
alter table public.empresa_roles         enable row level security;
alter table public.empresa_auditoria     enable row level security;

-- Política: solo usuarios de la misma empresa pueden ver/editar

create policy "empresa_ajustes_select" on public.empresa_ajustes
  for select using (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

create policy "empresa_ajustes_upsert" on public.empresa_ajustes
  for all using (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

create policy "empresa_departamentos_select" on public.empresa_departamentos
  for select using (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

create policy "empresa_departamentos_all" on public.empresa_departamentos
  for all using (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

create policy "empresa_roles_select" on public.empresa_roles
  for select using (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

create policy "empresa_roles_all" on public.empresa_roles
  for all using (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

create policy "empresa_auditoria_select" on public.empresa_auditoria
  for select using (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

create policy "empresa_auditoria_insert" on public.empresa_auditoria
  for insert with check (
    empresa_id in (
      select empresa_id from public.profiles where id = auth.uid()
    )
  );

-- ─── 6. TRIGGER updated_at ─────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger empresa_ajustes_updated_at
  before update on public.empresa_ajustes
  for each row execute function public.set_updated_at();

create trigger empresa_departamentos_updated_at
  before update on public.empresa_departamentos
  for each row execute function public.set_updated_at();

create trigger empresa_roles_updated_at
  before update on public.empresa_roles
  for each row execute function public.set_updated_at();
