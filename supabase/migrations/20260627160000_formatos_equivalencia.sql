-- Equivalencia del formato a la medida base (p.ej. "24 Ud" = 24; "0,5 Kg" = 0,5; "5 L" = 5).
-- Necesaria para que stock e inventarios cuadren al comprar/contar en distintos formatos.
alter table public.formatos
  add column if not exists equivalencias numeric;
