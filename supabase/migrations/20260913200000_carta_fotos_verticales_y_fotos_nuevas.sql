-- Carta digital: toda la carta en vertical y cuatro platos con foto nueva.
--
-- El formato cuadrado recortaba el plato: la ensaladilla de BACANAL salia con
-- el plato cortado por los cuatro lados mientras que en HABANA, con la misma
-- foto, se veia entera. Vertical (2:3) es la proporcion en la que estan
-- disparadas casi todas las fotos, asi que el plato entra entero y la tarjeta
-- gana alto, que es lo que hace levantar la vista de la carta.
--
-- Cada foto se ha vuelto a recortar DESDE SU ORIGINAL, no desde el recorte
-- cuadrado: encadenar recortes era lo que dejaba la ensaladilla en un detalle.
-- Tartar y coulant llevan encuadre a medida (el plato se iba abajo o fuera).
--
-- Fotos nuevas: Entraña con chimichurri, Burger Balles Hosteleros, Ensalada de
-- burrata y Ceviche Thai.
--
-- Idempotente: volver a aplicarla no cambia nada.

-- 1) Vertical en las dos casas y para las empresas que se den de alta.
update public.empresas
   set carta_formato_foto = 'vertical'
 where nombre in ('BACANAL', 'HABANA')
   and carta_formato_foto is distinct from 'vertical';

update public.carta_categorias cat
   set formato_foto = 'vertical', updated_at = now()
  from public.empresas e
 where e.id = cat.empresa_id
   and e.nombre in ('BACANAL', 'HABANA')
   and cat.formato_foto is distinct from 'vertical';

alter table public.empresas alter column carta_formato_foto set default 'vertical';

