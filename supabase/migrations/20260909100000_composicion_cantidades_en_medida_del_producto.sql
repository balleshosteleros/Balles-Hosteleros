-- ============================================================
-- 20260909100000_composicion_cantidades_en_medida_del_producto.sql
-- Las recetas que descuentan stock vuelven a estar en la unidad del producto.
--
-- QUÉ PASÓ (verificado en producción el 2026-09-09):
--   La misma receta vive en DOS tablas: `escandallo_ingredientes` (lo que ve cocina) y
--   `producto_composicion` (la que de verdad calcula el coste y descontará el almacén).
--   No hay un único escritor, y en agosto/septiembre cada equipo arregló UNA:
--
--   · La migración 20260829120000 (Fase 3, nuestra) pasó 26 líneas de gramos a kilos
--     **solo en el escandallo**. `producto_composicion` se quedó con el valor en gramos.
--     Como su `cantidad` se lee en la `medida` del ingrediente, "0,5 kg de costilla"
--     quedó registrado como **500 kg por ración**.
--   · Las migraciones del 08-sep (revisión con Borja) corrigieron cantidades **solo en
--     `producto_composicion`**, y en gramos, dejando el escandallo a 0.
--
--   `coste_escandallo()` hace `cantidad × precio ÷ factor_conversion`, y
--   `factor_conversion` vale **1 en los 1.150 productos activos** — nunca se rellenó.
--   Así que la cantidad tiene que estar en la medida del producto, y no lo estaba:
--   43 líneas costaban mil veces de más.
--
-- No ha habido daño en el almacén: el descuento por ventas sigue apagado
-- (`empresas.stock_descuento_desde` a NULL) y no hay elaboraciones confirmadas.
-- El daño era el coste: platos con escandallos de miles de euros.
--
-- QUÉ HACE ESTA MIGRACIÓN
--   BLOQUE 1 — donde el escandallo tiene el valor bueno y la unidad cuadra con la del
--              producto, `producto_composicion` copia del escandallo. Sin criterio: espejo.
--   BLOQUE 2 — donde no hay escandallo (o está a 0) y la cantidad es un valor en gramos
--              inequívoco contra un producto que se compra por kilo/litro, se divide
--              entre 1000 y se escribe también en el escandallo, para que dejen de
--              divergir. Cada línea va comentada con su antes y su después.
--
-- QUÉ **NO** TOCA, a propósito (va en la nota para Iván y Borja):
--   · Las 49 líneas con cantidad 0 — nadie sabe cuánto llevan salvo el cocinero.
--   · Las líneas donde la receta está en gramos y el producto se cuenta por unidades
--     (zanahoria, lechuga romana, cola de rape, salsa de curry rojo, vieira media):
--     pasar de gramos a unidades exige saber cuánto pesa una, y eso no se inventa.
--   · `Martini Rojo`/`Martini Blanco` (1 litro por copa) y `Coulant` (1 kg por ración):
--     números redondos que huelen a "1 unidad", pero no es evidente. Que lo digan ellos.
--
-- Idempotente: tras aplicarla, ninguna de las dos condiciones vuelve a encontrar filas.
-- ============================================================

-- ── BLOQUE 1 · el escandallo manda donde ya tiene el valor correcto ──────────
update producto_composicion pc
set cantidad = ei.cantidad
from productos pi, escandallos e, escandallo_ingredientes ei
where pc.ingrediente_id = pi.id
  and e.producto_id = pc.producto_venta_id
  and ei.escandallo_id = e.id
  and ei.producto_id = pc.ingrediente_id
  and ei.cantidad > 0
  and ei.unidad = pi.medida          -- unidad compatible: copiar es seguro
  and pc.cantidad <> ei.cantidad;

