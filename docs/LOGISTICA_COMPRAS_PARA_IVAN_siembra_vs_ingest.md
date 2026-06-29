# Logística · Compras — Coordinación: siembra manual vs ingest del Excel

> **De:** Claude (trabajando con Fernando) · **Para:** Iván y su agente · **Fecha:** 2026-06-29
> **Método:** re-discovery de SOLO LECTURA tras sincronizar los 118 commits (25–30 jun). Sonda PostgREST con service-role (solo GET, sin escrituras) + lectura de código. **No se tocó nada en BD ni en código.**
> **Objetivo:** decidir la fuente de verdad de los datos de compras **antes** de que nadie corra el ingest, para no perder trabajo por ninguna de las dos partes.

## TL;DR

- Hay **dos vías de siembra de datos que chocan**:
  1. Lo que sembré yo a mano (proveedores reales + stock máximo provisional) — **vivo en prod**, hace funcionar "reponer por stock".
  2. Vuestro ingest del Excel (`run-ingest.ts`), que **borra y reinserta** productos/proveedores/escandallos y deja todos los ingredientes en MAKRO.
- El ingest **aún no se ha corrido** contra esta BD. Si se corre tal cual, **borra/orfana mi siembra**.
- **Necesito que decidáis A/B/C** (sección 3) antes de que nadie toque datos. Mi recomendación: **C (híbrido)**.
- Además dejo **4 hallazgos secundarios** que probablemente os interesen (sección 4).

## 1. Qué hay sembrado AHORA en prod (verificado en BD hoy)

Sembrado por mí el 25-jun (commits `1dc7fc0` Bacanal, `f588290` Habana; scripts idempotentes con modo `revert` en `scripts/logistica/seed_proveedor_principal_{bacanal,habana}.py`):

- **`ingredientes_proveedor` = 70 filas, TODAS `es_preferido=true`** (1 proveedor principal por producto de compra), derivadas de los 11 albaranes reales:
  - Por proveedor: **DITHER 32, BELMONTE 29, ENCINAR DE HUMIENTA 3, ANTONIO DE MIGUEL 3, GARCIMAR 3**.
  - Por empresa: **Bacanal 32, Habana 38**.
- **`productos.stock_maximo = 10`** (provisional, plano) en esos mismos 70 productos de compra (Habana 38, Bacanal 32).
- Resultado: **"Reponer almacén → por stock" funciona hoy** (`getSugerenciasPorStock` agrupa por proveedor con precios). El motor lee el máximo como `stock.cantidad_maxima ?? productos.stock_maximo`, así que mi `stock_maximo=10` actúa de fallback.

(Tamaños de contexto: `productos` total 977; compra Habana 280 / Bacanal 297.)

## 2. El conflicto: `run-ingest.ts`

`src/features/logistica/services/ingest-from-pdfs/run-ingest.ts` (+ `link-proveedores-default.ts`) es un ingest one-shot que lee `FICHAS TECNICAS - PRODUCTO .xlsx` (ruta del Mac de Iván) y, sobre la empresa:

- `delete()` + reinsert de **proveedores**, **productos de venta**, **productos de compra** y **escandallos**.
- Vincula **todos los ingredientes a MAKRO** como proveedor por defecto (`link-proveedores-default.ts`: `es_preferido=true`, precio = `productos.precio_compra`).

Está **sin ejecutar** contra esta BD (lo confirma que los proveedores vivos son los reales, no MAKRO). **Si se ejecuta tal cual**, recrea los productos con IDs nuevos → mis `ingredientes_proveedor` y los `stock_maximo` quedan huérfanos / se borran, y todo pasa a MAKRO.

## 3. Decisión requerida (dadnos A, B o C y lo ordenamos)

- **A) El Excel manda.** Corréis el ingest cuando tengáis el Excel definitivo; **después** re-vinculo los proveedores reales (5 min con mis scripts, o por UI). Asumimos que cualquier dato manual previo se pierde y se re-aplica tras el ingest.
- **B) La siembra actual manda.** No se corre el ingest sobre esta BD (se reserva para una BD limpia) y seguimos enriqueciendo sobre lo que hay.
- **C) Híbrido (recomendado).** Adaptar `run-ingest.ts` para que cargue **solo lo que falta** —productos de venta + escandallos/recetas— **quitando los `delete()` destructivos** sobre proveedores y productos de compra ya sembrados. Así cargáis recetas sin tirar lo que ya funciona.

## 4. Hallazgos secundarios (vuestra zona, por si no los teníais fichados)

1. **`ventas_dia_promedio = 0`** en todos los productos de compra (ambas empresas) → "reponer por ventas" (`getSugerenciasPorVentas`) no devuelve nada todavía. **Nadie computa ese campo** desde `pos_tickets` × recetas.
2. **Recetas casi vacías**: `escandallos` = 1 fila, `escandallo_ingredientes` = 0. El Excel no se ha ingerido.
3. **Inconsistencia de tabla de escandallos**: `run-ingest.ts` escribe las recetas en **`producto_composicion`**, pero el dashboard de Control de Compras (`control-compras-actions.ts`) las lee de **`escandallo_ingredientes`** (vacía). Si ingerís en `producto_composicion`, el dashboard no las verá → conviene unificar a una sola tabla/relación.
4. **`stock_temporada_reglas` no aparece en el esquema** (PostgREST → 404 `PGRST205`), pero `temporadas-actions.ts` la consulta (`listTemporadas`, `createTemporada`, `updateTemporada`). Tal cual, la pantalla de Temporadas **falla en runtime**. Falta aplicar una migración o cuadrar el nombre de la tabla.

(Notas menores verificadas: `pedidos` = 2 en estado `Pendiente`; `enviado_at` ya existe → la **Decisión 1** de mi nota previa `LOGISTICA_COMPRAS_PARA_IVAN_decisiones_bd_y_whatsapp.md` queda **resuelta por vuestro commit `5e60ecf`**. Sigue abierta la **Decisión 2** (WhatsApp Business/Meta para adjuntar el PDF). `albaranes` = 0; la tabla de líneas real es `albaranes_lineas`.)

## 5. Qué hago yo mientras

A la espera de A/B/C, **no toco datos**. Si os parece, avanzo con la **recepción móvil de albaranes (§5)** —es código, no toca estos datos— salvo que la cojáis vosotros. Decídmelo.

## 6. Cómo verificar (para el agente)

- Siembra viva: `GET /rest/v1/ingredientes_proveedor?select=*` (70 filas, `es_preferido`) y `productos?tipo=eq.compra&stock_maximo=eq.10`.
- Ingest: `src/features/logistica/services/ingest-from-pdfs/run-ingest.ts` y `link-proveedores-default.ts`.
- Inconsistencia de tablas: comparar `producto_composicion` (escribe el ingest) vs `escandallo_ingredientes` (lee `control-compras-actions.ts`).

---

_Relacionado: `docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md` (plan por incrementos), `docs/LOGISTICA_COMPRAS_RESPUESTAS_IVAN.md` (decisiones previas de Iván), `docs/LOGISTICA_COMPRAS_PARA_IVAN_decisiones_bd_y_whatsapp.md` (§4: Decisión 1 ya resuelta, Decisión 2 abierta)._
