-- Las shishas "de liquidacion" se eliminan del sistema por completo.
--
-- Se comprobo antes que no arrastraban nada: sin stock, sin pedidos, sin
-- inventarios y sin movimientos.
--
-- "Shisha 1 Sabor" y "Shisha 2 Sabor" NO se tocan: esos son el producto de
-- venta real -la shisha se cobra por numero de sabores, y el sabor concreto se
-- elige despues-. Siguen fuera de la carta, donde el cliente elige sabor, pero
-- activos para el TPV. La combinacion sabor -> escandallo se diseñara al
-- abordar el modulo de ventas.
delete from public.carta_items ci
using public.productos p
where ci.producto_id = p.id and p.nombre ilike '%liquidacion%';

delete from public.productos where nombre ilike '%liquidacion%';
