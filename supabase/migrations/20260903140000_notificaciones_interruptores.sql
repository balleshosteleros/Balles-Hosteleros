-- Interruptores de notificaciones automáticas por empresa (Ajustes → Herramientas → Notificaciones).
--
-- Modelo: fila SOLO cuando se apaga algo. Ausencia de fila = activa.
-- Así una notificación nueva del software nace encendida sin tener que
-- sembrar filas en todas las empresas.
create table if not exists notificaciones_config (
  empresa_id  uuid not null references empresas(id) on delete cascade,
  tipo        text not null,
  activo      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  primary key (empresa_id, tipo)
);

comment on table notificaciones_config is
  'Interruptor on/off por tipo de notificación y empresa. Sin fila = activa.';

alter table notificaciones_config enable row level security;

drop policy if exists notificaciones_config_select on notificaciones_config;
create policy notificaciones_config_select on notificaciones_config
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists notificaciones_config_write on notificaciones_config;
create policy notificaciones_config_write on notificaciones_config
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));
