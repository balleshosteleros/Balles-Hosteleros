-- Migration 002: Align profiles + roles with code expectations
-- Reason: src/features/auth/contexts/auth-context.tsx and src/actions/admin.ts
-- expect columns/tables that 001_create_profiles.sql did not create.
-- This migration is additive and idempotent.

-- =======================================================
-- 1. empresas table
-- =======================================================
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz default now() not null
);

alter table public.empresas enable row level security;

drop policy if exists "Authenticated can view empresas" on public.empresas;
create policy "Authenticated can view empresas"
  on public.empresas for select
  to authenticated
  using (true);

-- Seed default empresa so existing users belong somewhere
insert into public.empresas (id, nombre)
values ('00000000-0000-0000-0000-000000000001', 'Balles Hosteleros')
on conflict (id) do nothing;

-- =======================================================
-- 2. profiles: add columns the code expects
-- =======================================================
alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists nombre text,
  add column if not exists apellidos text,
  add column if not exists empresa_id uuid references public.empresas(id);

-- Backfill existing rows
update public.profiles
set user_id    = coalesce(user_id, id),
    nombre     = coalesce(nombre, full_name),
    empresa_id = coalesce(empresa_id, '00000000-0000-0000-0000-000000000001'::uuid)
where user_id is null
   or nombre is null
   or empresa_id is null;

create index if not exists idx_profiles_user_id on public.profiles(user_id);

-- =======================================================
-- 3. app_role enum + user_roles table
-- =======================================================
do $$ begin
  create type public.app_role as enum (
    'admin','director','gerencia','responsable','empleado','solo_lectura'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz default now() not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- =======================================================
-- 4. Update handle_new_user trigger to populate new columns
-- =======================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, user_id, email, full_name, nombre, avatar_url, empresa_id)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    '00000000-0000-0000-0000-000000000001'::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

-- =======================================================
-- 5. Backfill: create profiles for auth.users that don't have one
-- =======================================================
insert into public.profiles (id, user_id, email, full_name, nombre, empresa_id)
select u.id,
       u.id,
       u.email,
       u.raw_user_meta_data->>'full_name',
       u.raw_user_meta_data->>'full_name',
       '00000000-0000-0000-0000-000000000001'::uuid
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- =======================================================
-- 6. Assign 'admin' role to every existing auth user (dev env)
-- =======================================================
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
on conflict (user_id, role) do nothing;
