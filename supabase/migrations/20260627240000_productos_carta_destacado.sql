-- Estrella destacada en carta digital, configurada desde la ficha del producto de venta.
-- Cuando un producto de venta está destacado, su plato luce una estrella dorada en la carta.
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS carta_destacado boolean NOT NULL DEFAULT false;
