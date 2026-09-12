-- Los 7 sabores de shisha que ya no se sirven se eliminan del todo, tambien
-- como producto de venta: Casper, Chao Bella, Lady Killer, Mango Tango,
-- Moon Dream, Play y Tornado.
--
-- Se comprobo antes que no arrastraban nada -sin stock, sin pedidos, sin
-- inventarios y sin movimientos-, asi que el borrado no se lleva por delante
-- ningun historico. Si alguno hubiera tenido ventas se habria quedado como
-- Inactivo en vez de borrarse.
--
-- Y el Zumo natural de mango estrena foto: la de Agora estaba hecha en el
-- jardin y desentonaba con los otros cinco zumos, tomados en la barra. La
-- nueva sale del Drive de HABANA (2024/8.AGOSTO), que es donde estaban las
-- fotos del local -yo habia mirado solo el Drive de BACANAL-.
delete from public.carta_items ci
using public.productos p
where ci.producto_id = p.id and p.categoria = 'Shishas'
  and p.nombre in ('Casper','Chao Bella','Lady Killer','Mango Tango','Moon Dream','Play','Tornado');

delete from public.producto_composicion pc
using public.productos p
where (pc.producto_venta_id = p.id or pc.ingrediente_id = p.id)
  and p.categoria = 'Shishas'
  and p.nombre in ('Casper','Chao Bella','Lady Killer','Mango Tango','Moon Dream','Play','Tornado');

delete from public.productos p
where p.categoria = 'Shishas'
  and p.nombre in ('Casper','Chao Bella','Lady Killer','Mango Tango','Moon Dream','Play','Tornado');
