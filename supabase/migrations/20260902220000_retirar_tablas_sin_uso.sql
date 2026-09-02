-- Retirar de en medio 6 tablas que no usa nadie.
--
-- NO se borran: se RENOMBRAN a `zz_borrar_<nombre>`. Así desaparecen de la
-- vista sin perder nada, y si algo dependiera de ellas —cosa que no parece—
-- se recuperan al instante con un rename inverso. Pasado un tiempo prudencial
-- sin incidencias, se tiran de verdad con un DROP.
--
-- Antes de tocarlas se comprobó, una por una, que:
--   · ninguna otra tabla las apunta por clave foránea,
--   · no tienen disparadores,
--   · ninguna vista ni función de la base de datos las nombra,
--   · no aparecen en el código del software (ni siquiera anidadas dentro de
--     otra consulta, que es como se leía `actualizaciones_juridicas` — esa NO
--     entra aquí: sí se usa, la lee el módulo Jurídico).
--
-- Contenido en el momento de retirarlas:
--   costes_judiciales, facturas_etiquetas, lineas_factura,
--   movimientos_banco, transacciones_etiquetas ... vacías (0 filas)
--   audit_log ................................. 2 filas, ambas de pruebas
--                                               automáticas (correos
--                                               @example.com), sin dato real
--
-- Idempotente: se puede volver a lanzar sin error.

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'audit_log',
    'costes_judiciales',
    'facturas_etiquetas',
    'lineas_factura',
    'movimientos_banco',
    'transacciones_etiquetas'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    -- Solo si sigue existiendo con su nombre original y el destino está libre.
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'zz_borrar_' || t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', t, 'zz_borrar_' || t);
      RAISE NOTICE 'Retirada: % -> zz_borrar_%', t, t;
    END IF;
  END LOOP;
END $$;

-- Deja escrito en la propia base de datos por qué están así, para quien las
-- encuentre dentro de unos meses.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname LIKE 'zz_borrar_%' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'COMMENT ON TABLE public.%I IS %L', t,
      'Retirada el 2026-09-02 por no usarla nadie (sin claves foráneas, ' ||
      'sin disparadores, sin uso en el código). Renombrada en vez de borrada ' ||
      'para poder recuperarla. Si sigue sin hacer falta, se puede borrar.'
    );
  END LOOP;
END $$;
