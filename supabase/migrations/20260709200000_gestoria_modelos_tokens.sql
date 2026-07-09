-- ============================================================
-- 20260709200000_gestoria_modelos_tokens.sql — PRP-072
-- Enlace tokenizado para que la GESTORÍA suba los modelos de un
-- periodo (trimestral o anual) sin login. Espejo de
-- gestoria_contrato_tokens (PRP-068).
-- Escritura SIEMPRE por service_role (no hay policy insert/update).
-- Idempotente.
-- ============================================================

create table if not exists public.gestoria_modelos_tokens (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  ejercicio      integer not null,
  -- 'TRIMESTRALES' | 'ANUALES': define qué modelos entran en este enlace.
  grupo          text not null check (grupo in ('TRIMESTRALES','ANUALES')),
  -- Para trimestrales, el periodo Q concreto (Q1..Q4). Para anuales, 'ANUAL'.
  periodo        text not null,
  token_hash     text not null,
  expira_en      timestamptz not null,
  -- Trazabilidad
  email_enviado_en    timestamptz,
  primer_uso_en       timestamptz,
  completado_en       timestamptz,
  modelos_subidos     integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_gestoria_modelos_tokens_hash
  on public.gestoria_modelos_tokens(token_hash);
create index if not exists idx_gestoria_modelos_tokens_empresa
  on public.gestoria_modelos_tokens(empresa_id, ejercicio, grupo, periodo);

alter table public.gestoria_modelos_tokens enable row level security;

-- Solo SELECT para usuarios de la empresa (la escritura va por service_role).
drop policy if exists "gestoria_modelos_tokens_read" on public.gestoria_modelos_tokens;
create policy "gestoria_modelos_tokens_read" on public.gestoria_modelos_tokens
  for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.usuarios p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.usuario_empresas ue where ue.user_id = auth.uid())
  );
