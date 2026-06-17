---
name: Regla de Oro — Balles es la fuente de verdad, Ágora solo vende
description: Producto/catálogo/precios/stock viven en Balles; Ágora solo cobra. Las ventas se importan de Ágora para descontar mercancía y sacar informes por plato
type: feedback
---

**Norma confirmada por el dueño (2026-06-17) para todo el equipo.**

De cara a producto, catálogo, precios y stock, **todo vive en Balles**. En Ágora **solo se vende/cobra**; nada se toca a mano allí. Los precios se cambian en Balles y se enviarán a la caja con un botón (envío de precios, PRP-057).

**Ágora → Balles solo aporta las VENTAS**, y se importan para dos fines:
1. **Descontar mercancía** del almacén vía recetas/escandallos (un plato resta sus ingredientes — kardex, PRP-057).
2. **Informes de ventas valiosos por plato** y demás analítica.

**Matiz sobre descuentos:** en Ágora se aplican descuentos en los tickets que afectan al **importe de la venta** (lo recaudado), pero NO al consumo de mercancía: el stock se descuenta por **cantidad vendida × receta**, independientemente del descuento aplicado en caja.

**Why:** evita doble mantenimiento y divergencias; Ágora es solo TPV de cobro, Balles es el ERP.

**How to apply:** ningún flujo debe escribir catálogo/precio/stock en Ágora; la única dirección de escritura Balles→Ágora es el envío de precios. La única lectura Ágora→Balles relevante es la de ventas. Relacionado: [[modelo_compra_venta_separados]], el espejo de stock matinal (`agora-stock-mirror`) es provisional hasta que las entradas de albaranes se registren en Balles.
