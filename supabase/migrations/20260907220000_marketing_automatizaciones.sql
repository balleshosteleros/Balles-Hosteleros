-- ============================================================
-- Marketing → Automatizaciones.
--
-- Una automatización es una frase que cualquiera entiende:
--
--   CUANDO entra una reserva → ESPERA 2 horas → MANDA un correo
--
-- Nada de diagramas ni de nodos: un disparador y una lista de pasos que se
-- recorren en orden. Es todo lo que hace falta para el 95 % de lo que un
-- restaurante quiere automatizar, y es lo único que una persona sin formación
-- técnica puede mantener sin miedo.
--
-- Dos tablas:
--   marketing_automatizaciones            → la receta (disparador + pasos)
--   marketing_automatizacion_ejecuciones  → cada vez que la receta se dispara
--
-- ── Por qué el motor va por BARRIDO y no por eventos ──────────────────────
-- Enganchar el disparador dentro de reservas/clientes obligaría a tocar el
-- módulo de sala, que es el que no puede fallar nunca. En su lugar, un cron
-- mira cada pocos minutos qué ha pasado y crea las ejecuciones que falten. La
-- automatización llega con unos minutos de retraso —irrelevante para marketing—
-- y a cambio no puede tumbar una reserva.
--
-- ── Por qué `dedupe_key` es única ────────────────────────────────────────
-- El barrido mira una ventana amplia hacia atrás (para que un cron caído no
-- pierda nada). Sin clave única, la misma reserva entraría en la misma
-- automatización en cada pasada y el cliente recibiría el mismo correo diez
-- veces. La clave es la que hace que el barrido sea repetible sin daño.
--
-- Idempotente: se puede ejecutar dos veces.
-- ============================================================

-- ─── 1. La receta ────────────────────────────────────────────
create table if not exists public.marketing_automatizaciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  nombre       text not null,
  descripcion  text,

  -- Qué la pone en marcha. Texto libre validado en código (el catálogo crece
  -- cada vez que se añade un disparador y un CHECK obligaría a migrar la BD
  -- por cada uno).
  disparador   text not null,
  -- Los ajustes del disparador: días de antelación del cumpleaños, cuántos
  -- días sin venir, a partir de qué nota se considera una valoración baja…
  disparador_config jsonb not null default '{}'::jsonb,

  -- Los pasos, en orden. Cada uno es {tipo, …}: esperar, email, whatsapp,
  -- sms, aviso (a un departamento) o solo_si (corta si no se cumple).
  pasos        jsonb not null default '[]'::jsonb,

  estado       text not null default 'Inactivo' check (estado in ('Activo','Inactivo')),

  -- Ensayo general: la automatización corre entera y deja su rastro en el
  -- historial, pero NO sale ni un correo. Se nace en pruebas a propósito —
  -- nadie debería poder escribir a 4.000 clientes con un clic sin querer.
  modo_prueba  boolean not null default true,

  -- Desde cuándo cuenta. Al activarla, lo de antes NO se dispara: si no,
  -- encender "da la bienvenida al cliente nuevo" escribiría a los 4.000
  -- clientes históricos de golpe.
  activada_at  timestamptz,

  ejecuciones_total integer not null default 0,
  ultima_ejecucion  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists idx_mkt_autom_empresa
  on public.marketing_automatizaciones (empresa_id, estado);
create index if not exists idx_mkt_autom_disparador
  on public.marketing_automatizaciones (disparador, estado);

-- ─── 2. Cada disparo ─────────────────────────────────────────
create table if not exists public.marketing_automatizacion_ejecuciones (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  automatizacion_id uuid not null
    references public.marketing_automatizaciones(id) on delete cascade,

  -- Qué la disparó: 'reserva', 'cliente' o 'resena', y su id.
  entidad_tipo     text not null,
  entidad_id       uuid,

  -- Lo que el motor necesita para escribir sin volver a consultar: nombre,
  -- email, teléfono, fecha de la reserva, permisos de marketing…
  contexto         jsonb not null default '{}'::jsonb,

  -- Por qué paso va (índice dentro de `pasos`).
  paso_actual      integer not null default 0,
  estado           text not null default 'pendiente'
    check (estado in ('pendiente','hecha','cortada','error')),
  -- Cuándo toca seguir. Una espera de dos días es, simplemente, esta fecha
  -- puesta dos días por delante.
  ejecutar_en      timestamptz not null default now(),

  -- Qué se hizo en cada paso, en cristiano, para poder enseñárselo al usuario.
  historial        jsonb not null default '[]'::jsonb,
  intentos         integer not null default 0,
  ultimo_error     text,

  -- La que impide que el barrido repita el mismo disparo.
  dedupe_key       text not null,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (automatizacion_id, dedupe_key)
);

-- El cron pide siempre lo mismo: lo pendiente que ya toca.
create index if not exists idx_mkt_autom_ejec_pendientes
  on public.marketing_automatizacion_ejecuciones (estado, ejecutar_en)
  where estado = 'pendiente';

create index if not exists idx_mkt_autom_ejec_historial
  on public.marketing_automatizacion_ejecuciones (empresa_id, created_at desc);

-- ─── 3. RLS ──────────────────────────────────────────────────
alter table public.marketing_automatizaciones      enable row level security;
alter table public.marketing_automatizacion_ejecuciones enable row level security;

drop policy if exists mkt_autom_rw on public.marketing_automatizaciones;
create policy mkt_autom_rw on public.marketing_automatizaciones
  for all
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

-- El historial se lee, no se toca a mano: lo escribe el motor con service role.
drop policy if exists mkt_autom_ejec_read on public.marketing_automatizacion_ejecuciones;
create policy mkt_autom_ejec_read on public.marketing_automatizacion_ejecuciones
  for select
  using (empresa_id in (select empresas_del_usuario()));

-- ─── 4. updated_at ───────────────────────────────────────────
create or replace function public.mkt_autom_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mkt_autom_updated on public.marketing_automatizaciones;
create trigger trg_mkt_autom_updated
  before update on public.marketing_automatizaciones
  for each row execute function public.mkt_autom_set_updated_at();

drop trigger if exists trg_mkt_autom_ejec_updated on public.marketing_automatizacion_ejecuciones;
create trigger trg_mkt_autom_ejec_updated
  before update on public.marketing_automatizacion_ejecuciones
  for each row execute function public.mkt_autom_set_updated_at();

comment on table public.marketing_automatizaciones is
  'Marketing → Automatizaciones: un disparador y una lista de pasos en orden.';
comment on table public.marketing_automatizacion_ejecuciones is
  'Cada vez que una automatización se dispara para un cliente concreto.';
