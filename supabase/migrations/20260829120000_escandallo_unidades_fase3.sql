-- PRP-080 Fase 3 (TASK-3A): la unidad la manda el producto.
-- Generado por scripts/_clasificar_unidades_escandallo.mjs a partir del estado real.
-- Convierte SOLO lo mecánicamente seguro (misma dimensión). Las líneas en
-- conflicto (gramos de productos por unidad, etc.) NO se tocan: son decisión de Iván.

begin;

-- 1) Conversión gramos → Kg (cantidad ÷ 1000, unidad = medida del producto).
update escandallo_ingredientes set cantidad = 0.4, unidad = 'Kilogramos' where id = '5328ebc6-c9fd-4308-a584-61db1cdb6f0e'; -- Arroz de Secreto · Base de arroz  de carne: 400 GR → 0.4 Kilogramos
update escandallo_ingredientes set cantidad = 0.08, unidad = 'Kilogramos' where id = '08d1d289-2321-4300-b846-62640c304713'; -- Arroz de Secreto · brocoli: 80 GR → 0.08 Kilogramos
update escandallo_ingredientes set cantidad = 0.08, unidad = 'Kilogramos' where id = 'bc046f85-d699-4185-9d97-59479329def7'; -- Arroz de Secreto · coliflor: 80 GR → 0.08 Kilogramos
update escandallo_ingredientes set cantidad = 0.05, unidad = 'Kilogramos' where id = '5f5a99fd-fd1d-4ed9-bbea-66967306c263'; -- Arroz de Secreto · tirabeques: 50 GR → 0.05 Kilogramos
update escandallo_ingredientes set cantidad = 0.2, unidad = 'Kilogramos' where id = '6f64b90f-c7f1-4b69-89ba-fcac894a5599'; -- Arroz de Secreto · secreto de cerdo: 200 GR → 0.2 Kilogramos
update escandallo_ingredientes set cantidad = 0.2, unidad = 'Kilogramos' where id = '4a17a915-5c64-435a-ba60-edf5e14bcb17'; -- Arroz negro · Arroz bomba: 200 Gr → 0.2 Kilogramos
update escandallo_ingredientes set cantidad = 0.025, unidad = 'Kilogramos' where id = '460b7cf2-509f-43aa-8389-1393d0c09390'; -- Arroz negro · Gambones: 25 Gr → 0.025 Kilogramos
update escandallo_ingredientes set cantidad = 0.1, unidad = 'Kilogramos' where id = '4360f8b7-a6cd-4736-9c0c-2f7c5f36d6ee'; -- Bao-cadillo de oreja a baja temperatura con brava y lima · Oreja de cerdo en adobo: 100 Gr → 0.1 Kilogramos
update escandallo_ingredientes set cantidad = 0.15, unidad = 'Kilogramos' where id = '55159937-97b5-4da3-b806-bbed7352d79f'; -- Brioche meloso de ternera · Carrillera de Ternera: 150 Gr → 0.15 Kilogramos
update escandallo_ingredientes set cantidad = 0.01, unidad = 'Kilogramos' where id = '657940b1-3ddf-4c5b-ab59-8ba5d45b15e5'; -- Brioche meloso de ternera · Cebolla encurtida: 10 Gr → 0.01 Kilogramos
update escandallo_ingredientes set cantidad = 0.35, unidad = 'Kilogramos' where id = '090842d3-e9b1-4384-b873-4e4b9de62406'; -- Cachopo con Jamon y Queso curado · Cachopo: 350 Gr → 0.35 Kilogramos
update escandallo_ingredientes set cantidad = 0.03, unidad = 'Kilogramos' where id = '8fa50b34-2a97-4e60-8a54-18710724a0cc'; -- Cachopo con Jamon y Queso curado · Queso: 30 Gr → 0.03 Kilogramos
update escandallo_ingredientes set cantidad = 0.2, unidad = 'Kilogramos' where id = '469cce92-bd54-4631-a6a3-d0c592444221'; -- Cazon en adobo y una base de lechuga y wakame · Cazón en adobo: 200 Gr → 0.2 Kilogramos
update escandallo_ingredientes set cantidad = 0.015, unidad = 'Kilogramos' where id = 'd167d5c7-cb0c-4d5d-a5a9-5bdff152a9dd'; -- Cazon en adobo y una base de lechuga y wakame · Wakame: 15 Gr → 0.015 Kilogramos
update escandallo_ingredientes set cantidad = 0.025, unidad = 'Kilogramos' where id = 'd2813a79-7b54-4bf5-bb8c-25bf77a72962'; -- Cazon en adobo y una base de lechuga y wakame · Lechuga romana: 25 Gr → 0.025 Kilogramos
update escandallo_ingredientes set cantidad = 0.07, unidad = 'Kilogramos' where id = '0da2c4d0-8dca-4d0b-b513-b1ed549a6bec'; -- Ceviche Thai · tomate cherry: 70 g → 0.07 Kilogramos
update escandallo_ingredientes set cantidad = 0.05, unidad = 'Kilogramos' where id = 'e817260f-fb26-4230-a0fa-5257e5487e12'; -- Ceviche Thai · cebolla morada: 50 g → 0.05 Kilogramos
update escandallo_ingredientes set cantidad = 0.12, unidad = 'Kilogramos' where id = 'fef26c45-9f2d-47be-987f-759b65b7065f'; -- Ceviche Thai · lubina: 120 g → 0.12 Kilogramos
update escandallo_ingredientes set cantidad = 0.5, unidad = 'Kilogramos' where id = 'c359902f-6cff-41a5-abc7-128904065734'; -- Costillas a baja temperatura · Costilla de cerdo: 500 Gr → 0.5 Kilogramos
update escandallo_ingredientes set cantidad = 0.05, unidad = 'Kilogramos' where id = 'b2ddea4b-0fab-4226-9f88-acd20e337d0d'; -- Curry Rojo con Verduras · coliflor: 50 g → 0.05 Kilogramos
update escandallo_ingredientes set cantidad = 0.05, unidad = 'Kilogramos' where id = '08a1fe66-a3a8-4222-a5e0-d6e147bb646f'; -- Curry Rojo con Verduras · brocoli: 50 g → 0.05 Kilogramos
update escandallo_ingredientes set cantidad = 0.05, unidad = 'Kilogramos' where id = 'acf053c8-2f6c-4285-b3c4-d59bbc1d19dd'; -- Curry Rojo con Verduras · calabacín: 50 g → 0.05 Kilogramos
update escandallo_ingredientes set cantidad = 0.05, unidad = 'Kilogramos' where id = 'bc38a158-5fde-4307-8d36-b8a4e193c565'; -- Curry Rojo con Verduras · zanahoria: 50 g → 0.05 Kilogramos
update escandallo_ingredientes set cantidad = 0.13, unidad = 'Kilogramos' where id = '955d117a-e03d-4827-bf3d-1484421a532b'; -- Curry Rojo con Verduras · lubina: 130 g → 0.13 Kilogramos
update escandallo_ingredientes set cantidad = 0.025, unidad = 'Kilogramos' where id = '176b99af-f531-42fe-8e34-ff0d47a118c0'; -- Ensalada de Burrata · Tomate cherry: 25 Gr → 0.025 Kilogramos
update escandallo_ingredientes set cantidad = 0.04, unidad = 'Kilogramos' where id = 'f0f937a5-3b72-4ae5-b66c-3b0f0601748a'; -- Tomahawk · PIMIENTOS: 40 GR → 0.04 Kilogramos

