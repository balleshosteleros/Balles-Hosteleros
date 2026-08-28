-- Reservas: vinculación a un cliente existente pendiente de revisión.
--
-- Contexto: una reserva se engancha a una ficha de `clientes_sala` cuando
-- coincide el email O el teléfono normalizado (nunca por nombre: dos personas
-- que se llaman igual con móviles distintos son dos clientes distintos).
--
-- Cuando engancha pero el resto de datos NO coinciden, hasta ahora lo que
-- escribía quien reservaba se descartaba sin dejar rastro: la reserva salía a
-- nombre de la ficha y nadie sabía por qué. Estas columnas conservan ese dato
-- para que el restaurante decida (conservar / actualizar / cliente nuevo).
--
-- Idempotente: se puede ejecutar varias veces sin efecto.

-- Lo que escribió quien reservó, tal cual, cuando difiere de la ficha.
-- Forma: {"nombre":"Javier","apellidos":"Serrano","email":"javi@…","telefono":"…"}
-- Solo se guardan las claves que REALMENTE difieren.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS datos_declarados jsonb;

-- Qué dato provocó el enganche con la ficha existente: 'email' | 'telefono'.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS vinculacion_motivo text;

-- Estado de la revisión. NULL = no hay nada que revisar (caso normal).
--   PENDIENTE  → el restaurante aún no ha decidido; se ve el icono de peligro.
--   CONSERVADA → se mantuvieron los datos de la ficha; se descartó lo declarado.
--   ACTUALIZADA→ la ficha se actualizó con los datos de esta reserva.
--   SEPARADA   → era otra persona; se le creó ficha propia.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS vinculacion_estado text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservas_vinculacion_motivo_chk'
  ) THEN
    ALTER TABLE public.reservas
      ADD CONSTRAINT reservas_vinculacion_motivo_chk
      CHECK (vinculacion_motivo IS NULL OR vinculacion_motivo IN ('email', 'telefono'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservas_vinculacion_estado_chk'
  ) THEN
    ALTER TABLE public.reservas
      ADD CONSTRAINT reservas_vinculacion_estado_chk
      CHECK (vinculacion_estado IS NULL OR vinculacion_estado IN (
        'PENDIENTE', 'CONSERVADA', 'ACTUALIZADA', 'SEPARADA'
      ));
  END IF;
END $$;

-- El listado de sala pinta el icono de peligro filtrando por pendientes. Son
-- pocas filas frente al total, así que el índice va parcial.
CREATE INDEX IF NOT EXISTS reservas_vinculacion_pendiente_idx
  ON public.reservas (empresa_id, fecha)
  WHERE vinculacion_estado = 'PENDIENTE';

COMMENT ON COLUMN public.reservas.datos_declarados IS
  'Datos que indicó quien reservó cuando difieren de la ficha vinculada. Se descartan al resolver la revisión.';
COMMENT ON COLUMN public.reservas.vinculacion_motivo IS
  'Dato que provocó el enganche con la ficha existente: email | telefono.';
COMMENT ON COLUMN public.reservas.vinculacion_estado IS
  'NULL = nada que revisar. PENDIENTE | CONSERVADA | ACTUALIZADA | SEPARADA.';
