-- ============================================================
-- 20260710140000_empresa_telefonia.sql
-- Configuración de telefonía VoIP por empresa (PRP telefonía híbrida).
--
-- UNA fila por empresa: proveedor (none/b2com_sip/sip/twilio), CallerID
-- compartido y credenciales. Las credenciales sensibles (contraseña SIP y
-- Auth Token de Twilio) se guardan CIFRADAS en columnas bytea con pgcrypto,
-- mismo patrón que public.bank_connections (PSD2).
--
-- Multi-tenant por empresa_id. RLS con helper public.empresas_del_usuario().
-- Idempotente: seguro re-ejecutar.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ─── 1. Tabla de configuración de telefonía (1 fila por empresa) ───
create table if not exists public.empresa_telefonia (
  empresa_id          uuid primary key references public.empresas(id) on delete cascade,

  proveedor           text not null default 'none'
                      check (proveedor in ('none','b2com_sip','sip','twilio')),

  -- Identidad saliente (compartida por todos los usuarios de la empresa)
  caller_id           text not null default '',
  display_name        text not null default '',

  -- Credenciales SIP (b2com_sip / sip)
  sip_server          text not null default '',   -- host o WSS, ej. wss://sip.b2com.es:7443
  sip_user            text not null default '',    -- usuario / extensión
  sip_realm           text not null default '',    -- dominio / realm
  sip_password_enc    bytea,                        -- contraseña SIP CIFRADA

  -- Credenciales Twilio
  twilio_account_sid  text not null default '',
  twilio_app_sid      text not null default '',
  twilio_auth_token_enc bytea,                      -- Auth Token CIFRADO

  -- Opciones
  grabar_llamadas     boolean not null default false,

  updated_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.empresa_telefonia is
  'Configuración VoIP por empresa. Una fila por empresa_id. Credenciales sensibles cifradas con pgcrypto (sip_password_enc, twilio_auth_token_enc).';

-- ─── 2. Trigger updated_at ──────────────────────────────────
create or replace function public.empresa_telefonia_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_empresa_telefonia_touch on public.empresa_telefonia;
create trigger trg_empresa_telefonia_touch
  before update on public.empresa_telefonia
  for each row execute function public.empresa_telefonia_touch();

-- ─── 3. RLS: solo empresas del usuario ──────────────────────
alter table public.empresa_telefonia enable row level security;

drop policy if exists empresa_telefonia_select on public.empresa_telefonia;
create policy empresa_telefonia_select on public.empresa_telefonia
  for select using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists empresa_telefonia_insert on public.empresa_telefonia;
create policy empresa_telefonia_insert on public.empresa_telefonia
  for insert with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists empresa_telefonia_update on public.empresa_telefonia;
create policy empresa_telefonia_update on public.empresa_telefonia
  for update using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists empresa_telefonia_delete on public.empresa_telefonia;
create policy empresa_telefonia_delete on public.empresa_telefonia
  for delete using (empresa_id in (select public.empresas_del_usuario()));
