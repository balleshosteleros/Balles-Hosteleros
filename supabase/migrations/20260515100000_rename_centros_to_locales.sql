-- =====================================================================
-- 20260515100000_rename_centros_to_locales.sql
-- Renombra el módulo "Centros" a "Locales" en toda la BD.
--   - Tabla centros → locales
--   - Columnas FK: empleados.centro_id → local_id, fichajes.centro_id → local_id
--   - Índices, policies y trigger
-- =====================================================================

ALTER TABLE public.centros RENAME TO locales;

ALTER TABLE public.empleados RENAME COLUMN centro_id TO local_id;
ALTER TABLE public.fichajes  RENAME COLUMN centro_id TO local_id;

ALTER INDEX IF EXISTS idx_centros_empresa            RENAME TO idx_locales_empresa;
ALTER INDEX IF EXISTS uniq_centros_empresa_nombre    RENAME TO uniq_locales_empresa_nombre;
ALTER INDEX IF EXISTS idx_empleados_centro           RENAME TO idx_empleados_local;
ALTER INDEX IF EXISTS idx_fichajes_centro            RENAME TO idx_fichajes_local;

ALTER TRIGGER trg_centros_updated_at ON public.locales RENAME TO trg_locales_updated_at;

ALTER POLICY centros_read  ON public.locales RENAME TO locales_read;
ALTER POLICY centros_write ON public.locales RENAME TO locales_write;
