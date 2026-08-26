-- SINCRONIZACIÓN EN VIVO: publica en `supabase_realtime` las tablas de los
-- módulos que varias personas tocan a la vez. Sin esto las vistas no reciben
-- aviso de los cambios y se quedan mostrando datos viejos (ver el hook
-- `useSincronizacionEnVivo`).
--
-- Idempotente: cada tabla se añade solo si no estaba ya publicada, así que se
-- puede reejecutar sin error. NO cambia datos ni permisos: la RLS sigue
-- decidiendo qué ve cada usuario, también en los avisos de realtime.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    -- Sala / Reservas
    'reservas', 'mesas',
    -- RRHH · Reclutamiento
    'candidatos', 'vacantes',
    -- RRHH · Personal
    'empleados', 'fichajes', 'rrhh_cuadrantes',
    -- Logística
    'pedidos', 'stock', 'productos', 'inventarios',
    -- Transversal
    'notificaciones'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
