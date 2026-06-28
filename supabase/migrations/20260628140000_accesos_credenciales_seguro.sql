-- ============================================================
-- 20260628140000_accesos_credenciales_seguro.sql
--
-- Módulo seguro de Accesos (contraseñas de la empresa).
--
-- Tablas:
--   apps_externas         — aplicaciones/servicios por empresa
--   app_credenciales      — credenciales (contraseña + datos extra CIFRADOS)
--   app_credencial_roles  — ROL VISIBLE: qué roles pueden ver cada credencial
--
-- Columnas por credencial (modelo acordado con el usuario):
--   APP (app_id) · USUARIO (usuario, en claro/buscable) · CONTRASEÑA
--   (password_cifrado) · DATO EXTRA (datos_extra: array nombre + valor_cifrado)
--   ROL RESPONSABLE (rol_responsable, informativo) · ROL VISIBLE
--   (app_credencial_roles) · NOTAS (notas)
--
-- SEGURIDAD — doble blindaje:
--   1. RLS por ROL VISIBLE: una credencial SOLO es legible si el rol del
--      usuario (usuarios.rol_label) está en app_credencial_roles, o si el
--      usuario es de DIRECCIÓN/admin de plataforma (ve todo).
--      => El rol PROGRAMADOR (Fernando) no tiene credenciales asignadas:
--         verá el módulo VACÍO. La RLS se evalúa en BD, no en el front.
--   2. Cifrado en reposo: contraseña y datos extra se guardan cifrados
--      (AES-256-GCM, clave en servidor/Vercel, nunca en el repo).
--
-- Idempotente.
-- ============================================================

-- ─── apps_externas ───────────────────────────────────────────
create table if not exists public.apps_externas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  url         text,
  logo_url    text,
  categoria   text not null default 'Otros',
  notas       text not null default '',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_apps_externas_empresa
  on public.apps_externas(empresa_id, nombre);

