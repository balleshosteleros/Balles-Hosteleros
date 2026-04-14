-- ============================================================
-- 026_rrhh_empleados.sql
-- Módulo RRHH: Tabla maestra de empleados, departamentos, puestos,
--              contratos, nóminas, vacaciones y evaluaciones.
--
-- NOTA: profiles es la tabla de auth (acceso al sistema).
--       empleados es la tabla maestra de RRHH (incluye trabajadores
--       sin acceso digital). Se vinculan por profile_id nullable.
-- ============================================================

-- ─── 1. DEPARTAMENTOS ──────────────────────────────────────
-- Áreas funcionales del restaurante (Cocina, Sala, Bar, Admin…)
-- Referenciado desde RRHH, Dirección y permisos.

create table if not exists public.departamentos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  color         text default '#6366f1',
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create index if not exists idx_departamentos_empresa
  on public.departamentos(empresa_id);

create or replace function public.set_departamentos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists departamentos_updated_at on public.departamentos;
create trigger departamentos_updated_at
  before update on public.departamentos
  for each row execute function public.set_departamentos_updated_at();

-- ─── 2. PUESTOS DE TRABAJO ─────────────────────────────────
-- Roles laborales: Cocinero, Camarero, Jefe de Partida, etc.
-- Conecta RRHH con Dirección (asignación de turnos por puesto).

