-- La hora de reparto del pedido es un RANGO entre dos horas (desde–hasta).
-- hora_entrega = inicio del rango; hora_entrega_hasta = fin del rango.
-- Se auto-rellenan desde la franja de reparto del proveedor.
alter table public.pedidos
  add column if not exists hora_entrega_hasta text;  -- 'HH:MM' (24h). Fin del rango de reparto.
