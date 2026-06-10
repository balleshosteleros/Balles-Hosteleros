create table if not exists public.formacion_novedades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  tipo text not null default 'aviso',
  titulo text not null default '',
  descripcion text not null default '',
  -- "todos" (string) o array de puesto_id (jsonb). Se interpreta en la app.
  audiencia jsonb not null default '"todos"'::jsonb,
  fecha_publicacion date not null default current_date,
  autor text not null default '',
  curso_id uuid references public.formacion_cursos(id) on delete set null,
  leccion_id uuid references public.formacion_lecciones(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_formacion_novedades_emp on public.formacion_novedades (empresa_id);

alter table public.formacion_novedades enable row level security;
drop policy if exists fn_all on public.formacion_novedades;
create policy fn_all on public.formacion_novedades
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));
