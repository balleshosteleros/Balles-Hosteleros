-- ============================================================
-- 20260729130000_cierres_gastos.sql
-- Gastos de la semana asociados a un cierre semanal (Gerencia).
-- Cada gasto: tipo (texto libre) + descripción + importe.
-- Registro informativo: NO afecta al cálculo del descuadre.
-- Idempotente.
-- ============================================================

create table if not exists public.cierres_gastos (
  id          uuid primary key default gen_random_uuid(),
  cierre_id   uuid not null references public.cierres_semanales(id) on delete cascade,
  empresa_id  uuid not null,
  tipo        text not null default '',
  descripcion text,
  importe     numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_cierres_gastos_cierre
  on public.cierres_gastos(cierre_id);

create index if not exists idx_cierres_gastos_empresa
  on public.cierres_gastos(empresa_id);

alter table public.cierres_gastos enable row level security;

drop policy if exists "cierres_gastos_select" on public.cierres_gastos;
drop policy if exists "cierres_gastos_insert" on public.cierres_gastos;
drop policy if exists "cierres_gastos_update" on public.cierres_gastos;
drop policy if exists "cierres_gastos_delete" on public.cierres_gastos;

-- RLS multiempresa vía helper canónico (ver 049 desalineado con prod: prod usa el helper).
create policy "cierres_gastos_select" on public.cierres_gastos
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "cierres_gastos_insert" on public.cierres_gastos
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

create policy "cierres_gastos_update" on public.cierres_gastos
  for update to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "cierres_gastos_delete" on public.cierres_gastos
  for delete to authenticated
  using (empresa_id in (select empresas_del_usuario()));
