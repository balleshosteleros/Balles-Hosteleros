-- ─────────────────────────────────────────────────────────────────────────────
-- Ficha de cliente de sala: clasificación automática + reseñas enlazadas.
--
-- 1) `resenas` gana `cliente_id` y `reserva_id`: hasta ahora el único puente
--    con el cliente era comparar teléfono/email en texto plano, y las reseñas
--    de Google no traen contacto, así que NUNCA casaban. Con FK el enlace es
--    exacto para las reseñas que pedimos nosotros por correo.
--
-- 2) `reservas.valoracion_token` + `email_valoracion_at`: el token que viaja en
--    el correo de "¿qué tal fue?" y el sello de envío (idempotencia, mismo
--    patrón que el resto de correos de reserva).
--
-- 3) `empresa_reservas_config`: umbrales de clasificación por visitas,
--    configurables por empresa.
--
-- 4) `clientes_sala.clasificacion_manual`: cuando el usuario fuerza una
--    clasificación a mano, su decisión manda sobre el cálculo automático.
--
-- Idempotente: se puede reejecutar sin efectos.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Enlace real reseña → cliente / reserva ----------------------------------
ALTER TABLE resenas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes_sala(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserva_id uuid REFERENCES reservas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS resenas_cliente_id_idx ON resenas(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS resenas_reserva_id_idx ON resenas(reserva_id) WHERE reserva_id IS NOT NULL;

-- `origen` debe admitir 'reserva': reseña pedida por correo tras la visita.
DO $$
BEGIN
  ALTER TABLE resenas DROP CONSTRAINT IF EXISTS resenas_origen_check;
  ALTER TABLE resenas ADD CONSTRAINT resenas_origen_check
    CHECK (origen IN ('manual','encuesta','qr','carta','google','reserva','otro'));
END $$;

-- 2) Token de valoración en la reserva ---------------------------------------
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS valoracion_token text,
  ADD COLUMN IF NOT EXISTS email_valoracion_at timestamptz;

-- Único global: el token resuelve la reserva por sí solo en la landing pública.
CREATE UNIQUE INDEX IF NOT EXISTS reservas_valoracion_token_key
  ON reservas(valoracion_token) WHERE valoracion_token IS NOT NULL;

-- 3) Umbrales de clasificación por empresa -----------------------------------
-- Por visitas acumuladas. Sin regla por antigüedad: INACTIVO queda como marca
-- exclusivamente manual.
ALTER TABLE empresa_reservas_config
  ADD COLUMN IF NOT EXISTS clasif_regular_min integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS clasif_frecuente_min integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS clasif_vip_min integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS valoracion_email_activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valoracion_email_horas_despues integer NOT NULL DEFAULT 24;

-- 4) Override manual de la clasificación -------------------------------------
ALTER TABLE clientes_sala
  ADD COLUMN IF NOT EXISTS clasificacion_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clientes_sala.clasificacion_manual IS
  'true = la clasificación la fijó una persona a mano y el cálculo automático por visitas no debe pisarla.';
COMMENT ON COLUMN reservas.valoracion_token IS
  'Token público del correo de solicitud de valoración. Resuelve la reserva en /r/[token].';
COMMENT ON COLUMN resenas.cliente_id IS
  'Cliente de sala que dejó la reseña. NULL en reseñas de Google (no traen contacto).';
