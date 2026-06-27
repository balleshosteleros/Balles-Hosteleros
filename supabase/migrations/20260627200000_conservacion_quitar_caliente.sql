-- Eliminar definitivamente el tipo "Caliente" de la conservación (enum + catálogo).
-- Decisión de producto: "Caliente" (> 65 °C) no aplica a materias primas de compra y
-- se descarta también para cocinados. No debe existir en ningún sitio.
--
-- Postgres no permite borrar un valor suelto de un enum: hay que recrear el tipo.
-- Ningún producto usa 'Caliente' (verificado), así que el cast text→enum es seguro.
-- Idempotente: solo recrea el tipo si 'Caliente' aún figura en el enum.

DELETE FROM conservaciones WHERE nombre = 'Caliente';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'producto_conservacion' AND e.enumlabel = 'Caliente'
  ) THEN
    ALTER TYPE producto_conservacion RENAME TO producto_conservacion_old;
    CREATE TYPE producto_conservacion AS ENUM ('Ambiente', 'Refrigeración', 'Congelación');

    ALTER TABLE productos
      ALTER COLUMN conservacion TYPE producto_conservacion
      USING conservacion::text::producto_conservacion;

    -- Tabla de backup histórica (Ágora) que también referencia el enum.
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'backup_agora' AND c.relname = 'productos_bacanal_20260610'
    ) THEN
      ALTER TABLE backup_agora.productos_bacanal_20260610
        ALTER COLUMN conservacion TYPE producto_conservacion
        USING conservacion::text::producto_conservacion;
    END IF;

    DROP TYPE producto_conservacion_old;
  END IF;
END $$;
