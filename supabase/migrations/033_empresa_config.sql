-- ============================================================
-- 033_empresa_config.sql
-- Roles por empresa: una fila por rol con permisos como JSONB.
-- ============================================================

create table if not exists public.empresa_roles (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  descripcion text not null default '',
  permisos    jsonb not null default '[]',
  protected   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_empresa_roles_empresa
  on public.empresa_roles(empresa_id, created_at);

comment on table public.empresa_roles is
  'Roles de acceso por empresa con permisos por módulo en JSONB.';

-- Trigger updated_at
create or replace function public.set_empresa_roles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists empresa_roles_updated_at on public.empresa_roles;
create trigger empresa_roles_updated_at
  before update on public.empresa_roles
  for each row execute function public.set_empresa_roles_updated_at();

-- RLS
alter table public.empresa_roles enable row level security;

create policy "empresa_roles_select" on public.empresa_roles
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "empresa_roles_all" on public.empresa_roles
  for all to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );
