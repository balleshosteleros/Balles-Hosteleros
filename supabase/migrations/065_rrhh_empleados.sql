-- ============================================================
-- 065_rrhh_empleados.sql
-- Tabla maestra de empleados (RRHH). Vinculada a usuarios del
-- portal vía profile_id (nullable: hay empleados sin acceso digital).
--
-- profiles.es_empleado distingue usuarios de plantilla vs externos.
-- Aquí guardamos los datos laborales y personales que NO pertenecen
-- al perfil de acceso (DNI, fecha de alta, departamento, jefe, etc.).
-- ============================================================

create table if not exists public.empleados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  profile_id      uuid references public.profiles(id) on delete set null,
  departamento_id uuid references public.departamentos(id) on delete set null,

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

  -- Datos laborales
  numero_ss       text,
  numero_empleado text,
  fecha_alta      date not null default current_date,
  fecha_baja      date,
  estado          text not null default 'Activo'
                    check (estado in ('Activo','Baja temporal','Baja definitiva','Excedencia')),
  tipo_jornada    text not null default 'Completa'
                    check (tipo_jornada in ('Completa','Parcial','Indefinida','Temporal')),
  puesto          text,

  -- Jerarquía
  jefe_directo_id uuid references public.empleados(id) on delete set null,

  -- Meta
  notas           text,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.empleados is
  'Tabla maestra RRHH. profile_id nullable: admite empleados sin acceso digital al portal.';
comment on column public.empleados.profile_id is
  'FK a profiles (usuario del portal). null = empleado de plantilla sin cuenta.';
comment on column public.empleados.jefe_directo_id is
  'FK a empleados (self-join) — supervisor directo del trabajador.';

create index if not exists idx_empleados_empresa
  on public.empleados(empresa_id);
create index if not exists idx_empleados_profile
  on public.empleados(profile_id);
create index if not exists idx_empleados_departamento
  on public.empleados(departamento_id);
create index if not exists idx_empleados_estado
  on public.empleados(empresa_id, estado);

-- ─── Trigger updated_at ───────────────────────────────────
create or replace function public.set_empleados_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists empleados_updated_at on public.empleados;
create trigger empleados_updated_at
  before update on public.empleados
  for each row execute function public.set_empleados_updated_at();

-- ─── RLS: cada usuario ve solo los empleados de su empresa ───
alter table public.empleados enable row level security;

drop policy if exists "empleados_select" on public.empleados;
create policy "empleados_select" on public.empleados
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

drop policy if exists "empleados_all" on public.empleados;
create policy "empleados_all" on public.empleados
  for all to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );
