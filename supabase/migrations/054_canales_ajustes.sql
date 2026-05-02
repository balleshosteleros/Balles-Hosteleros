-- Persistencia de ajustes de canales (chat) en Supabase.
-- Sustituye localStorage por:
--   1) columnas de configuración global del grupo en `canales`
--   2) tabla `canales_preferencias` con preferencias por usuario+canal
-- Añade además políticas update/delete que faltaban en `canales`.

------------------------------------------------------------------
-- 1. Configuración global del grupo (vive en canales)
------------------------------------------------------------------
alter table public.canales
  add column if not exists descripcion text,
  add column if not exists solo_admins_envian boolean not null default false,
  add column if not exists bloquear_ajustes boolean not null default false,
  add column if not exists mensajes_efimeros_dias integer,
  add column if not exists updated_at timestamptz not null default now();

-- Trigger para mantener updated_at
create or replace function public.canales_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists canales_updated_at on public.canales;
create trigger canales_updated_at
  before update on public.canales
  for each row execute function public.canales_set_updated_at();

------------------------------------------------------------------
-- 2. RLS: añadir update/delete sobre canales (mismo criterio: empresa del usuario)
------------------------------------------------------------------
drop policy if exists "canales_update" on public.canales;
create policy "canales_update" on public.canales
  for update to authenticated
  using (empresa_id in (
    select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
  ))
  with check (empresa_id in (
    select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
  ));

drop policy if exists "canales_delete" on public.canales;
create policy "canales_delete" on public.canales
  for delete to authenticated
  using (empresa_id in (
    select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
  ));

------------------------------------------------------------------
-- 3. Preferencias por usuario y canal
------------------------------------------------------------------
create table if not exists public.canales_preferencias (
  user_id      uuid not null,
  canal_id     uuid not null references public.canales(id) on delete cascade,
  silenciado   boolean not null default false,
  fijado       boolean not null default false,
  last_read_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, canal_id)
);

create index if not exists canales_preferencias_user_idx
  on public.canales_preferencias(user_id);

alter table public.canales_preferencias enable row level security;

-- Cada usuario solo ve y modifica sus propias preferencias
drop policy if exists "canales_pref_read_propio" on public.canales_preferencias;
create policy "canales_pref_read_propio" on public.canales_preferencias
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "canales_pref_upsert_propio" on public.canales_preferencias;
create policy "canales_pref_upsert_propio" on public.canales_preferencias
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "canales_pref_update_propio" on public.canales_preferencias;
create policy "canales_pref_update_propio" on public.canales_preferencias
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "canales_pref_delete_propio" on public.canales_preferencias;
create policy "canales_pref_delete_propio" on public.canales_preferencias
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.canales_pref_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists canales_pref_updated_at on public.canales_preferencias;
create trigger canales_pref_updated_at
  before update on public.canales_preferencias
  for each row execute function public.canales_pref_set_updated_at();
