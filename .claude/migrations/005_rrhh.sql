-- ============================================================
-- 005_rrhh.sql — Módulo de RRHH
-- Empleados, fichas completas, fichajes, horarios, vacantes,
-- candidatos, roles de empresa y comunicados internos.
-- ============================================================

-- ─── 0. ENUMS ──────────────────────────────────────────────

do $$ begin
  create type public.empleado_estado as enum ('trabajando', 'fuera', 'descanso', 'ausente', 'vacaciones', 'baja', 'inactivo');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.fichaje_estado as enum ('completo', 'incompleto', 'incidencia', 'pendiente', 'validado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tipo_contrato as enum ('indefinido', 'temporal', 'practicas', 'obra_servicio', 'formacion', 'relevo', 'otro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tipo_jornada as enum ('completa', 'parcial', 'turno_partido', 'turno_continuo', 'fin_semana');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.vacante_estado as enum ('abierta', 'cerrada', 'pausada', 'cubierta');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.candidato_fase as enum ('recibido', 'revision', 'primera_entrevista', 'segunda_entrevista', 'prueba', 'oferta', 'contratado', 'descartado');
exception when duplicate_object then null;
end $$;

-- ─── 1. EMPLEADOS ──────────────────────────────────────────

create table if not exists public.empleados (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  nombre                text not null,
  apellidos             text not null default '',
  avatar_url            text,
  estado                public.empleado_estado not null default 'trabajando',
  departamento          text not null default '',
  puesto                text not null default '',
  email_empresa         text not null default '',
  email_personal        text not null default '',
  telefono_empresa      text not null default '',
  telefono_personal     text not null default '',
  horario_tipo          text not null default '',
  horario_semanal       numeric not null default 0,
  validador_fichajes    text,
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_empleados_empresa on public.empleados(empresa_id);
create index if not exists idx_empleados_estado  on public.empleados(empresa_id, estado);

-- ─── 2. FICHAS DE EMPLEADO (datos completos) ───────────────
-- Almacenamos los bloques complejos como JSONB para flexibilidad

create table if not exists public.fichas_empleados (
  id                    uuid primary key default gen_random_uuid(),
  empleado_id           uuid not null references public.empleados(id) on delete cascade,
  empresa_id            uuid not null references public.empresas(id) on delete cascade,

  -- Bloques de datos
  datos_personales      jsonb not null default '{}',
  -- {tipoIdentificacion, numeroIdentificacion, nacionalidad, estadoCivil, fechaNacimiento, genero, compartirCumple}
  direccion             jsonb not null default '{}',
  -- {domicilio, codigoPostal, localidad, provincia, pais}
  datos_laborales       jsonb not null default '{}',
  -- {puesto, departamento, centro, fechaAlta, estado, responsable, tipoContrato, jornada, salarioBrutoAnual, costePorHora, horarioBase}
  formacion             jsonb not null default '[]',
  habilidades           jsonb not null default '[]',
  journey               jsonb not null default '[]',
  accesos               jsonb not null default '[]',
  contratos             jsonb not null default '[]',
  documentos            jsonb not null default '[]',
  evaluaciones          jsonb not null default '[]',
  campos_personalizados jsonb not null default '{}',

  updated_at            timestamptz not null default now(),
  unique (empleado_id)
);

create index if not exists idx_fichas_empleados_empresa on public.fichas_empleados(empresa_id);

-- ─── 3. FICHAJES ───────────────────────────────────────────

create table if not exists public.fichajes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  fecha           date not null,
  hora_entrada    time,
  hora_salida     time,
  pausa_inicio    time,
  pausa_fin       time,
  horas_totales   numeric not null default 0,
  estado          public.fichaje_estado not null default 'pendiente',
  incidencia      text,
  validado_por    text,
  observaciones   text not null default '',
  departamento    text not null default '',
  centro          text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_fichajes_empresa   on public.fichajes(empresa_id);
create index if not exists idx_fichajes_empleado  on public.fichajes(empleado_id, fecha desc);
create index if not exists idx_fichajes_fecha     on public.fichajes(empresa_id, fecha desc);

-- ─── 4. HORARIOS DE EMPLEADO ───────────────────────────────

create table if not exists public.horarios_empleados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  semana_inicio   date not null,
  -- turnos como JSONB: {lunes: "10:00-18:00", martes: "Libre", ...}
  turnos          jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists idx_horarios_empleados_empresa  on public.horarios_empleados(empresa_id);
create index if not exists idx_horarios_empleados_empleado on public.horarios_empleados(empleado_id);

-- ─── 5. AUSENCIAS Y VACACIONES ─────────────────────────────

create table if not exists public.ausencias (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  tipo            text not null, -- 'vacaciones', 'baja_medica', 'asuntos_propios', etc.
  fecha_inicio    date not null,
  fecha_fin       date not null,
  dias            integer not null default 1,
  estado          text not null default 'pendiente', -- 'pendiente', 'aprobada', 'denegada'
  aprobado_por    text,
  observaciones   text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists idx_ausencias_empresa  on public.ausencias(empresa_id);
create index if not exists idx_ausencias_empleado on public.ausencias(empleado_id);

-- ─── 6. VACANTES ───────────────────────────────────────────

create table if not exists public.vacantes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  puesto          text not null,
  departamento    text not null default '',
  ubicacion       text not null default '',
  tipo_jornada    public.tipo_jornada not null default 'completa',
  tipo_contrato   public.tipo_contrato not null default 'indefinido',
  salario_min     numeric,
  salario_max     numeric,
  descripcion     text not null default '',
  requisitos      text[] not null default '{}',
  estado          public.vacante_estado not null default 'abierta',
  fecha_inicio    date,
  fecha_limite    date,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_vacantes_empresa on public.vacantes(empresa_id);

-- ─── 7. CANDIDATOS ─────────────────────────────────────────

create table if not exists public.candidatos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  vacante_id      uuid references public.vacantes(id) on delete set null,
  nombre          text not null,
  apellidos       text not null default '',
  email           text not null default '',
  telefono        text not null default '',
  origen          text not null default 'directo', -- 'infojobs', 'linkedin', 'referido', 'directo'
  fase            public.candidato_fase not null default 'recibido',
  cv_url          text,
  carta_url       text,
  puntuacion      integer,
  notas           text not null default '',
  fecha_inscripcion date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_candidatos_empresa  on public.candidatos(empresa_id);
create index if not exists idx_candidatos_vacante  on public.candidatos(vacante_id);

-- ─── 8. ROLES DE EMPRESA (puestos internos) ─────────────────

create table if not exists public.roles_empresa (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  departamento    text not null default '',
  descripcion     text not null default '',
  estado          text not null default 'activo',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_roles_empresa_empresa on public.roles_empresa(empresa_id);

-- ─── 9. COMUNICADOS INTERNOS ───────────────────────────────

create table if not exists public.comunicados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  titulo          text not null,
  cuerpo          text not null default '',
  tipo            text not null default 'general', -- 'general', 'urgente', 'departamento'
  departamentos   text[] not null default '{}', -- vacío = todos
  autor           text not null default '',
  publicado_en    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_comunicados_empresa on public.comunicados(empresa_id, publicado_en desc);

-- ─── 10. RLS ───────────────────────────────────────────────

alter table public.empleados          enable row level security;
alter table public.fichas_empleados   enable row level security;
alter table public.fichajes           enable row level security;
alter table public.horarios_empleados enable row level security;
alter table public.ausencias          enable row level security;
alter table public.vacantes           enable row level security;
alter table public.candidatos         enable row level security;
alter table public.roles_empresa      enable row level security;
alter table public.comunicados        enable row level security;

create policy "empleados_empresa" on public.empleados
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "fichas_empleados_empresa" on public.fichas_empleados
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "fichajes_empresa" on public.fichajes
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "horarios_empleados_empresa" on public.horarios_empleados
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "ausencias_empresa" on public.ausencias
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "vacantes_empresa" on public.vacantes
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "candidatos_empresa" on public.candidatos
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "roles_empresa_empresa" on public.roles_empresa
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "comunicados_empresa" on public.comunicados
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

-- ─── 11. TRIGGERS updated_at ───────────────────────────────

create trigger empleados_updated_at
  before update on public.empleados
  for each row execute function public.set_updated_at();

create trigger fichas_empleados_updated_at
  before update on public.fichas_empleados
  for each row execute function public.set_updated_at();

create trigger fichajes_updated_at
  before update on public.fichajes
  for each row execute function public.set_updated_at();

create trigger vacantes_updated_at
  before update on public.vacantes
  for each row execute function public.set_updated_at();

create trigger candidatos_updated_at
  before update on public.candidatos
  for each row execute function public.set_updated_at();
