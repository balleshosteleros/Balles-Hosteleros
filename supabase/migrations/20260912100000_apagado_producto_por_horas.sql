-- El apagado de un producto dura HORAS, no "hasta mañana".
--
-- CAMBIO (Iván, 12-09-2026): antes el agotado caducaba al empezar el día de
-- servicio siguiente (corte 06:00). Ahora dura un número fijo de horas —12 por
-- defecto— configurable por empresa desde Cocina → Comandas.
--
-- POR QUÉ ES MEJOR: con el corte del día, apagar algo a las 05:50 duraba diez
-- minutos y apagarlo a las 06:10 duraba casi un día entero. Un plazo en horas
-- dura lo mismo siempre, sin importar a qué hora se marque, y se entiende sin
-- explicar qué es un día de servicio.
--
-- Ya no hace falta guardar el día: basta `agotado_at` (el instante del
-- marcado), que ya se guardaba. Un producto está apagado mientras
-- `agotado_at` + las horas configuradas no haya pasado.

alter table public.cocina_alarmas_config
  add column if not exists horas_apagado_producto smallint not null default 12;

do $$
begin
  alter table public.cocina_alarmas_config
    add constraint cocina_alarmas_horas_apagado_chk
    check (horas_apagado_producto between 1 and 72);
exception
  when duplicate_object then null;
end $$;

comment on column public.cocina_alarmas_config.horas_apagado_producto is
  'Horas que dura el apagado de un producto agotado antes de volver solo a la carta y al TPV. 12 por defecto.';

-- El día de servicio deja de usarse para esto.
drop index if exists public.productos_agotado_idx;
drop index if exists public.carta_items_agotado_idx;
alter table public.productos drop column if exists agotado_dia;
alter table public.carta_items drop column if exists agotado_dia;

-- La carta pregunta "qué hay apagado ahora" por empresa en cada carga.
create index if not exists productos_agotado_at_idx
  on public.productos (empresa_id, agotado_at)
  where agotado_at is not null;
create index if not exists carta_items_agotado_at_idx
  on public.carta_items (empresa_id, agotado_at)
  where agotado_at is not null;
