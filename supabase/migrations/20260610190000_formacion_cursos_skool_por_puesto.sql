-- Portal de Formación estilo Skool, persistido en BD (sustituye el store
-- localStorage). Curso → Secciones (temas) → Lecciones (tareas: vídeo +
-- documento adjunto + descripción). Un curso por puesto real (UNIQUE puesto_id).

create table if not exists public.formacion_cursos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  puesto_id uuid references public.puestos(id) on delete cascade,
  ambito text not null default 'general' check (ambito in ('general','puesto')),
  titulo text not null,
  descripcion text not null default '',
  cover text,
  categoria text not null default 'otros',
  orden int not null default 0,
  publicado boolean not null default true,
  fecha_publicacion date not null default current_date,
  autor text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid
);
create unique index if not exists uq_formacion_curso_puesto
  on public.formacion_cursos (puesto_id) where puesto_id is not null;

create table if not exists public.formacion_secciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  curso_id uuid not null references public.formacion_cursos(id) on delete cascade,
  titulo text not null default '',
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_formacion_secciones_curso on public.formacion_secciones (curso_id);

create table if not exists public.formacion_lecciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  curso_id uuid not null references public.formacion_cursos(id) on delete cascade,
  seccion_id uuid not null references public.formacion_secciones(id) on delete cascade,
  titulo text not null default '',
  descripcion text not null default '',
  video_url text not null default '',
  documento_path text,
  documento_nombre text,
  duracion_min int not null default 0,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_formacion_lecciones_seccion on public.formacion_lecciones (seccion_id);
create index if not exists idx_formacion_lecciones_curso on public.formacion_lecciones (curso_id);

create table if not exists public.formacion_progreso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  empresa_id uuid not null,
  curso_id uuid not null references public.formacion_cursos(id) on delete cascade,
  leccion_id uuid not null references public.formacion_lecciones(id) on delete cascade,
  completada_at timestamptz not null default now(),
  unique (user_id, leccion_id)
);
create index if not exists idx_formacion_progreso_user on public.formacion_progreso (user_id);

alter table public.formacion_cursos enable row level security;
alter table public.formacion_secciones enable row level security;
alter table public.formacion_lecciones enable row level security;
alter table public.formacion_progreso enable row level security;

drop policy if exists fc_all on public.formacion_cursos;
create policy fc_all on public.formacion_cursos
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists fs_all on public.formacion_secciones;
create policy fs_all on public.formacion_secciones
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists fl_all on public.formacion_lecciones;
create policy fl_all on public.formacion_lecciones
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists fp_own on public.formacion_progreso;
create policy fp_own on public.formacion_progreso
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('formacion-docs', 'formacion-docs', false)
on conflict (id) do nothing;
