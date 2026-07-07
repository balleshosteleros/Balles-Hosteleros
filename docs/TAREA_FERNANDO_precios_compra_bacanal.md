# TAREA para Fernando — Precios de compra de BACANAL (cuando bajes el repo)

> **De:** Iván (vía Claude) · **Fecha:** 2026-06-30 · **Actualizado:** 2026-07-07 · **Prioridad:** media
> Léelo al hacer `git pull` y reconciliar.

## ⚡ ACTUALIZACIÓN 2026-07-07 (lo primero que tienes que saber)

- **Iván ya te ha pasado los ALBARANES DE COMPRA por WhatsApp.** Esos albaranes son la **fuente real de los precios de compra** (el precio unitario real de cada producto está en el albarán, línea a línea — NO en las facturas). **Tu tarea: subirlos y grabar los precios** de cada producto.
- Con esos albaranes: cargar `albaranes` + `albaranes_lineas` y unir cada precio a su producto (ver "Lo que necesitamos de ti" abajo).

## Contexto: qué se hizo

Se cargaron en BACANAL los **escandallos (fichas técnicas) del Excel de platos**:
- **22 escandallos**, cada uno ligado a su **producto de venta** (regla nueva: un escandallo SIEMPRE va ligado a un producto de venta/elaboración, mismo nombre).
- **Todos sus ingredientes** ligados a un producto de **compra** o **elaboración**.
- Para completarlos se **crearon ~28 productos nuevos** (pescados: lubina, salmón, sepia, calamar; carnes: bacon, oreja de cerdo en adobo; quesos: cabra, cheddar, curado; panes; y elaboraciones: aliño asiático, salsa kimchi, mayonesa de trufa/chipotle, chimichurri, salsa brava/bacanal/barbacoa, caldo de pescado, picada mediterránea, fingers, patata frita, etc.).

⚠️ **Todos esos productos nuevos están SIN precio de compra.** (Hoy en BACANAL: 0 `albaranes`, 0 `albaranes_lineas`, 0 `producto_precios_compra`.)

## Lo que necesitamos de ti

Cuando subas/proceses las **facturas y albaranes** de proveedores, **unir el precio de compra a cada producto**:

- Modelo: histórico en `producto_precios_compra` (1 producto → N precios con `fecha_inicio`/`fecha_fin`; el vigente = el más reciente). El **IVA va en esa tabla**, no en `productos.iva` (null para compra).
- Emparejar por nombre de producto ↔ línea de albarán/factura (habrá diferencias de escritura, como pasó con los ingredientes; reutilizar el criterio de normalización del importador en `src/features/cocina/services/import-fichas/matcher.ts` si ayuda).

### Ojo con el Excel de Ágora `Compras por Proveedor.xlsx`
Si usas ese informe: la columna **"Base Prod." es el importe TOTAL del periodo, NO el precio unitario**.
- Precio unitario = `Base Prod. ÷ Cantidad Prod.`
- Ese archivo solo trae **bebidas/refrescos** (Cocacola, Aquabona…), no la cocina. Los precios de pescados/carnes/cocina tienen que salir de **tus facturas/albaranes reales**.

## Cómo confirmar que está hecho
```sql
-- productos de compra de BACANAL SIN precio vigente:
select p.nombre
from productos p join empresas e on e.id=p.empresa_id
where e.nombre='BACANAL' and p.tipo='compra'
and not exists (select 1 from producto_precios_compra ppc where ppc.producto_id=p.id);
```
Cuando esa consulta devuelva pocas/ninguna fila → listo.

_Relacionado: `docs/LOGISTICA_COMPRAS_PARA_IVAN_siembra_vs_ingest.md` (tu nota previa)._

---

## Otras decisiones de Iván (2026-07-07) — para que estemos alineados

**1. Stock de Ágora ↔ Balles → BALLES MANDA EL STOCK.**
Confirmado por Iván. El stock lo gobierna Balles; de Ágora **solo necesitamos las VENTAS** ("cuánto se vende"). Balles cruza venta × escandallo → consumo → descuenta stock → genera compras.
- Esto **deja fuera la "Opción A"** que ejecutaste (Ágora copiando stock a Balles: 185 productos + 201 líneas de stock en Bacanal). Ese **espejo de stock hay que revertir/aparcar**.
- ⚠️ Coordinémoslo antes de tocarlo (no toco tu código/datos de Ágora sin hablarlo contigo). El cron `agora-stock-mirror.ts` + botón manual quedan como transición hasta que decidamos retirarlos.
- Lo único común y seguro: mantener alineado el catálogo de **productos de venta** entre Balles y Ágora.

**2. Rotación de la clave de cifrado (módulo Accesos / PRP-043) → CAPADA / DESCARTADA.**
Decisión de Iván: **no se necesita**, no hay que implementar la rotación de `CREDENCIALES_ENCRYPTION_KEY`. No lo tratéis como pendiente.
