-- PRP-057 Fase 3: a partir de esta fecha (business-day) las ventas de Ágora descuentan stock.
-- NULL = no descontar todavía (el histórico de 12 meses NO se toca).
alter table public.empresas add column if not exists stock_descuento_desde date;
comment on column public.empresas.stock_descuento_desde is
  'PRP-057: business-day desde el que las ventas descuentan stock vía kardex. NULL = desactivado.';