-- 2) Fotos nuevas y reencuadres (item, foto publicada, negativo del que sale).
with fotos (item_id, url, original) as (
  values
    ('000b148d-46eb-4d4e-9416-1b4f3e16f04d'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-menthol-mojito-0-cua-cua-fondo-ver.jpg', null),
    ('03b41cca-8ff1-4e97-be56-73f2d27d5574'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-300-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-300.jpg'),
    ('07c2ae55-35d7-4f58-a079-cfdfd59b434f'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-strawberry-watermelon-bubblegum-0-cua-cua-fondo-ver.jpg', null),
    ('0e7730d4-785e-41a9-b9d9-934dc4786a18'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-07_DSC_6704-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-07_DSC_6704.jpg'),
    ('118c6c27-22f2-4854-8437-ca7fa789fcc8'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-strawberry-ice-0-cua-cua-fondo-ver.jpg', null),
    ('13850c18-2c92-4762-9b7c-08edaeb04a8b'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-22_sDSC_3812__1_-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-22_sDSC_3812__1_.jpg'),
    ('138dd307-816c-4ceb-b59e-9fa645311cf6'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-266-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-266.jpg'),
    ('157aa5e0-4194-40d7-a85b-275be4a43388'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-01-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-01.jpg'),
    ('172a0bbf-0c90-4f9a-bbdd-55102b05564a'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-strawberry-ice-2-cua-cua-fondo-ver.jpg', null),
    ('173b5c6e-1086-421f-8475-cb2a9362f71a'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/v2-856-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/v2-856.jpg'),
    ('1a63d2c7-8a89-40cc-9f7f-7d5196ce588d'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-cotton-candy-ice-0-cua-cua-fondo-ver.jpg', null),
    ('1a733bd0-6f80-41c3-8d58-d0cbfba8dc11'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrana-chimichurri-4272-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrana-chimichurri-4272.jpg'),
    ('1f5c7cb9-a52b-484f-a0f4-66d5a0df7fa0'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/costillas-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/costillas.jpg'),
    ('2099bec1-e855-4ed5-996a-5f85abbd78ed'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrana-chimichurri-4272-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrana-chimichurri-4272.jpg'),
    ('27b7c6bf-93e1-4d72-93ad-9f4ddda1394d'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/burger-balles-3801-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/burger-balles-3801.jpg'),
    ('2dab14db-0169-4d71-afb2-303096700d7a'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-strawberry-ice-0-cua-cua-fondo-ver.jpg', null),
    ('2f944f42-a0a2-4474-82aa-d5a9c14fce30'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrecot-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrecot.jpg'),
    ('2ff3b91f-bf7a-42d1-b03b-aaad6f269ef1'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-vieiras-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-vieiras.jpg'),
    ('311bbd39-5205-4ec0-b4c8-00bba25bd92e'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/ensalada-burrata-6317-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/ensalada-burrata-6317.jpg'),
    ('32ac25b6-d0a8-41ee-bf66-bcc941bf7f2c'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-06_DSC_6693-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-06_DSC_6693.jpg'),
    ('37a1bf3c-6e86-46e1-bc5a-bc6d835c9f15'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-tortilla-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-tortilla.jpg'),
    ('3aeb114c-d545-4763-bc50-c5e4d263160a'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-04-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-04.jpg'),
    ('3c884325-8ac0-4aa8-ad3b-4432f71ad372'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-267-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-267.jpg'),
    ('43e2df87-9164-490f-a95f-8c8d589cb1b8'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-cotton-candy-ice-2-cua-cua-fondo-ver.jpg', null),
    ('46836e88-4ed4-4836-a10c-64c334582f0e'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-268-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-268.jpg'),
    ('483bf980-e562-4eaf-85b7-b3c61ba41fff'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-torreznos-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-torreznos.jpg'),
    ('484f8c20-40f3-4490-bbf5-c4f5f67fb796'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/burger-balles-3801-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/burger-balles-3801.jpg'),
    ('496ba529-14f1-449d-842c-87ce8e1b0250'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-03_DSC_5756-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-03_DSC_5756.jpg'),
    ('4c8904aa-175a-4c38-8196-72f383820697'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/agora-gofre-hor-cua-cua-fondo-ver.jpg', null),
    ('53491d00-44ac-476c-b9a0-09e081c1d821'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/ceviche-thai-5834-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/ceviche-thai-5834.jpg'),
    ('574104cb-6306-4f35-879b-6ee478397162'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-menthol-mojito-2-cua-cua-fondo-ver.jpg', null),
    ('5baa4582-2b67-4af5-835c-0efa2b3829cd'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-02_DSC_0914-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-02_DSC_0914.jpg'),
    ('5f490f8a-c8a9-43e4-b0c4-33afa4b23fee'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-24_sDSC_8369-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-24_sDSC_8369.jpg'),
    ('6a982658-0275-4048-a047-cb9cb3dd45e2'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-triple-melon-2-cua-cua-fondo-ver.jpg', null),
    ('6e44364c-3d2d-4ed5-8a2a-b0e31eeee438'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/drive-x-alitas-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-alitas.jpg'),
    ('722e8fc9-7a2e-49a9-80b3-15c77a4305c7'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-triple-melon-2-cua-cua-fondo-ver.jpg', null),
    ('778baa8f-4fac-4a70-a7c0-f4016710924c'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-alitas-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-alitas.jpg'),
    ('790bf5dc-5b08-4e41-ba89-535ed0ac46fe'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/ceviche-thai-5834-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/ceviche-thai-5834.jpg'),
    ('7a38e71a-b672-4c30-bcc1-de4a56c14bc7'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-strawberry-watermelon-bubblegum-0-cua-cua-cua-fondo-ver.jpg', null),
    ('7b187831-27b1-4a8e-8bd2-c65ed0a18cab'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-strawberry-watermelon-bubblegum-2-cua-cua-fondo-ver.jpg', null),
    ('7bdb8622-bd35-4c4e-ba2f-0d4c8e90869d'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-tortilla-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/drive-x-tortilla.jpg'),
    ('7db592a4-4795-486d-92bd-9a255e9c9ba9'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-triple-melon-0-cua-cua-fondo-ver.jpg', null),
    ('7e18090e-f998-4f94-a008-6f37e929de0b'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-264-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-264.jpg'),
    ('80e9183a-ba76-45f9-9573-9caeccae2dc9'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/fix-pan-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/fix-pan.jpg'),
    ('81d0db30-9372-4530-831b-4b18777c7000'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-01-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-01.jpg'),
    ('820a9561-3139-4931-8243-502a23804052'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-03_DSC_5756-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-03_DSC_5756.jpg'),
    ('8979fa2c-dfd8-46d0-ae92-087cdce8afdc'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-strawberry-ice-2-cua-cua-fondo-ver.jpg', null),
    ('8c7db341-678a-49a6-a5cf-533a180bc636'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/vaper-menthol-mojito-0-cua-cua-fondo-ver.jpg', null),
    ('8cbc95c4-ff6a-4c62-a99a-96f8f16a494d'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-menthol-mojito-2-cua-cua-cua-fondo-ver.jpg', null),
    ('91668bca-313c-40a1-b47a-ce217d5c34bc'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrecot-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrecot.jpg'),
    ('94c25b4d-90f3-4e51-86b5-4e5d31958e92'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/v2-828-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/v2-828.jpg'),
    ('9521583a-68f8-45f0-8d17-109a158d0d12'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-cazon-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-cazon.jpg'),
    ('955fed97-eec1-43c6-b551-3ec8e672269c'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-28_cachopo-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-28_cachopo.jpg'),
    ('984e9f89-9d27-43ff-a7d1-723b0724204e'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-04_DSC_5852-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-04_DSC_5852.jpg'),
    ('9ef6cde0-4530-4ddc-a3a9-769a4d086772'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-triple-melon-0-cua-cua-fondo-ver.jpg', null),
    ('a0885eb8-f6dc-4ed9-9d8c-d005b8edd0db'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-20_sDSC_0360-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-20_sDSC_0360.jpg'),
    ('a249cb1b-2589-4a1b-a39c-1cd7ab04a372'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-07_DSC_6704-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-07_DSC_6704.jpg'),
    ('a39d66c8-d649-4f52-8394-de313b3b960e'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/costillas-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/costillas.jpg'),
    ('a3b47cbb-21b9-4453-aa76-e76e7b9b0431'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-05_DSC_5885-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-05_DSC_5885.jpg'),
    ('a3c60158-ed62-4e80-bb6d-83c7b7e1abbd'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/dv-106-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/dv-106.jpg'),
    ('b3360f8c-acde-42e3-8c7f-af03bcc480f7'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-cotton-candy-ice-0-cua-cua-cua-fondo-ver.jpg', null),
    ('b7c5065c-e53f-414f-ae48-35404c2e22fd'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/iv-24_sDSC_8369-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-24_sDSC_8369.jpg'),
    ('b968bf78-582f-4041-96bc-b0cb301748a6'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/n-croquetas-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-croquetas.jpg'),
    ('beafd657-e5fe-4f2b-9480-ead3f07e8be1'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/v2-828-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/v2-828.jpg'),
    ('c46aa946-453a-4c62-b1ad-708ef41c339c'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/iv-20_sDSC_0360-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-20_sDSC_0360.jpg'),
    ('ca34ff6b-4ddf-4cd7-9da7-2d60e44dab00'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-02-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-02.jpg'),
    ('ce96fdc6-83b1-4231-890f-c4fe17facb47'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/dv-106-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/dv-106.jpg'),
    ('cea7b51d-5748-4850-8146-3fced88613c9'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrana-chimichurri-4272-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/entrana-chimichurri-4272.jpg'),
    ('d1de885b-9c90-44b1-8dce-2bba5ec4a93f'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/coulant-chocolate-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/coulant-chocolate.jpg'),
    ('d3631020-38df-44b2-b676-e28a9b63f9f7'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-22_sDSC_3812__1_-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-22_sDSC_3812__1_.jpg'),
    ('d3ed1132-4653-495a-9ec3-8be92acf3ccc'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/n-torreznos-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-torreznos.jpg'),
    ('d49d55cc-0b9f-484a-b9f6-ac3dbcf15ae2'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-strawberry-watermelon-bubblegum-2-cua-cua-fondo-ver.jpg', null),
    ('d754ee08-b60c-492e-84c2-66b305bec928'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-300-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-300.jpg'),
    ('d9d9c909-e3a5-4c86-aeb8-c29ef2c28a22'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-20_sDSC_0360-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-20_sDSC_0360.jpg'),
    ('db213641-e03d-4fba-8b69-9ff353c8efcd'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/costillas-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/costillas.jpg'),
    ('dc6a0468-b012-44b6-be77-134b191dd8ce'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-cazon-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-cazon.jpg'),
    ('e02fb52f-22c8-481d-9a1d-a0c5e501c1f1'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/vaper-cotton-candy-ice-2-cua-cua-cua-fondo-ver.jpg', null),
    ('e1891ade-5aa4-43d2-ad27-31550fe51552'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/burger-balles-3801-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/burger-balles-3801.jpg'),
    ('e68e09f9-7807-48d0-a887-41fc071fc9cc'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/00000000-0000-0000-0000-000000000001/nv-01-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-01.jpg'),
    ('f2b6c57c-80c9-444e-88db-f96c52dc1849'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-04-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/nv-04.jpg'),
    ('f5ede076-1f94-4475-babb-6ef910016554'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-264-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/d26-264.jpg'),
    ('f8520023-516a-44c7-a57d-8efc0c802d78'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-20_sDSC_0360-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-20_sDSC_0360.jpg'),
    ('fc939e8c-8c88-43ec-bce3-b16979ff0b6c'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-croquetas-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/n-croquetas.jpg'),
    ('ffcedc9b-24db-4356-bf3d-50ee1c41449b'::uuid, 'https://sxjtubzdpfmlmwqtsgro.supabase.co/storage/v1/object/public/carta-fotos/fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-02_DSC_0914-ver.jpg', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47/iv-02_DSC_0914.jpg')
)
update public.carta_items ci
   set foto_url = f.url,
       foto_storage_path = coalesce(f.original, ci.foto_storage_path),
       updated_at = now()
  from fotos f
 where ci.id = f.item_id
   and (ci.foto_url is distinct from f.url
        or ci.foto_storage_path is distinct from coalesce(f.original, ci.foto_storage_path));