-- ── BLOQUE 2 · gramos evidentes contra productos que se compran por kilo/litro ──
update producto_composicion set cantidad = 0.06 where id = '568c72f4-2cae-4273-a9b3-f6ceb8fc593d'; -- Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico · Barbacoa asiatica: 60 g → 0.06 Kilogramos
update producto_composicion set cantidad = 0.015 where id = '9258bf81-c910-45d3-97ba-f5372dec834b'; -- Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico · Polvo de cacahuete: 15 g → 0.015 Kilogramos
update producto_composicion set cantidad = 0.4 where id = '01e7b78c-7a5c-4a66-94b4-af30eebc2f07'; -- Arroz de señoret · Base de arroz de pescado: 400 g → 0.4 Kilogramos
update escandallo_ingredientes set cantidad = 0.4, unidad = 'Kilogramos' where id = '753396ec-dc01-4a62-9caf-0c1763a95957'; -- espejo: Arroz de señoret · Base de arroz de pescado
update producto_composicion set cantidad = 0.08 where id = 'dd7443be-dd16-40bf-84b3-8e145688a528'; -- Arroz de señoret · Gamba cola pelada 50/70: 80 g → 0.08 Kilogramos
update escandallo_ingredientes set cantidad = 0.08, unidad = 'Kilogramos' where id = 'c15f27b4-5ba1-4afa-ad83-89593acab5db'; -- espejo: Arroz de señoret · Gamba cola pelada 50/70
update escandallo_ingredientes set cantidad = 0.12, unidad = 'Kilogramos' where id = '61ba8bbe-6730-4170-9d98-d3789aa21ce6'; -- espejo: Arroz de señoret · Sepia
update producto_composicion set cantidad = 0.12 where id = 'acaa627d-e6fd-4139-b428-1f0a15b508d4'; -- Arroz de señoret · Sepia: 120 g → 0.12 Kilogramos
update producto_composicion set cantidad = 0.04 where id = '8efc0b72-a79a-4ff1-8b1e-946030ad3890'; -- Cachopo con Jamon y Queso curado · Panko: 40 g → 0.04 Kilogramos
update producto_composicion set cantidad = 0.12 where id = '2b88106d-a178-45f4-8fe5-a5d147f15259'; -- Ceviche Thai · Corvina: 120.000 g → 0.12 Kilogramos
update producto_composicion set cantidad = 0.13 where id = '11b78d56-d1bc-46f7-9425-ff635c0e6e48'; -- Corvina frita · Corvina: 130 g → 0.13 Kilogramos
update producto_composicion set cantidad = 0.002 where id = '7d3919b8-b81a-4057-9a15-4ee10eaee81c'; -- Ensaladilla Rusa · Cebollino: 2 g → 0.002 Kilogramos
update producto_composicion set cantidad = 0.25 where id = '0e8beafc-9b26-4b62-b61f-c062c7d0d9e2'; -- Ensaladilla Rusa · Ensaladilla: 250 g → 0.25 Kilogramos
update producto_composicion set cantidad = 0.35 where id = '1d5253b0-2614-446e-ad11-a339db4d0603'; -- Entrecot Lomo bajo frisona · Lomo bajo frisona ( 350 gr ): 350 g → 0.35 Kilogramos
update producto_composicion set cantidad = 0.07 where id = 'ffefa0d6-7866-42a7-8757-571ccbf43a2d'; -- Falso risotto con setas · Ragout de setas: 70 g → 0.07 Kilogramos
update producto_composicion set cantidad = 0.02 where id = '014e047d-058f-43aa-9e51-46bc2397d449'; -- Gyozas pollo al curry · Mango: 20 g → 0.02 Kilogramos
update producto_composicion set cantidad = 0.025 where id = '84aae686-4bb6-47c5-be90-d1851caa9a14'; -- Gyozas pollo al curry · Salsa de curry mango: 25 g → 0.025 Kilogramos
update producto_composicion set cantidad = 0.002 where id = 'a0042698-f4d5-4154-b09a-b38ed25a3f53'; -- Gyozas pollo al curry · Sésamo negro: 2 g → 0.002 Kilogramos
update producto_composicion set cantidad = 0.15 where id = '4173cc81-eb55-4fec-bdb9-ce28635e619c'; -- Patatas fritas · Patata Agria: 150 g → 0.15 Kilogramos
update producto_composicion set cantidad = 0.1 where id = 'e56bbfb6-08fb-4b3c-9857-0932ada753b2'; -- Pimientos fritos · Pimiento Rojo: 100 g → 0.1 Kilogramos
update producto_composicion set cantidad = 0.025 where id = '3624d572-a82f-4fc4-89c3-cae7ae892bf3'; -- Tiramisu · Base de galleta de café: 25 g → 0.025 Kilogramos
update producto_composicion set cantidad = 0.07 where id = 'c6a9a7a7-39f1-4017-b6f2-c71833ac9a0c'; -- Tiramisu · Espuma de tiramisú: 70 g → 0.07 Kilogramos
update producto_composicion set cantidad = 0.06 where id = '1845492b-52fb-47c4-9f26-3d2e4539ec1e'; -- Torreznos con guacamole y pico de gallo · Guacamole: 60 g → 0.06 Kilogramos
update producto_composicion set cantidad = 0.15 where id = 'c7e7e0d9-095c-40cd-aba2-0409af6a5e9f'; -- Torreznos con guacamole y pico de gallo · Panceta adobada: 150 g → 0.15 Kilogramos
update producto_composicion set cantidad = 0.025 where id = '05288246-7fd4-4de0-b337-2b9ab70b8324'; -- Torreznos con guacamole y pico de gallo · Pico de gallo: 25 g → 0.025 Kilogramos
