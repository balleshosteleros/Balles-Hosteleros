-- ============================================================
-- 012_organigramas.sql — Persistencia del organigrama por empresa.
-- Mapping slug → estructura completa (nodes, edges, zones).
-- Patrón idéntico a empresa_logos: PK por slug, lectura pública,
-- escritura solo via admin client (Server Actions).
-- ============================================================

create table if not exists public.organigramas (
  empresa_slug  text primary key,
  nodes         jsonb not null default '[]'::jsonb,
  edges         jsonb not null default '[]'::jsonb,
  zones         jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.organigramas enable row level security;

do $$ begin
  create policy "organigramas_public_read"
    on public.organigramas for select
    using (true);
exception when duplicate_object then null;
end $$;

-- Las escrituras pasan por createAdminClient (service-role bypass).
-- No se define política de escritura para anon.
