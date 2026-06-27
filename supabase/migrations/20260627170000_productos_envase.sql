-- Envase: indicador del continente en que viene el producto (Bolsa, Caja, Saco, Botella…).
-- Columna con nombre propio (no reutilizar unidad_uso). Independiente del formato (número + medida).
alter table public.productos
  add column if not exists envase text;
