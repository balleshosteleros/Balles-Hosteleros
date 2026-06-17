-- PRP-057: formato de venta de Ágora por línea (ratio = fracción del producto base
-- consumida; 0,1 = combinado, 0,2 = copa, 1 = unidad). El coste NO se toma de Ágora
-- (mal calculado); el coste/precio vive en Balles. La columna coste_unitario queda
-- disponible para rellenarla desde Balles si se quiere histórico de margen.
alter table public.pos_ticket_lineas
  add column if not exists sale_format_id integer,
  add column if not exists sale_format_nombre text,
  add column if not exists sale_format_ratio numeric not null default 1,
  add column if not exists coste_unitario numeric;
comment on column public.pos_ticket_lineas.sale_format_ratio is
  'PRP-057: SaleFormatRatio de Ágora. consumo_stock_base = cantidad * sale_format_ratio.';
