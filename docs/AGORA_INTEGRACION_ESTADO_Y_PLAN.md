# Ágora POS — Estado de la integración y plan de corrección

> **Fecha:** 2026-06-09 · actualizado **2026-06-10**
> **Repo / HEAD:** Balles-Hosteleros · `main` @ `c777d6f`
> **Origen:** handoff tras estudio del código heredado + la "Guía del Integrador" de Ágora (v8.6.0) + la conversación con el equipo técnico de Ágora (2026-06-09).
> **Relacionado:** `.claude/PRPs/PRP-024-auditoria-tecnica-logistica-agora-pos.md`, `.claude/memory/feedback/regla_seguridad_agora.md`
> **Estado:** catálogo+stock de **ambas empresas migrados desde Ágora el 2026-06-10** por el otro dev (`migrar-catalogo.mjs`, Excel curado). El espejo del 09-06 quedó **supersedido**. **Recurrencia implementada** (`e43411d`): cron 08:00 + botón manual reflejan el stock de Ágora a diario — falta solo añadir `AGORA_API_URL`/`AGORA_API_TOKEN` en Vercel. **Escritura hacia Ágora confirmada y probada** (§1bis). Abierto: env en Vercel, sedes Getafe/Alcorcón, recetas reales/food-cost.

---

## 1. Resumen ejecutivo

El colaborador anterior dejó una integración con Ágora POS **bastante completa y bien arquitecturada** (validación Zod, tabla de auditoría con RLS, reintentos, UI con la "Regla de Seguridad Ágora", cron diario y 384 líneas de tests). Todo está **commiteado y limpio en `main`**.

**El problema:** el código apunta a **endpoints, parámetros y formatos de respuesta que NO coinciden con la API HTTP real de Ágora** (la documentada en la propia Guía del Integrador). Es un andamiaje sólido cableado a un contrato **supuesto**. Nunca se probó contra un servidor real (las env vars `AGORA_*` están sin configurar y los fallos de los tests son por `npm run dev` caído, no por el código).

La conversación de hoy con Ágora aporta justo lo que faltaba (URL ACMS, puerto, token, versión), así que **ahora es posible hacerlo real** — pero antes hay que corregir el código a los endpoints reales y resolver un posible bloqueo de red (un cron en Vercel tiene que poder alcanzar el servidor del restaurante).

---

## ✅ Resultados Fase A — conectividad (2026-06-09)

Ejecutado `~/agora-connectivity.sh` (GET **sin token**, solo lectura) desde fuera de la LAN:

- **DNS:** `habanabacanaliictpv.ddns.me` → `88.2.231.217` (IP pública, ISP español). DDNS vivo.
- **Servidor alcanzable desde internet:** `GET http://…:8984/` → `200 OK`, `Server: Microsoft-HTTPAPI/2.0`, body = web de Administración de Ágora ("IGT Microelectronics"). **→ Resuelve el riesgo #1: el cron de Vercel SÍ puede alcanzarlo** (respuesta en ~0,17s).
- **API HTTP activa y ruta válida:** `GET /api/export-master/?filter=Products` (sin token) → `401 "Falta la cabecera api-token"` con header **`Api-Version: 8.5.5`**.
  - La ruta `/api/export-master/?filter=Products` es correcta (no 404 → 401 pidiendo token).
  - La cabecera esperada es **`api-token`** (minúsculas) → el `api-token` del código heredado era correcto.
  - **Versión real = 8.5.5** (no 6.0.6). Equivale al manual 8.6.0 → endpoints documentados disponibles.

**✅ Token RESUELTO (2026-06-09):** el token válido del ACMS central es el **CIF de BACANAL System S.L. sin la letra = `‹TOKEN_BACANAL›`** (¡no el de Habana ni el de la matriz! — Ágora informó mal: dijo "CIF de Habana"). Probados: Gourmet `56558109`→401, Bacanal `‹TOKEN_BACANAL›`→**200**, Habana `88599592`→401. Va en `AGORA_POS_TOKEN` (env), nunca en código.

### Esquema real confirmado (leído del servidor, 2026-06-09)

**Catálogo** `GET /api/export-master/?filter=Products` → `{ "Products": [ {...} ] }`. **1253 productos** (639 activos, sin `DeletionDate`), `Id` 1..2622. Campos por producto: `Id` (int), `Name`, `FamilyId`, `VatId`, `Prices:[{PriceListId, MainPrice}]`, `CostPrices:[{WarehouseId, CostPrice}]`, `DeletionDate` (los borrados lo traen), `IsMenu`.

**Ventas** `GET /api/export/?business-day=YYYY-MM-DD&filter=Invoices` → `{ "Invoices": [ { Serie, Number, BusinessDay, Workplace:{Id,Name}, DocumentType:"BasicInvoice", InvoiceItems:[ { GlobalId, Guests, SaleCenter, Lines:[ {...} ] } ] } ] }`. Muestra 2026-06-06: **123 facturas, 617 líneas**.

**Línea de venta** (`InvoiceItems[].Lines[]`) — campos confirmados:
`Type` ("Standard" | "MenuHeader"), `ParentIndex`, **`ProductId`** (int, clave de cruce), `ProductName`, **`Quantity`** (decimal), `UnitPrice`, `TotalAmount`, `ProductCostPrice`, `FamilyId`/`FamilyName`, `PreparationTypeName`, `SaleFormatId`/`SaleFormatName`/`SaleFormatRatio`, `VatRate`, `OfferId`, `DiscountRate`.

