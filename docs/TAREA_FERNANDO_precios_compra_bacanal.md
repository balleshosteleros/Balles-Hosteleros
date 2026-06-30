# TAREA para Fernando — Precios de compra de BACANAL (cuando bajes el repo)

> **De:** Iván (vía Claude) · **Fecha:** 2026-06-30 · **Prioridad:** media
> Léelo al hacer `git pull` y reconciliar.

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
