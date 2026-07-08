-- ============================================================================
-- Solicitudes de trabajo (día trabajado / horas extras) → generan un FICHAJE al
-- aprobarse, con el tramo (hora entrada–salida) indicado por el trabajador.
--
--   • solicitudes_personal.hora_inicio / hora_fin  → el TRAMO solicitado.
--   • fichajes.solicitud_id                        → vincula el fichaje generado
--                                                    a su solicitud (evita duplicar
--                                                    y permite trazar el origen).
--
-- Al aprobar una solicitud de subtipo 'dia_trabajado' se crea un fichaje NOR
-- (horas normales) y de 'horas_extras' un fichaje EXT, con ese tramo. Se valida
-- que el tramo no se solape con otro fichaje del mismo día (varios fichajes/día
-- están permitidos si no se pisan en el tiempo).
-- Idempotente: re-ejecutable sin error.
-- ============================================================================

alter table public.solicitudes_personal
  add column if not exists hora_inicio time,
  add column if not exists hora_fin    time;

comment on column public.solicitudes_personal.hora_inicio is
  'Tramo solicitado (inicio) para solicitudes de trabajo dia_trabajado/horas_extras; se materializa en el fichaje al aprobar.';
comment on column public.solicitudes_personal.hora_fin is
  'Tramo solicitado (fin) para solicitudes de trabajo dia_trabajado/horas_extras.';

alter table public.fichajes
  add column if not exists solicitud_id uuid references public.solicitudes_personal(id) on delete set null;

comment on column public.fichajes.solicitud_id is
  'Solicitud que originó este fichaje (día trabajado / horas extras aprobada). null = fichaje directo del empleado.';

-- Un fichaje por solicitud (idempotencia al aprobar/reaprobar).
create unique index if not exists fichajes_solicitud_id_uidx
  on public.fichajes (solicitud_id)
  where solicitud_id is not null;