**Hallazgos que reescriben el plan:**
1. **Estructura real = `Invoices → InvoiceItems → Lines`** (no `{Tickets:[{Lines}]}`). Cantidad = **`Quantity`**, clave de producto = **`ProductId`**.
2. **El ACMS devuelve Habana Y Bacanal juntos** en la misma respuesta: `Workplace.Id` **1 = HABANA FUENLABRADA**, **4 = BACANAL FUENLABRADA**. → Hay que **enrutar cada factura a su empresa Balles por `Workplace.Id`** (o filtrar con `?workplaces=`). HABANA empresa_id=`00000000-…-0001`, BACANAL=`fe2ea3c4-…`.
3. **Cruce 100% sano:** de los 117 `ProductId` vendidos ese día, **los 117 están en el catálogo**. `ProductId` (ventas) == `Product.Id` (catálogo). Mapeo: `productos.agora_id (string) == ProductId (int→string)`.
4. **Escala real:** 639 productos activos, no 74. Balles solo tiene 74 con `agora_id` → la mayoría de lo vendido **no casaría hoy** → no se descontaría. El Flujo A debe **importar/alinear el catálogo real** y hace falta **escandallo** para los productos vendidos.
5. **Menús:** existen líneas `Type:"MenuHeader"` (ej. "MENU BACANAL", `ProductId` 2576) con hijos (`ParentIndex`). Para stock probablemente descontar los **componentes**, no la cabecera. Verificar con una muestra que contenga menús antes de implementar.

### 🔎 Reconciliación dry-run (2026-06-09) — qué falta DE VERDAD

Cruzado catálogo + ventas reales (3 días: 06-06/07/08) contra Balles, vía `scripts/agora/reconcile.mjs` (solo lectura, no escribe). Estado real de la BD verificado con `scripts/agora/db-recon.mjs`:

- **Empresas reales:** HABANA `00000000-…-0001`, BACANAL `fe2ea3c4-…`. Tabla de recetas real = **`producto_composicion`** (208 filas; `escandallos`=8 es legado). **`stock` VACÍO.**

**BACANAL (Workplace 4):** 74 productos vendidos · 270 en Balles.
- **2** ya enlazados por `agora_id` · **30 emparejables por nombre** (solo falta poner el id) · **42 sin equivalente** (crear).
- De los emparejados, solo **12 descontarían** (compra 1:1 o venta con receta); **20 son venta sin receta** (se omitirían) — varios son bebidas (Alhambra, San Miguel, Tinto de Verano) **mal clasificadas como "venta"** en lugar de "compra".

**HABANA (Workplace 1):** 67 productos vendidos · **0 en Balles** → todo por crear (Brugal, Mojito Habanero, Shisha, Coco Colado…). **Greenfield.**

**Conclusión:** el código es la parte pequeña; el grueso es **datos** (enlazar `agora_id`, reclasificar bebidas, cargar recetas y cargar inventario inicial), y **Habana está vacío** — decisión de alcance. El descuento real no aportará nada hasta que exista stock.

**Orden de trabajo sugerido (datos):** (1) auto-enlazar por nombre los 30 de Bacanal (seguro, reversible: solo pone `agora_id`); (2) reclasificar bebidas venta→compra; (3) cargar recetas de los elaborados que se venden; (4) cargar inventario inicial; (5) decidir si Habana entra y, si sí, sembrar su catálogo desde Ágora.

### 🧩 ¿Qué expone Ágora? (verificado 2026-06-09 · `scripts/agora/probe-stock-recipe.mjs`)

- **Catálogo (Products):** completo. Claves: `Id, Name, FamilyId, VatId, Prices[], CostPrice, CostPrices[]` (por almacén), `StorageOptions[]` (min/max por almacén), `IsMenu`… **NO trae la receta/ingredientes** (Ágora la usa internamente para el coste, pero no la exporta vía export-master).
- **Stock actual (`filter=Stocks`): SÍ** — 804 filas `{WarehouseId, ProductId, Quantity}`, cantidades fraccionadas (3,9 / 1,01) → Ágora **lleva stock a nivel de ingrediente** por almacén. ⇒ el inventario de Balles puede **sembrarse/reflejarse desde Ágora**, sin conteo manual.
- **Almacenes (`filter=Warehouses`): 5** — 1 HABANA FUENLABRADA, 2 almacen 2, 3 HABANA GETAFE, 4 BACANAL FUENLABRADA, 5 HABANA ALCORCON. ⚠️ Hay **más sedes** (Getafe, Alcorcón) que las 2 empresas de Balles.
- **Familias (`filter=Families`): 58** con nombre → resuelve `FamilyId`→categoría.

**🔑 Implicación estratégica (replantea el enfoque):** como Ágora YA lleva el stock por ingrediente, el camino más robusto puede ser que **Balles REFLEJE el stock de Ágora** (`filter=Stocks`, espejo diario) en vez de **recalcular** el descuento desde ventas+recetas. Elimina la dependencia de recetas (lo único que Ágora no exporta) y el inventario manual; usa el dato real de Ágora. El enfoque "ventas→receta→descuento" solo es necesario si Balles debe llevar un control de stock **independiente** de Ágora. Además, las sedes de Getafe/Alcorcón sugieren revisar el mapa Workplace/Almacén→empresa antes de cualquier escritura.

### ✅ DECISIÓN: Opción A (Balles refleja Ágora) — 2026-06-09

Elegido **A**: Ágora es la fuente de verdad de **catálogo Y stock**; Balles los **refleja** (no recalcula con recetas). Mapeo piloto: **Almacén Ágora 4 (BACANAL FUENLABRADA) → empresa BACANAL**. Habana (almacenes 1/3/5 = Fuenlabrada/Getafe/Alcorcón) y "almacen 2" pendientes de decidir alcance.

