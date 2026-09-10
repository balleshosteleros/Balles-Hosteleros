-- ============================================================================
-- "Tortilla trufada huevo Concurso" era un duplicado de la tortilla trufada creado
-- para un concurso puntual. Se elimina del catálogo por decisión de Iván (08-09-2026).
--
-- Se comprobó antes de borrar que no arrastraba nada: sin receta propia, sin uso
-- como ingrediente, sin ficha de carta, sin ventas en POS, sin stock ni movimientos,
-- sin escandallo, sin tarifas, sin mermas, sin pedidos, sin inventario, sin precios
-- de compra ni referencias de proveedor. No estaba visible en la carta.
--
-- Idempotente: si ya se aplicó, no encuentra el producto y no hace nada.
-- ============================================================================
delete from public.productos p
 using public.empresas e
 where e.id = p.empresa_id
   and e.nombre = 'BACANAL'
   and p.tipo = 'venta'
   and p.nombre = 'Tortilla trufada huevo Concurso';
