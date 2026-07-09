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

**Lo que FALTA de precios necesita decisiones de NEGOCIO de Iván.** Las dejamos AQUÍ completas (detalle ampliado en `docs/LOGISTICA_COMPRAS_PARA_IVAN_precios_albaranes.md`). Responder sí/no por línea basta:

**A) El producto EXISTE pero el nombre difiere — ¿es el mismo (cargamos el precio ahí) o creamos ficha aparte?**
| Línea del albarán | Producto propuesto | Precio | IVA | Proveedor | Empresa |
|---|---|---|---|---|---|
| METRO Chef queso vaca-cabra rulo 1kg | Queso de cabra | 9,75 | 4% | MAKRO | Bacanal |
| PAN FRANKFURT BRIOCHE (85g×54u) | Pan briocht | 37,27/caja | 4% | ANTONIO DE MIGUEL | Bacanal |
| METRO Chef leche entera 1,5L (6u) | Leche | 9,28 (¿por caja de 6?) | 4% | MAKRO | Bacanal |
| FUENTE LIVIANA 1/1 vidrio ret. | Agua Fuenteliviana Grande | 10,54 | 10% | DDI NEXIA | Bacanal |
| FUENTE LIVIANA 1/2 vidrio ret. | Agua Fuenteliviana Pequeña | 11,70 | 10% | DDI NEXIA | Bacanal |
| BENGALAS 60s sin humo 36u | Bengalas (¿o "Bengalas Boom-boom"?) | 14,40 | 21% | KRITTIKALI | Bacanal |
| ALH RESERVA 0,30 RET | Alhambra | 20,41 (efectivo tras dto) | 21% | MAHOU | Bacanal |
| TOALLITA TISSUE 2 capas 3990u | Toallita Tissue Especial | 19,14 | 21% | KRITTIKALI | Habana |
| LAVAVAJILLAS **MANUAL** 5L | ¿Fairy o crear "Lavavajillas manual"? | 5,49 | 21% | KRITTIKALI | Bacanal |
| ENTRECOT DE VACA (€/kg) | ¿Lomo bajo frisona (350gr) o crear "Entrecot"? | 28,90/kg | 10% | ENCINAR | Bacanal |
| FREGONA tejido sin tejer | ¿Fregona Microfriba o crear? | 1,03 | 21% | KRITTIKALI | Habana |

*(En Leche/Pan/Fuenteliviana el precio del albarán es por caja/pack, no por unidad → decidir cómo se guarda.)*

**B) Producto OK pero el PROVEEDOR no existe en `proveedores` — los panes. ¿El proveedor real es SERPESKA, Distribuciones Mozos o Juanito Baker?** (lío de CIFs de la nota original)
| Línea | Producto | Precio | IVA |
|---|---|---|---|
| BURGER POTATO HIGH 75gr | Pan de Hamburguesa (High Potato) | 0,65 | 4% |
| ARTESANITO SEMILLADO 60gr | Artesanillo semillado (60 g) | 0,29 | 4% |
| ARTESANITO 55gr | Artesanillo (55 g) | 0,18 | 4% |

**C) El producto NO existe en el catálogo — ¿lo damos de alta como producto de compra con este precio?** (muchos son justo los ~28 nuevos de los escandallos)
- **Bacanal (Makro salvo indicado):** Mozzarella rallada 2kg 13,55 · Filete pechuga de pollo 7,05/kg · Secreto de cerdo 5,41/kg · Lomo de merluza 15,54/kg · Nata para montar 35% 1,5L 5,86 · Huevo de codorniz (18u) 1,96 · Yema de huevo 1L 11,18 · Helado vainilla 2,5L 6,18 · Gyozas pollo+veg 600g 5,84 · Gyozas veg 600g 5,84 · Corvina 10,89/kg · Chile rojo 100g 2,17 · Citronela 300g 4,46 · Orejones 1kg 17,37 · Tomate deshidratado en aceite 960g 10,33 · Aceite girasol alto oleico 25L 51,50 · Puntalette (pasta) 500g 2,15 · Papel de arroz 300g 2,41 · Salsa tartufata 500g 14,10 · Zumo concentrado de limón 2L 6,05 · Bayeta microfibra 4u (Krittikali) 2,95 · Base de arroz de **PAELLA** (Garcimar; existen carne/pescado/negro pero no paella) 87,00/caja · **Paleta** cebo ibérico 50% loncheada 500g ("La Barrica"; ≠ del Jamón de cebo que ya existe) 31,65 · Fregona tejido sin tejer (Krittikali) 1,03.
- **Habana (Krittikali, menaje):** Tiki porta-vasos Cobra 20,90 · Bowl 8×8×4 Ming 1,08 · Biberón dosificador 1L Araven 1,90 · Lavafrutas apilable 12cm 1,20.

