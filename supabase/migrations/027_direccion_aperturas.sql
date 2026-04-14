-- ============================================================
-- 027_direccion_aperturas.sql
-- Módulo Dirección: Horarios operativos, aperturas (turnos diarios),
--                   zonas y mesas, cuadros de mando.
--
-- CONEXIONES CRUZADAS:
--   - aperturas → fichajes (RRHH), mermas (Cocina), produccion_diaria (Cocina)
--   - zonas_mesas → reservas (Sala)
--   - cuadros_mando → agora_sync_log (ventas), nominas (coste), stock (inventario)
-- ============================================================

-- ─── 1. HORARIOS OPERATIVOS ────────────────────────────────
-- Plantilla de horario del restaurante por día de semana.
-- Base para calcular personal necesario y turnos.

create table if not exists public.horarios_operativos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null default 'Horario principal',
  dia_semana    integer not null check (dia_semana between 0 and 6), -- 0=lunes, 6=domingo
  turno         text not null check (turno in ('Mañana','Tarde','Noche','Partido','Cerrado')),
  hora_apertura time,
  hora_cierre   time,
  aforo_maximo  integer,
  activo        boolean not null default true,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, nombre, dia_semana, turno)
);

create index if not exists idx_horarios_empresa
  on public.horarios_operativos(empresa_id);

create or replace function public.set_horarios_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists horarios_updated_at on public.horarios_operativos;
create trigger horarios_updated_at
  before update on public.horarios_operativos
  for each row execute function public.set_horarios_updated_at();

-- ─── 2. ZONAS Y MESAS ──────────────────────────────────────
-- Plano del restaurante: zonas (Terraza, Interior, Barra…) y mesas.
-- Referenciado desde: reservas (Sala), aperturas (asignación de personal).

create table if not exists public.zonas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  aforo       integer default 0,
  activa      boolean not null default true,
  orden       integer default 0,
  created_at  timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create table if not exists public.mesas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  zona_id     uuid references public.zonas(id) on delete set null,
  numero      text not null,
  capacidad   integer not null default 2,
  estado      text not null default 'Libre'
                check (estado in ('Libre','Ocupada','Reservada','Bloqueada')),
  activa      boolean not null default true,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (empresa_id, numero)
);

create index if not exists idx_zonas_empresa  on public.zonas(empresa_id);
create index if not exists idx_mesas_empresa  on public.mesas(empresa_id);
create index if not exists idx_mesas_zona     on public.mesas(zona_id);

create or replace function public.set_mesas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists mesas_updated_at on public.mesas;
create trigger mesas_updated_at
  before update on public.mesas
  for each row execute function public.set_mesas_updated_at();

-- Conectar reservas con mesas (FK hacia tabla existente reservas)
-- La tabla reservas ya tiene mesa text — añadir mesa_id como FK opcional
alter table public.reservas
  add column if not exists mesa_id uuid references public.mesas(id) on delete set null;

alter table public.reservas
  add column if not exists zona_id uuid references public.zonas(id) on delete set null;

-- ─── 3. APERTURAS ──────────────────────────────────────────
-- Turno real de apertura del restaurante (≠ horario teórico).
-- Cada apertura agrupa: personal asistente, ventas Ágora, mermas, producción.
-- TABLA CENTRAL de operaciones diarias.

create table if not exists public.aperturas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  fecha           date not null default current_date,
  turno           text not null check (turno in ('Mañana','Tarde','Noche','Partido')),
  estado          text not null default 'Activa'
                    check (estado in ('Activa','Cerrada','Cancelada')),
  -- Personal
  responsable_id  uuid references public.empleados(id) on delete set null,
  num_personal    integer default 0,
  -- Ventas (poblado desde Ágora sync)
  ventas_total    numeric(12,2) default 0,
  num_tickets     integer default 0,
  ticket_medio    numeric(8,2) default 0,
  comensales      integer default 0,
  -- Operativa
  hora_apertura   time,
  hora_cierre     time,
  incidencias     text,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, fecha, turno)
);

create index if not exists idx_aperturas_empresa
  on public.aperturas(empresa_id);
create index if not exists idx_aperturas_fecha
  on public.aperturas(empresa_id, fecha desc);

create or replace function public.set_aperturas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists aperturas_updated_at on public.aperturas;
create trigger aperturas_updated_at
  before update on public.aperturas
  for each row execute function public.set_aperturas_updated_at();

comment on table public.aperturas is
  'Turno real del restaurante. Agrega ventas (Ágora), personal (RRHH), mermas (Cocina) y producción.';

-- ─── 4. ASIGNACIONES DE PERSONAL POR APERTURA ──────────────
-- Qué empleados trabajaron en cada apertura.
-- Conecta Dirección con RRHH (fichajes avanzados).

create table if not exists public.apertura_empleados (
  id           uuid primary key default gen_random_uuid(),
  apertura_id  uuid not null references public.aperturas(id) on delete cascade,
  empleado_id  uuid not null references public.empleados(id) on delete cascade,
  hora_entrada time,
  hora_salida  time,
  rol_turno    text,                  -- ej: 'Jefe de partida', 'Ayudante cocina'
  observaciones text,
  unique (apertura_id, empleado_id)
);

