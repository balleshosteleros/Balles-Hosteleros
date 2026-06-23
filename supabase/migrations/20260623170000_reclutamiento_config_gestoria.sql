-- Ajuste propio de Reclutamiento: correo(s) de la gestoría a los que se envía el
-- alta de contrato. Standalone (no ligado a departamentos ni personas). 1 fila/empresa.
create table if not exists public.reclutamiento_config (
  empresa_id        uuid primary key references public.empresas(id) on delete cascade,
  gestoria_email    text,        -- email principal de alta de contrato
  gestoria_email_cc text,        -- segundo contacto opcional
  updated_at        timestamptz not null default now()
);

alter table public.reclutamiento_config enable row level security;

drop policy if exists reclutamiento_config_sel on public.reclutamiento_config;
create policy reclutamiento_config_sel on public.reclutamiento_config
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists reclutamiento_config_ins on public.reclutamiento_config;
create policy reclutamiento_config_ins on public.reclutamiento_config
  for insert with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists reclutamiento_config_upd on public.reclutamiento_config;
create policy reclutamiento_config_upd on public.reclutamiento_config
  for update using (empresa_id in (select empresas_del_usuario()));