**Nota:** la hoja de **shisha/cachimba** de Habana quedó **excluida** (es un Excel interno, no un albarán; riesgo de desalineación de filas en la foto) → revisarla contra el Excel original antes de cargar nada de ahí.

**Sobre "cargar `albaranes` + `albaranes_lineas`"** (petición nueva de esta actualización): la carga del 07-01 fue **solo de precios**; los albaranes como documentos **no** están registrados. Lo podemos hacer con el mismo tooling (datos ya extraídos), idealmente **después** de las decisiones A/B/C para poder vincular todas las líneas a su producto.

**Enterados y de acuerdo:**
- **Stock: BALLES MANDA** — no tocamos el espejo de Ágora hasta coordinarlo (lane de Fernando).
- **Rotación de clave (PRP-043): descartada** — la quitamos de pendientes.

**D) Recetas — 2 preguntas más (bloquean la reposición POR VENTAS; detalle en `docs/LOGISTICA_COMPRAS_PARA_IVAN_reposicion_por_ventas.md`):**
1. **¿Qué tabla de recetas manda?** Hay dos con consumidores distintos: `producto_composicion` (la usa el descuento de stock por ventas de Ágora) vs `escandallo_ingredientes` (donde escribe vuestro importador PRP-071 y lee Control de Compras). Si nuestro cálculo de `ventas_dia` lee la equivocada/vacía, saldrá 0. Decidid fuente única (o un sync explícito).
2. **¿Está cerrada vuestra Fase 4** (enlazar escandallo → producto de venta)? Sin ese enlace no se puede explotar "vendí plato X" → ingredientes.

En cuanto (1) esté decidido, **nosotros montamos el cálculo de `ventas_dia_promedio`** (hoy nadie lo escribe y el motor de sugerencias lo lee) — eso es técnico y no necesita a Iván.

---

## ⚡ ACTUALIZACIÓN 2026-07-09 — TANDA 2 de albaranes (37 fotos más)

Fernando pasó **37 fotos más** (14 documentos nuevos, fechas 25/06–03/07). Mismo proceso: extracción IA
(todos los totales cuadrados) + emparejado contra catálogo. **195 precios más cargados y verificados**
(Bacanal 83 + Habana 112; total acumulado en `producto_precios_compra` = **280**). El hueco de "sin precio"
baja a **Bacanal 241 / Habana 190** (de 271/236). Reparto por proveedor: DITHER 65, BELMONTE 51, MAKRO 19,
KRITTIKALI 14, COCACOLA 14, BIGGER GOLOSINAS 11, ENCINAR 7, MAHOU 6, SERPESKA 5, ANTONIO DE MIGUEL 2, DDI NEXIA 1.

**4 proveedores nuevos** en esta tanda, todos ya casan con proveedores existentes del catálogo (no hizo
falta crear ninguno): Coca-Cola Europacific Partners, Bigger Golosinas (chuches Habana), Procubitos
(hielo Habana), y el distribuidor Iniciativas Sedox (reparte San Miguel/Corona, mapeado bajo "MAHOU").

**Refuerza las MISMAS dudas del bloque A/B/C de arriba** (Makro repite productos en pedidos distintos:
secreto de cerdo, corvina, aceite de oliva, gyozas, queso vaca-cabra, entrecot, etc. — misma pregunta,
más evidencia). No repito la tabla; las decisiones de A/B/C siguen abiertas y aplican también a esta tanda.

**Casos NUEVOS de esta tanda (no estaban en A/B/C):**
- **"Cubo Cóctel Mix 2kg" (Bigger Golosinas, Habana)** — no existe en catálogo; aparece en 2 albaranes (9,86€). ¿Crear?
- **"Leche Asturiana" (Dither, Habana)** — catálogo Habana solo tiene "Leche Condesada" (producto distinto). ¿Crear "Leche"?
- **Hielo en cubitos 41mm (Procubitos, Habana)** — no encaja con "Hielo Roca" ni "Hielo Pile" del catálogo (0,818€/kg). ¿Crear "Hielo Cubitos"?
- **Vaso de sidra PP desechable 50cl (Krittikali, Habana)** — catálogo solo tiene "Vaso de Sidra Tensionado" (vidrio); material distinto (59,99€/500u). ¿Mismo producto o crear aparte?
- **Un pedido Makro es "PARA PERSONAL"** (no para el restaurante, doc 027174) — cargamos igual sus precios (bacon, carne picada, Coca-Cola) pero **confirma si corresponde** o si hay que excluirlo del gasto de restaurante.
- **"Salsa barbacoa" comprada (Makro, Bacanal)** — el catálogo la tiene como **elaboración** (receta casera); esta línea es la salsa ya envasada de proveedor. ¿Es el mismo producto (y cargamos el precio ahí) o creamos "Salsa barbacoa (compra)" aparte?

**Igual que la tanda 1:** revertible por el tag → `delete from producto_precios_compra where observaciones like '%tanda 2%';`
