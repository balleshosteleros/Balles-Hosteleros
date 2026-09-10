-- ============================================================================
-- La carta pública lee `carta_items.alergenos` (una copia que solo se refresca al
-- sincronizar), no los deriva en caliente. Tras copiar los platos de BACANAL hay
-- que bajar esos alérgenos también a la ficha de carta de HABANA, o el cliente
-- seguiría viendo el plato sin nada.
-- Idempotente.
-- ============================================================================
update public.carta_items ci
   set alergenos = case when p.alergenos_modo = 'manual'
                        then p.alergenos
                        else public.alergenos_derivados(p.id)
                   end
  from public.productos p, public.empresas e
 where e.nombre = 'HABANA'
   and ci.empresa_id = e.id
   and p.id = ci.producto_id;
