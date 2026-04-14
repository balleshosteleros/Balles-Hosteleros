-- ============================================================
-- 011_empresa_logos_storage.sql — Bucket Storage para logos
-- de empresa + tabla de mapping slug → URL pública.
-- ============================================================

-- ─── 1. BUCKET DE STORAGE (público) ──────────────────────────
-- Los logos son activos públicos: cualquiera puede leerlos,
-- solo el service-role puede escribir (Server Actions).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'empresa-logos',
  'empresa-logos',
  true,
  2097152,  -- 2 MB
  array['image/png','image/jpeg','image/jpg','image/svg+xml','image/webp']
)
on conflict (id) do nothing;

-- Lectura pública de objetos del bucket
do $$ begin
  create policy "empresa_logos_storage_public_read"
    on storage.objects for select
    using (bucket_id = 'empresa-logos');
exception when duplicate_object then null;
end $$;

-- Escritura solo via service-role (Server Actions usan admin client)
do $$ begin
  create policy "empresa_logos_storage_service_write"
    on storage.objects for insert
    with check (bucket_id = 'empresa-logos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "empresa_logos_storage_service_update"
    on storage.objects for update
    using (bucket_id = 'empresa-logos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "empresa_logos_storage_service_delete"
    on storage.objects for delete
    using (bucket_id = 'empresa-logos');
exception when duplicate_object then null;
end $$;

-- ─── 2. TABLA empresa_logos (slug → URL) ──────────────────────
-- Clave: slug de empresa (ej. "habana", "bacanal").
-- Independiente de UUIDs para funcionar también en dev-bypass.

create table if not exists public.empresa_logos (
  empresa_slug  text primary key,
  logo_url      text not null default '',
  updated_at    timestamptz not null default now()
);

-- RLS: lectura pública, escritura solo service-role
alter table public.empresa_logos enable row level security;

do $$ begin
  create policy "empresa_logos_public_read"
    on public.empresa_logos for select
    using (true);
exception when duplicate_object then null;
end $$;

-- El admin client bypasses RLS automáticamente con service-role key.
-- No necesitamos política de escritura para el cliente anon.
