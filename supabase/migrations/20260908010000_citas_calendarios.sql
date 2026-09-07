-- ============================================================
-- 20260908010000_citas_calendarios.sql — PRP-088 (citas del embudo)
--
-- Reuniones que se reservan desde fuera: alguien llega por un embudo, elige
-- hueco y queda citado con una persona del equipo.
--
-- Añade:
--   citas_calendarios            un calendario por ESTRATEGIA (clase gratuita,
--                                consultoría…), cada uno con su duración y sus
--                                normas
--   citas_calendario_empleados   quién atiende cada calendario
--   citas_disponibilidad         franjas de cada día en que se puede reservar
--   citas                        la reunión reservada
--
-- Idempotente. No toca nada existente.
-- ============================================================

-- ─── 1. Calendarios (uno por estrategia) ─────────────────────
create table if not exists public.citas_calendarios (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references public.empresas(id) on delete cascade,
  nombre               text not null,
  descripcion          text,
  -- Cuánto dura la reunión y cada cuánto empieza un hueco. En GoHighLevel la
  -- llamada de valoración es de 1 h.
  duracion_min         integer not null default 60,
  paso_min             integer not null default 30,
  -- Colchón por delante: nadie puede reservar para dentro de diez minutos.
  antelacion_min_horas integer not null default 4,
  -- Hasta cuándo se puede reservar hacia delante.
  dias_vista           integer not null default 30,
  color                text,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_citas_calendarios_empresa
  on public.citas_calendarios(empresa_id, activo);

-- ─── 2. Quién atiende cada calendario ────────────────────────
-- Varios empleados por calendario: en el lateral de la vista se elige de quién
-- se están mirando las citas.
create table if not exists public.citas_calendario_empleados (
  calendario_id uuid not null references public.citas_calendarios(id) on delete cascade,
  empleado_id   uuid not null references public.empleados(id) on delete cascade,
  primary key (calendario_id, empleado_id)
);

-- ─── 3. Cuándo se puede reservar ─────────────────────────────
-- `empleado_id` a null = la franja vale para todo el calendario. Las horas se
-- guardan SIN zona: son horas de la empresa (`empresas.zona_horaria`), como el
-- resto del software. Guardarlas en UTC haría que un cambio de horario de
-- verano moviera la agenda sola.
create table if not exists public.citas_disponibilidad (
  id            uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references public.citas_calendarios(id) on delete cascade,
  empleado_id   uuid references public.empleados(id) on delete cascade,
  dia_semana    smallint not null check (dia_semana between 1 and 7), -- 1 = lunes
  hora_inicio   time not null,
  hora_fin      time not null,
  check (hora_fin > hora_inicio)
);

create index if not exists idx_citas_disponibilidad_calendario
  on public.citas_disponibilidad(calendario_id, dia_semana);

-- ─── 4. La cita ──────────────────────────────────────────────
do $$ begin
  create type cita_estado as enum ('CONFIRMADA', 'CANCELADA', 'REALIZADA', 'NO_ASISTE');
exception when duplicate_object then null; end $$;

create table if not exists public.citas (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  calendario_id       uuid not null references public.citas_calendarios(id) on delete cascade,
  empleado_id         uuid references public.empleados(id) on delete set null,
  -- Quien reserva es un cliente del software: la misma ficha que Producto →
  -- Clientes, para no tener dos sitios donde mirar a la misma persona.
  cliente_id          uuid references public.clientes_sala(id) on delete set null,
  inicio              timestamptz not null,
  fin                 timestamptz not null,
  estado              cita_estado not null default 'CONFIRMADA',
  -- De dónde vino: el paso del embudo que la generó.
  pagina_id           uuid references public.paginas_web(id) on delete set null,
  origen              text,
  notas               text,
  -- Espejo en Google Calendar, para poder actualizarlo o borrarlo después.
  google_event_id     text,
  google_cuenta_email text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (fin > inicio)
);

create index if not exists idx_citas_empresa_inicio on public.citas(empresa_id, inicio);
create index if not exists idx_citas_calendario     on public.citas(calendario_id, inicio);
create index if not exists idx_citas_empleado       on public.citas(empleado_id, inicio);
create index if not exists idx_citas_cliente        on public.citas(cliente_id);

-- Dos personas no pueden coger el mismo hueco con el mismo empleado. El índice
-- es la única defensa de verdad: dos reservas a la vez pasan la comprobación
-- previa las dos y sin esto quedarían las dos guardadas.
create unique index if not exists uq_citas_empleado_inicio
  on public.citas(empleado_id, inicio)
  where estado = 'CONFIRMADA' and empleado_id is not null;

-- ─── 5. RLS: por empresa, como todo lo demás ─────────────────
alter table public.citas_calendarios          enable row level security;
alter table public.citas_calendario_empleados enable row level security;
alter table public.citas_disponibilidad       enable row level security;
alter table public.citas                      enable row level security;

do $$ begin
  create policy "citas_calendarios_todo" on public.citas_calendarios
    for all to authenticated
    using (empresa_id in (select public.empresas_del_usuario()))
    with check (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "citas_todo" on public.citas
    for all to authenticated
    using (empresa_id in (select public.empresas_del_usuario()))
    with check (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;

-- Las tablas que cuelgan del calendario heredan su empresa.
do $$ begin
  create policy "citas_cal_empleados_todo" on public.citas_calendario_empleados
    for all to authenticated
    using (calendario_id in (
      select c.id from public.citas_calendarios c
      where c.empresa_id in (select public.empresas_del_usuario())))
    with check (calendario_id in (
      select c.id from public.citas_calendarios c
      where c.empresa_id in (select public.empresas_del_usuario())));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "citas_disponibilidad_todo" on public.citas_disponibilidad
    for all to authenticated
    using (calendario_id in (
      select c.id from public.citas_calendarios c
      where c.empresa_id in (select public.empresas_del_usuario())))
    with check (calendario_id in (
      select c.id from public.citas_calendarios c
      where c.empresa_id in (select public.empresas_del_usuario())));
exception when duplicate_object then null; end $$;
