-- ESCUELA — portal de alumnos (PRP-090).
--
-- El CONTENIDO (cursos, módulos y lecciones) reutiliza las tablas de formación
-- con `ambito = 'escuela'` (migración 20260908020000). Aquí se añade lo que la
-- formación de empleados no tiene:
--   · las CLASES en directo del calendario,
--   · el ALUMNO, que no es un usuario del software,
--   · su matrícula, su progreso y su acceso por código al correo.
--
-- Idempotente: se puede aplicar tantas veces como haga falta.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) CLASES en directo (el calendario del portal)
-- ─────────────────────────────────────────────────────────────────────────────
-- La hora se guarda como fecha + hora LOCALES de la empresa (igual que el
-- calendario de GoHighLevel, que rotula «Europe/Madrid»). Guardarla en UTC
-- obligaría a convertir en cada lectura y una clase de las 11:00 acabaría
-- moviéndose sola con el cambio de hora.
create table if not exists public.escuela_clases (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  titulo       text not null default '',
  descripcion  text not null default '',
  tipo         text not null default 'CLASE' check (tipo in ('CLASE','DIRECTO','TALLER','TUTORIA','OTRO')),
  fecha        date not null,
  hora_inicio  time not null default '11:00',
  hora_fin     time,
  -- Dónde se da la clase (Zoom/Meet/YouTube en directo) y dónde queda grabada.
  enlace       text,
  grabacion_url text,
  -- Miniatura propia. Si va vacía, el portal pinta una generada con la imagen
  -- de marca de la empresa (ver `MiniaturaClase`): nunca queda un hueco.
  cover        text,
  curso_id     uuid references public.formacion_cursos(id) on delete set null,
  publicado    boolean not null default true,
  orden        int not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid
);
create index if not exists idx_escuela_clases_empresa_fecha
  on public.escuela_clases (empresa_id, fecha);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) ALUMNO — identidad propia, fuera de `auth.users`
-- ─────────────────────────────────────────────────────────────────────────────
-- Un alumno NO es un usuario del software: meterlo en `auth.users` rompería el
-- modelo de acceso de empleados y le abriría una puerta al panel de gestión.
create table if not exists public.escuela_alumnos (
  id           uuid primary key default gen_random_uuid(),
  -- Empresa DUEÑA de la escuela (la matriz). Cada empresa, su ecosistema.
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  email        text not null,
  nombre       text not null default '',
  telefono     text,
  -- Empresa CLIENTE del alumno, cuando ya tiene el software contratado.
  empresa_cliente_id uuid references public.empresas(id) on delete set null,
  -- Usuario del software con el que entra sin claves desde dentro (SSO).
  usuario_id   uuid,
  -- true = ve todos los cursos publicados de la escuela (la escuela va incluida
  -- con el software). false = ve solo los cursos en los que está matriculado.
  acceso_total boolean not null default true,
  estado       text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  origen       text not null default 'ALTA_MANUAL',
  ultimo_acceso_at timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid
);
create unique index if not exists uq_escuela_alumnos_email
  on public.escuela_alumnos (empresa_id, lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Matrícula, progreso y acceso
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.escuela_matriculas (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  alumno_id  uuid not null references public.escuela_alumnos(id) on delete cascade,
  curso_id   uuid not null references public.formacion_cursos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (alumno_id, curso_id)
);

create table if not exists public.escuela_progreso (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  alumno_id     uuid not null references public.escuela_alumnos(id) on delete cascade,
  curso_id      uuid not null references public.formacion_cursos(id) on delete cascade,
  leccion_id    uuid not null references public.formacion_lecciones(id) on delete cascade,
  completada_at timestamptz not null default now(),
  unique (alumno_id, leccion_id)
);
create index if not exists idx_escuela_progreso_alumno on public.escuela_progreso (alumno_id);

-- Código de un solo uso enviado al correo. Se guarda el HASH, nunca el código.
create table if not exists public.escuela_accesos (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references public.escuela_alumnos(id) on delete cascade,
  codigo_hash text not null,
  expira_en   timestamptz not null,
  usado_at    timestamptz,
  intentos    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_escuela_accesos_alumno on public.escuela_accesos (alumno_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.escuela_clases     enable row level security;
alter table public.escuela_alumnos    enable row level security;
alter table public.escuela_matriculas enable row level security;
alter table public.escuela_progreso   enable row level security;
alter table public.escuela_accesos    enable row level security;

-- El back-office (PRODUCTO → ESCUELA) trabaja con el cliente autenticado y ve
-- solo lo de su empresa. El portal del alumno lee y escribe con service-role,
-- que no pasa por RLS, porque el alumno no tiene sesión de Supabase.
drop policy if exists ec_all on public.escuela_clases;
create policy ec_all on public.escuela_clases
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists ea_all on public.escuela_alumnos;
create policy ea_all on public.escuela_alumnos
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists em_all on public.escuela_matriculas;
create policy em_all on public.escuela_matriculas
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists ep_all on public.escuela_progreso;
create policy ep_all on public.escuela_progreso
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

-- `escuela_accesos` guarda hashes de códigos de un solo uso: NO lleva políticas
-- a propósito. Solo el servidor (service-role) la toca, igual que la tabla de
-- tokens de la gestoría.

comment on table public.escuela_clases is
  'Clases en directo de la Escuela (calendario del portal del alumno). Fecha y hora en la zona de la empresa.';
comment on table public.escuela_alumnos is
  'Alumno de la Escuela. NO es un usuario del software: entra por código al correo o por enlace desde dentro del software.';
