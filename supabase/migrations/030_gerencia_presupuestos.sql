-- ============================================================
-- 030_gerencia_presupuestos.sql
-- Módulo Gerencia: Presupuestos, metas KPI, campañas.
--
-- CONEXIONES CRUZADAS:
--   - presupuestos → cuadros_mando (Dirección — comparar presupuesto vs real)
--   - metas_kpi → cuadros_mando (Dirección — seguimiento de objetivos)
--   - campañas → descuentos (Gerencia existente), productos (Logística)
--   - presupuestos → nominas (RRHH — planificación de costes de personal)
-- ============================================================

-- ─── 1. PRESUPUESTOS ───────────────────────────────────────
-- Planificación financiera por período.
-- Comparado contra cuadros_mando para calcular desviaciones.

create table if not exists public.presupuestos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  periodo         text not null,          -- 'YYYY-MM' o 'YYYY'
  tipo_periodo    text not null default 'mes'
                    check (tipo_periodo in ('mes','trimestre','anio')),
  estado          text not null default 'Borrador'
                    check (estado in ('Borrador','Aprobado','Cerrado')),
  -- Ingresos planificados
  ventas_previstas    numeric(12,2) not null default 0,
  otros_ingresos      numeric(12,2) not null default 0,
  total_ingresos      numeric(12,2) generated always as (ventas_previstas + otros_ingresos) stored,
  -- Costes planificados
  coste_mercancias    numeric(12,2) not null default 0,  -- % sobre ventas típico: 28-32%
  coste_personal      numeric(12,2) not null default 0,  -- % sobre ventas típico: 30-35%
  alquiler            numeric(12,2) not null default 0,
  suministros         numeric(12,2) not null default 0,
  marketing           numeric(12,2) not null default 0,
  otros_costes        numeric(12,2) not null default 0,
  total_costes        numeric(12,2) generated always as (
                        coste_mercancias + coste_personal + alquiler +
                        suministros + marketing + otros_costes
                      ) stored,
  -- Beneficio esperado
  beneficio_esperado  numeric(12,2) generated always as (
                        (ventas_previstas + otros_ingresos) -
                        (coste_mercancias + coste_personal + alquiler +
                         suministros + marketing + otros_costes)
                      ) stored,
  -- Ratios objetivo
  food_cost_obj_pct   numeric(5,2),   -- % food cost objetivo
  labor_cost_obj_pct  numeric(5,2),   -- % labor cost objetivo
  -- Meta
  aprobado_por    uuid references auth.users(id) on delete set null,
  aprobado_at     timestamptz,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, periodo, tipo_periodo)
);

create index if not exists idx_presupuestos_empresa
  on public.presupuestos(empresa_id);
create index if not exists idx_presupuestos_periodo
  on public.presupuestos(empresa_id, tipo_periodo, periodo desc);

create or replace function public.set_presupuestos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists presupuestos_updated_at on public.presupuestos;
create trigger presupuestos_updated_at
  before update on public.presupuestos
  for each row execute function public.set_presupuestos_updated_at();

-- Enlazar cuadros_mando con presupuesto del período
alter table public.cuadros_mando
  add column if not exists presupuesto_id uuid references public.presupuestos(id) on delete set null;

comment on column public.cuadros_mando.presupuesto_id is
  'FK al presupuesto del período para calcular desviaciones en cuadro de mando';

-- ─── 2. METAS KPI ──────────────────────────────────────────
-- Objetivos cuantitativos por departamento o empresa.
-- Conecta con: departamentos (RRHH), cuadros_mando (Dirección).

create table if not exists public.metas_kpi (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  departamento_id uuid references public.departamentos(id) on delete set null,
  nombre          text not null,
  descripcion     text,
  kpi             text not null,          -- ej: 'ticket_medio', 'food_cost_pct'
  unidad          text not null default 'valor'
                    check (unidad in ('valor','porcentaje','unidades','horas')),
  periodo         text not null,
  tipo_periodo    text not null default 'mes'
                    check (tipo_periodo in ('semana','mes','trimestre','anio')),
  -- Objetivo
  valor_objetivo  numeric(12,2) not null,
  valor_minimo    numeric(12,2),          -- alerta si cae por debajo
  valor_maximo    numeric(12,2),          -- alerta si supera
  -- Resultado real (actualizado desde cuadros_mando o manualmente)
  valor_real      numeric(12,2),
  cumplimiento_pct numeric(5,2),
  estado          text not null default 'En seguimiento'
                    check (estado in ('En seguimiento','Cumplida','Incumplida','Superada')),
  responsable_id  uuid references public.empleados(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_metas_empresa
  on public.metas_kpi(empresa_id);
create index if not exists idx_metas_departamento
  on public.metas_kpi(departamento_id);

create or replace function public.set_metas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists metas_updated_at on public.metas_kpi;
create trigger metas_updated_at
  before update on public.metas_kpi
  for each row execute function public.set_metas_updated_at();

-- ─── 3. CAMPAÑAS ───────────────────────────────────────────
-- Campañas de marketing y promoción.
-- Conecta con: descuentos (Gerencia), productos (Logística — productos en campaña).

create table if not exists public.campanas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  descripcion     text,
  tipo            text not null default 'Promocion'
                    check (tipo in ('Promocion','Evento','Temporada','Fidelizacion','Redes sociales','Otro')),
  estado          text not null default 'Planificada'
                    check (estado in ('Planificada','Activa','Pausada','Finalizada','Cancelada')),
  fecha_inicio    date not null,
  fecha_fin       date,
  -- Presupuesto de campaña
  presupuesto     numeric(10,2) default 0,
  gasto_real      numeric(10,2) default 0,
  -- Resultados esperados
  objetivo_ventas numeric(12,2),
  ventas_generadas numeric(12,2) default 0,
  -- Canales
  canales         text[] default '{}',    -- ['Instagram','Email','Cartelería']
  -- Relaciones
  descuento_id    uuid references public.descuentos(id) on delete set null,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Productos incluidos en campaña
create table if not exists public.campanas_productos (
  campana_id  uuid not null references public.campanas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio_especial numeric(10,2),
  dto_pct         numeric(5,2) default 0,
  primary key (campana_id, producto_id)
);

create index if not exists idx_campanas_empresa
  on public.campanas(empresa_id);

create or replace function public.set_campanas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists campanas_updated_at on public.campanas;
create trigger campanas_updated_at
  before update on public.campanas
  for each row execute function public.set_campanas_updated_at();

-- Enriquecer comunicados con FK a campaña
alter table public.comunicados
  add column if not exists campana_id uuid references public.campanas(id) on delete set null;

comment on column public.comunicados.campana_id is
  'FK a campañas — comunicado puede ser parte de una campaña de gerencia';

-- ─── 4. RLS ────────────────────────────────────────────────

alter table public.presupuestos      enable row level security;
alter table public.metas_kpi         enable row level security;
alter table public.campanas          enable row level security;
alter table public.campanas_productos enable row level security;

-- Presupuestos
create policy "pres2_read" on public.presupuestos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pres2_manage" on public.presupuestos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Metas KPI
create policy "metas_read" on public.metas_kpi for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "metas_manage" on public.metas_kpi for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Campañas
create policy "camp_read" on public.campanas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "camp_manage" on public.campanas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Campañas-productos
create policy "cp_read" on public.campanas_productos for select to authenticated using (true);
create policy "cp_manage" on public.campanas_productos for all to authenticated
  using (true) with check (true);
