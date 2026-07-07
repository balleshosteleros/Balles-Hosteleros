-- ============================================================================
-- Envío automático a la gestoría → subida de nóminas por enlace → volcado por IA.
--
-- Flujo (por EMPRESA):
--   1) Un día fijo del mes (config `nominas_gestoria_dia_envio`) el cron manda un
--      correo a la gestoría con un enlace tokenizado ÚNICO de ese mes.
--   2) La gestoría abre el enlace (sin sesión) y adjunta las nóminas (un PDF con
--      todas, o varias). La IA (Gemini) lee cada una, empareja por DNI/NIE y
--      vuelca neto/SS/IRPF + adjunta el PDF en `rrhh_pagos` de esa empresa/mes.
--   3) Se avisa a RRHH con el resumen (X guardadas, Y sin empleado).
--
-- El enlace es MULTI-USO (la gestoría puede subir varias veces / archivos) pero
-- caduca (fin del mes siguiente). Mismo patrón hash-only que gestoria_contrato_tokens.
-- Idempotente.
-- ============================================================================

-- 1) Tokens de subida de nóminas (uno por empresa+periodo) -----------------------
create table if not exists public.nominas_gestoria_tokens (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  periodo            text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  token_hash         text not null,                       -- HMAC-SHA256 del token (PII)
  expira_en          timestamptz not null,
  enviado_en         timestamptz not null default now(),  -- correo de solicitud enviado
  ultima_subida_en   timestamptz,                         -- última vez que la gestoría subió
  subidas_count      integer not null default 0,          -- nº de nóminas volcadas por el enlace
  created_at         timestamptz not null default now(),
  -- Un único enlace vigente por empresa y mes (se regenera si hace falta).
  unique (empresa_id, periodo)
);

create index if not exists nominas_gestoria_tokens_hash_idx
  on public.nominas_gestoria_tokens (token_hash);
create index if not exists nominas_gestoria_tokens_empresa_idx
  on public.nominas_gestoria_tokens (empresa_id);

alter table public.nominas_gestoria_tokens enable row level security;

-- Solo lectura para usuarios de la empresa (la escritura va por service-role:
-- enlace público de la gestoría sin sesión + cron del sistema).
drop policy if exists nominas_gestoria_tokens_sel on public.nominas_gestoria_tokens;
create policy nominas_gestoria_tokens_sel on public.nominas_gestoria_tokens
  for select using (empresa_id in (select empresas_del_usuario()));

-- 2) Config del envío a la gestoría (columnas en `empresas`, config general) ------
-- Mismo hogar que la config de liquidaciones (notif_liquidaciones_*).
alter table public.empresas
  add column if not exists nominas_gestoria_activo boolean not null default false;
alter table public.empresas
  add column if not exists nominas_gestoria_email text;
alter table public.empresas
  add column if not exists nominas_gestoria_email_cc text;
-- Día del mes (1-28) en el que sale el correo a la gestoría. Se acota a 28 para
-- que exista en todos los meses.
alter table public.empresas
  add column if not exists nominas_gestoria_dia_envio integer not null default 25
    check (nominas_gestoria_dia_envio between 1 and 28);
-- Aviso a RRHH cuando la gestoría sube nóminas por el enlace (resumen del volcado).
alter table public.empresas
  add column if not exists nominas_gestoria_notif_rrhh boolean not null default true;
-- Último periodo (AAAA-MM) para el que YA se envió el correo (evita reenvíos el
-- mismo mes desde el cron diario).
alter table public.empresas
  add column if not exists nominas_gestoria_ultimo_envio text;

comment on table public.nominas_gestoria_tokens is
  'Enlace tokenizado por empresa+mes para que la gestoría suba las nóminas; la IA las vuelca a rrhh_pagos.';
comment on column public.empresas.nominas_gestoria_dia_envio is
  'Día del mes (1-28) en el que el cron envía a la gestoría el enlace para subir las nóminas.';
