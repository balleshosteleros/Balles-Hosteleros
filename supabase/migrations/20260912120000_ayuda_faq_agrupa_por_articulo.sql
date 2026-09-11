-- Las preguntas frecuentes se agrupan por el ARTÍCULO con el que se respondió,
-- no por parecido entre los textos de las preguntas.
--
-- Por qué se cambia: medido con preguntas reales, el parecido entre textos NO
-- separa los temas. Dos formas de preguntar lo mismo llegan a 0,168 de
-- distancia ("¿cómo pido vacaciones?" contra "quiero solicitar unos días
-- libres") mientras que dos temas DISTINTOS bajan a 0,125 ("dónde están mis
-- nóminas" contra "dónde se ficha"). Con esos números no hay umbral posible:
-- o parte en dos lo que es la misma duda, o junta nóminas con fichajes.
--
-- El artículo del manual con el que se contestó sí es una etiqueta fiable: si a
-- dos preguntas les sirvió la misma explicación, son la misma duda. Y es gratis,
-- porque ese dato ya se guarda en cada consulta.
--
-- Idempotente.

ALTER TABLE soporte_faq ADD COLUMN IF NOT EXISTS chunk_principal UUID
  REFERENCES soporte_conocimiento(id) ON DELETE SET NULL;

-- Una sola pregunta publicada por artículo y empresa. Es lo que hace que la
-- pasada semanal sume al contador en vez de publicar lo mismo otra vez.
CREATE UNIQUE INDEX IF NOT EXISTS soporte_faq_empresa_chunk_uniq
  ON soporte_faq (empresa_id, chunk_principal)
  WHERE chunk_principal IS NOT NULL;

-- El embedding de la pregunta publicada ya no se usa para nada: sobra.
DROP INDEX IF EXISTS soporte_faq_embedding_hnsw;
ALTER TABLE soporte_faq DROP COLUMN IF EXISTS embedding;
DROP FUNCTION IF EXISTS buscar_faq_parecida(VECTOR, UUID, FLOAT);