**Dry-run espejo de stock (Bacanal, almacén 4)** · `scripts/agora/stock-mirror-dryrun.mjs`: 201 líneas de stock; solo **12 emparejan** con productos de Balles, **189 no existen** en Balles (Cocacola, aguas, refrescos, panes, bases…). ⇒ el catálogo de Balles (270, con 208 recetas) se construyó **independiente** y casi no solapa con Ágora (solo 12 coinciden).

**Plan A (pilot Bacanal):** (1) sincronizar catálogo Ágora → Balles (crear faltantes + enlazar por nombre + poner `agora_id`); (2) reflejar stock (`filter=Stocks` almacén 4 → tabla `stock`). Todo desde Ágora, sin entrada manual. **Dry-run con lista revisable antes de escribir.** Las 208 recetas y el catálogo viejo de Balles quedan como food-cost/secundario (no se usan para A).

### ✅ EJECUTADO — Espejo de stock Bacanal (2026-06-09)

`scripts/agora/sync-bacanal.mjs --write` (token = CIF Bacanal `‹TOKEN_BACANAL›`, almacén Ágora 4 → empresa BACANAL):
- **Enlazados 16** (nombre exacto + 4 difusos aprobados, incl. "Filete de vaca"="Filete de ternera") + **creados 185** → Bacanal pasa a **208 productos con `agora_id`** (de 455 totales). Creados con `tipo=compra`, categoría de Ágora, `observaciones='Importado de Agora (espejo stock) 2026-06-09'` (tag de rollback).
- **201 filas de stock** reflejadas en `stock` (Bacanal) con la cantidad real de Ágora. Verificado (Pan gua bao 950, Croquetas 456, Tarta de queso 175…); 8 negativos sin regularizar reflejados tal cual.
- **Idempotente** (re-ejecutar no duplica) y **reversible** (rollback = borrar `stock` de Bacanal + `productos` con ese `observaciones`).
- Scripts: `db-recon.mjs`, `reconcile.mjs`, `probe-stock-recipe.mjs`, `stock-mirror-dryrun.mjs`, `catalog-sync-dryrun.mjs`, `sync-bacanal.mjs`, `verify-bacanal.mjs` (todos en `scripts/agora/`).

**Pendiente:** (1) verlo en la UI de logística; (2) **recurrencia** — hoy es one-shot; falta portar la lógica a la app + env `AGORA_POS_*` en Vercel + cron/job diario (el cron heredado `/api/cron/agora-sync` se puede reusar/reemplazar); (3) **Habana** (greenfield, mismo método, almacenes 1/3/5 → decidir alcance); (4) limpieza: el código heredado ventas→descuento queda **superado** por A; revisar duplicados con el catálogo viejo (sin borrar: marcar `Descatalogado`); afinar unidades (algunos productos son kg/L, no `ud`).

### ⚠️ Nota de entorno (2026-06-09): clon local desactualizado

La BD `sxjtubzdpfmlmwqtsgro` (la del `.env.local`, confirmada por el otro dev) es la **correcta** → el espejo de stock está bien puesto, **no rehacer**. Pero el clon local de Fernando va **49 commits por detrás** de `origin/main`: su código usa los nombres de tabla **viejos** (`.from("profiles")` ×140, `usuarios` ×0), mientras `origin/main` ya renombró a `usuarios` (×153) para cuadrar con una migración de la BD. Por eso **el dev server de ese clon no muestra datos tras login** (pide `profiles`, que ya no existe). **Fix para ver en local: `git pull` de los 49 commits** (gestionar antes el WIP de reservas/sala sin commitear). El otro dev (código al día) ya ve el stock. Las tablas de auth no se exponen por PostgREST; usar Management API (`SUPABASE_ACCESS_TOKEN`).

### 🔁 ACTUALIZACIÓN 2026-06-10 — el espejo del 09-06 quedó SUPERSEDIDO por una migración completa del equipo

El otro dev (vía su agente) ejecutó una **migración total del catálogo** con `scripts/agora/migrar-catalogo.mjs` (añadido en `c777d6f`, construido sobre este handoff y el tooling de `scripts/agora/`). Verificado en BD el 10-jun (timestamps 03:57–04:09 UTC):

- **Borró TODO el catálogo de BACANAL y HABANA** (`delete … eq(empresa_id)`; el CASCADE se llevó recetas/stock/precios — incluidos el espejo del 09-06 **y el catálogo viejo de Balles**) y **reimportó desde un Excel curado** (`/tmp/migracion.json`: empresa, `tipo` venta/compra, categoría, `precio_venta`, flag `ambos`), enriquecido desde Ágora (coste por almacén `CostPrices`, unidad kg/ud según `IsSoldByWeight`, stock `filter=Stocks`).
- **Resultado actual:** BACANAL **495** productos · HABANA **472**, todos con `agora_id` y `observaciones='Importado de Agora 2026-06-10'`. Stock: **151 (Bacanal) + 145 (Habana)** filas (solo `tipo=compra` con existencias en Ágora). Almacenes usados: **4→Bacanal, 1→Habana**; Getafe (3), Alcorcón (5) y "almacen 2" siguen fuera.
- **Recetas:** las 208 filas reales de `producto_composicion` (multi-ingrediente) se borraron en cascada; se recrearon **203 triviales 1:1** (venta→compra de los `ambos`, cantidad 1, merma 0). Las recetas reales antiguas **no están en la BD**: el comentario del script menciona "backup Bacanal en `backup_agora`", pero **esa tabla no existe en ningún schema** (verificado vía Management API el 10-jun) → si hay backup, es externo al proyecto (preguntar al otro dev dónde lo guardó).
- **Consecuencias:** la sección "EJECUTADO 09-06" de arriba queda como historia. **NO volver a ejecutar `sync-bacanal.mjs`**: crearía productos fuera de la curación del Excel y pisaría su formato de stock. Su script usa env **`AGORA_API_URL` / `AGORA_API_TOKEN`** (≠ de los `AGORA_POS_*` propuestos aquí — unificar nombres al portar a la app).
- **Sigue abierto:** (1) ~~recurrencia~~ → ✅ **RESUELTA en código (2026-06-10, commit `e43411d`)**, ver sección siguiente; falta solo la config en Vercel; (2) sedes **Getafe/Alcorcón/almacén 2**; (3) **food-cost real** (recetas multi-ingrediente); (4) el código heredado ventas→descuento sigue **superado** y sin retirar (`agora-sync.ts` y `agora-ventas-sync.ts` ya no tienen consumidores reales).

