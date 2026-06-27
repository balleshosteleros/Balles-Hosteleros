-- ============================================================================
-- Catálogos estándar de Logística independientes por TIPO de producto
-- (compra / venta / elaboración).
--
-- Antes eran compartidos por empresa (una sola "base" para los 3 tipos): borrar
-- o renombrar una unidad/IVA/conservación/envase/formato en compras afectaba
-- también a venta y elaboración. A partir de aquí cada tipo tiene su catálogo
-- propio e independiente.
--
-- Tablas afectadas: medidas, formatos, ivas, conservaciones, envases.
-- Migración de datos: las filas existentes pasan a tipo='compra' y se CLONAN a
-- 'venta' y 'elaboracion' para que ningún tipo pierda su catálogo actual.
-- Idempotente: se puede ejecutar varias veces sin duplicar.
-- ============================================================================

-- 1) Columna `tipo` (las filas existentes quedan como 'compra') ---------------
ALTER TABLE public.medidas        ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'compra';
ALTER TABLE public.formatos       ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'compra';
ALTER TABLE public.ivas           ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'compra';
ALTER TABLE public.conservaciones ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'compra';
ALTER TABLE public.envases        ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'compra';

-- 2) CHECK de valores válidos (idempotente) -----------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['medidas','formatos','ivas','conservaciones','envases'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_tipo_check') THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (tipo IN (''compra'',''venta'',''elaboracion''))',
        t, t || '_tipo_check'
      );
    END IF;
  END LOOP;
END $$;

-- 3) Reemplazar índices únicos para incluir `tipo` ----------------------------
--    (deben caer ANTES de clonar filas, o el código duplicado chocaría)
DROP INDEX IF EXISTS public.uniq_unidades_medida_empresa_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_medidas_empresa_tipo_codigo
  ON public.medidas (empresa_id, tipo, lower(codigo));

DROP INDEX IF EXISTS public.uniq_ivas_empresa_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ivas_empresa_tipo_codigo
  ON public.ivas (empresa_id, tipo, lower(codigo));

DROP INDEX IF EXISTS public.uniq_conservaciones_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conservaciones_empresa_tipo_nombre
  ON public.conservaciones (empresa_id, tipo, lower(nombre));

-- envases: el índice único estaba respaldado por una constraint
ALTER TABLE public.envases DROP CONSTRAINT IF EXISTS envases_empresa_id_nombre_key;
DROP INDEX IF EXISTS public.envases_empresa_id_nombre_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_envases_empresa_tipo_nombre
  ON public.envases (empresa_id, tipo, nombre);

DROP INDEX IF EXISTS public.uniq_formatos_medida_empresa_unidad_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_formatos_empresa_tipo_unidad_nombre
  ON public.formatos (empresa_id, tipo, unidad_id, lower(nombre));

-- Índices de lectura por (empresa, tipo, orden)
CREATE INDEX IF NOT EXISTS idx_medidas_empresa_tipo        ON public.medidas (empresa_id, tipo, orden);
CREATE INDEX IF NOT EXISTS idx_ivas_empresa_tipo           ON public.ivas (empresa_id, tipo, orden);
CREATE INDEX IF NOT EXISTS idx_conservaciones_empresa_tipo ON public.conservaciones (empresa_id, tipo, orden);
CREATE INDEX IF NOT EXISTS idx_envases_empresa_tipo        ON public.envases (empresa_id, tipo, orden);
CREATE INDEX IF NOT EXISTS idx_formatos_empresa_tipo       ON public.formatos (empresa_id, tipo, orden);

-- 4) Clonar el catálogo de compra a venta + elaboración -----------------------
--    Medidas
INSERT INTO public.medidas (empresa_id, codigo, label, orden, activa, tipo)
SELECT m.empresa_id, m.codigo, m.label, m.orden, m.activa, t.tipo
FROM public.medidas m
CROSS JOIN (VALUES ('venta'), ('elaboracion')) AS t(tipo)
WHERE m.tipo = 'compra'
  AND NOT EXISTS (
    SELECT 1 FROM public.medidas x
    WHERE x.empresa_id = m.empresa_id AND x.tipo = t.tipo AND lower(x.codigo) = lower(m.codigo)
  );

--    Formatos (remapeando unidad_id a la medida del mismo tipo y código)
INSERT INTO public.formatos (empresa_id, unidad_id, nombre, equivalencias, orden, activa, tipo)
SELECT f.empresa_id, tm.id, f.nombre, f.equivalencias, f.orden, f.activa, t.tipo
FROM public.formatos f
JOIN public.medidas cm ON cm.id = f.unidad_id AND cm.tipo = 'compra'
CROSS JOIN (VALUES ('venta'), ('elaboracion')) AS t(tipo)
JOIN public.medidas tm
  ON tm.empresa_id = f.empresa_id AND tm.tipo = t.tipo AND lower(tm.codigo) = lower(cm.codigo)
WHERE f.tipo = 'compra'
  AND NOT EXISTS (
    SELECT 1 FROM public.formatos xf
    WHERE xf.empresa_id = f.empresa_id AND xf.tipo = t.tipo
      AND xf.unidad_id = tm.id AND lower(xf.nombre) = lower(f.nombre)
  );

--    IVAs
INSERT INTO public.ivas (empresa_id, codigo, porcentaje, label, orden, activa, tipo)
SELECT i.empresa_id, i.codigo, i.porcentaje, i.label, i.orden, i.activa, t.tipo
FROM public.ivas i
CROSS JOIN (VALUES ('venta'), ('elaboracion')) AS t(tipo)
WHERE i.tipo = 'compra'
  AND NOT EXISTS (
    SELECT 1 FROM public.ivas x
    WHERE x.empresa_id = i.empresa_id AND x.tipo = t.tipo AND lower(x.codigo) = lower(i.codigo)
  );

--    Conservaciones
INSERT INTO public.conservaciones (empresa_id, nombre, rango_temp, orden, activa, tipo)
SELECT c.empresa_id, c.nombre, c.rango_temp, c.orden, c.activa, t.tipo
FROM public.conservaciones c
CROSS JOIN (VALUES ('venta'), ('elaboracion')) AS t(tipo)
WHERE c.tipo = 'compra'
  AND NOT EXISTS (
    SELECT 1 FROM public.conservaciones x
    WHERE x.empresa_id = c.empresa_id AND x.tipo = t.tipo AND lower(x.nombre) = lower(c.nombre)
  );

--    Envases
INSERT INTO public.envases (empresa_id, nombre, orden, activa, tipo)
SELECT e.empresa_id, e.nombre, e.orden, e.activa, t.tipo
FROM public.envases e
CROSS JOIN (VALUES ('venta'), ('elaboracion')) AS t(tipo)
WHERE e.tipo = 'compra'
  AND NOT EXISTS (
    SELECT 1 FROM public.envases x
    WHERE x.empresa_id = e.empresa_id AND x.tipo = t.tipo AND x.nombre = e.nombre
  );
