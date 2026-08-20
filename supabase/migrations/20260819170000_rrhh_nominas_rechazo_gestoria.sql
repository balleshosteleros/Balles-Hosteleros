-- RECHAZO DE NÓMINAS: RRHH devuelve el mes a la gestoría con las anomalías.
--
-- Hasta ahora RRHH solo podía CONFIRMAR el mes (y publicarlo al empleado). Si las
-- nóminas venían mal, no había forma de devolverlas: había que borrarlas a mano
-- una a una y avisar a la gestoría por fuera del sistema.
--
-- Flujo completo que cierra esta migración:
--   1. La gestoría sube nóminas + TC1 → mes en BORRADOR.
--   2. RRHH revisa y decide:
--        · CONFIRMAR → mes inmutable + publicado al empleado (ya existía).
--        · RECHAZAR  → RRHH redacta las anomalías (OBLIGATORIO), se borran TODAS
--          las nóminas del mes y su TC1, sale un correo a la gestoría con el
--          texto, y el enlace de subida se REABRE.
--   3. La gestoría vuelve a subir todo corregido → vuelta al punto 2, ronda +1.
--
-- El histórico de rechazos queda en `rrhh_nominas_rechazos`: qué se dijo, quién
-- lo dijo y cuándo. Es la trazabilidad del ida y vuelta con la gestoría.
--
-- Idempotente: re-ejecutable sin error.

-- ── 1. Estado de rechazo en el mes ──────────────────────────────────────────
-- Vive junto a `confirmado_en` porque son los dos desenlaces del MISMO estado:
-- un mes está en borrador, confirmado o devuelto a la gestoría.
alter table public.rrhh_nominas_mes
  add column if not exists rechazado_en     timestamptz,
  add column if not exists rechazado_por    uuid references auth.users(id),
  add column if not exists rechazo_motivo   text,
  -- Nº de entregas de la gestoría. Empieza en 1; cada rechazo la incrementa, así
  -- que "ronda 3" se lee como "es el tercer intento de la gestoría".
  add column if not exists ronda            integer not null default 1;

comment on column public.rrhh_nominas_mes.rechazado_en is
  'Fecha en que RRHH devolvió las nóminas del mes a la gestoría. Se limpia cuando la gestoría vuelve a subir.';
comment on column public.rrhh_nominas_mes.rechazo_motivo is
  'Anomalías redactadas por RRHH y enviadas a la gestoría. Obligatorio al rechazar.';
comment on column public.rrhh_nominas_mes.ronda is
  'Entrega nº N de la gestoría para este mes. Cada rechazo la sube en 1.';

-- Un mes NO puede estar confirmado y rechazado a la vez: son excluyentes.
alter table public.rrhh_nominas_mes
  drop constraint if exists rrhh_nominas_mes_estado_excluyente;
alter table public.rrhh_nominas_mes
  add constraint rrhh_nominas_mes_estado_excluyente
  check (confirmado_en is null or rechazado_en is null);

-- Rechazar sin decir por qué no sirve de nada: la gestoría no sabría qué
-- corregir. La BD lo impone, no solo la pantalla.
alter table public.rrhh_nominas_mes
  drop constraint if exists rrhh_nominas_mes_motivo_obligatorio;
alter table public.rrhh_nominas_mes
  add constraint rrhh_nominas_mes_motivo_obligatorio
  check (
    rechazado_en is null
    or (rechazo_motivo is not null and length(btrim(rechazo_motivo)) >= 10)
  );

-- ── 2. Histórico de rechazos ────────────────────────────────────────────────
-- El campo `rechazo_motivo` del mes guarda solo el ÚLTIMO. Aquí queda el rastro
-- completo del ida y vuelta, que es lo que permite ver "esto ya se les dijo".
create table if not exists public.rrhh_nominas_rechazos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  periodo      text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  ronda        integer not null,
  motivo       text not null check (length(btrim(motivo)) >= 10),
  -- Foto de lo que se devolvió: cuántas nóminas se borraron y si iba el TC1.
  nominas_borradas integer not null default 0,
  tc1_borrado      boolean not null default false,
  -- Si el correo a la gestoría salió o no (y a quién). Un fallo de envío no
  -- deshace el rechazo: el mes ya está devuelto, pero queda constancia.
  email_enviado    boolean not null default false,
  email_destino    text,
  creado_por   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

comment on table public.rrhh_nominas_rechazos is
  'Histórico de devoluciones de nóminas a la gestoría: qué anomalías se comunicaron, en qué ronda y si salió el correo.';

create index if not exists idx_rrhh_nominas_rechazos_empresa_periodo
  on public.rrhh_nominas_rechazos (empresa_id, periodo, created_at desc);

alter table public.rrhh_nominas_rechazos enable row level security;

-- Lo ve quien gestiona pagos: es información del ida y vuelta con la gestoría,
-- no del trabajador.
drop policy if exists "rrhh_nominas_rechazos_read" on public.rrhh_nominas_rechazos;
create policy "rrhh_nominas_rechazos_read" on public.rrhh_nominas_rechazos
  for select to authenticated
  using (public.user_has_empresa_access(empresa_id) and public.puede_gestionar_pagos());

drop policy if exists "rrhh_nominas_rechazos_write" on public.rrhh_nominas_rechazos;
create policy "rrhh_nominas_rechazos_write" on public.rrhh_nominas_rechazos
  for all to authenticated
  using (public.user_has_empresa_access(empresa_id) and public.puede_gestionar_pagos())
  with check (public.user_has_empresa_access(empresa_id) and public.puede_gestionar_pagos());

-- ── 3. El mes rechazado NO bloquea: es un mes vacío esperando entrega ────────
-- `mes_nominas_confirmado()` sigue siendo la única condición de inmutabilidad, y
-- el CHECK de arriba garantiza que un mes rechazado nunca está confirmado. No
-- hace falta tocar los triggers: un mes devuelto vuelve a admitir subidas, que es
-- justo lo que se busca.
