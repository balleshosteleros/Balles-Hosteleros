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

---

## ❓ DUDAS DE IVÁN — Fernando, explícale/resuélvele esto

Al repasar estos temas, a Iván le quedaron varias dudas. No necesita entender lo técnico; necesita que le expliques cada punto de forma sencilla y que le digas qué le toca a él (si es que le toca algo). Estas son las dudas, ya desarrolladas:

**Duda 1 — La integración de Ágora con Balles: no la entiende y no sabe qué papel juega él.**
Hay dos maneras de llevar el stock: la que tú montaste (Ágora envía el stock y Balles lo copia) y la que Iván quiere (Balles lleva el stock por su cuenta y de Ágora solo usa las ventas). Iván no acaba de ver qué diferencia hay en la práctica ni qué implica para el día a día del restaurante. Fernando: explícaselo con palabras del negocio (qué cambia para él, qué gana), y confirmad juntos si se revierte/aparca el espejo de stock que ya estaba montado.

**Duda 2 — No tiene claro qué decisiones se le están pidiendo a él.**
En estos temas hay decisiones de dos tipos: las de **negocio** (cómo quiere que funcione el restaurante) y las **técnicas** (cómo se implementa por dentro). Iván se pierde porque no distingue cuáles son suyas. Fernando: sepárale claramente qué decisiones necesitas de él (las de negocio) y qué cosas resuelves tú sin molestarle (las técnicas), para que no sienta que tiene que decidir cosas de programación.

**Duda 3 — Quiere saber, en concreto, qué acción le toca hacer a él.**
Iván solo quiere una lista clara de "esto es lo tuyo". A día de hoy, lo único que dependía de él eran los **albaranes de compra**, y **ya te los ha pasado por WhatsApp**. Fernando: confírmale si con eso ya no tiene que hacer nada más, o si necesitas alguna otra cosa de su parte.

> **Resumen para Fernando:** Iván no necesita entender lo técnico. Cuando habléis, dile de forma sencilla **(a)** qué has hecho tú, **(b)** qué decisiones de negocio necesitas de él, y **(c)** que, aparte de los albaranes que ya te envió, no tiene que hacer nada más (si efectivamente es así).

---

## ✅ RESPUESTA de Fernando/Claude (2026-07-07) — estado real de esta tarea

**La parte de PRECIOS ya está hecha en su grueso desde el 2026-07-01** (parece que esta actualización se escribió sin verlo):

- De **esos mismos albaranes de WhatsApp** (17 fotos, 14 documentos, 128 líneas extraídas con IA y todos los totales cuadrados) **cargamos 85 precios reales en `producto_precios_compra`**: Bacanal 41 + Habana 44 (Dither 32, Belmonte 29, Krittikali 10, Makro 5, Garcimar/Antonio de Miguel/Encinar 3). Verificado en BD; `productos.precio_compra` (vigente) sincronizado.
- **Detalle completo, método y cómo revertir**: `docs/LOGISTICA_COMPRAS_PARA_IVAN_precios_albaranes.md` (commit `877b3da`).
- La consulta de verificación de esta tarea ya baja de 311 → **271** en Bacanal (y 280 → 236 en Habana).

**Lo que FALTA de precios necesita decisiones de NEGOCIO de Iván** (misma nota, secciones A/B/C):
- **A)** 11 casos "¿es el mismo producto?" (ej.: rulo vaca-cabra Makro = ¿"Queso de cabra"?; pan frankfurt brioche = ¿"Pan briocht"?).
- **B)** los panes: ¿el proveedor es SERPESKA, Mozos o Juanito Baker? (no está en `proveedores`).
- **C)** ~28 productos de los albaranes que **no existen en el catálogo** (secreto de cerdo, merluza, corvina, nata, mozzarella, gyozas…): ¿se dan de alta? Muchos son justo los ~28 nuevos de los escandallos.

**Sobre "cargar `albaranes` + `albaranes_lineas`"** (petición nueva de esta actualización): la carga del 07-01 fue **solo de precios**; los albaranes como documentos **no** están registrados. Lo podemos hacer con el mismo tooling (datos ya extraídos), idealmente **después** de las decisiones A/B/C para poder vincular todas las líneas a su producto.

**Enterados y de acuerdo:**
- **Stock: BALLES MANDA** — no tocamos el espejo de Ágora hasta coordinarlo (lane de Fernando).
- **Rotación de clave (PRP-043): descartada** — la quitamos de pendientes.

**Recordatorio:** también espera respuesta `docs/LOGISTICA_COMPRAS_PARA_IVAN_reposicion_por_ventas.md` (qué tabla de recetas manda: `producto_composicion` vs `escandallo_ingredientes`; con eso montamos nosotros el cálculo de `ventas_dia`).
