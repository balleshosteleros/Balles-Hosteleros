-- Foto nueva para el coctel Bacanal Colada y para las vieiras (BACANAL).
--
-- Las dos salen del Drive de marketing de BACANAL (2024/3.MARZO): DSC_7646 es
-- la colada servida en el coco, con el humo del palo de canela, y DSC_0830ok
-- las vieiras en el momento de flambearlas. Se suben recortadas en vertical
-- (2:3), el formato de la carta.
--
-- Idempotente: volver a aplicarla no cambia nada.
with fotos (item_id, url, original) as (
  values
    ('2676dd56-8e08-4092-9191-d016f69d06c8'::uuid,
     'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/bacanal-colada-7646-ver.jpg',
     'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/bacanal-colada-7646.jpg'),
    ('2ff3b91f-bf7a-42d1-b03b-aaad6f269ef1'::uuid,
     'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vieiras-kimchi-0830-ver.jpg',
     'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vieiras-kimchi-0830.jpg')
)
update public.carta_items ci
   set foto_url = f.url,
       foto_storage_path = f.original,
       updated_at = now()
  from fotos f
 where ci.id = f.item_id
   and (ci.foto_url is distinct from f.url
        or ci.foto_storage_path is distinct from f.original);
