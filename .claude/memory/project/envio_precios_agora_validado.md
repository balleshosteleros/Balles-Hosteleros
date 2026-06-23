---
name: Envío de precios Balles→Ágora VALIDADO end-to-end (botón de precios, Opción B)
description: El circuito para publicar precios desde Balles a la caja de Ágora está probado en producción con un cambio real reversible. Falta solo construir la UI/feature. Enfoque — leer el producto del export, cambiar su MainPrice y reenviarlo con sus campos clave + propagar
type: project
---

**Validado 2026-06-23 (Claude, lado Fernando). Para el equipo / agente de Iván.**

El "botón" que quería el dueño (cambiar precios en Balles y publicarlos a la caja) es **viable y está probado de punta a punta en producción**:
- Permiso de escritura: ✓ (token actual, `POST /api/import/`).
- **Cambio real reversible**: producto "Bot Belvedere 3L" (Id 2147), tarifa Bacanal **471,50 € → 471,51 € → 471,50 €**, verificado leyendo Ágora en cada paso. `import` 200 + `generate-data` 200 en cambio y reversión.

**Enfoque validado (NO construir el producto desde cero):**
1. **Leer** el producto del export: `GET /api/export-master/?filter=Products` → `{Id, Name, BaseSaleFormatId, FamilyId, VatId, Prices[]}`.
2. **Cambiar SOLO** el `MainPrice` de la tarifa objetivo dentro de `Prices[]` (Habana = `PriceListId 1`, Bacanal = `10`), dejando el resto igual.
3. **Reenviar** `{Id, Name, BaseSaleFormatId, FamilyId, VatId, Prices}` por `POST /api/import/`.
4. **Propagar** a las cajas: `POST /api/hub/generate-data/?workplaces=<1 Habana | 4 Bacanal>`.

**Claves descubiertas (cada una dio un 500 hasta cumplirla):**
- El import **EXIGE `Name`** (500 "no se puede deserializar Name" si falta).
- **TODOS los productos tienen `BaseSaleFormatId`** (formato de venta) y hay que reenviarlo (500 "formato base no coincide" si falta). No existen productos "simples".
- Por eso el enfoque es **"leer y devolver"**: reenviar la estructura real de Ágora con solo el precio tocado → nunca hay incoherencia. Vale para todos los productos.
- Tarifas con **IVA incluido** (`VatIncluded:true`) → el `precio_venta` de Balles debe ser PVP con IVA.
- Se pueden mandar **varios productos en un mismo `import`** (publicación en lote).
- Precio distinto por formato (copa vs botella) vive en `AdditionalSaleFormats` → caso avanzado, no cubierto por este enfoque básico.

**Estado:** circuito validado; **falta solo construir la feature** — server action `enviarPreciosAgora(empresaId, productoIds?)` + UI (botón en logística/productos), idempotente, con log y confirmación (Regla de Seguridad Ágora). Cruza por `productos.agora_id` (= `Id` de Ágora) y `productos.precio_venta`. Es **zona de Iván** (logística/precios) → coordinar antes de construir. Detalle del manual en `docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md` §1bis. Relacionado: [[regla_oro_balles_fuente_verdad]].
