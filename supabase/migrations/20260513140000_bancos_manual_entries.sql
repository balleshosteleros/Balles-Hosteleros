-- ============================================================
-- 20260513140000_bancos_manual_entries.sql
-- Soporte para entradas de banco manuales (Efectivo, Fianza, etc.)
-- y entradas pendientes de conectar vía PSD2 (NOT_CONNECTED).
-- ============================================================

-- 1. Catálogo: provider 'manual'
insert into public.bank_providers (id, display_name, api_base_url, config)
values ('manual', 'Manual', 'manual://internal', '{"is_manual": true}'::jsonb)
on conflict (id) do nothing;

-- 2. requisition_id / reference nullables (los manuales no los tienen,
--    y los NOT_CONNECTED tampoco hasta que el usuario conecte por PSD2).
alter table public.bank_connections alter column requisition_id drop not null;
alter table public.bank_connections alter column reference drop not null;

-- 3. Status NOT_CONNECTED para entradas reales pendientes de OAuth PSD2.
alter table public.bank_connections drop constraint if exists bank_connections_status_check;
alter table public.bank_connections add constraint bank_connections_status_check
  check (status in (
    'PENDING','ACTIVE','REQUIRES_RECONSENT','EXPIRED','ERROR','REVOKED','NOT_CONNECTED'
  ));

-- 4. La unique (empresa_id, provider, requisition_id) chocaba si dos manuales
--    comparten requisition_id = null. La hacemos parcial sobre filas con requisition.
alter table public.bank_connections drop constraint if exists bank_connections_empresa_id_provider_requisition_id_key;
create unique index if not exists uq_bank_conn_req
  on public.bank_connections (empresa_id, provider, requisition_id)
  where requisition_id is not null;

-- 5. Unicidad por (empresa_id, institution_id) para idempotencia del seed.
create unique index if not exists uq_bank_conn_empresa_institution
  on public.bank_connections (empresa_id, institution_id);