create index if not exists idx_ap_emp_apertura  on public.apertura_empleados(apertura_id);
create index if not exists idx_ap_emp_empleado  on public.apertura_empleados(empleado_id);

-- ─── 5. CUADROS DE MANDO ───────────────────────────────────
-- KPIs diarios/semanales/mensuales por empresa.
-- Datos calculados o importados desde Ágora, nóminas, stock.

create table if not exists public.cuadros_mando (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  periodo         text not null,      -- 'YYYY-MM-DD', 'YYYY-WNN', 'YYYY-MM'
  tipo_periodo    text not null default 'dia'
                    check (tipo_periodo in ('dia','semana','mes','trimestre','anio')),
  -- Ventas
  ventas_total    numeric(12,2) default 0,
  num_tickets     integer default 0,
  ticket_medio    numeric(8,2) default 0,
  comensales      integer default 0,
  -- Costes
  coste_mercancias numeric(12,2) default 0,  -- albaranes del período
  coste_personal   numeric(12,2) default 0,  -- nóminas del período
  otros_costes     numeric(12,2) default 0,
  -- Ratios
  food_cost_pct   numeric(5,2) default 0,    -- coste_mercancias / ventas
  labor_cost_pct  numeric(5,2) default 0,    -- coste_personal / ventas
  beneficio_bruto numeric(12,2) default 0,
  margen_pct      numeric(5,2) default 0,
  -- Personal
  horas_trabajadas numeric(8,2) default 0,
  num_aperturas   integer default 0,
  -- Meta de referencia
  presupuesto_ventas numeric(12,2),
  desviacion_pct  numeric(5,2),
  -- Control
  calculado_at    timestamptz default now(),
  fuente          text default 'manual'
                    check (fuente in ('manual','agora','sistema')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, periodo, tipo_periodo)
);

create index if not exists idx_cuadros_empresa
  on public.cuadros_mando(empresa_id);
create index if not exists idx_cuadros_periodo
  on public.cuadros_mando(empresa_id, tipo_periodo, periodo desc);

create or replace function public.set_cuadros_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists cuadros_updated_at on public.cuadros_mando;
create trigger cuadros_updated_at
  before update on public.cuadros_mando
  for each row execute function public.set_cuadros_updated_at();

comment on table public.cuadros_mando is
  'KPIs agregados por período. Se calcula diariamente desde Ágora, nóminas y albaranes.';

-- ─── 6. RLS ────────────────────────────────────────────────

alter table public.horarios_operativos enable row level security;
alter table public.zonas               enable row level security;
alter table public.mesas               enable row level security;
alter table public.aperturas           enable row level security;
alter table public.apertura_empleados  enable row level security;
alter table public.cuadros_mando       enable row level security;

-- Horarios
create policy "hor_read" on public.horarios_operativos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "hor_manage" on public.horarios_operativos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Zonas
create policy "zona_read" on public.zonas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "zona_manage" on public.zonas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Mesas
create policy "mesa_read" on public.mesas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "mesa_manage" on public.mesas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Aperturas
create policy "aper_read" on public.aperturas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "aper_manage" on public.aperturas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Apertura empleados (acceso vía apertura)
create policy "apemp_read" on public.apertura_empleados for select to authenticated using (true);
create policy "apemp_manage" on public.apertura_empleados for all to authenticated
  using (true) with check (true);

-- Cuadros de mando
create policy "cmd_read" on public.cuadros_mando for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "cmd_manage" on public.cuadros_mando for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 7. FUNCIÓN: recalcular_cuadro_dia ─────────────────────
-- Calcula el cuadro de mando diario a partir de las aperturas del día.

create or replace function public.recalcular_cuadro_dia(
  p_empresa_id uuid,
  p_fecha      date default current_date
)
returns void
language plpgsql
as $$
declare
  v_ventas        numeric;
  v_tickets       integer;
  v_comensales    integer;
  v_ticket_medio  numeric;
  v_aperturas     integer;
begin
  select
    coalesce(sum(ventas_total), 0),
    coalesce(sum(num_tickets), 0),
    coalesce(sum(comensales), 0),
    count(*)
  into v_ventas, v_tickets, v_comensales, v_aperturas
  from public.aperturas
  where empresa_id = p_empresa_id
    and fecha = p_fecha
    and estado = 'Cerrada';

  v_ticket_medio := case when v_tickets > 0 then round(v_ventas / v_tickets, 2) else 0 end;

  insert into public.cuadros_mando (
    empresa_id, periodo, tipo_periodo,
    ventas_total, num_tickets, ticket_medio, comensales,
    num_aperturas, fuente
  ) values (
    p_empresa_id, p_fecha::text, 'dia',
    v_ventas, v_tickets, v_ticket_medio, v_comensales,
    v_aperturas, 'sistema'
  )
  on conflict (empresa_id, periodo, tipo_periodo) do update set
    ventas_total    = excluded.ventas_total,
    num_tickets     = excluded.num_tickets,
    ticket_medio    = excluded.ticket_medio,
    comensales      = excluded.comensales,
    num_aperturas   = excluded.num_aperturas,
    calculado_at    = now(),
    fuente          = 'sistema',
    updated_at      = now();
end;
$$;
