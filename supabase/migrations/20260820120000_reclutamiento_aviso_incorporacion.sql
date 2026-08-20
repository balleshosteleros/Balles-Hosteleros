-- Recordatorio de nueva incorporación al departamento de RRHH.
--
-- Cuando un candidato entra en la fase «Contratación» (alta de contrato), además
-- de los avisos técnicos del flujo de gestoría, salta un RECORDATORIO con texto
-- libre editable desde Ajustes → Reclutamiento. Es solo notificación in-app
-- (campana de RRHH); no envía correo a nadie.
--
-- Idempotente: se puede reejecutar sin efectos.

alter table public.reclutamiento_config
  add column if not exists notif_incorporacion_activo boolean not null default true;

alter table public.reclutamiento_config
  add column if not exists notif_incorporacion_titulo text not null
    default 'Nueva incorporación: {empleado}';

alter table public.reclutamiento_config
  add column if not exists notif_incorporacion_mensaje text not null
    default 'Prepara la incorporación de {empleado} para el {fecha}: uniforme, accesos, formación y presentación al equipo.';

comment on column public.reclutamiento_config.notif_incorporacion_activo is
  'Si está activo, cada alta de contrato genera un recordatorio in-app al departamento de RRHH.';
comment on column public.reclutamiento_config.notif_incorporacion_titulo is
  'Título del recordatorio de nueva incorporación. Admite {empleado}, {puesto} y {fecha}.';
comment on column public.reclutamiento_config.notif_incorporacion_mensaje is
  'Mensaje del recordatorio de nueva incorporación. Admite {empleado}, {puesto} y {fecha}.';
