> # ⛔ ESTE DOSSIER ESTABA MAL — NO ACTUAR SOBRE ÉL (corregido 14-ago-2026)
>
> Agrupa **solo por nombre, sin mirar el `tipo`**, y en este modelo cada artículo existe
> legítimamente DOS veces: una ficha `compra` y una ficha `venta` (Absolut compra/Alcoholes +
> Absolut venta/Vodkas). **Eso no es un duplicado: es el diseño**, y lo que une a las dos es
> la receta 1:1 de `producto_composicion` — por eso en casi todas las parejas de abajo las dos
> filas tienen `Recetas: 1`.
>
> Fusionar los 213 grupos habría **desactivado ~200 fichas legítimas y roto las recetas que
> hacen que una venta descuente su producto de compra**.
>
> **Duplicados reales** (mismo `tipo`, misma empresa): **8 grupos**, no 213 — BACANAL 6,
> HABANA 2. **Ya fusionados el 14-ago**: gana la ficha con más referencias, se le traspasan
> precios, alias y recetas, y la perdedora queda **Inactiva** (nada se borra; el motivo queda
> escrito en sus `observaciones`).
>
> Causa real: **no fue "una siembra que corrió dos veces"**. El matcher de albaranes distingue
> mayúsculas y acentos, así que al cargar los albaranes del 30-jul no reconoció "Cebolla roja"
> como la "Cebolla Roja" ya existente y creó ficha nueva. Mientras eso no se arregle, cada
> tanda de albaranes seguirá generando duplicados.
>
> La tabla de abajo se conserva solo como registro de lo que se analizó.

# Dossier de productos duplicados en el catálogo (07-ago-2026)

> Grupos de productos con el MISMO nombre (ignorando mayúsculas, acentos y signos) dentro
> de la misma empresa. Para cada uno: cuántos precios, movimientos de stock, recetas
> (composición) y alias de proveedor lo referencian — con eso se decide cuál es "el bueno".
> **Aquí no se ha fusionado nada**: la fusión necesita el OK de Iván por cada grupo.

