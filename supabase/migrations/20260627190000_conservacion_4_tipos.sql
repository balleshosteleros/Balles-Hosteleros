-- Migrar el enum `producto_conservacion` a los 4 tipos reales de conservación,
-- alineándolo con el catálogo `conservaciones` (Ambiente / Refrigeración / Congelación / Caliente).
--
-- El enum tenía 3 valores legacy (Frigorífico / Congelador / Seco) que NO coincidían con
-- el catálogo que ve el usuario en la UI → era imposible guardar una conservación elegida.
--
-- ALTER TYPE ... RENAME VALUE preserva todas las filas existentes (PG 10+). No hay datos
-- usando estos valores hoy (conservacion = NULL en todas las filas), pero el rename es
-- seguro igualmente. Idempotente: cada rename solo se aplica si el valor origen aún existe.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'producto_conservacion' AND e.enumlabel = 'Frigorífico'
  ) THEN
    ALTER TYPE producto_conservacion RENAME VALUE 'Frigorífico' TO 'Refrigeración';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'producto_conservacion' AND e.enumlabel = 'Congelador'
  ) THEN
    ALTER TYPE producto_conservacion RENAME VALUE 'Congelador' TO 'Congelación';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'producto_conservacion' AND e.enumlabel = 'Seco'
  ) THEN
    ALTER TYPE producto_conservacion RENAME VALUE 'Seco' TO 'Ambiente';
  END IF;
END $$;

-- 4º tipo: alimentos en caliente (> 65 °C). No existía en el enum legacy.
ALTER TYPE producto_conservacion ADD VALUE IF NOT EXISTS 'Caliente';
