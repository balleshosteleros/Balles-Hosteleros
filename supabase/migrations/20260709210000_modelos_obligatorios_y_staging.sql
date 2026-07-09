-- ============================================================
-- 20260709210000_modelos_obligatorios_y_staging.sql — PRP-072
--   1) modelos_config.tipos_obligatorios: qué modelos son
--      obligatorios en el enlace de la gestoría (null = todos
--      los visibles son obligatorios).
--   2) gestoria_modelos_staging: retiene los PDFs subidos+
--      validados por la gestoría ANTES de la confirmación final
--      (subida todo-o-nada: nada entra a modelos_aeat hasta que
--      están todos los obligatorios).
-- Idempotente.
-- ============================================================

alter table public.modelos_config
  add column if not exists tipos_obligatorios text[];

create table if not exists public.gestoria_modelos_staging (
  id            uuid primary key default gen_random_uuid(),
  token_id      uuid not null references public.gestoria_modelos_tokens(id) on delete cascade,
  tipo          text not null,
  staging_path  text not null,
  ia_ok         boolean not null default false,
  ia_motivo     text,
  created_at    timestamptz not null default now(),
  unique (token_id, tipo)
);

create index if not exists idx_gestoria_modelos_staging_token
  on public.gestoria_modelos_staging(token_id);

alter table public.gestoria_modelos_staging enable row level security;
-- Solo lectura para usuarios de la empresa dueña del token; la escritura va por
-- service_role (la gestoría no tiene login).
drop policy if exists "gestoria_modelos_staging_read" on public.gestoria_modelos_staging;
create policy "gestoria_modelos_staging_read" on public.gestoria_modelos_staging
  for select to authenticated
  using (
    token_id in (
      select t.id from public.gestoria_modelos_tokens t
      where t.empresa_id in (select p.empresa_id from public.usuarios p where p.user_id = auth.uid())
         or t.empresa_id in (select ue.empresa_id from public.usuario_empresas ue where ue.user_id = auth.uid())
    )
  );
