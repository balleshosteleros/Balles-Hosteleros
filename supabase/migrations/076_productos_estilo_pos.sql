-- 076_productos_estilo_pos.sql
-- Añade configuración visual por producto para el botón del POS.
-- estilo_color y estilo_imagen_url son mutuamente excluyentes (la UI fuerza
-- uno u otro), pero a nivel de DB ambos son nullable independientes.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS estilo_color text,
  ADD COLUMN IF NOT EXISTS estilo_imagen_url text;

COMMENT ON COLUMN public.productos.estilo_color IS
  'Color de fondo (hex) para el botón POS. Mutuamente excluyente con estilo_imagen_url.';
COMMENT ON COLUMN public.productos.estilo_imagen_url IS
  'URL pública (carta-fotos) de la imagen para el botón POS. Mutuamente excluyente con estilo_color.';