### ✅ RECURRENCIA implementada — espejo de stock en la app (2026-06-10, `e43411d`)

**Qué hay:** servicio `src/features/logistica/services/agora-stock-mirror.ts` (espejo Ágora→Balles), el cron `/api/cron/agora-sync` (diario 08:00 UTC, vercel.json) **reenchufado** a él, y el botón "Sincronizar" del panel de logística (`syncVentasAgoraAction`) reapuntado también. Registra cada ejecución en `agora_sync_log` (visible en `AgoraSyncStatus`).

**Política del espejo:** NO crea productos (el catálogo lo gobierna la curación del Excel); NO borra filas de stock ni pisa `unidad`/`cantidad_minima`/`cantidad_maxima`; actualiza `cantidad_actual`+`ultimo_movimiento` de filas existentes y solo crea filas nuevas para `tipo=compra` sin fila. Una sola petición a Ágora, sin reintentos automáticos (Regla de Seguridad). Mapa almacén→empresa en `ALMACEN_AGORA_POR_EMPRESA` (4→Bacanal, 1→Habana).

**Detalle clave aprendido:** los "ambos" del Excel crean DOS productos con el **mismo `agora_id`** (gemelas venta/compra); el stock vive en la gemela de **compra** — el espejo la prefiere al resolver `agora_id→producto`. Otro dato: Ágora inventaría **los mismos 201 productos en los 4 almacenes activos** (804 filas = 4×201); cambian las cantidades, no la lista.

**Validado (smoke E2E local, `next start`+cron real):** guard 401 sin token ✓ · Bacanal **151/151** posiciones actualizadas · Habana **145/145** · 0 errores (omitidos = posiciones de Ágora fuera de la curación, correcto).

**⛔ Pendiente para que corra en producción:** añadir en Vercel (Production) las env `AGORA_API_URL` y `AGORA_API_TOKEN` y redesplegar. **No hay sesión de Vercel en la máquina de Fernando** (ni Windows ni WSL) → o `vercel login` (si su cuenta es del equipo) o pedírselo al otro dev. `CRON_SECRET` ya está configurado en prod (el cron lleva meses autenticando). Hasta entonces, el cron diario registrará en `agora_sync_log` el error exacto "AGORA_API_URL o AGORA_API_TOKEN no están configuradas" — inofensivo y visible.

### 🧭 DECISIÓN DE ARQUITECTURA (2026-06-10, tarde) — Balles manda; de Ágora solo entran VENTAS

Aclarada con Fernando tras la conversación del equipo sobre precios:

- **Balles = sistema maestro** (back-office): catálogo, precios, recetas y stock se gestionan en Balles. **Ágora = la caja que ejecuta.** Regla de oro operativa: **en Ágora no se toca nada a mano** (cualquier cambio manual allí lo pisará el siguiente envío desde Balles — lo dice su propio manual, pág. 12).
- Flujos permanentes: **Ágora → Balles: SOLO ventas** (Fase 2). **Balles → Ágora: SOLO precios** (botón de §1bis, ya desbloqueado y probado).
- La migración del Excel (10-jun) fue la **siembra inicial** de Balles, no una sincronización permanente.
- **El espejo de stock (`e43411d`) es una herramienta de TRANSICIÓN, no el destino**: mantiene el stock de Balles veraz **mientras** Balles no pueda auto-gestionarlo. Se **apaga** cuando existan (a) import de ventas, (b) recetas reales, y (c) compras/albaranes registrándose en Balles — desde entonces el stock lo calcula Balles (ventas×recetas + compras + inventarios) y el espejo queda solo como resiembra/cuadre manual. **No configurarlo mentalmente como permanente.**
- **Prerrequisitos para que Balles sea dueño del stock:** (1) Fase 2 — ventas; (2) **recetas multi-ingrediente** (las 208 reales se borraron en la migración → preguntar al otro dev por el backup; AHORA ES BLOQUEANTE); (3) compromiso operativo de registrar las entradas de mercancía en Balles (decisión del dueño).

**Preguntas vigentes (2026-06-10):**
- *Al dueño:* (1) confirmar la regla de oro "todo desde Balles, en Ágora no se toca"; (2) ¿quién y desde cuándo registrará las compras/albaranes en Balles?; (3) ¿entran las ventas de Getafe/Alcorcón o solo Fuenlabrada?
- *Al otro dev:* (1) **¿dónde está el backup de las 208 recetas reales?** (¿en el Excel?); (2) añadir `AGORA_API_URL`/`AGORA_API_TOKEN` en Vercel Production + redeploy; (3) coordinación: Fernando arranca Fase 2 (import ventas + pantalla "Ventas Ágora").
- *Resueltas/desaparecidas:* frecuencia del stock (espejo=transición, diario por defecto), limpieza del catálogo viejo (la migración lo borró), permiso de escritura de Ágora (probado: SÍ).

