-- SOLICITUDES DE MATERIAL: pedir uno NUEVO o DEVOLVER el que ya se tiene.
--
-- Hasta ahora una solicitud de entrega solo podia significar una cosa: «dame
-- una camiseta». Faltaba el camino de vuelta —«esta camiseta ya no sirve»—, que
-- solo podia arrancar RRHH desde el modulo Entregas, aunque quien ve la prenda
-- rota es el trabajador.
--
-- Dos modalidades:
--   nuevo       → como hasta hoy: elige del catalogo y al aprobar se crea la entrega.
--   devolucion  → elige una pieza QUE YA TIENE y dice por que la devuelve:
--                   desgaste      (se ha roto o esta gastada)
--                   tallaje       (no es su talla)
--                   baja_contrato (se marcha y devuelve el material)
--
-- LA FOTO ES OBLIGATORIA EN LAS TRES, y solo en devoluciones: es la prueba del
-- estado de la prenda. Sin foto no hay devolucion, asi que va en el CHECK y no
-- solo en el formulario.

-- Bucket privado de las fotos. Se leen SIEMPRE con URL firmada desde servidor.
INSERT INTO storage.buckets (id, name, public)
VALUES ('entregas-fotos', 'entregas-fotos', false)
ON CONFLICT (id) DO NOTHING;

-- ─── La solicitud ───────────────────────────────────────────

ALTER TABLE public.solicitudes_personal
  -- Las solicitudes de entrega que ya existen son todas de material nuevo.
  ADD COLUMN IF NOT EXISTS entrega_modalidad text NOT NULL DEFAULT 'nuevo',
  ADD COLUMN IF NOT EXISTS entrega_devolucion_motivo text,
  ADD COLUMN IF NOT EXISTS entrega_foto_path text,
  -- Que pieza concreta devuelve. Es una entrega suya ya firmada.
  ADD COLUMN IF NOT EXISTS entrega_origen_id uuid
    REFERENCES public.entregas_material(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.solicitudes_personal.entrega_modalidad IS
  'Solicitudes de entrega: nuevo (pide material) | devolucion (devuelve el suyo).';
COMMENT ON COLUMN public.solicitudes_personal.entrega_devolucion_motivo IS
  'Por que lo devuelve: desgaste | tallaje | baja_contrato. NULL si es material nuevo.';
COMMENT ON COLUMN public.solicitudes_personal.entrega_foto_path IS
  'Foto de la prenda en el bucket entregas-fotos. Obligatoria en toda devolucion.';
COMMENT ON COLUMN public.solicitudes_personal.entrega_origen_id IS
  'Entrega que se devuelve. Solo en las devoluciones.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitudes_personal_entrega_modalidad_chk'
  ) THEN
    ALTER TABLE public.solicitudes_personal
      ADD CONSTRAINT solicitudes_personal_entrega_modalidad_chk
      CHECK (entrega_modalidad IN ('nuevo', 'devolucion'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitudes_personal_devolucion_motivo_chk'
  ) THEN
    ALTER TABLE public.solicitudes_personal
      ADD CONSTRAINT solicitudes_personal_devolucion_motivo_chk
      CHECK (
        entrega_devolucion_motivo IS NULL
        OR entrega_devolucion_motivo IN ('desgaste', 'tallaje', 'baja_contrato')
      );
  END IF;

  -- Una devolucion sin pieza, sin motivo o SIN FOTO no se puede guardar.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitudes_personal_devolucion_completa_chk'
  ) THEN
    ALTER TABLE public.solicitudes_personal
      ADD CONSTRAINT solicitudes_personal_devolucion_completa_chk
      CHECK (
        entrega_modalidad <> 'devolucion'
        OR (
          entrega_origen_id IS NOT NULL
          AND entrega_devolucion_motivo IS NOT NULL
          AND entrega_foto_path IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idxfk_solicitudes_personal_entrega_origen
  ON public.solicitudes_personal (entrega_origen_id);

-- ─── La entrega ─────────────────────────────────────────────
-- La foto se copia aqui en cuanto el trabajador la manda, para que el modulo
-- Entregas pueda enseñarla en la fila de la pieza sin ir a buscar la solicitud.

ALTER TABLE public.entregas_material
  ADD COLUMN IF NOT EXISTS devolucion_foto_path text,
  ADD COLUMN IF NOT EXISTS devolucion_motivo_trabajador text,
  ADD COLUMN IF NOT EXISTS devolucion_solicitud_id uuid
    REFERENCES public.solicitudes_personal(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.entregas_material.devolucion_foto_path IS
  'Foto que subio el trabajador al pedir la devolucion (bucket entregas-fotos).';
COMMENT ON COLUMN public.entregas_material.devolucion_motivo_trabajador IS
  'Motivo que dio el trabajador: desgaste | tallaje | baja_contrato.';
COMMENT ON COLUMN public.entregas_material.devolucion_solicitud_id IS
  'Solicitud del trabajador que pidio esta devolucion.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entregas_material_devolucion_motivo_trab_chk'
  ) THEN
    ALTER TABLE public.entregas_material
      ADD CONSTRAINT entregas_material_devolucion_motivo_trab_chk
      CHECK (
        devolucion_motivo_trabajador IS NULL
        OR devolucion_motivo_trabajador IN ('desgaste', 'tallaje', 'baja_contrato')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idxfk_entregas_material_devolucion_solicitud
  ON public.entregas_material (devolucion_solicitud_id);
