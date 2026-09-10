-- Baja a las fichas de carta (lo que ve el cliente) los alérgenos de su producto.
-- `carta_items.alergenos` es una copia y no se deriva en caliente. Idempotente.
update public.carta_items ci
   set alergenos = case when p.alergenos_modo = 'manual' then p.alergenos
                        else public.alergenos_derivados(p.id) end
  from public.productos p
 where p.id = ci.producto_id;