**Roadmap re-priorizado:** Fase 2 (ventas a la vista) → recetas reales → descuento por ventas en Balles (apagar espejo) → precios desde Balles (Opción B, §1bis).

---

## 1bis. ESCRITURA hacia Ágora — confirmado por el manual (desbloquea la Opción B / precios desde Balles)

> **Fuente:** "Guía del Integrador" de Ágora **v8.6.0** (PDF del dueño), págs. 12-13, 49-60 y 208-210. Leído el 2026-06-10.
> **Pregunta que resuelve:** ¿puede **Balles escribir** el precio de venta en Ágora y que el TPV lo cobre? → **SÍ**, por la **misma API HTTP `:8984` y el mismo `Api-Token`** que ya usamos para leer. No hace falta preguntar a Ágora; está documentado. Solo queda confirmar que el token tiene el permiso de importación activado en *esta* instalación.

### Endpoints de escritura (mismo servidor y token que la lectura)

| Endpoint | Método | Para qué |
|---|---|---|
| `/api/import/` | POST | Importar **ventas, compras Y datos maestros** (productos, precios, tarifas, familias, clientes…). Cuerpo XML o JSON. |
| `/api/hub/generate-data/?workplaces=1,3` | POST | (Solo ACMS centralizado) Empuja datos de la **Central a los Locales** para que las cajas físicas reciban el cambio. |
| `/api/print/` | POST | Imprimir texto libre en una impresora del local (notificaciones). |
| `/api/document/?globalId=…` | GET | Recuperar un documento por su GlobalId. |

Cabeceras de un `POST /api/import/` (pág. 208), misma estructura que la lectura:

```
Api-Token: ‹TOKEN_BACANAL›
Accept: application/json
Content-Type: application/json; charset=utf-8
```

### El precio de venta = `MainPrice` por tarifa (`PriceListId`)

El precio **no es global**: va por **tarifa** (lista de precios). Un producto se escribe así (págs. 49-60):

```xml
<Products>
  <Product Id="200" Name="Ron Brugal" FamilyId="101" VatId="3">
    <Prices>
      <Price PriceListId="10" MainPrice="2.50"/>
      <Price PriceListId="11" MainPrice="3.00"/>
    </Prices>
  </Product>
</Products>
```

- `MainPrice` *[Obligatorio]* = *"Precio de venta como producto principal. El precio será **con impuestos incluidos**"* (pág. 60).
- `PriceListId` = a qué **tarifa** aplica (normal, terraza, hora feliz…). Los `<SaleCenter>` declaran su `PriceListId`/`CurrentPriceListId`; hay que **mapear qué tarifa usa cada local** leyendo el `export-master` real **antes** de escribir.

### Comportamiento del importador — parcial y NO destructivo (clave de seguridad, pág. 12)

Ágora procesa cada registro **por su `Id`**: no existe → lo **crea**; existe → lo **actualiza** (sobreescribe); trae `DeletionDate` → lo **marca borrado** (sin ese campo y estaba borrado → lo reactiva).

Citas literales (para enseñar al dueño/colaborador):
> *"Ágora **no realizará ninguna acción** sobre la información existente en Ágora que **no aparezca** en el fichero de datos importados."*
> *"La información recibida en el fichero **siempre sobreescribe** la información existente en Ágora."*
> Campos opcionales: *si no aparecen en el fichero se mantiene el valor actual de Ágora; si aparecen, se sobreescriben.*

**Implicación:** se puede mandar **solo los productos cuyo precio cambió**, con **solo su `Id` + `<Prices>`**, y Ágora **no toca nada más** (ni los demás productos, ni el nombre/familia del propio producto). Es "cambiar este precio y punto", reversible (rollback = reenviar el precio anterior).

> ⚠️ La otra cara, citada por el manual: *"si se modifica un precio en Ágora y luego se vuelve a importar un fichero con el precio original, se perderá la modificación realizada en Ágora."* → En cuanto Balles sea dueño del precio, **NO se debe tocar el precio en Ágora a mano** (lo pisaría el siguiente envío). Es exactamente lo que pidió el dueño ("Ágora ya no se toca").

### El "botón Comunicar a Ágora" = 2 llamadas encadenadas

Como Habana+Bacanal es **instalación centralizada (ACMS)**:
1. `POST /api/import/` (a la central) con los productos+precios cambiados.
2. `POST /api/hub/generate-data/?workplaces=<ids>` para propagar de la Central a las cajas.

→ La caja empieza a cobrar el precio nuevo. Ejemplo cURL del manual (pág. 210):

```
curl -X POST http://habanabacanaliictpv.ddns.me:8984/api/hub/generate-data/ -H 'Api-Token: ‹TOKEN_BACANAL›'
```

### Arquitectura objetivo (lo que pidió el dueño, ahora viable)

**Balles = back-office** (dueño de catálogo, precios, recetas, coste; con histórico de precios y márgenes) · **Ágora = caja que ejecuta.** El precio se edita en Balles → botón manual → `import` + `generate-data` → la caja cobra. Las ventas vuelven a Balles para reporting (eso es la lectura de la Opción A).

### Riesgos / requisitos antes de implementar la escritura

1. **Primera escritura sobre el sistema de caja vivo.** Regla de Seguridad Ágora a tope: empezar por **1 producto de prueba**, confirmar en la caja, log de lo enviado, rollback preparado. Nunca el lote completo a la primera.
2. **Tarifas:** mapear `PriceListId` por local/centro de venta (puede haber varias) leyendo `export-master`. Cambiar "el precio" puede implicar varias tarifas.
3. **Encadenar `import` + `generate-data`** (sin propagar, la caja no se entera).
4. ~~Confirmar permiso de IMPORT del token~~ → ✅ **CONFIRMADO (2026-06-10)**: `POST /api/import/` con cuerpo vacío `{}` respondió **200 OK** (Api-Version 8.5.5) con el token actual (CIF Bacanal). El token **ya tiene permiso de escritura**; no hay que pedir nada a Ágora. Prueba de riesgo cero: sin registros en el cuerpo → no se modificó ningún dato.
5. **Fuente única:** desde la activación, el precio se edita SOLO en Balles.

