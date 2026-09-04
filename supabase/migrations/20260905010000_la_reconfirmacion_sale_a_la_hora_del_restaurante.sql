-- La reconfirmación sale a la hora del restaurante, no en UTC.
--
-- Antes la hora la fijaba el cron de Vercel, que solo entiende UTC: "las 10:00"
-- eran las 10:00 en verano y las 09:00 en invierno, porque el cambio de hora de
-- octubre movía el correo sin que nadie tocara nada.
--
-- Ahora la hora la pone la empresa y se guarda en SU hora local. El cron pasa
-- cada hora y solo dispara en la pasada que cae en esa hora según la zona
-- horaria de la empresa (empresas.config_operativa->>'zonaHoraria').
--
-- Mismo tipo y patrón que `cancelacion_reintento_hora`, que ya existía.
-- Idempotente: se puede volver a aplicar sin romper nada.

alter table empresa_reservas_config
  add column if not exists reconfirmacion_hora_envio text not null default '10:00';

comment on column empresa_reservas_config.reconfirmacion_hora_envio is
  'Hora local de la empresa ("HH:MM") a la que sale la reconfirmacion. El cron pasa varias veces al dia y solo dispara en la pasada que cae en esta hora segun la zona horaria de la empresa.';

-- Formato "HH:MM" en 24 h: el cron lo parsea y un valor suelto lo dejaria mudo.
alter table empresa_reservas_config
  drop constraint if exists empresa_reservas_config_reconfirmacion_hora_envio_chk;
alter table empresa_reservas_config
  add constraint empresa_reservas_config_reconfirmacion_hora_envio_chk
  check (reconfirmacion_hora_envio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
