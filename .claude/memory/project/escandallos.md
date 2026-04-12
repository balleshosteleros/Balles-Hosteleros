---
name: Escandallos = composición del producto
description: Los escandallos son la receta interna de cada producto de venta, no una tabla separada
type: project
---

Los escandallos NO son una lista aparte: son la composición interna (ingredientes + cantidades) de cada producto de venta.

**Why:** Evitar modelar escandallos como entidad independiente con su propia UI; desalinea el modelo de negocio.
**How to apply:** Al crear vistas o queries, tratar escandallos como relación producto_venta → ingredientes. Si el usuario pide "gestión de escandallos", entenderlo como edición del detalle del producto.