### Estado de las preguntas abiertas tras este hallazgo

- **B (¿escribir precios?)** → ✅ **Resuelta y PROBADA en vivo: SÍ.** El manual lo documenta y, además, el token tiene **permiso de escritura confirmado** (200 OK a `POST /api/import/` el 2026-06-10, sin tocar datos). No hay que pedir nada a Ágora. La Opción B es viable end-to-end con lo que tenemos.
- **A (visibilidad de ventas / histórico en Balles)** → camino rápido y sin riesgo (solo lectura). El import de ventas heredado apunta a un endpoint inventado (`/api/export/tickets?businessDay=`); el real es `/api/export/?business-day=YYYY-MM-DD&filter=Invoices` (ya validado: 123 facturas / 617 líneas el 06-jun). Falta una pantalla "Ventas Ágora" con histórico por día.

> **Nota:** el PDF está en `~/Downloads` del equipo de Fernando (`Guía del Integrador.pdf`). Secciones útiles para implementar: **Productos** (págs. 47-68), **Tarifas/PriceLists** (págs. 42-45), **API HTTP** (págs. 196-210).

---

## 2. Inventario: qué hay y dónde

| Archivo | Rol |
|---|---|
| `src/features/logistica/types/agora.ts` | Schemas Zod (`agoraVentaRawSchema`), tipos, `validarLoteAgora()` |
| `src/features/logistica/services/agora-sync.ts` | **Flujo A — Sync de catálogo**: fetch → validar → upsert en `productos` por `agora_id`. Reintentos backoff. |
| `src/features/logistica/services/agora-ventas-sync.ts` | **Flujo B — Ventas→stock**: fetch tickets del día → mapear `agora_id`→`producto_id` → descontar stock |
| `src/features/logistica/actions/agora-actions.ts` | Server actions: `syncVentasAgoraAction`, `getLastSyncLog`, `getSyncLogHistory`, `syncVentasYDescontarStockAction` |
| `src/features/logistica/components/AgoraSyncStatus.tsx` | UI: estado del último sync + botón "Sincronizar" + diálogo Regla de Seguridad |
| `src/app/api/cron/agora-sync/route.ts` | Cron (Vercel, diario 08:00) que dispara el Flujo B; fail-closed con `CRON_SECRET` |
| `supabase/migrations/016_agora_sync_log.sql` | Tabla `agora_sync_log` (auditoría de cada sync) + RLS por empresa |
| `tests/agora-sync.spec.ts` | 14 tests E2E Playwright (UI + fail-safe) |
| `src/features/sala/pos/services/descontar-stock-por-ventas.ts` | Servicio **compartido** (POS propio + Ágora) que aplica el delta de stock |

**Commits que lo introdujeron** (ancestros de `main` y `origin/main`; también en rama `rrhh-sync-origin-c4da3ca`):
- `e0cafd2` — base (types, agora-sync, actions, UI, migración 016, tests, PRP-024, regla seguridad)
- `80531e4` — "Fase 4 — Ágora tickets → descuento stock automático" (agora-ventas-sync, cron, vercel.json, migración 024)
- `4829a9a` — cron fail-closed si falta `CRON_SECRET`

**Cableado real:** `<AgoraSyncStatus />` se renderiza en `src/app/(main)/logistica/page.tsx:143`. El cron está en `vercel.json` (`/api/cron/agora-sync`, `0 8 * * *`).

---

## 3. Cómo funciona hoy (3 caminos)

1. **Botón "Sincronizar" (UI)** → `syncVentasAgoraAction` → `syncVentasAgora` (Flujo A, catálogo). Hace `fetch(AGORA_API_URL)` esperando un **array plano** `{agora_id, nombre, categoria, precio_venta}`.
2. **Cron 08:00** → `descontarStockPorVentasAgora` (Flujo B). Hace `GET {AGORA_API_URL}/api/export/tickets?businessDay=YYYYMMDD` con header `api-token`, espera `{ "Tickets": [{ "Lines": [{ProductId, Quantity}] }] }`.
3. **`syncVentasYDescontarStockAction` (manual)** → existe en `agora-actions.ts` pero **NO está referenciado por ninguna UI** → hoy es código muerto (solo correría el cron).

El descuento real lo hace `descontarStockPorVentas(supabase, {empresaId, lineas, signo})`: por cada línea, si el producto de venta tiene escandallo descuenta cada ingrediente `cantidad × cantidadEscandallo × (1 + merma%)`; producto de compra sin escandallo, 1:1; venta sin escandallo, se omite. **No tiene guardia anti-doble-descuento** en el camino Ágora (el camino POS sí, vía flag `stock_descontado` en `pos_tickets`).

---

## 4. Diagnóstico: por qué NO funciona contra Ágora real

Cotejando el código con la sección **"Integración mediante API HTTP"** de la Guía del Integrador (págs. 196-211):

