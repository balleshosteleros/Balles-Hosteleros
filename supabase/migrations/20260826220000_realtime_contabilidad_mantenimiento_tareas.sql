-- SINCRONIZACIÓN EN VIVO (3ª tanda): Contabilidad, Mantenimiento y Tareas.
-- Misma forma idempotente que las tandas anteriores: solo publica tablas que
-- existen y que no estuvieran ya publicadas. No toca datos ni permisos: la RLS
-- sigue decidiendo qué ve cada usuario, también en los avisos de realtime.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    -- Contabilidad
    'facturas', 'transacciones', 'contactos_contabilidad', 'etiquetas',
    'bank_transactions',
    -- Mantenimiento
    'mantenimiento', 'mantenimiento_actualizaciones',
    -- Tareas / cronogramas
    'tareas', 'cronograma_ejecuciones'
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
