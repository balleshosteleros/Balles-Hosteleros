-- ============================================================================
-- Confirmación de liquidación por ENLACE de correo (empleado).
--
-- Al enviar la liquidación (rrhh_pagos.confirmacion_enviada_at), además del
-- pop-up in-app, se manda al empleado un correo con un enlace tokenizado. En
-- ese enlace (sin sesión) ve un recuadro con SUS datos del mes y un botón para
-- confirmar que es correcto. Al confirmar, se marca rrhh_pagos.confirmacion_
-- aceptada_at (mismo campo que el pop-up: los dos canales conviven, el primero
-- que confirme gana) y aparece el tick verde "Liquidada" junto a Pagar.
--
-- El enlace es por EMPLEADO + MES y de un SOLO uso lógico (una vez confirmado
-- deja de aceptar confirmaciones, aunque la pantalla sigue mostrando el detalle).
-- Mismo patrón hash-only que gestoria_contrato_tokens / nominas_gestoria_tokens:
-- solo se persiste el HMAC del token, nunca el token en claro.
-- Idempotente: re-ejecutable sin error.
-- ============================================================================

create table if not exists public.rrhh_pagos_confirmacion_tokens (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  empleado_id    uuid not null references public.empleados(id) on delete cascade,
  periodo        text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- Pago concreto que se confirma (rrhh_pagos.id) para escritura inequívoca.
  pago_id        uuid not null references public.rrhh_pagos(id) on delete cascade,
  token_hash     text not null,                       -- HMAC-SHA256 del token (PII)
  expira_en      timestamptz not null,
  enviado_en     timestamptz not null default now(),  -- correo enviado
  confirmado_en  timestamptz,                         -- el empleado confirmó por el enlace
  created_at     timestamptz not null default now(),
  -- Un único enlace vigente por empleado y mes (se regenera al reenviar).
  unique (empresa_id, empleado_id, periodo)
);

create index if not exists rrhh_pagos_confirmacion_tokens_hash_idx
  on public.rrhh_pagos_confirmacion_tokens (token_hash);
create index if not exists rrhh_pagos_confirmacion_tokens_empresa_idx
  on public.rrhh_pagos_confirmacion_tokens (empresa_id);

alter table public.rrhh_pagos_confirmacion_tokens enable row level security;

-- Solo lectura para usuarios de la empresa (la escritura va por service-role:
-- creación al enviar y confirmación desde el enlace público sin sesión).
drop policy if exists rrhh_pagos_confirmacion_tokens_sel on public.rrhh_pagos_confirmacion_tokens;
create policy rrhh_pagos_confirmacion_tokens_sel on public.rrhh_pagos_confirmacion_tokens
  for select using (empresa_id in (select empresas_del_usuario()));

comment on table public.rrhh_pagos_confirmacion_tokens is
  'Enlace tokenizado por empleado+mes para que el trabajador confirme su liquidación desde el correo; marca rrhh_pagos.confirmacion_aceptada_at.';
