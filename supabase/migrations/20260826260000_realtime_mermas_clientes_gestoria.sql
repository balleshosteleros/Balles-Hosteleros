-- SINCRONIZACIÓN EN VIVO (7ª tanda): mermas, clientes de sala, canjes de
-- toques, facturas de proveedor y panel de contrataciones de gestoría.
-- Idempotente y defensivo: si una tabla no existe, se salta. No toca datos ni
-- permisos: la RLS sigue decidiendo qué ve cada usuario.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'mermas',
    'clientes_sala', 'clientes',
    'toques_canjes',
    'facturas_proveedor',
    'gestoria_contrato_tokens', 'gestoria_bajas', 'empleado_condiciones'
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
