-- El NOMBRE y el TEXTO de la carta pasan de la ficha del producto a Marketing.
--
-- REGLA (Iván, 10-09-2026): ventas define lo que el producto ES (nombre real,
-- precio, alérgenos, si existe o no en la carta). Marketing define lo que el
-- cliente VE. Nada de lo que se toque en la carta digital modifica jamás la
-- ficha del producto de venta, porque eso no es tarea de marketing.
--
-- Antes el nombre comercial y la descripción se escribían en la ficha del
-- producto (`productos.carta_nombre` / `carta_texto`) y PISABAN a los de la
-- carta al pintarla: lo que se escribía en Marketing no llegaba a verse nunca.
--
-- Aquí solo se COPIAN esos textos a `carta_items`, que es donde a partir de
-- ahora mandan. Las columnas de `productos` se retiran en un paso aparte, una
-- vez comprobado que la carta sigue diciendo exactamente lo mismo.

-- Nombre comercial: solo donde el producto lo tenía puesto; el resto ya lleva
-- el nombre real del producto, copiado en su día por la sincronización.
update public.carta_items i
set nombre = trim(p.carta_nombre)
from public.productos p
where i.producto_id = p.id
  and p.carta_nombre is not null
  and trim(p.carta_nombre) <> ''
  and i.nombre is distinct from trim(p.carta_nombre);

-- Descripción de venta.
update public.carta_items i
set descripcion = trim(p.carta_texto)
from public.productos p
where i.producto_id = p.id
  and p.carta_texto is not null
  and trim(p.carta_texto) <> ''
  and i.descripcion is distinct from trim(p.carta_texto);

-- Retirada de las columnas viejas. Los textos ya están copiados arriba y la
-- carta pública se ha comprobado idéntica antes y después. Si se quedaran,
-- alguien acabaría escribiendo ahí sin que llegue a verse nunca.
alter table public.productos drop column if exists carta_nombre;
alter table public.productos drop column if exists carta_texto;
