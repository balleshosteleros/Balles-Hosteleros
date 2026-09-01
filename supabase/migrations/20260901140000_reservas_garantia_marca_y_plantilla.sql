-- Reservas · Garantía de punta a punta
--
-- La garantía es una marca INDEPENDIENTE de `tipo_categoria`: una reserva
-- puede llevar garantía y política de cancelación a la vez (un grupo grande
-- que además se penaliza si no aparece). `garantia_importe`, que ya existía,
-- guarda el importe efectivamente retenido en ESTA reserva, congelado en el
-- momento de crearla: si mañana cambia la configuración, la reserva conserva
-- lo que se le dijo al cliente.

alter table public.reservas
  add column if not exists tiene_garantia boolean not null default false;

update public.reservas
set tiene_garantia = true
where garantia_importe is not null and garantia_importe > 0 and tiene_garantia = false;

create index if not exists idx_reservas_tiene_garantia
  on public.reservas (empresa_id, fecha)
  where tiene_garantia = true;

-- Plantilla del bloque de garantía en el correo de confirmación.
alter table public.reserva_email_plantillas
  drop constraint if exists reserva_email_plantillas_tipo_chk;

alter table public.reserva_email_plantillas
  add constraint reserva_email_plantillas_tipo_chk check (
    tipo = any (array[
      'CONFIRMACION','RECONFIRMACION','RECORDATORIO','CANCELACION',
      'POLITICA_AVISO','GARANTIA_AVISO','CUPON_PAGADO','SOLICITUD_VALORACION',
      'TICKET_COMPRA','TICKET_RESERVA'
    ])
  );
