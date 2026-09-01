-- PRP-082 fase 2 · Estado de la tarjeta en cada reserva.
--
-- NO se guarda ningún dato de tarjeta: solo el identificador que devuelve
-- Revolut (con el que se cobra) y los cuatro últimos dígitos, que sirven para
-- que el camarero la identifique por teléfono pero no permiten cobrar nada.

alter table public.reservas
  -- GARANTÍA: dinero retenido a la espera de capturarse o soltarse.
  add column if not exists garantia_revolut_order_id text,
  add column if not exists garantia_estado text,
  add column if not exists garantia_capture_deadline timestamptz,
  add column if not exists garantia_retenida_at timestamptz,
  add column if not exists garantia_cobrada_at timestamptz,
  add column if not exists garantia_cobrada_por uuid references public.usuarios(id) on delete set null,
  add column if not exists garantia_tarjeta_ultimos4 text,
  add column if not exists garantia_tarjeta_marca text,
  -- CANCELACIÓN: tarjeta guardada para cobrar más tarde.
  add column if not exists cancelacion_revolut_order_id text,
  add column if not exists cancelacion_estado text,
  add column if not exists cancelacion_guardada_at timestamptz,
  add column if not exists cancelacion_cobrada_at timestamptz,
  add column if not exists cancelacion_cobrada_por uuid references public.usuarios(id) on delete set null,
  add column if not exists cancelacion_tarjeta_ultimos4 text,
  add column if not exists cancelacion_tarjeta_marca text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservas_garantia_estado_chk') then
    alter table public.reservas add constraint reservas_garantia_estado_chk
      check (garantia_estado is null or garantia_estado in
        ('pendiente','retenida','cobrada','liberada','caducada','fallida'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservas_cancelacion_estado_chk') then
    alter table public.reservas add constraint reservas_cancelacion_estado_chk
      check (cancelacion_estado is null or cancelacion_estado in
        ('pendiente','guardada','cobrada','liberada','fallida'));
  end if;
end $$;

-- Una orden de Revolut pertenece a UNA sola reserva: si dos reservas
-- apuntaran a la misma, un cobro afectaría a la que no toca.
create unique index if not exists reservas_garantia_revolut_order_idx
  on public.reservas (garantia_revolut_order_id)
  where garantia_revolut_order_id is not null;
create unique index if not exists reservas_cancelacion_revolut_order_idx
  on public.reservas (cancelacion_revolut_order_id)
  where cancelacion_revolut_order_id is not null;

comment on column public.reservas.garantia_revolut_order_id is
  'Identificador de la retención en Revolut. Con él se captura o se libera.';
comment on column public.reservas.garantia_capture_deadline is
  'Hasta cuándo deja Revolut capturar. Lo dice la tarjeta del cliente, no nosotros.';
comment on column public.reservas.garantia_tarjeta_ultimos4 is
  'Solo para identificar la tarjeta al hablar con el cliente. No permite cobrar.';