create table if not exists public.puestos_trabajo (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  departamento_id uuid references public.departamentos(id) on delete set null,
  nombre          text not null,
  descripcion     text,
  salario_base    numeric(10,2),
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create index if not exists idx_puestos_empresa
  on public.puestos_trabajo(empresa_id);
create index if not exists idx_puestos_departamento
  on public.puestos_trabajo(departamento_id);

create or replace function public.set_puestos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists puestos_updated_at on public.puestos_trabajo;
create trigger puestos_updated_at
  before update on public.puestos_trabajo
  for each row execute function public.set_puestos_updated_at();

-- ─── 3. EMPLEADOS (tabla maestra RRHH) ────────────────────
-- Trabajadores del restaurante. profile_id es nullable:
--   - Sin profile_id = empleado sin acceso al sistema.
--   - Con profile_id = empleado que también puede iniciar sesión.
-- Referenciado desde: contratos, nóminas, vacaciones, ausencias,
--   fichajes, evaluaciones, produccion_diaria.

create table if not exists public.empleados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  profile_id      uuid references public.profiles(user_id) on delete set null,
  departamento_id uuid references public.departamentos(id) on delete set null,
  puesto_id       uuid references public.puestos_trabajo(id) on delete set null,
  -- Datos personales
  nombre          text not null,
  apellidos       text,
  dni_nie         text,
  fecha_nacimiento date,
  nacionalidad    text default 'Española',
  -- Contacto
  telefono        text,
  email_personal  text,
  email_empresa   text,
  direccion       text,
  -- Laborales
  numero_ss       text,
  numero_empleado text,
  fecha_alta      date not null default current_date,
  fecha_baja      date,
  estado          text not null default 'Activo'
                    check (estado in ('Activo','Baja temporal','Baja definitiva','Excedencia')),
  tipo_jornada    text not null default 'Completa'
                    check (tipo_jornada in ('Completa','Parcial','Indefinida','Temporal')),
  -- Jefe directo
  jefe_directo_id uuid references public.empleados(id) on delete set null,
  -- Meta
  notas           text,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_empleados_empresa
  on public.empleados(empresa_id);
create index if not exists idx_empleados_perfil
  on public.empleados(profile_id);
create index if not exists idx_empleados_departamento
  on public.empleados(departamento_id);
create index if not exists idx_empleados_estado
  on public.empleados(empresa_id, estado);

create or replace function public.set_empleados_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists empleados_updated_at on public.empleados;
create trigger empleados_updated_at
  before update on public.empleados
  for each row execute function public.set_empleados_updated_at();

comment on table public.empleados is
  'Tabla maestra RRHH. profile_id nullable: empleados sin acceso digital admitidos.';
comment on column public.empleados.jefe_directo_id is
  'FK a empleados (self-join) — quién supervisa a este trabajador';

-- ─── 4. CONTRATOS ──────────────────────────────────────────
-- Historial contractual de cada empleado.
-- Conecta con: RRHH (empleados), Contabilidad (costes laborales).

create table if not exists public.contratos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  tipo            text not null default 'Indefinido'
                    check (tipo in ('Indefinido','Temporal','Por obra','Formacion','Practicas','Relevo')),
  fecha_inicio    date not null,
  fecha_fin       date,
  salario_bruto   numeric(10,2) not null,
  jornada_horas   numeric(4,1) not null default 40,
  grupo_cotizacion text,
  categoria_profesional text,
  convenio        text,
  estado          text not null default 'Vigente'
                    check (estado in ('Vigente','Finalizado','Rescindido','Prorrogado')),
  documento_url   text,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_contratos_empleado
  on public.contratos(empleado_id);
create index if not exists idx_contratos_empresa
  on public.contratos(empresa_id);

create or replace function public.set_contratos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists contratos_updated_at on public.contratos;
create trigger contratos_updated_at
  before update on public.contratos
  for each row execute function public.set_contratos_updated_at();

-- ─── 5. NÓMINAS ────────────────────────────────────────────
-- Registro mensual de nómina por empleado.
-- Conecta con: RRHH (empleados, contratos), Contabilidad (transacciones).

create table if not exists public.nominas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  contrato_id     uuid references public.contratos(id) on delete set null,
  periodo         text not null,           -- 'YYYY-MM'
  fecha_pago      date,
  -- Devengos
  salario_base    numeric(10,2) not null default 0,
  complementos    numeric(10,2) not null default 0,
  horas_extra     numeric(10,2) not null default 0,
  otros_devengos  numeric(10,2) not null default 0,
  total_devengado numeric(10,2) not null default 0,
  -- Deducciones
  seg_social_empleado numeric(10,2) not null default 0,
  irpf_pct        numeric(4,2) not null default 0,
  irpf_importe    numeric(10,2) not null default 0,
  otras_deducciones numeric(10,2) not null default 0,
  total_deducciones numeric(10,2) not null default 0,
  -- Neto
  liquido_percibir numeric(10,2) not null default 0,
  -- Coste empresa
  seg_social_empresa numeric(10,2) not null default 0,
  coste_total_empresa numeric(10,2) not null default 0,
  -- Estado
  estado          text not null default 'Borrador'
                    check (estado in ('Borrador','Revisada','Pagada','Reclamada')),
  documento_url   text,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empleado_id, periodo)
);

create index if not exists idx_nominas_empleado
  on public.nominas(empleado_id);
create index if not exists idx_nominas_empresa_periodo
  on public.nominas(empresa_id, periodo);

create or replace function public.set_nominas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists nominas_updated_at on public.nominas;
create trigger nominas_updated_at
  before update on public.nominas
  for each row execute function public.set_nominas_updated_at();

-- ─── 6. VACACIONES ─────────────────────────────────────────
-- Control de días de vacaciones y permisos retribuidos.
-- Diferente de ausencias (imprevistos) — estas son planificadas.
-- Conecta con: RRHH, Dirección (planificación de personal).

