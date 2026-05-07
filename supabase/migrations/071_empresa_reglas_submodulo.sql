-- ============================================================
-- 071_empresa_reglas_submodulo.sql — Reglas de creación por submódulo
--
-- Objetivo:
--   Permitir al admin definir, por cada submódulo del sistema, qué
--   campos son obligatorios al pulsar "Nuevo" (empleado, proveedor,
--   comunicado, etc.).
--
-- Modos:
--   basico        — exige solo el campo identificador (mínimo)
--   estandar      — exige los campos clave del submódulo (default)
--   avanzado      — exige todos los campos del formulario
--   personalizado — admin elige campo a campo (campos_obligatorios[])
--
-- Si no hay fila para (empresa, modulo, submodulo) la app trata por
-- defecto como modo "estandar" — no se necesita seed inicial.
-- ============================================================

create table if not exists public.empresa_reglas_submodulo (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  modulo              text not null,
  submodulo           text not null,
  modo                text not null default 'estandar'
                      check (modo in ('basico','estandar','avanzado','personalizado')),
  campos_obligatorios text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists empresa_reglas_submodulo_uniq
  on public.empresa_reglas_submodulo (empresa_id, modulo, submodulo);

create index if not exists idx_empresa_reglas_submodulo_empresa
  on public.empresa_reglas_submodulo (empresa_id);

-- ─── Trigger updated_at ──────────────────────────────────────
create or replace function public.empresa_reglas_submodulo_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_empresa_reglas_submodulo_updated
  on public.empresa_reglas_submodulo;
create trigger trg_empresa_reglas_submodulo_updated
  before update on public.empresa_reglas_submodulo
  for each row execute function public.empresa_reglas_submodulo_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.empresa_reglas_submodulo enable row level security;

drop policy if exists "empresa_reglas_submodulo_select"
  on public.empresa_reglas_submodulo;
create policy "empresa_reglas_submodulo_select"
  on public.empresa_reglas_submodulo
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

drop policy if exists "empresa_reglas_submodulo_all"
  on public.empresa_reglas_submodulo;
create policy "empresa_reglas_submodulo_all"
  on public.empresa_reglas_submodulo
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
