-- Quita del catálogo de Sala el grupo "Servicio Hotelero" y sus 4 etiquetas
-- (Huésped, Cliente externo, Turista, Local): el software no gestiona hoteles.
-- Idempotente: se puede reejecutar sin efecto adicional.

-- 1) Desasignar de reservas y clientes antes de borrar las etiquetas.
DELETE FROM sala_reserva_etiquetas
WHERE etiqueta_id IN (
  SELECT e.id
  FROM sala_etiquetas e
  JOIN sala_etiqueta_categorias c ON c.id = e.categoria_id
  WHERE c.nombre = 'Servicio Hotelero' AND c.sistema = true
);

DELETE FROM sala_cliente_etiquetas
WHERE etiqueta_id IN (
  SELECT e.id
  FROM sala_etiquetas e
  JOIN sala_etiqueta_categorias c ON c.id = e.categoria_id
  WHERE c.nombre = 'Servicio Hotelero' AND c.sistema = true
);

-- 2) Borrar las etiquetas del grupo.
DELETE FROM sala_etiquetas e
USING sala_etiqueta_categorias c
WHERE e.categoria_id = c.id
  AND c.nombre = 'Servicio Hotelero'
  AND c.sistema = true;

-- 3) Borrar el grupo.
DELETE FROM sala_etiqueta_categorias
WHERE nombre = 'Servicio Hotelero' AND sistema = true;
