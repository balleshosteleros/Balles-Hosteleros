-- ============================================================
-- 038_carta_digital.sql — Carta Digital pública (PRP-028)
--
-- Tablas nuevas:
--   carta_categorias       (categorías de carta por empresa)
--   carta_items            (platos con foto, precio, alérgenos)
--   carta_item_likes       (1 like por dispositivo, anónimo, RGPD-safe)
--
-- Extensiones:
--   empresas.carta_slug, carta_publicada, carta_horarios, carta_descripcion
--
-- Reutiliza: empresas, productos, profiles
-- ============================================================

-- ─── 0. Slug público en empresas ─────────────────────────────
alter table public.empresas
  add column if not exists carta_slug text unique,
  add column if not exists carta_publicada boolean not null default false,
  add column if not exists carta_horarios jsonb,
  add column if not exists carta_descripcion text;

create index if not exists idx_empresas_carta_slug
  on public.empresas(carta_slug) where carta_slug is not null;

-- ─── 1. Categorías ───────────────────────────────────────────
create table if not exists public.carta_categorias (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  orden        smallint not null default 0,
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_carta_cat_empresa
  on public.carta_categorias(empresa_id, orden);

-- ─── 2. Items (platos) ───────────────────────────────────────
create table if not exists public.carta_items (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  categoria_id      uuid not null references public.carta_categorias(id) on delete cascade,
  producto_id       uuid references public.productos(id) on delete set null,
  nombre            text not null,
  descripcion       text,
  precio            numeric(10,2) not null default 0,
  foto_url          text,
  foto_storage_path text,
  alergenos         text[] not null default '{}',
  orden             smallint not null default 0,
  visible           boolean not null default true,
  destacado         boolean not null default false,
  likes_count       integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_carta_items_cat
  on public.carta_items(categoria_id, orden) where visible = true;

create index if not exists idx_carta_items_destacado
  on public.carta_items(empresa_id, destacado) where destacado = true and visible = true;

-- ─── 3. Likes ────────────────────────────────────────────────
create table if not exists public.carta_item_likes (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.carta_items(id) on delete cascade,
  device_id   text not null,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (item_id, device_id)
);

create index if not exists idx_carta_likes_item
  on public.carta_item_likes(item_id);

create index if not exists idx_carta_likes_iphash_recent
  on public.carta_item_likes(ip_hash, created_at desc);

-- ─── 4. Trigger sync likes_count ─────────────────────────────
create or replace function public.carta_likes_sync()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.carta_items set likes_count = likes_count + 1, updated_at = now() where id = new.item_id;
  elsif tg_op = 'DELETE' then
    update public.carta_items set likes_count = greatest(likes_count - 1, 0), updated_at = now() where id = old.item_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_carta_likes_sync on public.carta_item_likes;
create trigger trg_carta_likes_sync
  after insert or delete on public.carta_item_likes
  for each row execute function public.carta_likes_sync();

-- ─── 5. Trigger updated_at automático ────────────────────────
create or replace function public.carta_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_carta_cat_updated on public.carta_categorias;
create trigger trg_carta_cat_updated before update on public.carta_categorias
  for each row execute function public.carta_set_updated_at();

drop trigger if exists trg_carta_items_updated on public.carta_items;
create trigger trg_carta_items_updated before update on public.carta_items
  for each row execute function public.carta_set_updated_at();

-- ─── 6. RLS ──────────────────────────────────────────────────
alter table public.carta_categorias enable row level security;
alter table public.carta_items      enable row level security;
alter table public.carta_item_likes enable row level security;

-- Lectura pública (anon + auth) sobre empresas con carta_publicada=true
drop policy if exists "carta_cat_public_read" on public.carta_categorias;
create policy "carta_cat_public_read" on public.carta_categorias
  for select to anon, authenticated
  using (
    visible = true and exists (
      select 1 from public.empresas e
      where e.id = empresa_id and e.carta_publicada = true
    )
  );

drop policy if exists "carta_items_public_read" on public.carta_items;
create policy "carta_items_public_read" on public.carta_items
  for select to anon, authenticated
  using (
    visible = true and exists (
      select 1 from public.empresas e
      where e.id = empresa_id and e.carta_publicada = true
    )
  );

-- Escritura admin (filtrado por empresa del profile)
drop policy if exists "carta_cat_admin_write" on public.carta_categorias;
create policy "carta_cat_admin_write" on public.carta_categorias
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "carta_items_admin_write" on public.carta_items;
create policy "carta_items_admin_write" on public.carta_items
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- Likes: insert/delete público (validación anti-spam server-side)
drop policy if exists "carta_likes_public_insert" on public.carta_item_likes;
create policy "carta_likes_public_insert" on public.carta_item_likes
  for insert to anon, authenticated
  with check (true);

drop policy if exists "carta_likes_public_delete" on public.carta_item_likes;
create policy "carta_likes_public_delete" on public.carta_item_likes
  for delete to anon, authenticated
  using (true);

drop policy if exists "carta_likes_public_select" on public.carta_item_likes;
create policy "carta_likes_public_select" on public.carta_item_likes
  for select to anon, authenticated
  using (true);

-- ─── 7. Realtime publication ─────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.carta_items;
exception when duplicate_object then null; end $$;

-- ─── 8. Storage bucket carta-fotos (idempotente) ─────────────
insert into storage.buckets (id, name, public)
values ('carta-fotos', 'carta-fotos', true)
on conflict (id) do nothing;

drop policy if exists "carta_fotos_public_read" on storage.objects;
create policy "carta_fotos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'carta-fotos');

drop policy if exists "carta_fotos_admin_upload" on storage.objects;
create policy "carta_fotos_admin_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'carta-fotos');

drop policy if exists "carta_fotos_admin_update" on storage.objects;
create policy "carta_fotos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'carta-fotos');

drop policy if exists "carta_fotos_admin_delete" on storage.objects;
create policy "carta_fotos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'carta-fotos');
