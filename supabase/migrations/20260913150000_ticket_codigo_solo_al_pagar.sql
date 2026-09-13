-- El código del ticket se reservaba ANTES de cobrar, al abrir la pasarela.
-- Resultado: quien dejaba sus datos y se iba sin pagar se llevaba un código
-- consigo. Códigos de 6 caracteres quemados para nada, y un identificador
-- vivo asociado a alguien que no ha pagado nada.
--
-- Ahora la columna admite vacío: el código se genera cuando Revolut confirma
-- el cobro, que es cuando el cliente tiene derecho a él.
--
-- El índice único sigue valiendo: Postgres admite varios NULL en un único.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.reserva_ticket_compras
  ALTER COLUMN codigo DROP NOT NULL;

COMMENT ON COLUMN public.reserva_ticket_compras.codigo IS
  'Código de 6 caracteres del ticket. NULL mientras la compra no esté pagada: se genera al confirmar el cobro.';
