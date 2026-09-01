-- PRP-082 · La política de cancelación también se marca por reserva, igual
-- que la garantía: son independientes y pueden convivir en la misma reserva.
--
-- `cancelacion_importe` guarda el importe congelado en el momento de crearla:
-- si mañana cambia la configuración, la reserva conserva lo que se le dijo al
-- cliente en su correo.

alter table public.reservas
  add column if not exists tiene_cancelacion boolean not null default false,
  add column if not exists cancelacion_importe numeric(10,2);

create index if not exists idx_reservas_tiene_cancelacion
  on public.reservas (empresa_id, fecha)
  where tiene_cancelacion = true;

comment on column public.reservas.tiene_cancelacion is
  'La reserva lleva política de cancelación: se guarda tarjeta para cobrar si no aparece.';
comment on column public.reservas.cancelacion_importe is
  'Importe a cobrar, congelado al crear la reserva.';
