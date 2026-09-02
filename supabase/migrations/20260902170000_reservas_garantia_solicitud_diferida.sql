-- PRP-082 fase 4 · Reservas lejanas: la tarjeta se pide después.
--
-- Una retención caduca (5 días con Visa en un restaurante), así que pedir la
-- tarjeta al reservar con un mes de antelación no sirve: el día de la reserva
-- ya no habría nada retenido. Se pide cuando falta poco.
--
-- Solo afecta a la GARANTÍA. La cancelación guarda la tarjeta sin retener
-- nada, y eso no caduca: se puede pedir en el momento de reservar.

alter table public.reservas
  add column if not exists garantia_solicitada_at timestamptz,
  add column if not exists garantia_limite_at timestamptz,
  add column if not exists garantia_cancelada_sin_tarjeta_at timestamptz;

create index if not exists idx_reservas_garantia_pendiente
  on public.reservas (fecha)
  where tiene_garantia = true and garantia_estado is null;
create index if not exists idx_reservas_garantia_limite
  on public.reservas (garantia_limite_at)
  where garantia_limite_at is not null;

alter table public.empresa_reservas_config
  -- 4 días por defecto: el caso peor son los 5 de Visa, y conviene dejar un
  -- día de margen (Revolut recomienda capturar 24 h antes del vencimiento).
  add column if not exists garantia_dias_antes integer not null default 4,
  add column if not exists garantia_horas_limite integer not null default 24,
  -- Si se apaga, la reserva NO se cancela sola: la decide una persona.
  add column if not exists garantia_cancelar_si_falta boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'empresa_reservas_config_garantia_dias_antes_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_garantia_dias_antes_chk
      check (garantia_dias_antes >= 1 and garantia_dias_antes <= 30);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'empresa_reservas_config_garantia_horas_limite_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_garantia_horas_limite_chk
      check (garantia_horas_limite >= 1 and garantia_horas_limite <= 168);
  end if;
end $$;

alter table public.reservas
  add column if not exists email_garantia_pendiente_at timestamptz,
  add column if not exists email_garantia_solicitud_at timestamptz,
  add column if not exists email_garantia_caducada_at timestamptz;

alter table public.reserva_email_plantillas
  drop constraint if exists reserva_email_plantillas_tipo_chk;
alter table public.reserva_email_plantillas
  add constraint reserva_email_plantillas_tipo_chk check (tipo in (
    'CONFIRMADA', 'RECONFIRMADA', 'NO_RECONFIRMADA', 'LISTA_ESPERA',
    'LIBERADA', 'TERMINANDO', 'NO_SHOW', 'RECORDATORIO', 'CANCELADA',
    'POLITICA_CANCELACION', 'POLITICA_GARANTIA',
    'GARANTIA_PENDIENTE', 'GARANTIA_SOLICITUD', 'GARANTIA_CADUCADA',
    'SOLICITUD_VALORACION', 'TICKET_COMPRA', 'TICKET_RESERVA'
  ));

alter table public.reserva_email_envios
  drop constraint if exists reserva_email_envios_tipo_chk;
alter table public.reserva_email_envios
  add constraint reserva_email_envios_tipo_chk check (tipo in (
    'CONFIRMADA', 'RECONFIRMADA', 'NO_RECONFIRMADA', 'LISTA_ESPERA',
    'LIBERADA', 'TERMINANDO', 'NO_SHOW', 'RECORDATORIO', 'CANCELADA',
    'POLITICA_CANCELACION', 'POLITICA_GARANTIA',
    'GARANTIA_PENDIENTE', 'GARANTIA_SOLICITUD', 'GARANTIA_CADUCADA',
    'SOLICITUD_VALORACION', 'TICKET_COMPRA', 'TICKET_RESERVA'
  ));

comment on column public.reservas.garantia_limite_at is
  'Hasta cuándo tiene el cliente para poner la tarjeta. Pasado el plazo, la reserva puede cancelarse sola.';
