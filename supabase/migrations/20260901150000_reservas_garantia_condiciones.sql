-- Reservas · Condiciones de la política de garantía (PRP-082, fase 1)
--
-- Deciden CUÁNDO se pide garantía. Mismo patrón que las condiciones de canje
-- de los Tickets (PRP-078): cada eje vacío no restringe, y las condiciones se
-- suman (día Y personas Y zona...).
--
-- Por defecto todos los ejes están vacíos y `garantia_activa` es false, así
-- que toda reserva sigue siendo gratis hasta que alguien lo configure.

alter table public.empresa_reservas_config
  add column if not exists garantia_dias_semana text[] not null default '{}',
  add column if not exists garantia_fechas date[] not null default '{}',
  add column if not exists garantia_turnos text[] not null default '{}',
  add column if not exists garantia_hora_desde text,
  add column if not exists garantia_hora_hasta text,
  add column if not exists garantia_grupo_zona_ids uuid[] not null default '{}',
  add column if not exists garantia_mesa_ids uuid[] not null default '{}';

comment on column public.empresa_reservas_config.garantia_dias_semana is
  'Días de la semana en los que se pide garantía. Vacío = todos.';
comment on column public.empresa_reservas_config.garantia_fechas is
  'Fechas concretas en las que se pide garantía siempre. Vacío = ninguna.';
comment on column public.empresa_reservas_config.garantia_mesa_ids is
  'Mesas concretas que exigen garantía. Vacío = todas las mesas.';
