-- PRP-082 fase 3 · Cobro desde la ficha.
--
-- Cobrar una GARANTÍA captura dinero ya retenido: casi nunca falla.
-- Cobrar una CANCELACIÓN va contra una tarjeta guardada, y sí puede fallar
-- por falta de fondos. Por eso solo la cancelación lleva reintentos.

alter table public.reservas
  add column if not exists cancelacion_error text,
  add column if not exists cancelacion_intentos integer not null default 0,
  add column if not exists cancelacion_ultimo_intento_at timestamptz,
  -- NULL = no se reintenta más (cobrado, agotado o se rindieron).
  add column if not exists cancelacion_proximo_intento_at timestamptz,
  -- Decisión humana: alguien miró el aviso y eligió no cobrar.
  add column if not exists cobro_perdonado_at timestamptz,
  add column if not exists cobro_perdonado_por uuid references public.usuarios(id) on delete set null,
  -- Por qué procedía cobrar: no_show | cancelacion_fuera_plazo.
  add column if not exists cobro_motivo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservas_cobro_motivo_chk') then
    alter table public.reservas add constraint reservas_cobro_motivo_chk
      check (cobro_motivo is null or cobro_motivo in ('no_show', 'cancelacion_fuera_plazo'));
  end if;
end $$;

-- El cron de reintentos busca por aquí: solo las que tocan hoy.
create index if not exists idx_reservas_cobro_pendiente
  on public.reservas (cancelacion_proximo_intento_at)
  where cancelacion_proximo_intento_at is not null;

-- Ajustes de los reintentos, por empresa.
alter table public.empresa_reservas_config
  add column if not exists cancelacion_reintento_activo boolean not null default true,
  add column if not exists cancelacion_reintentos_max integer not null default 5,
  add column if not exists cancelacion_reintento_hora text not null default '10:00';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'empresa_reservas_config_reintentos_max_chk'
  ) then
    -- Tope duro: insistir contra la tarjeta de quien no paga acaba en disputa
    -- bancaria, y las redes penalizan al comercio que abusa de los reintentos.
    alter table public.empresa_reservas_config
      add constraint empresa_reservas_config_reintentos_max_chk
      check (cancelacion_reintentos_max >= 1 and cancelacion_reintentos_max <= 10);
  end if;
end $$;

comment on column public.reservas.cancelacion_proximo_intento_at is
  'Cuándo se vuelve a intentar el cobro. NULL = no se reintenta más.';
comment on column public.reservas.cobro_perdonado_at is
  'Alguien decidió no cobrar pudiendo hacerlo. Queda registrado quién y cuándo.';
