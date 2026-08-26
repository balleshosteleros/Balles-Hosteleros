-- SINCRONIZACIÓN EN VIVO (2ª tanda): Cocina y Gerencia.
-- Mismo criterio y misma forma idempotente que la tanda anterior.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    -- Cocina · Temperaturas APPCC
    'equipos_frio', 'registros_temperatura',
    -- Gerencia · Cierres
    'cierres_semanales', 'cierres_gastos'
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
