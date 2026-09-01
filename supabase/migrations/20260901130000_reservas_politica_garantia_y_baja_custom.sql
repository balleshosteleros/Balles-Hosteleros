-- Reservas · Políticas
--   1. Política de cancelación: gana interruptor de activación.
--   2. Política de garantía: nueva, importe retenido al reservar.
--   3. Baja del sistema de "políticas custom (avanzado)": nunca llegó a usarse
--      (0 filas en la tabla, 0 reservas apuntando a ella). La política general
--      configurable lo sustituye por completo.

alter table public.empresa_reservas_config
  add column if not exists cancelacion_activa boolean not null default true;

alter table public.empresa_reservas_config
  add column if not exists garantia_activa boolean not null default false,
  add column if not exists garantia_importe_eur numeric(10,2) not null default 20.00,
  add column if not exists garantia_modo text not null default 'reserva',
  add column if not exists garantia_desde_pax integer not null default 0,
  add column if not exists garantia_personalizar_mensaje boolean not null default false,
  add column if not exists garantia_mensaje_personalizado text;

-- 'reserva' = importe fijo por reserva; 'comensal' = importe x nº de personas.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresa_reservas_config_garantia_modo_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_garantia_modo_chk
      check (garantia_modo in ('reserva', 'comensal'));
  end if;
end $$;

-- garantia_desde_pax = 0 significa "todas las reservas".
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresa_reservas_config_garantia_desde_pax_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_garantia_desde_pax_chk
      check (garantia_desde_pax >= 0 and garantia_desde_pax <= 200);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresa_reservas_config_garantia_importe_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_garantia_importe_chk
      check (garantia_importe_eur >= 1.00 and garantia_importe_eur <= 9999.99);
  end if;
end $$;

alter table public.reservas drop column if exists politica_cancelacion_id;
alter table public.reservas drop column if exists politica_cancelacion_snapshot;
drop table if exists public.politicas_cancelacion;
