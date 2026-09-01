-- SINCRONIZACIÓN EN VIVO: bloqueos de mesas y sus excepciones.
--
-- Un bloqueo se toca desde dos sitios a la vez: el plano de /sala/reservas
-- (bloquear/desbloquear una mesa del día) y Configuración → Bloqueos (la lista
-- de bloqueos activos). Sin realtime, quien tuviera la otra pantalla abierta
-- seguía viendo la mesa como bloqueada después de desbloquearla — justo el
-- caso de T4. Publicando ambas tablas, las dos vistas se enteran solas.
--
-- Idempotente y defensivo: si una tabla no existe, se salta. No toca datos ni
-- permisos: la RLS sigue decidiendo qué ve cada usuario.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'empresa_reservas_bloqueos',
    'empresa_reservas_bloqueos_excepciones'
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