create table if not exists public.vacaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  anio            integer not null default extract(year from current_date)::integer,
  tipo            text not null default 'Vacaciones'
                    check (tipo in ('Vacaciones','Permiso retribuido','Asuntos propios','Compensacion horas')),
  fecha_inicio    date not null,
  fecha_fin       date not null,
  dias_habiles    integer not null default 1,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','Aprobada','Denegada','Anulada')),
  aprobado_por    uuid references public.empleados(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create index if not exists idx_vacaciones_empleado
  on public.vacaciones(empleado_id);
create index if not exists idx_vacaciones_empresa_anio
  on public.vacaciones(empresa_id, anio);

create or replace function public.set_vacaciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists vacaciones_updated_at on public.vacaciones;
create trigger vacaciones_updated_at
  before update on public.vacaciones
  for each row execute function public.set_vacaciones_updated_at();

-- ─── 7. EVALUACIONES ───────────────────────────────────────
-- Evaluaciones de desempeño periódicas.
-- Conecta con: RRHH (empleados), Gerencia (KPIs de personal).

create table if not exists public.evaluaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  evaluador_id    uuid references public.empleados(id) on delete set null,
  periodo         text not null,           -- 'YYYY-TN' o 'YYYY-MM'
  tipo            text not null default 'Trimestral'
                    check (tipo in ('Mensual','Trimestral','Semestral','Anual','Prueba periodo')),
  -- Puntuaciones (1-5)
  puntualidad     integer check (puntualidad between 1 and 5),
  actitud         integer check (actitud between 1 and 5),
  calidad_trabajo integer check (calidad_trabajo between 1 and 5),
  trabajo_equipo  integer check (trabajo_equipo between 1 and 5),
  iniciativa      integer check (iniciativa between 1 and 5),
  puntuacion_media numeric(3,2),
  -- Texto
  puntos_fuertes  text,
  areas_mejora    text,
  objetivos_siguiente text,
  comentarios     text,
  -- Estado
  estado          text not null default 'Borrador'
                    check (estado in ('Borrador','Completada','Firmada')),
  fecha_evaluacion date default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_evaluaciones_empleado
  on public.evaluaciones(empleado_id);
create index if not exists idx_evaluaciones_empresa
  on public.evaluaciones(empresa_id);

create or replace function public.set_evaluaciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists evaluaciones_updated_at on public.evaluaciones;
create trigger evaluaciones_updated_at
  before update on public.evaluaciones
  for each row execute function public.set_evaluaciones_updated_at();

-- ─── 8. RLS ────────────────────────────────────────────────

alter table public.departamentos     enable row level security;
alter table public.puestos_trabajo   enable row level security;
alter table public.empleados         enable row level security;
alter table public.contratos         enable row level security;
alter table public.nominas           enable row level security;
alter table public.vacaciones        enable row level security;
alter table public.evaluaciones      enable row level security;

-- Departamentos
create policy "dep_read" on public.departamentos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "dep_manage" on public.departamentos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Puestos
create policy "puesto_read" on public.puestos_trabajo for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "puesto_manage" on public.puestos_trabajo for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Empleados
create policy "emp_read" on public.empleados for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "emp_manage" on public.empleados for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Contratos (solo admin/director/responsable)
create policy "cont_read" on public.contratos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "cont_manage" on public.contratos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Nóminas
create policy "nom_read" on public.nominas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "nom_manage" on public.nominas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Vacaciones
create policy "vac_read" on public.vacaciones for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "vac_manage" on public.vacaciones for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Evaluaciones
create policy "eval_read" on public.evaluaciones for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "eval_manage" on public.evaluaciones for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 9. VISTA: resumen_personal ────────────────────────────
-- Vista útil para cuadros de mando (Dirección) y Gerencia.

create or replace view public.resumen_personal as
select
  e.empresa_id,
  e.id                as empleado_id,
  e.nombre || ' ' || coalesce(e.apellidos, '') as nombre_completo,
  e.estado,
  e.tipo_jornada,
  d.nombre            as departamento,
  pt.nombre           as puesto,
  c.tipo              as tipo_contrato,
  c.salario_bruto,
  c.fecha_inicio      as fecha_alta_contrato,
  c.fecha_fin         as fecha_fin_contrato
from public.empleados e
left join public.departamentos d    on d.id = e.departamento_id
left join public.puestos_trabajo pt on pt.id = e.puesto_id
left join public.contratos c        on c.empleado_id = e.id
                                    and c.estado = 'Vigente'
where e.estado = 'Activo';

comment on view public.resumen_personal is
  'Vista agregada de empleados activos con su contrato vigente — usada en cuadros de mando';
