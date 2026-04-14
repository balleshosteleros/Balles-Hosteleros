-- 013. Extender cronogramas_operativos para resumen + video + jerarquía
alter table public.cronogramas_operativos
  add column if not exists resumen text,
  add column if not exists video_url text,
  add column if not exists id_visible varchar(20),
  add column if not exists parent_id uuid references public.cronogramas_operativos(id) on delete cascade,
  add column if not exists orden integer default 0;

create index if not exists idx_cronogramas_parent on public.cronogramas_operativos(parent_id);
create index if not exists idx_cronogramas_rol_orden on public.cronogramas_operativos(rol, orden);
