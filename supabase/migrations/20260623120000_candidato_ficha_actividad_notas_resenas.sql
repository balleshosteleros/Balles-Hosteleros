-- Ficha del candidato: persistencia de Actividad, Notas y Reseñas.
-- Hasta ahora estas tres secciones del CandidatoDetailModal vivían solo en
-- memoria del cliente. Se persisten en tres tablas por candidato, con RLS
-- multi-tenant vía empresas_del_usuario() (empresa_id es uuid). Aplica a todas
-- las empresas, presentes y futuras (sin seed por empresa: son datos de uso).
--
-- Idempotente.

-- ── Actividad: historial de cambios de estado del candidato ──────────────────
create table if not exists public.candidato_historial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  fase_anterior text,
  estado_anterior text,
  fase_nueva text not null,
  estado_nuevo text not null,
  usuario_id uuid,
  usuario_nombre text,
  email_enviado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidato_historial_candidato
  on public.candidato_historial (candidato_id, created_at);

-- ── Notas internas del reclutador ───────────────────────────────────────────
create table if not exists public.candidato_notas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  autor_id uuid,
  autor_nombre text,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidato_notas_candidato
  on public.candidato_notas (candidato_id, created_at);

-- ── Reseñas: valoración por estrellas (1–5) de criterios canónicos ──────────
create table if not exists public.candidato_resenas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  autor_id uuid,
  autor_nombre text,
  -- [{ criterioId: string, estrellas: 1..5 }]
  puntuaciones jsonb not null default '[]'::jsonb,
  comentario text,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidato_resenas_candidato
  on public.candidato_resenas (candidato_id, created_at);

-- ── RLS multi-tenant ────────────────────────────────────────────────────────
alter table public.candidato_historial enable row level security;
alter table public.candidato_notas     enable row level security;
alter table public.candidato_resenas   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['candidato_historial','candidato_notas','candidato_resenas']
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s;', t);

    execute format(
      'create policy "%1$s_select" on public.%1$s for select using (empresa_id in (select empresas_del_usuario()));', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$s for insert with check (empresa_id in (select empresas_del_usuario()));', t);
    execute format(
      'create policy "%1$s_update" on public.%1$s for update using (empresa_id in (select empresas_del_usuario())) with check (empresa_id in (select empresas_del_usuario()));', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$s for delete using (empresa_id in (select empresas_del_usuario()));', t);
  end loop;
end $$;
