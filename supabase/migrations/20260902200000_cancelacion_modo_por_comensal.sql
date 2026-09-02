-- La política de cancelación gana el mismo ajuste que ya tenía la garantía:
-- si el importe es fijo por reserva o se multiplica por comensal.
--
-- Un no-show de 8 personas no cuesta lo mismo que uno de 2, así que cobrar por
-- comensal es lo que de verdad refleja lo que pierde el restaurante.

alter table public.empresa_reservas_config
  add column if not exists cancelacion_modo text not null default 'reserva';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresa_reservas_config_cancelacion_modo_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_cancelacion_modo_chk
      check (cancelacion_modo in ('reserva', 'comensal'));
  end if;
end $$;

comment on column public.empresa_reservas_config.cancelacion_modo is
  'reserva = importe fijo; comensal = importe x nº de personas.';
