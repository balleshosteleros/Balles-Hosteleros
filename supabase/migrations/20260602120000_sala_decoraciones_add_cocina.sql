-- Añade 'cocina' al catálogo universal de decoraciones de plano.
-- Catálogo: maceta, planta_grande, pasillo, pared, puerta, escaleras,
--           barra, cocina, columna, ventana, wc.

ALTER TABLE public.sala_decoraciones
  DROP CONSTRAINT IF EXISTS sala_decoraciones_tipo_check;

ALTER TABLE public.sala_decoraciones
  ADD CONSTRAINT sala_decoraciones_tipo_check
  CHECK (tipo IN (
    'maceta',
    'planta_grande',
    'pasillo',
    'pared',
    'puerta',
    'escaleras',
    'barra',
    'cocina',
    'columna',
    'ventana',
    'wc'
  ));
