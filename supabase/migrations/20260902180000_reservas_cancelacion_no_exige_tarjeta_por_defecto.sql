-- Corrección: `cancelacion_activa` nació con default TRUE para no cambiar el
-- comportamiento de la política que ya existía (un texto en el correo).
--
-- Al conectarla al motor de tarjeta (PRP-082 fase 2) ese TRUE pasó a
-- significar otra cosa muy distinta: "pide tarjeta a TODA reserva". Con cero
-- condiciones configuradas, el portal mandaba a pagar a todos los clientes.
--
-- La política de tarjeta se enciende a propósito, nunca por herencia.

alter table public.empresa_reservas_config
  alter column cancelacion_activa set default false;

-- Las empresas que la tienen activa sin haberlo pedido: se apaga. Ninguna la
-- configuró (todas con 0 condiciones y el importe por defecto), así que no se
-- pierde ninguna decisión de nadie.
update public.empresa_reservas_config
set cancelacion_activa = false
where cancelacion_activa = true
  and cardinality(cancelacion_dias_semana) = 0
  and cardinality(cancelacion_fechas) = 0
  and cardinality(cancelacion_grupo_zona_ids) = 0
  and cardinality(cancelacion_mesa_ids) = 0
  and cancelacion_desde_pax = 0;

comment on column public.empresa_reservas_config.cancelacion_activa is
  'La reserva pide tarjeta de cancelación. Se enciende a propósito: activarla sin condiciones la exige en TODAS las reservas.';
