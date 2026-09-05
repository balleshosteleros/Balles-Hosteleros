-- Hora PROPIA del correo de valoración.
--
-- Antes iba pegada a la hora de la reconfirmación: el mismo minuto servía para
-- las dos cosas, así que un local con la reconfirmación a media tarde no pedía
-- valoración por la mañana, y sus comensales del día anterior se quedaban sin
-- correo. Son dos envíos distintos y cada uno necesita su hora.
--
-- Por defecto 10:00, que es cuando se pide la valoración del día anterior.
alter table public.empresa_reservas_config
  add column if not exists valoracion_email_hora_envio text not null default '10:00';

comment on column public.empresa_reservas_config.valoracion_email_hora_envio is
  'Hora local de la empresa ("HH:MM") a la que sale la petición de valoración de las reservas del día anterior.';
