-- Encuestas: guardar el modelo rico completo (grupos, destinatarios, flags, mensajes)
-- en una columna config jsonb, manteniendo columnas consultables para listar/filtrar.
alter table public.encuestas
  add column if not exists descripcion text,
  add column if not exists config jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- Respuestas de empleados a encuestas internas.
create table if not exists public.encuesta_respuestas (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.encuestas(id) on delete cascade,
  empresa_id text not null,
  user_id uuid,                 -- responsable (para dedup / "una respuesta"); no se expone en analítica anónima
  empleado_id uuid,             -- null cuando la encuesta es anónima
  anonima boolean not null default false,
  respuestas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_encuesta_respuestas_encuesta on public.encuesta_respuestas (encuesta_id);
create index if not exists idx_encuesta_respuestas_user on public.encuesta_respuestas (encuesta_id, user_id);

alter table public.encuesta_respuestas enable row level security;

drop policy if exists encr_read on public.encuesta_respuestas;
create policy encr_read on public.encuesta_respuestas
  for select using (empresa_id in (select empresas_del_usuario_text()));

drop policy if exists encr_insert on public.encuesta_respuestas;
create policy encr_insert on public.encuesta_respuestas
  for insert with check (
    empresa_id in (select empresas_del_usuario_text())
    and user_id = auth.uid()
  );

drop policy if exists encr_update on public.encuesta_respuestas;
create policy encr_update on public.encuesta_respuestas
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
