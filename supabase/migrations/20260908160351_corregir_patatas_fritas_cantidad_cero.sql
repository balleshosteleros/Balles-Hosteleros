-- ============================================================================
-- "Burger Bacanal 2.0" y "Entraña con chimichurri y guarnicion" llevaban
-- "Patatas fritas" a cantidad 0 en su escandallo, cuando el resto de platos
-- que llevan esta guarnición usan 150 g. Confirmado con Iván (09-09-2026):
-- se corrige a 150 g, igual que Tomahawk, Cachopo, Costillas a baja
-- temperatura, Huevos rotos con jamon iberico y Fingers de pollo con patatas.
--
-- Idempotente: solo actualiza si sigue en 0.
-- ============================================================================
update public.producto_composicion pc
   set cantidad = 150
  from public.productos p, public.productos i
 where pc.producto_venta_id = p.id
   and pc.ingrediente_id = i.id
   and p.empresa_id = (select id from public.empresas where nombre = 'BACANAL')
   and p.nombre in ('Burger Bacanal 2.0', 'Entraña con chimichurri y guarnicion')
   and i.nombre = 'Patatas fritas'
   and i.tipo = 'elaboracion'
   and pc.cantidad = 0;
