-- SINCRONIZACIÓN EN VIVO (6ª tanda): comunicados, vencimientos, sanciones,
-- auditorías y documentos del empleado.
-- Idempotente y defensivo: si una tabla no existe, se salta. No toca datos ni
-- permisos: la RLS sigue decidiendo qué ve cada usuario.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'comunicados',
    'vencimientos_documentos', 'revisiones', 'revisiones_historial',
    'auditorias', 'auditoria_respuestas',
    'documentos_empleado', 'firmas_documentos'
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