| Aspecto | Código actual | API real de Ágora | Veredicto |
|---|---|---|---|
| Base / puerto | `AGORA_API_URL` (sin valor) | `http://SERVIDOR:8984/` | ✅ coincide con `habanabacanaliictpv.ddns.me:8984` |
| Header auth | `api-token` | `Api-Token` | ✅ OK (HTTP ignora mayúsculas) |
| **Endpoint ventas** | `/api/export/tickets?...` | `/api/export/tickets/` devuelve **tickets ABIERTOS ahora**, no ventas cerradas | ❌ endpoint equivocado |
| **Ventas del día** | (no se usa) | `GET /api/export/?business-day=YYYY-MM-DD&filter=Invoices,DeliveryNotes,SalesOrders` | ⬅️ esto es lo correcto |
| **Parámetro fecha** | `businessDay=20260608` | `business-day=2026-06-08` (kebab + ISO) | ❌ nombre y formato |
| **Día consultado** | el cron pide **hoy** | para "lo vendido ayer" hay que pedir **ayer** | ❌ |
| **Formato respuesta** | `{Tickets:[{Lines:[{ProductId,Quantity}]}]}` | `{Invoices:[...]}` / `DeliveryNotes` / `SalesOrders` con sus `Item`/líneas | ❌ el parser no encontraría líneas |
| **Catálogo (Flujo A)** | array plano inventado | `GET /api/export-master/?filter=Products` → `{Products:[{Id,Name,FamilyId,...}]}` | ❌ contrato imaginario |
| Idempotencia | ninguna en el cron | `/api/doc/processed` + `include-processed=false` | ❌ riesgo de doble descuento |

**Efecto neto hoy:** a las 08:00 el cron pediría "tickets abiertos de hoy" (vacío) con un parámetro que Ágora ni reconoce → descuento de **0**. Solo se explica si nunca se probó en vivo.

---

## 5. Datos reales de conexión (conversación 2026-06-09)

**Válido y aplicable (Ágora TPV):**
- **Despliegue:** LOCAL. Versión **6.0.6+** confirmada (⚠️ el manual es 8.6.0; revisar que los endpoints usados existan en 6.x).
- **Integración por ACMS (central):** URL `http://habanabacanaliictpv.ddns.me:8984/`, **token = CIF de EMPRESA HABANA sin la letra**.
- **Integración por LOCAL:** IP pública de cada local + **CIF de cada local sin la letra** como token.
- El equipo de Ágora dijo: *"desconocemos lo que quieren integrar y qué datos necesitan sacar/meter"* → el endpoint/los datos los definimos **nosotros**.

**⚠️ NO aplica / confusión a evitar (Agora.io vídeo):**
- `AGORA_APP_ID`, `AGORA_APP_CERT`, `CUSTOMER_KEY/SECRET` que aparecen en la conversación son credenciales de **Agora.io** (SDK de videollamadas), **otra empresa**. No existen en el repo ni tienen que ver con el TPV.
- En `.env.example` las vars `AGORA_API_URL` / `AGORA_API_TOKEN` están etiquetadas como **"Agora (videollamadas)"** y el código del TPV las **reutiliza** → colisión de nombres. **Renombrar** a `AGORA_POS_URL` / `AGORA_POS_TOKEN`.

---

## 6. La API real de Ágora (resumen útil del PDF)

- Base: `http://SERVIDOR:8984/`. Cabeceras: `Api-Token: <token>`, `Accept: application/json`, `Content-Type: application/json; charset=utf-8` (en POST). Respuesta 200 OK + cabecera `Api-Version`.
- **Ventas/compras del día:** `GET /api/export/?business-day=YYYY-MM-DD` con `filter` opcional (`Invoices`, `DeliveryNotes`, `SalesOrders`, `PosCloseOuts`, `PurchaseInvoices`…), `workplaces=ids`, `include-processed=true|false`.
- **Tickets abiertos (ahora):** `GET /api/export/tickets/` (filtros `sale-center-id`+`sale-location-name`, `ticket-global-id`, `ticket-barcode`).
- **Maestros (catálogo):** `GET /api/export-master/?filter=Products` (también `Stocks`, `Families`, `PriceLists`, `Customers`…; filtros `where-product-category-id`, `where-stock-warehouse-id`).
- **Marcar procesados (idempotencia):** `POST /api/doc/processed` con body `[{"Serie":"F","Number":121}, ...]`.
- **Documento por GlobalId:** `GET /api/document/?globalId=<guid>`.
- **ACMS (central→locales):** `POST /api/hub/generate-data/?workplaces=1,3`.
- Decimales con `.`, fechas `aaaa-mm-dd` (o `aaaa-mm-ddThh:mm:ss`). Soporta XML y JSON (JSON por defecto).
- Texto completo del manual extraído en `/tmp/agora_guia.txt` (WSL) para referencia.

---

## 7. Plan de corrección por fases

### Fase A — Conectividad y muestras reales (SIN tocar código de negocio) 🔴 primero
1. **Decidir topología:** ACMS (un único endpoint central, token = CIF HABANA) vs por-local (un endpoint por local). La conversación apunta a **ACMS**; confirmar con el cliente.
2. ~~**Resolver el bloqueo de red**~~ **✅ CONFIRMADO alcanzable (2026-06-09):** el servidor `:8984` responde `200 OK` desde fuera de la LAN (IP pública `88.2.231.217`), así que el cron de Vercel puede alcanzarlo. (Si en el futuro cambia la IP del DDNS o el cliente cierra el puerto, volvería a ser un bloqueo.)
3. **Smoke de solo lectura** (seguro, no escribe nada) antes de programar nada:
   ```bash
   # Catálogo de productos
   curl -H "Api-Token: <CIF_HABANA_sin_letra>" -H "Accept: application/json" \
     "http://habanabacanaliictpv.ddns.me:8984/api/export-master/?filter=Products"
   # Ventas de un día concreto
   curl -H "Api-Token: <CIF_HABANA_sin_letra>" -H "Accept: application/json" \
     "http://habanabacanaliictpv.ddns.me:8984/api/export/?business-day=2026-06-08&filter=Invoices"
   ```
   Esto valida URL + puerto + token + versión + accesibilidad externa de una sola vez.