-- ─── app_credenciales ────────────────────────────────────────
create table if not exists public.app_credenciales (
  id               uuid primary key default gen_random_uuid(),
  app_id           uuid not null references public.apps_externas(id) on delete cascade,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  etiqueta         text not null,
  usuario          text not null default '',           -- en claro (buscable)
  password_cifrado text not null default '',           -- {iv:tag:enc} o vacío
  url_especifica   text,
  notas            text not null default '',
  rol_responsable  text not null default '',           -- informativo
  -- DATO EXTRA: [{ "nombre": "PIN", "valor_cifrado": "iv:tag:enc" }, ...]
  datos_extra      jsonb not null default '[]'::jsonb,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_app_credenciales_app
  on public.app_credenciales(app_id);
create index if not exists idx_app_credenciales_empresa
  on public.app_credenciales(empresa_id);

-- Columnas nuevas para tablas ya existentes (PRP-043 previo): aditivo.
alter table public.app_credenciales
  add column if not exists rol_responsable text not null default '';
alter table public.app_credenciales
  add column if not exists datos_extra jsonb not null default '[]'::jsonb;

-- ─── app_credencial_roles (ROL VISIBLE) ──────────────────────
create table if not exists public.app_credencial_roles (
  credencial_id uuid not null references public.app_credenciales(id) on delete cascade,
  rol_id        uuid not null references public.empresa_roles(id) on delete cascade,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  primary key (credencial_id, rol_id)
);
create index if not exists idx_app_cred_roles_rol
  on public.app_credencial_roles(rol_id);

-- ─── Triggers updated_at ─────────────────────────────────────
create or replace function public.accesos_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_apps_externas_updated on public.apps_externas;
create trigger trg_apps_externas_updated
  before update on public.apps_externas
  for each row execute function public.accesos_set_updated_at();

drop trigger if exists trg_app_credenciales_updated on public.app_credenciales;
create trigger trg_app_credenciales_updated
  before update on public.app_credenciales
  for each row execute function public.accesos_set_updated_at();

-- ─── Helper: ¿el usuario actual es DIRECCIÓN / admin de plataforma? ──
-- DIRECCIÓN ve TODAS las credenciales de sus empresas (super-usuario).
create or replace function public.es_direccion_en(p_empresa_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.empresa_roles er
      on er.empresa_id = u.empresa_id
     and lower(er.nombre) = lower(coalesce(u.rol_label, ''))
    where u.user_id = auth.uid()
      and u.empresa_id = p_empresa_id
      and upper(coalesce(u.rol_label, '')) in ('DIRECCIÓN','DIRECCION','DIRECTOR','ADMIN')
  );
$$;

-- ─── Helper: ¿el rol del usuario está autorizado a VER esta credencial? ──
create or replace function public.puede_ver_credencial(p_credencial_id uuid, p_empresa_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.app_credencial_roles acr
    join public.empresa_roles er on er.id = acr.rol_id
    join public.usuarios u
      on u.empresa_id = er.empresa_id
     and lower(u.rol_label) = lower(er.nombre)
    where acr.credencial_id = p_credencial_id
      and acr.empresa_id = p_empresa_id
      and u.user_id = auth.uid()
  );
$$;

-- ═══ RLS ═════════════════════════════════════════════════════
alter table public.apps_externas        enable row level security;
alter table public.app_credenciales     enable row level security;
alter table public.app_credencial_roles enable row level security;

-- apps_externas: visibles a cualquier miembro de la empresa (no contienen secretos).
drop policy if exists "apps_externas_tenant_read"  on public.apps_externas;
create policy "apps_externas_tenant_read" on public.apps_externas
  for select to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists "apps_externas_direccion_write" on public.apps_externas;
create policy "apps_externas_direccion_write" on public.apps_externas
  for all to authenticated
  using (empresa_id in (select public.empresas_del_usuario())
         and public.es_direccion_en(empresa_id))
  with check (empresa_id in (select public.empresas_del_usuario())
              and public.es_direccion_en(empresa_id));

-- app_credenciales: LECTURA solo si el rol del usuario está en ROL VISIBLE,
-- o si es DIRECCIÓN. Esto bloquea a PROGRAMADOR/Fernando a nivel BD.
drop policy if exists "app_credenciales_tenant_role_read" on public.app_credenciales;
create policy "app_credenciales_tenant_role_read" on public.app_credenciales
  for select to authenticated
  using (
    empresa_id in (select public.empresas_del_usuario())
    and (
      public.es_direccion_en(empresa_id)
      or public.puede_ver_credencial(id, empresa_id)
    )
  );

-- Escritura (crear/editar/borrar) solo DIRECCIÓN.
drop policy if exists "app_credenciales_direccion_write" on public.app_credenciales;
create policy "app_credenciales_direccion_write" on public.app_credenciales
  for all to authenticated
  using (empresa_id in (select public.empresas_del_usuario())
         and public.es_direccion_en(empresa_id))
  with check (empresa_id in (select public.empresas_del_usuario())
              and public.es_direccion_en(empresa_id));

-- app_credencial_roles: legible si puedes leer la credencial; escritura DIRECCIÓN.
drop policy if exists "app_cred_roles_read" on public.app_credencial_roles;
create policy "app_cred_roles_read" on public.app_credencial_roles
  for select to authenticated
  using (
    empresa_id in (select public.empresas_del_usuario())
    and (
      public.es_direccion_en(empresa_id)
      or public.puede_ver_credencial(credencial_id, empresa_id)
    )
  );

drop policy if exists "app_cred_roles_direccion_write" on public.app_credencial_roles;
create policy "app_cred_roles_direccion_write" on public.app_credencial_roles
  for all to authenticated
  using (empresa_id in (select public.empresas_del_usuario())
         and public.es_direccion_en(empresa_id))
  with check (empresa_id in (select public.empresas_del_usuario())
              and public.es_direccion_en(empresa_id));

comment on table public.app_credenciales is
  'Credenciales de apps por empresa. Contraseña y datos_extra cifrados en reposo. Lectura gobernada por ROL VISIBLE (app_credencial_roles) salvo DIRECCIÓN.';
comment on column public.app_credenciales.datos_extra is
  'Array jsonb de {nombre, valor_cifrado}. DATO EXTRA flexible: PIN, PUK, código empresa, etc. Valores cifrados AES-256-GCM.';
comment on column public.app_credenciales.rol_responsable is
  'ROL RESPONSABLE: informativo, indica el departamento que usa la cuenta. NO controla visibilidad.';
