-- ============================================================
-- 20260804170000_producto_proveedor_aliases.sql
-- PRP-073 Etapa C backend (TASK-221): alias por producto × proveedor.
--
-- Sustituye al alias único `productos.nombre_proveedor` (insuficiente: un
-- producto se compra a varios proveedores y un proveedor alterna referencias).
-- Reglas del PRP:
--   · Varios alias por producto/proveedor.
--   · Un alias normalizado solo puede identificar UN producto dentro del mismo
--     proveedor y empresa (unique parcial).
--   · `nombre_proveedor` queda como fallback de LECTURA una versión; el flujo
--     nuevo deja de escribirlo (TASK-222).
-- El backfill va aparte (script con informe): solo coincidencias inequívocas.
-- Idempotente.
-- ============================================================

create table if not exists public.producto_proveedor_aliases (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null,
  producto_id       uuid not null,
  proveedor_id      uuid not null,
  alias             text not null,             -- texto tal cual lo imprime el proveedor
  alias_normalizado text not null,             -- minúsculas, espacios colapsados (para casar)
  referencia        text,                      -- código de artículo del proveedor, si se conoce
  created_by        uuid,
  created_at        timestamptz not null default now()
);

-- Un alias normalizado identifica UN solo producto por proveedor y empresa.
create unique index if not exists uq_ppa_empresa_prov_alias
  on public.producto_proveedor_aliases(empresa_id, proveedor_id, alias_normalizado);

create index if not exists idx_ppa_empresa_producto
  on public.producto_proveedor_aliases(empresa_id, producto_id);
create index if not exists idx_ppa_empresa_prov
  on public.producto_proveedor_aliases(empresa_id, proveedor_id);

alter table public.producto_proveedor_aliases enable row level security;

drop policy if exists "ppa_select" on public.producto_proveedor_aliases;
drop policy if exists "ppa_insert" on public.producto_proveedor_aliases;
drop policy if exists "ppa_update" on public.producto_proveedor_aliases;
drop policy if exists "ppa_delete" on public.producto_proveedor_aliases;

create policy "ppa_select" on public.producto_proveedor_aliases
  for select to authenticated using (empresa_id in (select empresas_del_usuario()));
create policy "ppa_insert" on public.producto_proveedor_aliases
  for insert to authenticated with check (empresa_id in (select empresas_del_usuario()));
create policy "ppa_update" on public.producto_proveedor_aliases
  for update to authenticated using (empresa_id in (select empresas_del_usuario()));
create policy "ppa_delete" on public.producto_proveedor_aliases
  for delete to authenticated using (empresa_id in (select empresas_del_usuario()));