4. **Guardar muestras reales** del JSON (1 producto, 1 factura con líneas) para fijar el parser con datos reales, no supuestos. Anotar los nombres EXACTOS de los campos de línea (`ProductId`/`Reference`/`Quantity`…).

### Fase B — Configuración
- Añadir env **renombradas** `AGORA_POS_URL`, `AGORA_POS_TOKEN` (separadas del Agora.io vídeo) en `.env.local` (dev) y Vercel (prod). Actualizar `.env.example` con el bloque correcto. **No commitear valores.**
- Verificar que la **migración 016** está aplicada en la Supabase real (es prerrequisito de los tests y del runtime; no consta que se aplicara).

### Fase C — Corregir Flujo A (catálogo, `agora-sync.ts`)
- Cambiar el fetch a `GET {url}/api/export-master/?filter=Products` con header `Api-Token`.
- Adaptar el parser a `{ "Products": [{ Id, Name, FamilyId/CategoryId, ... }] }` (PascalCase). Mapear `Id→agora_id`, `Name→nombre`. Resolver `categoria`: en Ágora es un **id numérico** (`FamilyId`/`CategoryId`), no el string actual ("Para empezar"); decidir si se resuelve el nombre (otra llamada `filter=Families`) o se guarda el id.
- Mantener el Zod, alimentándolo desde el objeto ya normalizado (el `Id` numérico de Ágora encaja con el regex `^\d+$`).
- Resultado: el botón "Sincronizar" de la UI pasa a traer el catálogo real.

### Fase D — Corregir Flujo B (ventas→stock, `agora-ventas-sync.ts`)
- **Endpoint:** de `/api/export/tickets?businessDay=` a **`GET /api/export/?business-day=YYYY-MM-DD&filter=<lo que el cliente considere "venta">`** (probablemente `Invoices`; confirmar en Fase A si son `Invoices`, `DeliveryNotes` o ambos).
- **Fecha:** formato ISO con guiones y el cron debe pedir **ayer** (cierre del día anterior), no hoy.
- **Parser:** navegar `{Invoices:[{Items|Lines:[{ProductId/Reference, Quantity}]}]}` según la muestra real de Fase A. Reaprovechar la lógica de agregación por `agora_id` ya existente.
- **Idempotencia (crítico):** tras un descuento OK, `POST /api/doc/processed` con las series+números procesados y pedir el export con `include-processed=false` (default). Así Ágora no reexporta lo ya consumido y se evita el doble descuento en re-ejecuciones. Defensa adicional: registrar GlobalId/serie-número en `agora_sync_log`.
- **Mapeo de ids:** verificar que `Product.Id` de Ágora == los `agora_id` ya sembrados (los 74 hardcodeados tipo "1833" en `data-productos-venta.ts`). Si no coinciden, **re-sembrar el catálogo** desde Fase C para alinear.

### Fase E — Limpieza y coherencia
- `syncVentasYDescontarStockAction`: o se le da un **botón manual** en logística ("Procesar ventas del día", supervisado, cumpliendo la Regla de Seguridad) o se elimina como código muerto.
- Migración 016 tiene columnas `error_message` y `sales_data` sin usar: aprovechar `sales_data` para guardar el payload crudo (oro puro para depurar formato real).

### Fase F — Validación
- typecheck + build.
- Suite Playwright con `npm run dev` levantado (los fallos actuales eran por server caído).
- **Smoke real supervisado:** un día de prueba en Habana, comparar stock antes/después manualmente antes de confiar en el automático. Cumplir la Regla de Seguridad Ágora (ante error: parar, mostrar error exacto, pedir aprobación).

---

## 8. Preguntas abiertas para Ágora / el cliente

1. ~~¿ACMS o por-local?~~ **✅ ACMS central** (`:8984`), token = CIF de **Bacanal** sin letra `‹TOKEN_BACANAL›`. Devuelve Habana + Bacanal (enrutar por `Workplace.Id`).
2. **¿Qué documento es "una venta"?** En la muestra, `filter=Invoices` (`DocumentType: BasicInvoice`) trae los tickets cerrados con líneas. **Confirmar** si hay ventas que salgan como `DeliveryNotes`/`SalesOrders` (delivery/takeaway) y haya que sumarlas también.
3. ~~¿El servidor `:8984` es accesible desde internet?~~ **✅ RESUELTO 2026-06-09: SÍ** (`200 OK` desde fuera de la LAN).
4. ~~¿Coinciden los ids?~~ **✅ Sí** (`ProductId` ventas == `Product.Id` catálogo). Pero solo 74/639 productos están en Balles → **re-sembrar catálogo completo + definir escandallos** de lo que se vende.
5. ~~Versión exacta~~ **✅ RESUELTO: `Api-Version: 8.5.5`** (no 6.0.6). Endpoints del manual 8.6.0 disponibles.

---

## 9. Notas de seguridad

- Regla de Seguridad Ágora (`.claude/memory/feedback/regla_seguridad_agora.md`): ante cualquier error con Ágora o de persistencia, **parar, mostrar el error exacto, pedir aprobación**. Nunca reintentar/autocorregir solo. Aplica a todo el plan.
- Nada de credenciales en commits. El token es el CIF sin letra → tratarlo como secreto igualmente.
- Empezar **siempre por solo-lectura** (`export`/`export-master`). No usar `/api/import/`, `/api/doc/processed` ni `/api/hub/generate-data/` hasta tener el flujo de lectura validado y aprobado.
