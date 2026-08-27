-- Guardar SIEMPRE el identificador de producto de Ágora en las líneas de ticket.
--
-- PROBLEMA (detectado por el equipo de Iván, 27-ago): la ingesta busca el producto por su
-- ProductId y, si no lo encuentra en nuestro catálogo, guarda la línea con `producto_id` en
-- null y **tira el número de Ágora**. Solo sobrevive el nombre.
--
-- CONSECUENCIA: hay 288 líneas de ticket huérfanas — 5 productos que se llevan meses
-- vendiendo (Boom-Boom, Danza Macabra, MENU BACANAL, Desliz de cobra, Fiesta del Caribe) y
-- que no se pueden enlazar a posteriori, porque el único dato que los unía se perdió. Los
-- nombres no sirven de ancla: hay productos que se llaman distinto en cada sistema
-- ("Vieiras con salsa kimchi flambeadas" allí es "Vieira del Pacifico"), con erratas y
-- dobles espacios.
--
-- Con esta columna, una línea huérfana se puede reconciliar en cuanto el producto se da de
-- alta, y se puede construir el aviso de "Ágora está vendiendo algo que no tienes".

ALTER TABLE pos_ticket_lineas
  ADD COLUMN IF NOT EXISTS agora_product_id INTEGER;

COMMENT ON COLUMN pos_ticket_lineas.agora_product_id IS
  'ProductId de Ágora, guardado SIEMPRE (exista o no el producto en Balles). Permite '
  'reconciliar las líneas huérfanas cuando el producto se da de alta.';

-- Solo interesa indexar lo que está pendiente de enlazar: son pocas filas y es la consulta
-- que hará el aviso de producto sin dar de alta.
CREATE INDEX IF NOT EXISTS idx_pos_lineas_agora_huerfanas
  ON pos_ticket_lineas (agora_product_id)
  WHERE producto_id IS NULL AND agora_product_id IS NOT NULL;
