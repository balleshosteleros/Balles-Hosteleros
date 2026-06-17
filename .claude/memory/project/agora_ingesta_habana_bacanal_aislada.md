---
name: Ágora — solo Habana y Bacanal (Fuenlabrada), empresas aisladas sin datos compartidos
description: De Ágora solo migran/ingieren los 2 locales de Fuenlabrada (Habana y Bacanal). Son empresas distintas y NO comparten ningún dato; cada una solo ve las facturas de su propio workplace
type: project
---

**Decisión del dueño (2026-06-17).** De Ágora solo entran **HABANA y BACANAL** (los dos locales de Fuenlabrada). **Getafe y Alcorcón quedan fuera** — no se migran ni se ingieren.

**Habana y Bacanal son dos empresas TOTALMENTE distintas y NO deben compartir ni un solo dato.** Cada `empresa_id` tiene su propio catálogo, stock, precios y ventas.

**Cómo se garantiza en código** (`agora-ventas-ingesta.ts`):
- `EMPRESA_WORKPLACE` mapea solo: BACANAL → Workplace `4`, HABANA → Workplace `1`. Otras sedes no están mapeadas → no se ingieren.
- La ingesta filtra `Invoices` por `Workplace.Id === workplaceId` de la empresa, y el match de líneas es por **`empresa_id` + `agora_id`** (no global). Así una venta de Habana nunca toca productos/stock de Bacanal.

**Enlace producto Ágora↔Balles:** cada producto (venta y compra) guarda su número de Ágora en `productos.agora_id` (100% poblado en ambas empresas a 2026-06-17). Es la clave para mapear las ventas que manda Ágora al producto correcto en Balles. Ver [[modelo_compra_venta_separados]] y [[regla_oro_balles_fuente_verdad]].
