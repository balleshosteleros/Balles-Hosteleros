-- Palabra clave de cada producto de Ticket.
--
-- El nombre comercial de un ticket es una frase larga ("Cena Experiencia
-- HABANA × BACANAL (para 2 personas)"). En un listado, esa frase ocupa media
-- columna y no se lee: lo que hace falta es UNA palabra que diga de qué ticket
-- se trata de un vistazo, igual que las palabras clave de los enlaces de
-- reserva (FACEBOOK, GOOGLE, EMAIL…).
--
-- Se guarda en MAYÚSCULAS y sin espacios, y es única por empresa: dos tickets
-- de un mismo restaurante no pueden llamarse igual, o la columna dejaría de
-- identificar nada.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.reserva_ticket_productos
  ADD COLUMN IF NOT EXISTS clave TEXT;

COMMENT ON COLUMN public.reserva_ticket_productos.clave IS
  'Palabra que identifica el ticket en listados y enlaces. MAYÚSCULAS, sin espacios, única por empresa.';

-- Formato: letras (con acentos y Ñ), números, guiones. Una sola palabra.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_producto_clave_formato_chk'
  ) THEN
    ALTER TABLE public.reserva_ticket_productos
      ADD CONSTRAINT ticket_producto_clave_formato_chk
      CHECK (clave IS NULL OR clave ~ '^[A-ZÁÉÍÓÚÜÑ0-9_-]{2,24}$');
  END IF;
END $$;

-- Única por empresa, ignorando las que aún no la tienen puesta.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_producto_clave_empresa
  ON public.reserva_ticket_productos (empresa_id, clave)
  WHERE clave IS NOT NULL;
