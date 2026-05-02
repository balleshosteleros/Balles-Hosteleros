-- Permitir lista explícita de miembros para canales tipo "asunto".
-- Los canales tipo "departamento" siguen derivando miembros del rol/departamento
-- y por eso este array queda vacío para ellos.

alter table public.canales
  add column if not exists miembros_user_ids uuid[] not null default '{}';

-- Índice GIN para poder filtrar canales por miembro de forma eficiente
create index if not exists canales_miembros_user_ids_idx
  on public.canales using gin (miembros_user_ids);
