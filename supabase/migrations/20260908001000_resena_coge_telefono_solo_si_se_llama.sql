-- "¿Coge el teléfono?" se queda vacío en todo lo que vino de Go High Level.
--
-- Al importar se rellenó deduciéndolo de la fase: "No contesta" → no, y
-- Excelente / Regular / Malo → sí. Estaba mal, y lo corrige Iván (07-09-2026):
--
--   · "No contesta" NO es que no cogiera el teléfono. Es que no respondió al
--     WhatsApp por el que se le preguntó. A esa gente no se la llamó.
--   · Por teléfono solo se llama a los de MALO — son los que hay que recuperar.
--   · Y de esos, GHL tampoco guardaba si cogieron o no.
--
-- O sea que el dato no existía en ninguna de las 17.642. Se deja vacío, que es
-- la verdad, y lo rellena calidad cuando llame. Un "no" inventado en 11.458
-- fichas haría creer que se intentó localizar por teléfono a gente a la que
-- nadie llamó.
--
-- La columna "No contesta" del tablero sigue diciendo lo mismo que decía en
-- GHL: no hubo respuesta. Eso no se toca.
--
-- Idempotente.

UPDATE public.resenas
SET coge_telefono = NULL
WHERE plataforma = 'go_high_level'
  AND coge_telefono IS NOT NULL;
