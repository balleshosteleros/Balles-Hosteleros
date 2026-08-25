-- Elimina el sistema ANTIGUO de etiquetas de reserva.
--
-- Convivían dos modelos:
--   · ANTIGUO — `empresa_reserva_etiquetas` + `reservas.etiqueta_id` (una sola
--     etiqueta por reserva, sin grupos, sin etiquetas de cliente).
--   · NUEVO   — `sala_etiqueta_categorias` + `sala_etiquetas` +
--     `sala_reserva_etiquetas` / `sala_cliente_etiquetas` (M:N, agrupadas por
--     categoría y con scope reserva/cliente).
--
-- El nuevo cubre todo lo del antiguo. Se retira el antiguo para que en la
-- configuración deje de aparecer la lista duplicada.
--
-- Idempotente: se puede reejecutar sin efecto.

-- 1) Quitar la columna de la reserva (ninguna reserva la tenía informada).
ALTER TABLE IF EXISTS reservas DROP COLUMN IF EXISTS etiqueta_id;

-- 2) Borrar el catálogo antiguo.
DROP TABLE IF EXISTS empresa_reserva_etiquetas CASCADE;

-- 3) Impedir que un seed reejecutado duplique categorías dentro de una empresa.
CREATE UNIQUE INDEX IF NOT EXISTS sala_etiqueta_categorias_empresa_scope_nombre_uidx
  ON sala_etiqueta_categorias (empresa_id, scope, nombre);

-- 4) Registro de etiquetas/grupos de fábrica que el restaurante ha borrado
--    a propósito. El seed es aditivo por nombre, así que sin esta marca
--    volvería a crearlos en la siguiente sincronización y el borrado no
--    duraría nada.
CREATE TABLE IF NOT EXISTS sala_etiquetas_seed_excluidas (
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('categoria', 'etiqueta')),
  scope       text NOT NULL CHECK (scope IN ('reserva', 'cliente')),
  nombre      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, tipo, scope, nombre)
);

ALTER TABLE sala_etiquetas_seed_excluidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sala_etiquetas_seed_excluidas_rw ON sala_etiquetas_seed_excluidas;
CREATE POLICY sala_etiquetas_seed_excluidas_rw
  ON sala_etiquetas_seed_excluidas
  FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));