| Empresa | Grupo | Producto (id corto) | Tipo | Categoría | Estado | Alta | Precios | Movs | Stock≠0 | Recetas | Alias |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BACANAL | absolut | Absolut (`3968f2ae`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | absolut | Absolut (`1e96bcf4`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | agua fuentelivia con gas pequena | Agua Fuentelivia con Gas Pequeña (`ff7ba389`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | agua fuentelivia con gas pequena | Agua Fuentelivia con Gas Pequeña (`c63d72a7`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | agua fuenteliviana grande | Agua Fuenteliviana Grande (`d7541101`) | compra | Refrescos | Activo | 2026-06-10 | 3 | 0 | 1 | 1 | 1 |
| BACANAL | agua fuenteliviana grande | Agua Fuenteliviana Grande (`a6929465`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | agua fuenteliviana pequena | Agua Fuenteliviana Pequeña (`ca177528`) | compra | Refrescos | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| BACANAL | agua fuenteliviana pequena | Agua Fuenteliviana Pequeña (`075f1f4b`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | aguardiente antioqueno | Aguardiente Antioqueño (`66fcc4bc`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | aguardiente antioqueno | Aguardiente Antioqueño (`858bc32b`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | alhambra | Alhambra (`ad713af5`) | compra | Cervezas | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| BACANAL | alhambra | Alhambra (`07e9b019`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | alma blanco | Alma Blanco (`76e53b34`) | compra | Vinos y champagne | Activo | 2026-06-10 | 3 | 0 | 1 | 1 | 1 |
| BACANAL | alma blanco | Alma Blanco (`8792f6b9`) | venta | Vinos blancos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | alma rosado | Alma Rosado (`8273ca4f`) | compra | Vinos y champagne | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| BACANAL | alma rosado | Alma Rosado (`7dbba76a`) | venta | Vinos rosados | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | aquarius limon | Aquarius Limon (`610ea679`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | aquarius limon | Aquarius Limon (`33800f34`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | aquarius naranja | Aquarius Naranja (`2b8b84c1`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | aquarius naranja | Aquarius Naranja (`0916e0dd`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | arabe | Arabe (`97c791f2`) | compra | Vinos y champagne | Activo | 2026-06-10 | 3 | 0 | 1 | 1 | 1 |
| BACANAL | arabe | Arabe (`8f9a08df`) | venta | Vinos blancos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | ballantines | Ballantines (`317cdca3`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | ballantines | Ballantines (`c96dab75`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | beefeater | Beefeater (`3ee7f8f1`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | beefeater | Beefeater (`78dc901a`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | black label | Black Label (`20bba00b`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | black label | Black Label (`074e2370`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | brockmans | Brockmans (`c7987de9`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | brockmans | Brockmans (`ba3d8a4c`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | brugal | Brugal (`e30a4cfb`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | brugal | Brugal (`e20a087e`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | brugal extra viejo | Brugal Extra Viejo (`7ef6b2bf`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | brugal extra viejo | Brugal Extra Viejo (`e2bfdb53`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cebolla roja | Cebolla Roja (`4368496f`) | compra | Frutas y verduras | Activo | 2026-06-10 | 1 | 0 | 0 | 0 | 0 |
| BACANAL | cebolla roja | Cebolla roja (`77e4e0cc`) | compra | Frutas y verduras | Activo | 2026-07-30 | 2 | 1 | 1 | 0 | 1 |
| BACANAL | chivas | Chivas (`4cf35523`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | chivas | Chivas (`30a0c143`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | ciroc | Ciroc (`b71d7199`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | ciroc | Ciroc (`10c0ad10`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | ciroc coco | Ciroc coco (`e3c0e89c`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | ciroc coco | Ciroc coco (`216b4b64`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | ciroc manzana | Ciroc Manzana (`6f10a8dc`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | ciroc manzana | Ciroc Manzana (`ce01caa0`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cocacola | Cocacola (`8f4fd2ad`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cocacola | Cocacola (`9aa964a6`) | compra | Refrescos | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 1 |
| BACANAL | cocacola zero | Cocacola Zero (`c4cec17e`) | compra | Refrescos | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 1 |
| BACANAL | cocacola zero | Cocacola Zero (`83b3f6e9`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cofrutos melocoton | Cofrutos Melocoton (`c339fae7`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cofrutos melocoton | Cofrutos Melocoton (`e1b29aea`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | cofrutos naranja | Cofrutos Naranja (`7c730ad2`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cofrutos naranja | Cofrutos Naranja (`498947b6`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | cofrutos pina | Cofrutos Piña (`45ed424c`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cofrutos pina | Cofrutos Piña (`1e37da94`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | conde san cristobal | Conde San Cristobal (`375b3d21`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | conde san cristobal | Conde San Cristobal (`c81adad6`) | venta | Vinos tintos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | coronita | Coronita (`b6864ea5`) | compra | Cervezas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | coronita | Coronita (`6b6f6fcc`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cotton candy ice 0  | Cotton candy Ice 0% (`0acdf221`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | cotton candy ice 0  | Cotton candy Ice 0% (`df8e0a1d`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | cotton candy ice 2  | Cotton candy Ice 2% (`3b189699`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | cotton candy ice 2  | Cotton candy Ice 2% (`96a2c92f`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | delizia | Delizia (`f1ecdac4`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | delizia | Delizia (`10b7ebb2`) | venta | Vinos blancos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | don julio reposado | Don julio Reposado (`3272c65a`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | don julio reposado | Don julio Reposado (`c58fc726`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | dyc 8 | Dyc 8 (`b95321d1`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | dyc 8 | Dyc 8 (`3fd864c0`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | fanta limon | Fanta Limon (`8137dc8c`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | fanta limon | Fanta Limon (`27600239`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | fanta naranja | Fanta Naranja (`1ca65140`) | compra | Refrescos | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 1 |
| BACANAL | fanta naranja | Fanta Naranja (`8f53cd2b`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | fingers de pollo | Fingers de pollo (`39226efa`) | elaboracion | Sin categoría | Activo | 2026-06-30 | 1 | 0 | 0 | 1 | 0 |
| BACANAL | fingers de pollo | Fingers de pollo (`d35bdda9`) | compra | Carnes | Activo | 2026-07-30 | 1 | 0 | 0 | 0 | 1 |
| BACANAL | four roses | Four Roses (`2fddce33`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | four roses | Four Roses (`dd15c5e6`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | fuze tea | Fuze Tea (`056ac053`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | fuze tea | Fuze Tea (`360063b0`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | g vine | G'Vine (`060ebfc7`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | g vine | G'Vine (`7f07d517`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | gold label | Gold Label (`1babbb36`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | gold label | Gold Label (`34b89eba`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | gyozas vegetales | Gyozas Vegetales (`74cf5f75`) | venta | Veganos | Activo | 2026-06-10 | 0 | 0 | 0 | 0 | 0 |
| BACANAL | gyozas vegetales | Gyozas vegetales (`65614c80`) | compra | Despensa | Activo | 2026-07-10 | 1 | 0 | 0 | 0 | 0 |
| BACANAL | hallazgo crianza | Hallazgo Crianza (`97f2329a`) | compra | Vinos y champagne | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 1 |
| BACANAL | hallazgo crianza | Hallazgo Crianza (`23c1714a`) | venta | Vinos tintos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | havana 7 | Havana 7 (`d79b1d14`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | havana 7 | Havana 7 (`589d262e`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | hollenbar | Hollenbar (`d57b2e66`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | hollenbar | Hollenbar (`4ee6e629`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | irreverente joven | Irreverente Joven (`f33e29bd`) | compra | Vinos y champagne | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 1 |
| BACANAL | irreverente joven | Irreverente Joven (`541eb3f1`) | venta | Vinos tintos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | jaggermaister | Jaggermaister (`94fb2aec`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | jaggermaister | Jaggermaister (`1abf81ba`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | jameson | Jameson (`dbb56cd7`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | jameson | Jameson (`cd598bbb`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | jim beam | Jim Beam (`f1d4703e`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | jim beam | Jim Beam (`fedf034e`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | jose cuervo | Jose Cuervo (`9e614f2b`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 1 |
| BACANAL | jose cuervo | Jose Cuervo (`4003fa97`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | larios 12 | Larios 12 (`de159ded`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | larios 12 | Larios 12 (`2e8f7c68`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | larios rose | Larios Rose (`7ca4355f`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | larios rose | Larios Rose (`1b5209a3`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | leche condensada | Leche condensada (`7e255c5d`) | compra | Lácteos y huevos | Activo | 2026-06-10 | 0 | 0 | 0 | 0 | 0 |
| BACANAL | leche condensada | Leche condensada (`c81f422e`) | compra | Lácteos y huevos | Activo | 2026-07-30 | 1 | 0 | 0 | 0 | 1 |
| BACANAL | lechuga romana | Lechuga romana (`679d2a94`) | compra | Frutas y verduras | Activo | 2026-06-10 | 2 | 0 | 0 | 1 | 0 |
| BACANAL | lechuga romana | Lechuga romana (`d73e92de`) | compra | Frutas y verduras | Activo | 2026-07-30 | 2 | 1 | 1 | 0 | 1 |
| BACANAL | licor de crema el afilador | Licor de Crema El afilador (`589dc65b`) | compra | Alcoholes | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| BACANAL | licor de crema el afilador | Licor de Crema El afilador (`76d6a19a`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | licor de hierbas el afilador | Licor de Hierbas El afilador (`86963828`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| BACANAL | licor de hierbas el afilador | Licor de Hierbas El afilador (`ae24ede7`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | licor de manzana s a | Licor de Manzana S/A (`97caae06`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| BACANAL | licor de manzana s a | Licor de Manzana S/A (`46e3bd3a`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | licor malibu | Licor Malibu (`ce5a75cd`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | licor malibu | Licor Malibu (`79060ea9`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | manzanilla | Manzanilla (`99da3413`) | compra | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | manzanilla | Manzanilla (`7ba7ff19`) | venta | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | marques de vargas reserva | Marques de Vargas Reserva (`b1a4de67`) | compra | Vinos y champagne | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| BACANAL | marques de vargas reserva | Marques de Vargas Reserva (`815cbc6e`) | venta | Vinos tintos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | martin millers | Martin Millers (`6ff76ff9`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | martin millers | Martin Millers (`b52b1423`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | martini blanco | Martini Blanco (`a69abb55`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | martini blanco | Martini Blanco (`6dff693f`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | martini rojo | Martini Rojo (`eeec15ca`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | martini rojo | Martini Rojo (`29a66de8`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | menthol mojito 0  | Menthol Mojito 0 % (`9c8c9199`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | menthol mojito 0  | Menthol Mojito 0 % (`e75a6bc7`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | menthol mojito 2  | Menthol Mojito 2 % (`fc474903`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | menthol mojito 2  | Menthol Mojito 2 % (`9591f44d`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | moet chandon | Moet Chandon (`c6865562`) | venta | Champagne | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | moet chandon | Moet Chandon (`d842f6f4`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | patata lavada | Patata lavada (`269435c3`) | compra | Frutas y verduras | Activo | 2026-06-10 | 2 | 0 | 0 | 0 | 0 |
| BACANAL | patata lavada | Patata lavada (`ac890438`) | compra | Frutas y verduras | Activo | 2026-07-30 | 1 | 0 | 0 | 0 | 1 |
| BACANAL | pazo san mauro | Pazo San Mauro (`1a6aa6f9`) | compra | Vinos y champagne | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| BACANAL | pazo san mauro | Pazo San Mauro (`b3c493f9`) | venta | Vinos blancos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | radler tercio | Radler Tercio (`fffe5635`) | compra | Cervezas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | radler tercio | Radler Tercio (`d6fda983`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | red bull | Red Bull (`edbad340`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | red bull | Red Bull (`363e2259`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | red bull sa | Red Bull Sa (`3265c1a3`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | red bull sa | Red Bull Sa (`7ed8e880`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | red label | Red Label (`9b25e76d`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | red label | Red Label (`74c7bb6e`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | rives 1880 | Rives 1880 (`dd670955`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | rives 1880 | Rives 1880 (`226072c8`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | rives exotica | Rives Exotica (`b7046541`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | rives exotica | Rives Exotica (`1c72d304`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | rives pink | Rives Pink (`9308cce7`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | rives pink | Rives Pink (`e73e7946`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | royal bliss berry | Royal bliss berry (`ee2bb683`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | royal bliss berry | Royal bliss berry (`4b710a91`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | royal bliss limon | Royal bliss limon (`b7651a0b`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | royal bliss limon | Royal bliss limon (`2f0cf038`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | royal bliss tonica | Royal bliss tonica (`9870cd7f`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | royal bliss tonica | Royal bliss tonica (`41c0d8c9`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | salsa barbacoa | Salsa barbacoa (`37a8f2d2`) | elaboracion | Sin categoría | Activo | 2026-06-30 | 1 | 0 | 0 | 1 | 0 |
| BACANAL | salsa barbacoa | Salsa barbacoa (`40875f6e`) | compra | Despensa | Activo | 2026-07-30 | 2 | 0 | 0 | 0 | 1 |
| BACANAL | san miguel 0 0 | San miguel 0,0 (`3a84f6db`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | san miguel 0 0 | San miguel 0,0 (`409b39c8`) | compra | Cervezas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | san miguel 0 0 tostada | San miguel 0,0 Tostada (`f77bc22e`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | san miguel 0 0 tostada | San miguel 0,0 Tostada (`e73b210b`) | compra | Cervezas | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 1 |
| BACANAL | san miguel sin gluten | San miguel Sin Gluten (`3c303fe6`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | san miguel sin gluten | San miguel Sin Gluten (`3936fd98`) | compra | Cervezas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | san miguel tercio | San miguel Tercio (`738b30d1`) | compra | Cervezas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | san miguel tercio | San miguel Tercio (`3e0bc01e`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | santa teresa | Santa Teresa (`14eda990`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | santa teresa | Santa Teresa (`02f9492f`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | seagrams | Seagrams (`02e92d1e`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| BACANAL | seagrams | Seagrams (`5910833d`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | smirnoff | Smirnoff (`f21f2d12`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | smirnoff | Smirnoff (`cee4d0f9`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | sprite | Sprite (`8997e987`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | sprite | Sprite (`3048dfe3`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | strawbeery ice 0  | Strawbeery Ice 0% (`f08fb80b`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | strawbeery ice 0  | Strawbeery Ice 0% (`2451c6f3`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | strawbeery ice 2  | Strawbeery Ice 2% (`08880b41`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | strawbeery ice 2  | Strawbeery Ice 2% (`f2d3086a`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | strawberry watermelon bubblegum 0  | Strawberry Watermelon Bubblegum 0% (`26651073`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | strawberry watermelon bubblegum 0  | Strawberry Watermelon Bubblegum 0% (`5cdb1190`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | strawberry watermelon bubblegum 2  | Strawberry Watermelon Bubblegum 2 % (`41953605`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | strawberry watermelon bubblegum 2  | Strawberry Watermelon Bubblegum 2 % (`4af7edf4`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | tarta de queso | Tarta de queso (`fda93dc9`) | compra | Despensa | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | tarta de queso | Tarta de queso (`bd557789`) | venta | Postres | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | te negro | Te Negro (`d4a31f82`) | venta | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | te negro | Te Negro (`5c4e3186`) | compra | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | te rojo | Te Rojo (`716243f4`) | compra | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | te rojo | Te Rojo (`1470e71f`) | venta | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | te verde | Te Verde (`c41b1252`) | venta | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | te verde | Te Verde (`9088a8af`) | compra | Cafes e infusiones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | tequila de fresa diex | Tequila de Fresa Diex (`633ffc8f`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | tequila de fresa diex | Tequila de Fresa Diex (`bfa6856d`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | tequila de frutas de pasion diex | Tequila de Frutas de Pasion Diex (`43eaee37`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | tequila de frutas de pasion diex | Tequila de Frutas de Pasion Diex (`9dd17779`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | tinto de verano la casera | Tinto de Verano La Casera (`128884ed`) | venta | Vinos tintos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | tinto de verano la casera | Tinto de Verano La Casera (`6c45f33c`) | compra | Vinos y champagne | Activo | 2026-06-10 | 3 | 0 | 1 | 1 | 1 |
| BACANAL | tonica nordic | Tonica Nordic (`9be4f4cc`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | tonica nordic | Tonica Nordic (`aa8ec4ca`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | triple melon 0  | Triple Melon 0% (`fb99e1cd`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | triple melon 0  | Triple Melon 0% (`d71d55b9`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | triple melon 2  | Triple Melon 2 % (`5f3bd0bc`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | triple melon 2  | Triple Melon 2 % (`63d56ec6`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | white label | White Label (`fbed9725`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | white label | White Label (`85560cb9`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | yema de huevo | Yema de huevo (`d1b12fa4`) | compra | Lácteos y huevos | Activo | 2026-07-10 | 1 | 0 | 0 | 0 | 0 |
| BACANAL | yema de huevo | Yema de huevo (`bdfe4c0a`) | compra | Lácteos y huevos | Activo | 2026-07-30 | 2 | 0 | 0 | 0 | 1 |
| BACANAL | zacapa | Zacapa (`b2001275`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| BACANAL | zacapa | Zacapa (`e695be3a`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| BACANAL | zanahoria | Zanahoria (`5573766a`) | compra | Frutas y verduras | Activo | 2026-06-10 | 2 | 0 | 0 | 1 | 0 |
| BACANAL | zanahoria | Zanahoria (`a64a0f8d`) | compra | Frutas y verduras | Activo | 2026-07-30 | 1 | 0 | 0 | 0 | 1 |
| HABANA | absolut | Absolut (`a0525f1e`) | compra | Alcoholes | Activo | 2026-06-10 | 3 | 0 | 1 | 0 | 0 |
| HABANA | absolut | Absolut (`b720430b`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 0 | 0 |
| HABANA | aguardiente antioqueno | Aguardiente Antioqueño (`bb85a3da`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | aguardiente antioqueno | Aguardiente Antioqueño (`59fb793a`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | al kaher yelow | Al Kaher Yelow (`056ab31f`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | al kaher yelow | Al Kaher Yelow (`d80f3e14`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | alhambra | Alhambra (`c7b5ef11`) | compra | Cervezas | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | alhambra | Alhambra (`50838cbd`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | alma blanco | Alma Blanco (`e92ccf60`) | compra | Vinos y champagne | Activo | 2026-06-10 | 3 | 0 | 1 | 1 | 0 |
| HABANA | alma blanco | Alma Blanco (`c56f19cb`) | venta | Vinos blancos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | alma rosado | Alma Rosado (`24cebca6`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | alma rosado | Alma Rosado (`caad0490`) | venta | Vinos rosados | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | aquabona | Aquabona (`5db9ad8e`) | compra | Refrescos | Activo | 2026-06-10 | 4 | 0 | 1 | 1 | 1 |
| HABANA | aquabona | Aquabona (`166d5bd5`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | aquarius limon | Aquarius Limon (`17764a49`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | aquarius limon | Aquarius Limon (`283158c8`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | aquarius naranja | Aquarius Naranja (`1c9e4977`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | aquarius naranja | Aquarius Naranja (`56f0e7e8`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | ballantines | Ballantines (`40436ae2`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | ballantines | Ballantines (`2b3a20b3`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | base cachimba | Base cachimba (`11d7a178`) | venta | Otros | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | base cachimba | Base cachimba (`6560885a`) | compra | Otros | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | beefeater | Beefeater (`ac3c4ae6`) | compra | Alcoholes | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | beefeater | Beefeater (`68916a58`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | belaire luxe ice | Belaire luxe ice (`93175172`) | venta | Champagne | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | belaire luxe ice | Belaire luxe ice (`13fa1f52`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | belaire rose | Belaire rose (`84d168bd`) | venta | Champagne | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | belaire rose | Belaire rose (`a3a9e696`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | big boy | Big Boy (`c0843041`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | big boy | Big Boy (`e4ebe3ce`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | black label | Black Label (`1a896305`) | compra | Alcoholes | Activo | 2026-06-10 | 4 | 0 | 1 | 1 | 0 |
| HABANA | black label | Black Label (`e356ee4f`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | blue yellow | Blue Yellow (`c04ed83b`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | blue yellow | Blue Yellow (`b29057a8`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | brockmans | Brockmans (`b7f829b7`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | brockmans | Brockmans (`41c6faae`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | brugal | Brugal (`01ef644c`) | compra | Alcoholes | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | brugal | Brugal (`a71c7b08`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | brugal extra viejo | Brugal Extra Viejo (`d1589a2f`) | compra | Alcoholes | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | brugal extra viejo | Brugal Extra Viejo (`7d81db04`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | casper | Casper (`a7116bb7`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | casper | Casper (`773e3c1c`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | catton candy | Catton Candy (`c8eccb17`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | catton candy | Catton Candy (`4cee518a`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | cazoleta cachimba | Cazoleta cachimba (`e3b6dd0b`) | compra | Otros | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | cazoleta cachimba | Cazoleta cachimba (`7effaced`) | venta | Otros | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | chao bella | Chao Bella (`23eb990b`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | chao bella | Chao Bella (`f44de19c`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | chivas | Chivas (`34b663aa`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | chivas | Chivas (`83d862e2`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | ciroc | Ciroc (`20067cf4`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | ciroc | Ciroc (`345740da`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | ciroc coco | Ciroc coco (`e136abf6`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | ciroc coco | Ciroc coco (`944f070b`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | ciroc manzana | Ciroc Manzana (`460fa55e`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | ciroc manzana | Ciroc Manzana (`2c83713e`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | clear little mix | Clear Little Mix (`dd4bfdf1`) | compra | Chuches y picoteo | Activo | 2026-06-10 | 2 | 0 | 0 | 0 | 0 |
| HABANA | clear little mix | Clear Little Mix (`5ab6a841`) | compra | Chuches y picoteo | Activo | 2026-07-30 | 2 | 1 | 1 | 0 | 1 |
| HABANA | cocacola | Cocacola (`1eceb7fd`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cocacola | Cocacola (`85bfdf1c`) | compra | Refrescos | Activo | 2026-06-10 | 5 | 1 | 1 | 1 | 1 |
| HABANA | cocacola zero | Cocacola Zero (`6e5ee441`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cocacola zero | Cocacola Zero (`7ec9e372`) | compra | Refrescos | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | cofrutos melocoton | Cofrutos Melocoton (`6fba5d6f`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | cofrutos melocoton | Cofrutos Melocoton (`e240225c`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cofrutos naranja | Cofrutos Naranja (`30b165b7`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | cofrutos naranja | Cofrutos Naranja (`ba409d14`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cofrutos pina | Cofrutos Piña (`f61d204a`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cofrutos pina | Cofrutos Piña (`f2ef5113`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | coronita | Coronita (`9dab224f`) | compra | Cervezas | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | coronita | Coronita (`108af243`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cotton candy ice 0  | Cotton candy Ice 0% (`b0aec09c`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cotton candy ice 0  | Cotton candy Ice 0% (`7950bca7`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cotton candy ice 2  | Cotton candy Ice 2% (`71113adf`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | cotton candy ice 2  | Cotton candy Ice 2% (`3399170c`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | delizia | Delizia (`88abac66`) | venta | Vinos blancos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | delizia | Delizia (`d2359c8e`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | don julio reposado | Don julio Reposado (`293a50ce`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | don julio reposado | Don julio Reposado (`7395ad91`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | dyc 8 | Dyc 8 (`342d9505`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | dyc 8 | Dyc 8 (`94daf13e`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | fanta limon | Fanta Limon (`65f1147b`) | compra | Refrescos | Activo | 2026-06-10 | 4 | 1 | 1 | 1 | 1 |
| HABANA | fanta limon | Fanta Limon (`58132d1d`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | fanta naranja | Fanta Naranja (`9558951c`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | fanta naranja | Fanta Naranja (`4de5d009`) | compra | Refrescos | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | fight | Fight (`5040389b`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | fight | Fight (`a26bf011`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | four roses | Four Roses (`04480489`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | four roses | Four Roses (`9c7cada6`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | fuze tea | Fuze Tea (`959f66f9`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | fuze tea | Fuze Tea (`3c9dec48`) | compra | Refrescos | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 1 |
| HABANA | g vine | G'Vine (`a9cc3be2`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | g vine | G'Vine (`3035d432`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | gofre | Gofre (`5bc113a7`) | compra | Chuches y picoteo | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | gofre | Gofre (`86c90b72`) | venta | Meriendas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | gold label | Gold Label (`801e7393`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | gold label | Gold Label (`bace9157`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | havana 7 | Havana 7 (`439b3b9a`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | havana 7 | Havana 7 (`1f72c736`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | hawai | Hawai (`e2335da4`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | hawai | Hawai (`e9680643`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | hollenbar | Hollenbar (`76fbdf7f`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | hollenbar | Hollenbar (`ec39302e`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | huracan | Huracan (`d0c486e7`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | huracan | Huracan (`dad168d7`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | jaggermaister | Jaggermaister (`9b6cb50e`) | compra | Alcoholes | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | jaggermaister | Jaggermaister (`2612d162`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | jameson | Jameson (`6b051888`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | jameson | Jameson (`c3a2392b`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | jim beam | Jim Beam (`7b1ef29e`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | jim beam | Jim Beam (`30bc7331`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | jose cuervo | Jose Cuervo (`761eca09`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | jose cuervo | Jose Cuervo (`421b6062`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | kafayayo | Kafayayo (`44677056`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | kafayayo | Kafayayo (`1a6f5a83`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | lady killer | Lady Killer (`d509026e`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | lady killer | Lady Killer (`84f92ea9`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | larios 12 | Larios 12 (`38468afc`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | larios 12 | Larios 12 (`44d304f7`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | larios rose | Larios Rose (`479bab3a`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | larios rose | Larios Rose (`7cd2cdb7`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | licor de crema el afilador | Licor de Crema El afilador (`48607ad0`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | licor de crema el afilador | Licor de Crema El afilador (`08d2988a`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | licor malibu | Licor Malibu (`1688d269`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | licor malibu | Licor Malibu (`d267e22f`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | love 66 | Love 66 (`a7650abd`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | love 66 | Love 66 (`947fc5ab`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | mango tango | Mango Tango (`e3905919`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | mango tango | Mango Tango (`00936952`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | martin millers | Martin Millers (`e365a0da`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | martin millers | Martin Millers (`2670475f`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | martini blanco | Martini Blanco (`60a4c741`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | martini blanco | Martini Blanco (`8111703d`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | martini rojo | Martini Rojo (`a2eb83a5`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | martini rojo | Martini Rojo (`7b380361`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | menthol mojito 0  | Menthol Mojito 0 % (`64d5d32b`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | menthol mojito 0  | Menthol Mojito 0 % (`5f841ae3`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | menthol mojito 2  | Menthol Mojito 2 % (`b22bdbb7`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | menthol mojito 2  | Menthol Mojito 2 % (`f225d2fa`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | missjossy | MissJossy (`b02b2b3e`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | missjossy | MissJossy (`d0baf14d`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | mix goma pica | Mix goma pica (`9c361858`) | compra | Chuches y picoteo | Activo | 2026-06-10 | 4 | 1 | 1 | 0 | 0 |
| HABANA | mix goma pica | Mix Goma Pica (`db787861`) | compra | Chuches y picoteo | Activo | 2026-07-30 | 1 | 0 | 0 | 0 | 1 |
| HABANA | moet chandon | Moet Chandon (`1d0f4ce7`) | compra | Vinos y champagne | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | moet chandon | Moet Chandon (`b08fab50`) | venta | Champagne | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | moon dream | Moon Dream (`650d1d9e`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | moon dream | Moon Dream (`18b286f5`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | my amor | My amor (`a2446b40`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | my amor | My amor (`d928ea17`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | play | Play (`79f51f07`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | play | Play (`6c38dcd2`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | radler tercio | Radler Tercio (`6c2f62cd`) | compra | Cervezas | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | radler tercio | Radler Tercio (`c07a3893`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | red bull | Red Bull (`07375ec5`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | red bull | Red Bull (`e2d84f90`) | compra | Refrescos | Activo | 2026-06-10 | 4 | 0 | 1 | 1 | 0 |
| HABANA | red bull sa | Red Bull Sa (`0187e71b`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | red bull sa | Red Bull Sa (`58d2d418`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | red label | Red Label (`eafe0bf4`) | compra | Alcoholes | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | red label | Red Label (`c30b1ee3`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | rives 1880 | Rives 1880 (`b67e6eab`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | rives 1880 | Rives 1880 (`8a38a531`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | rives exotica | Rives Exotica (`d352c1cc`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | rives exotica | Rives Exotica (`90914811`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | rives pink | Rives Pink (`97f98275`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | rives pink | Rives Pink (`9dfa0a8c`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | royal bliss berry | Royal bliss berry (`76330892`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | royal bliss berry | Royal bliss berry (`66fe17fc`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | royal bliss limon | Royal bliss limon (`7608dcb8`) | compra | Refrescos | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | royal bliss limon | Royal bliss limon (`5680a4fc`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | royal bliss tonica | Royal bliss tonica (`c2718629`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | royal bliss tonica | Royal bliss tonica (`4658cdeb`) | compra | Refrescos | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | san miguel 0 0 | San miguel 0,0 (`06560fbc`) | compra | Cervezas | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | san miguel 0 0 | San miguel 0,0 (`d720ed7a`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | san miguel 0 0 tostada | San miguel 0,0 Tostada (`7b657764`) | compra | Cervezas | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | san miguel 0 0 tostada | San miguel 0,0 Tostada (`4ae871b9`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | san miguel tercio | San miguel Tercio (`9bf0b19c`) | compra | Cervezas | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | san miguel tercio | San miguel Tercio (`504c3de0`) | venta | Cervezas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | santa teresa | Santa Teresa (`b9182671`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | santa teresa | Santa Teresa (`2e1ab52c`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | seagrams | Seagrams (`724d927d`) | compra | Alcoholes | Activo | 2026-06-10 | 4 | 0 | 1 | 1 | 0 |
| HABANA | seagrams | Seagrams (`2528278e`) | venta | Gins | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | sexy sheba | Sexy Sheba (`fcbaf581`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | sexy sheba | Sexy Sheba (`b897eaa2`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | skimo watermelon | Skimo Watermelon (`08d4ebf2`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | skimo watermelon | Skimo Watermelon (`ae31c2f1`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | smirnoff | Smirnoff (`218d1a50`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | smirnoff | Smirnoff (`48b7ea6a`) | venta | Vodkas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | sprite | Sprite (`ebf8b986`) | compra | Refrescos | Activo | 2026-06-10 | 4 | 1 | 1 | 1 | 0 |
| HABANA | sprite | Sprite (`387eba30`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | strawbeery ice 0  | Strawbeery Ice 0% (`0d64efb9`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | strawbeery ice 0  | Strawbeery Ice 0% (`f5aeeb43`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | strawbeery ice 2  | Strawbeery Ice 2% (`4bbcfa3f`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | strawbeery ice 2  | Strawbeery Ice 2% (`43c2e9fc`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | strawberry watermelon bubblegum 0  | Strawberry Watermelon Bubblegum 0% (`d4cd352b`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | strawberry watermelon bubblegum 0  | Strawberry Watermelon Bubblegum 0% (`eb99d523`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | strawberry watermelon bubblegum 2  | Strawberry Watermelon Bubblegum 2 % (`d2527f94`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | strawberry watermelon bubblegum 2  | Strawberry Watermelon Bubblegum 2 % (`11edd2a6`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | tequila de fresa diex | Tequila de Fresa Diex (`852180a3`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | tequila de fresa diex | Tequila de Fresa Diex (`2bae37a9`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | tequila de frutas de pasion diex | Tequila de Frutas de Pasion Diex (`fec86120`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | tequila de frutas de pasion diex | Tequila de Frutas de Pasion Diex (`1b788ef4`) | venta | Licores | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | tinto de verano la casera | Tinto de Verano La Casera (`b17034c8`) | compra | Vinos y champagne | Activo | 2026-06-10 | 2 | 0 | 1 | 1 | 0 |
| HABANA | tinto de verano la casera | Tinto de Verano La Casera (`08512d6d`) | venta | Vinos tintos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | tonica nordic | Tonica Nordic (`0e9bcbc9`) | venta | Refrescos | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | tonica nordic | Tonica Nordic (`60cd26e8`) | compra | Refrescos | Activo | 2026-06-10 | 4 | 1 | 1 | 1 | 1 |
| HABANA | tornado | Tornado (`199596c4`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | tornado | Tornado (`6575315a`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | triple melon 0  | Triple Melon 0% (`9471f1d8`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | triple melon 0  | Triple Melon 0% (`fa085d7a`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | triple melon 2  | Triple Melon 2 % (`440c9624`) | compra | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | triple melon 2  | Triple Melon 2 % (`5ebb183d`) | venta | Vapers | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | white cake | White Cake (`ce606b50`) | venta | Shishas | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | white cake | White Cake (`dbdb3b56`) | compra | Shishas | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | white label | White Label (`48881dc7`) | compra | Alcoholes | Activo | 2026-06-10 | 0 | 0 | 1 | 1 | 0 |
| HABANA | white label | White Label (`9e6572fb`) | venta | Whiskys | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |
| HABANA | zacapa | Zacapa (`727ef9c7`) | compra | Alcoholes | Activo | 2026-06-10 | 1 | 0 | 1 | 1 | 0 |
| HABANA | zacapa | Zacapa (`090293db`) | venta | Rones | Activo | 2026-06-10 | 0 | 0 | 0 | 1 | 0 |

Total: 213 grupos, 426 productos implicados.

Criterio sugerido para elegir "el bueno": el que tenga más referencias (recetas > movimientos > precios); el resto se fusionaría re-apuntando referencias y desactivando el duplicado — NUNCA borrado a pelo.
