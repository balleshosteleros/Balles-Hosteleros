# Reposición por ventas — lo que falta para desbloquearla (para Iván)

> **De:** Claude (con Fernando) · **Para:** Iván · **Fecha:** 2026-07-01
> Refresco de estado: es "lo siguiente" de compras y ya casi no está bloqueado, pero
> quedan 3 piezas que dependen sobre todo de tu criterio de recetas. Los hallazgos base
> ya estaban en `..._siembra_vs_ingest.md` (§46-48) y `..._ESTADO_Y_PLAN.md` (§49, §120);
> esto los actualiza **después de tu PRP-071**.

## Dónde estamos
- **Reposición por STOCK**: funciona (Incremento 1, sembrado y verificado en ambas empresas).
- **Reposición por VENTAS** (`getSugerenciasPorVentas`, cobertura por días desde ayer): el motor
  **existe pero LEE `productos.ventas_dia_promedio`, que está a 0 en todos** → hoy no propone nada.
- Tu **PRP-071** ya empezó a cargar recetas (escribe en `escandallo_ingredientes`), que era el gran
  bloqueo. **Precios de compra**: acabamos de cargar 85 reales desde tus albaranes (ver
  `..._precios_albaranes.md`), así que cuando esto funcione, las sugerencias saldrán ya con precio.

## Lo que falta (3 piezas)

### 1. Decidir la TABLA DE RECETAS canónica — bloquea todo lo demás
Hay **dos** y con **consumidores distintos**:
- **`producto_composicion`** — la nota de Ágora la da como "tabla real" (208 filas; se recrearon 203
  triviales 1:1 tras el import de Ágora). La usa `descontar-stock-por-ventas.ts` (POS/Ágora).
- **`escandallo_ingredientes`** — donde escribe **tu importador PRP-071**. La lee el dashboard
  **Control de Compras** (`control-compras-actions.ts`).
→ **¿Cuál manda?** El cálculo de `ventas_dia` (pieza 3) tiene que explotar las ventas por **una** de
las dos; si elige la que esté vacía o desactualizada, saldrá 0. **Necesitamos que definas la fuente
única** (o un sync explícito entre ambas). Esto es decisión tuya (dominio de recetas).

### 2. Terminar de enlazar escandallo → producto de venta (tu Fase 4)
Para explotar "vendí plato X" → ingredientes de compra, cada escandallo tiene que estar ligado a su
**producto de venta**. Según tu propio PRP-071, la Fase 4 (enlazar a `producto_composicion` /
producto de venta) quedaba **pendiente de prueba**. Sin ese enlace, la explosión de ventas no sale.

### 3. Construir el cálculo de `ventas_dia_promedio` (esto lo podemos hacer nosotros)
Nadie ESCRIBE ese campo hoy; el motor solo lo LEE. Falta un cálculo:
`pos_tickets` (ventas de platos, ventana de días) → explotar por receta (pieza 1) → consumo diario por
**producto de compra** → escribir `productos.ventas_dia_promedio`.
- Decisión tuya ya tomada: **cobertura por días, ventana "desde ayer"** (hoy no cuenta).
- Ojo dato: `pos_tickets` solo tiene **~1 mes** de histórico (casi todo junio) → el promedio será de
  ventana corta hasta acumular más. La reposición por STOCK no tiene esta dependencia.
- **En cuanto (1) y (2) estén claras, esta pieza la montamos nosotros** (es backend puro, sin tu
  criterio de producto).

## Reparto sugerido
- **Tú (Iván):** (1) qué tabla de recetas es la fuente única, y (2) cerrar el enlace escandallo→venta.
- **Nosotros:** (3) el cálculo de `ventas_dia` en cuanto (1) esté decidido; lo dejamos idempotente.

Dinos la fuente de recetas y si la Fase 4 ya está cerrada, y arrancamos la pieza 3.

---
Relacionado: `..._siembra_vs_ingest.md`, `..._precios_albaranes.md`, `LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md` (§1 por-ventas), `AGORA_INTEGRACION_ESTADO_Y_PLAN.md` (§ recetas / `producto_composicion`).