-- 2) Homogeneizar grafía a la medida del producto (misma unidad, cantidad intacta).
update escandallo_ingredientes set unidad = 'Unidades' where id = 'e98be2cb-345c-413c-ade6-d983ef497fe0';
update escandallo_ingredientes set unidad = 'Unidades' where id = '3e6e242e-dfa5-4ebe-812c-377c8a21592f';
update escandallo_ingredientes set unidad = 'Unidades' where id = 'ea8f5452-3a1e-48c8-b731-24d900941a06';
update escandallo_ingredientes set unidad = 'Unidades' where id = '3c97ee8f-6cab-48be-b1ed-5434086f2dfd';
update escandallo_ingredientes set unidad = 'Unidades' where id = '049e1f74-d2c7-43a9-a7a1-ceda1ca26c4d';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '6fbbe9a8-7f38-41ed-bfdf-27da0baf0955';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '753396ec-dc01-4a62-9caf-0c1763a95957';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '61ba8bbe-6730-4170-9d98-d3789aa21ce6';
update escandallo_ingredientes set unidad = 'Unidades' where id = 'ba16374f-67e4-4a43-b3f5-2f96f726d9ed';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = 'c15f27b4-5ba1-4afa-ad83-89593acab5db';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '2641f0ea-bbaf-4fc1-8485-bb419a0b608c';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = 'b4d448ab-7a02-4f28-91eb-dff720467d2a';
update escandallo_ingredientes set unidad = 'Unidades' where id = '238fe603-87d1-44ff-a2a1-e3979d7a4715';
update escandallo_ingredientes set unidad = 'Unidades' where id = '68fa1687-b395-4ba9-a40f-99d7a7732b0a';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '776002ce-8f7a-4259-862c-30cebffff942';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '14f7db6f-022b-48bd-8912-d25fc998b916';
update escandallo_ingredientes set unidad = 'Unidades' where id = 'a51b3142-8b0d-4c29-ab28-5145642e8fb3';
update escandallo_ingredientes set unidad = 'Unidades' where id = '758e6bda-7bcb-4c87-824e-c8499f77db18';
update escandallo_ingredientes set unidad = 'Unidades' where id = 'cded9b7d-2d9f-42b9-b2f7-c64e11676997';
update escandallo_ingredientes set unidad = 'Unidades' where id = '00cda63c-b69f-4bf6-b940-f4c6a0eb87b7';
update escandallo_ingredientes set unidad = 'Unidades' where id = '98002f69-9c9d-4ebc-b339-584b52e699cf';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = 'eeef063d-d73c-4134-a6a3-41fe665e76e3';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = 'd0199343-a3ab-4501-8a42-09f0fff6d5c4';
update escandallo_ingredientes set unidad = 'Unidades' where id = '8839af2d-b4e0-42f0-a529-cc2d3cd7dc53';
update escandallo_ingredientes set unidad = 'Unidades' where id = '644fdbfd-c081-4b45-bbe5-b8020dc79ae5';
update escandallo_ingredientes set unidad = 'Unidades' where id = '66bd1657-f600-49d2-ae5d-0d2a9e026d2b';
update escandallo_ingredientes set unidad = 'Unidades' where id = '1d1c6a41-6ab0-4cc3-a584-51e288b7c200';
update escandallo_ingredientes set unidad = 'Unidades' where id = '720ead19-1965-40e4-841b-5d873e5d6d10';
update escandallo_ingredientes set unidad = 'Unidades' where id = '7269e61b-f265-4bb2-b44d-68397b2c0c7a';
update escandallo_ingredientes set unidad = 'Unidades' where id = 'ff58736f-985c-4b8d-9dfc-9bbd9ce67565';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = 'c873fe8d-699c-4997-9a42-29a971fd8e6c';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '2ed1ba76-8356-463e-9120-787a256839bf';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = 'de7b5774-5ac3-4987-8176-110a4d783246';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '21e3beb2-67e0-4b18-bf05-5bc8ac04b9e0';
update escandallo_ingredientes set unidad = 'Unidades' where id = 'ffb0f845-76b9-40ef-b937-c6aaa5b75c54';
update escandallo_ingredientes set unidad = 'Kilogramos' where id = '9ad179ed-49dd-41ad-a762-bf954c7d39ff';
update escandallo_ingredientes set unidad = 'Unidades' where id = 'c0251386-d750-4bdd-b638-ef47da67483a';
update escandallo_ingredientes set unidad = 'Unidades' where id = '03c35643-2d2e-494f-bb9e-1e3fe26ccc73';
update escandallo_ingredientes set unidad = 'Unidades' where id = '087b11dd-f693-46d3-84c0-74a3893b9bd4';

commit;
