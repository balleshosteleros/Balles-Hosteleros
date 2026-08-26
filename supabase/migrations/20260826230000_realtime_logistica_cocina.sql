-- SINCRONIZACIÓN EN VIVO (4ª tanda): Logística y fichas de cocina.
-- Pedidos, albaranes, inventarios, movimientos de almacén, proveedores,
-- escandallos y elaboraciones: lo que varias personas tocan a la vez en el
-- día a día. Idempotente y defensivo: si una tabla no existe, se salta.
-- No toca datos ni permisos: la RLS sigue decidiendo qué ve cada usuario.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    -- Logística
    'albaranes', 'albaran_incidencias',
    'lineas_inventario', 'stock_movimientos', 'proveedores',
    -- Cocina
    'escandallos', 'escandallo_ingredientes', 'elaboraciones'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
