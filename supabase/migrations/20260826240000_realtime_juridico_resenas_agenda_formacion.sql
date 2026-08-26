-- SINCRONIZACIÓN EN VIVO (5ª tanda): Jurídico, Reseñas, Agenda y Formación.
-- Idempotente y defensivo: si una tabla no existe, se salta. No toca datos ni
-- permisos: la RLS sigue decidiendo qué ve cada usuario.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'procesos_juridicos', 'documentos_juridicos',
    'resenas',
    'contactos_agenda',
    'formacion_cursos', 'formacion_lecciones', 'formacion_progreso'
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
