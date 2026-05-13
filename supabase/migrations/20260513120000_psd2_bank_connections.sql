-- ============================================================
-- 20260513120000_psd2_bank_connections.sql
-- Integración PSD2 (GoCardless Bank Account Data y futuros proveedores)
--
-- Self-contained: no depende de cuentas_bancarias/movimientos_banco/transacciones.
-- Multi-tenant por empresa_id. Tokens cifrados con pgcrypto.
-- Diseñado para soportar varios proveedores (gocardless, arcopay, ...) sin refactor.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ─── 1. Catálogo de proveedores PSD2 ────────────────────────
create table if not exists public.bank_providers (
  id              text primary key,
  display_name    text not null,
  api_base_url    text not null,
  default_country text not null default 'ES',
  config          jsonb not null default '{}'::jsonb,
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

insert into public.bank_providers (id, display_name, api_base_url)
values ('gocardless', 'GoCardless Bank Account Data', 'https://bankaccountdata.gocardless.com/api/v2')
on conflict (id) do nothing;

-- ─── 2. Conexiones PSD2 (un consentimiento = una requisition) ───
create table if not exists public.bank_connections (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  provider          text not null references public.bank_providers(id),
  institution_id    text not null,
  institution_name  text not null,
  institution_logo  text,
  requisition_id    text not null,
  reference         text not null,
  access_token_enc  bytea,
  refresh_token_enc bytea,
  status            text not null default 'PENDING'
                    check (status in ('PENDING','ACTIVE','REQUIRES_RECONSENT','EXPIRED','ERROR','REVOKED')),
  expires_at        timestamptz,
  last_error        text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (empresa_id, provider, requisition_id)
);

create index if not exists idx_bank_conn_empresa on public.bank_connections(empresa_id);
create index if not exists idx_bank_conn_status  on public.bank_connections(status, expires_at);

-- ─── 3. Cuentas remotas (1 connection → N accounts) ─────────
create table if not exists public.bank_accounts (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  connection_id    uuid not null references public.bank_connections(id) on delete cascade,
  provider          text not null references public.bank_providers(id),
  external_id       text not null,
  iban_hash         text,
  iban_last4        text,
  nombre            text,
  titular           text,
  moneda            text default 'EUR',
  balance           numeric(14,2),
  balance_at        timestamptz,
  last_sync_at      timestamptz,
  sync_status       text not null default 'IDLE'
                    check (sync_status in ('IDLE','SYNCING','OK','ERROR')),
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider, external_id)
);

create index if not exists idx_bank_accounts_empresa    on public.bank_accounts(empresa_id);
create index if not exists idx_bank_accounts_connection on public.bank_accounts(connection_id);

-- ─── 4. Movimientos importados ──────────────────────────────
create table if not exists public.bank_transactions (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  account_id        uuid not null references public.bank_accounts(id) on delete cascade,
  provider          text not null references public.bank_providers(id),
  provider_tx_id    text not null,
  booking_date      date not null,
  value_date        date,
  amount            numeric(14,2) not null,
  currency          text not null default 'EUR',
  descripcion       text,
  contraparte       text,
  referencia        text,
  estado            text not null default 'BOOKED' check (estado in ('BOOKED','PENDING')),
  raw               jsonb,
  created_at        timestamptz not null default now(),
  unique (account_id, provider_tx_id)
);

create index if not exists idx_bank_tx_empresa    on public.bank_transactions(empresa_id);
create index if not exists idx_bank_tx_account    on public.bank_transactions(account_id, booking_date desc);
create index if not exists idx_bank_tx_empresa_fecha on public.bank_transactions(empresa_id, booking_date desc);

-- ─── 5. Log de sincronizaciones ─────────────────────────────
create table if not exists public.bank_sync_logs (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  connection_id    uuid not null references public.bank_connections(id) on delete cascade,
  account_id       uuid references public.bank_accounts(id) on delete set null,
  tipo             text not null check (tipo in ('INITIAL','INCREMENTAL','RECONSENT','MANUAL')),
  status           text not null check (status in ('OK','PARTIAL','ERROR')),
  movimientos_new  integer not null default 0,
  movimientos_dup  integer not null default 0,
  error_message    text,
  duration_ms      integer,
  ran_at           timestamptz not null default now()
);

create index if not exists idx_sync_logs_conn on public.bank_sync_logs(connection_id, ran_at desc);

-- ─── 6. Trigger updated_at ──────────────────────────────────
create or replace function public.bank_set_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bank_conn_updated on public.bank_connections;
create trigger trg_bank_conn_updated before update on public.bank_connections
  for each row execute function public.bank_set_updated_at();

drop trigger if exists trg_bank_acc_updated on public.bank_accounts;
create trigger trg_bank_acc_updated before update on public.bank_accounts
  for each row execute function public.bank_set_updated_at();

-- ─── 7. Helpers de cifrado (clave inyectada vía set_config) ───
-- Uso server-side:
--   select set_config('app.bank_tokens_key', $env_key, true);
--   insert into bank_connections (..., access_token_enc) values (..., public.encrypt_bank_token($token));
create or replace function public.encrypt_bank_token(plain text) returns bytea
language sql
set search_path = pg_catalog, public, extensions
as $$
  select extensions.pgp_sym_encrypt(plain, current_setting('app.bank_tokens_key'));
$$;

create or replace function public.decrypt_bank_token(cipher bytea) returns text
language sql
set search_path = pg_catalog, public, extensions
as $$
  select extensions.pgp_sym_decrypt(cipher, current_setting('app.bank_tokens_key'));
$$;

revoke all on function public.encrypt_bank_token(text) from public, anon, authenticated;
revoke all on function public.decrypt_bank_token(bytea) from public, anon, authenticated;

-- ─── 8. RLS ─────────────────────────────────────────────────
alter table public.bank_providers     enable row level security;
alter table public.bank_connections   enable row level security;
alter table public.bank_accounts      enable row level security;
alter table public.bank_transactions  enable row level security;
alter table public.bank_sync_logs     enable row level security;

-- Providers: lectura abierta a usuarios autenticados
drop policy if exists "bp_read" on public.bank_providers;
create policy "bp_read" on public.bank_providers for select to authenticated using (true);

-- Helper inline: empresa_id del usuario via profiles o user_empresas
-- Connections
drop policy if exists "bc_read"   on public.bank_connections;
drop policy if exists "bc_manage" on public.bank_connections;
create policy "bc_read" on public.bank_connections for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );
create policy "bc_manage" on public.bank_connections for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

-- Accounts
drop policy if exists "ba_read"   on public.bank_accounts;
drop policy if exists "ba_manage" on public.bank_accounts;
create policy "ba_read" on public.bank_accounts for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );
create policy "ba_manage" on public.bank_accounts for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

-- Transactions
drop policy if exists "btx_read"   on public.bank_transactions;
drop policy if exists "btx_manage" on public.bank_transactions;
create policy "btx_read" on public.bank_transactions for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );
create policy "btx_manage" on public.bank_transactions for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

-- Sync logs
drop policy if exists "bsl_read" on public.bank_sync_logs;
create policy "bsl_read" on public.bank_sync_logs for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

-- ─── 9. Grants básicos ──────────────────────────────────────
grant select on public.bank_providers to authenticated;
grant select, insert, update, delete on public.bank_connections, public.bank_accounts, public.bank_transactions to authenticated;
grant select on public.bank_sync_logs to authenticated;
