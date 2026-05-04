-- Bloque consolidado de chat (canales + mensajes + preferencias).
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Sustituye/complementa a 008 (canales/mensajes), 054 (preferencias + flags) y 055 (miembros_user_ids).

------------------------------------------------------------------
-- 1. Tabla canales
------------------------------------------------------------------
create table if not exists public.canales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  tipo text not null default 'departamento',
  created_at timestamptz not null default now()
);

alter table public.canales
  add column if not exists descripcion text,
  add column if not exists solo_admins_envian boolean not null default false,
  add column if not exists bloquear_ajustes boolean not null default false,
  add column if not exists mensajes_efimeros_dias integer,
  add column if not exists miembros_user_ids uuid[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

alter table public.canales enable row level security;

drop policy if exists "canales_read_empresa" on public.canales;
create policy "canales_read_empresa" on public.canales
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
  ));

drop policy if exists "canales_insert" on public.canales;
create policy "canales_insert" on public.canales
  for insert to authenticated
  with check (true);

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

create index if not exists canales_miembros_user_ids_idx
  on public.canales using gin (miembros_user_ids);

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
-- 2. Tabla mensajes
------------------------------------------------------------------
create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.canales(id) on delete cascade,
  autor_id uuid references public.profiles(user_id) on delete set null,
  autor_nombre text not null,
  texto text not null,
  fijado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mensajes_canal_idx on public.mensajes(canal_id, created_at desc);

alter table public.mensajes enable row level security;

drop policy if exists "mensajes_read" on public.mensajes;
create policy "mensajes_read" on public.mensajes
  for select to authenticated
  using (true);

drop policy if exists "mensajes_insert" on public.mensajes;
create policy "mensajes_insert" on public.mensajes
  for insert to authenticated
  with check (true);

drop policy if exists "mensajes_update" on public.mensajes;
create policy "mensajes_update" on public.mensajes
  for update to authenticated
  using (true);

drop policy if exists "mensajes_delete" on public.mensajes;
create policy "mensajes_delete" on public.mensajes
  for delete to authenticated
  using (true);

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

drop policy if exists "canales_pref_read_propio" on public.canales_preferencias;
create policy "canales_pref_read_propio" on public.canales_preferencias
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "canales_pref_insert_propio" on public.canales_preferencias;
create policy "canales_pref_insert_propio" on public.canales_preferencias
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
