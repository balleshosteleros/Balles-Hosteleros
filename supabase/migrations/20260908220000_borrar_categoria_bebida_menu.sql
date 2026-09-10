-- ============================================================================
-- Las 6 "copas de menú" (Alma Blanco, Alma Rosado, Árabe, Delizia, Hallazgo e
-- Irreverente Joven) entraron desde el catálogo de Ágora pero no se usan: sin
-- precio, sin ventas, sin ficha de carta, sin receta, sin stock y sin tarifas.
-- Ensuciaban el recuento de platos sin escandallo sin ser comida.
-- Siguen existiendo en Ágora, así que reaparecerán como propuesta en el
-- importador de catálogo; ahí se descartan (el importador no crea nada solo).
-- Idempotente.
-- ============================================================================
delete from public.productos p
 using public.empresas e
 where e.id = p.empresa_id and e.nombre = 'BACANAL' and p.categoria = 'Bebida menu';
