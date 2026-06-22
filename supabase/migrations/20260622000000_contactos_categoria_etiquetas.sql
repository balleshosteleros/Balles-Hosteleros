-- Contactos de contabilidad: añade Categoría y Etiquetas
-- La lista (ContactosView) ya muestra y filtra por estas columnas, pero la
-- tabla no las almacenaba, por lo que siempre salían vacías y no podían
-- editarse en la ficha. Esta migración las añade de forma aditiva.
-- Idempotente: se puede ejecutar varias veces sin error.

ALTER TABLE public.contactos_contabilidad
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS etiquetas text[] NOT NULL DEFAULT '{}';
