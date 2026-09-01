-- PRP-082 fase 1 · Las DOS políticas tienen condiciones propias.
--
-- La de cancelación gana los mismos ejes que la de garantía: así se puede
-- pedir cancelación desde 6 comensales y garantía solo en los reservados de
-- Nochevieja. Cada eje vacío no restringe.

alter table public.empresa_reservas_config
  add column if not exists cancelacion_desde_pax integer not null default 0,
  add column if not exists cancelacion_dias_semana text[] not null default '{}',
  add column if not exists cancelacion_fechas date[] not null default '{}',
  add column if not exists cancelacion_turnos text[] not null default '{}',
  add column if not exists cancelacion_hora_desde text,
  add column if not exists cancelacion_hora_hasta text,
  add column if not exists cancelacion_grupo_zona_ids uuid[] not null default '{}',
  add column if not exists cancelacion_mesa_ids uuid[] not null default '{}';

-- Plazo mínimo de aviso de la GARANTÍA: con cuánta antelación tiene que
-- cancelar el cliente para no pagar. La de cancelación ya tenía el suyo
-- (`cancelacion_horas_antes`); no tienen por qué coincidir.
alter table public.empresa_reservas_config
  add column if not exists garantia_horas_antes integer not null default 24;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresa_reservas_config_garantia_horas_antes_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_garantia_horas_antes_chk
      check (garantia_horas_antes >= 1 and garantia_horas_antes <= 168);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresa_reservas_config_cancelacion_desde_pax_chk'
  ) then
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_cancelacion_desde_pax_chk
      check (cancelacion_desde_pax >= 0 and cancelacion_desde_pax <= 200);
  end if;
end $$;

comment on column public.empresa_reservas_config.cancelacion_desde_pax is
  'Comensales a partir de los cuales se pide tarjeta de cancelación. 0 = todas.';
comment on column public.empresa_reservas_config.garantia_horas_antes is
  'Plazo mínimo de aviso para NO pagar la garantía. Horas completas.';
