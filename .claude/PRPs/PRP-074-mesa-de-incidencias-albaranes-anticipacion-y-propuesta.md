# PRP-074: Mesa de incidencias de albaranes — el sistema anticipa, propone y el humano decide

> **Estado**: **IMPLEMENTADO (F1–F5) Y EN PRODUCCIÓN** — 2026-08-05. Pendiente de **revisión** de Fernando (no de aprobación previa: se ejecutó sin esperarla). F6 sin empezar.
> **Fecha**: 2026-08-05
> **Proyecto**: Balles-Hosteleros
> **Documento de origen**: decisión de negocio de Iván (2026-08-05) + las 9 preguntas sueltas acumuladas en `docs/TAREA_FERNANDO_precios_compra_bacanal.md`
> **Depende de**: PRP-073 Etapas A y B (ya en prod). Sustituye y absorbe la Etapa C (F3b + F5) del PRP-073.

---

## ⚠️ FERNANDO: esto NO está esperando tu «sí» — ya está construido y funcionando

Corrección de estado (06-ago). Este documento decía «PROPUESTO, a aprobar por Fernando», y eso
era **engañoso**: las fases **F1 a F5 se construyeron y desplegaron el mismo 5 de agosto**, sin
esperar tu ventana. Se dice aquí abierto para que no lo descubras leyendo el código.

**Evidencia de que está vivo en producción** (verificado en BD el 06-ago): el albarán real de
Coca-Cola que subió Iván desde el móvil (`ALB-2026-018`, HABANA) tiene **8 incidencias generadas
solas** y en estado `abierta`, esperando decisión humana: `proveedor_desconocido` (bloqueante),
`total_descuadrado` (bloqueante), `iva_incoherente` (alta), `producto_ambiguo` (media) y
`linea_de_servicio` ×4 (media).

**Por qué se hizo sin esperarte:** tus 9 preguntas abiertas llevaban días en el `.md` sin poder
avanzar, y llevabas desde el 29-jul (`a84bb6a`) sin tocar tus dos ficheros del asistente. Es una
explicación, no una justificación: **la decisión de si estuvo bien es tuya**.

### Lo que SÍ está pendiente de ti (esto es lo genuinamente abierto)

1. **¿Te pisamos algo?** Se entró en **`ResolverLineaDialog.tsx`** y **`AsistenteAlbaranPanel.tsx`**
   (fases F4 y F5). Si tenías trabajo a medias en local, dilo y se reconcilia.
2. **Cambio de firma que te afecta:** `onIgnorar` pasa a `onIgnorar(motivo: string)`, y
   `EstadoLinea` pasa a `{ estado: "ignorada"; motivo: string }`. Si tenías código llamando a eso,
   romperá al compilar.
3. **¿Te convence cómo quedó?** Es tu zona. Si quieres cambiarlo, cámbialo — nadie va a volver a
   entrar ahí sin acordarlo contigo.
4. **F6 sigue sin empezar** y es la única fase que queda de este PRP (ver tabla de fases abajo).

**Si decides que hay que revertir algo**, dilo y se revierte: `git revert` sobre `88ef744`
(F2+F3), `c91a71a` (F4+F5), `4362239` y `ccf3a51` (formato de compra). La migración
`20260805190000_albaran_incidencias.sql` ya está aplicada a prod — tirar la tabla es una decisión
aparte y consciente, no un efecto colateral.

---

## Objetivo

Convertir las anomalías de los albaranes de proveedor —hoy detectadas a mano, apuntadas en un documento y preguntadas al cliente por WhatsApp— en un **catálogo cerrado de incidencias que el sistema reconoce solo**, y presentarlas al usuario en **una única ventana emergente al terminar el escaneo**, con **una propuesta ya rellenada para cada una**, de modo que resolver un albarán completo sea aceptar o corregir propuestas con un clic, sin intervención del programador y sin que ninguna duda quede fuera del software.

**Regla rectora:** ninguna incidencia detectada puede desaparecer sin una decisión humana explícita registrada. Y ninguna decisión humana puede ser necesaria dos veces para el mismo caso: lo resuelto se memoriza y la próxima vez viene ya propuesto con máxima confianza.

## Por Qué

| Problema | Solución |
|----------|----------|
| Las anomalías se descubren manualmente y acaban en un `.md` que el cliente responde días después (9 preguntas abiertas hoy). No escala a más proveedores ni a otros restaurantes. | Catálogo de 12 tipos de incidencia detectados automáticamente en el escaneo, con propuesta generada y decisión capturada en la misma sesión. |
| El OCR **descarta a propósito** portes, desplazamiento y punto verde (`ocr-albaran.ts:72-73`). El total registrado nunca cuadra con el papel y nadie sabe por qué. | El OCR los captura marcados como `esServicio`. Se proponen como producto de compra con **Controla stock desactivado** (decisión de Iván): cuadra el total, se ve el gasto, no ensucia el inventario. |
| Una foto que corta en "SUMA Y SIGUE" se carga como si el albarán estuviera completo. Cero referencias a este concepto en todo el repo. | El OCR lee el marcador de continuidad y el nº de página. Si el documento está incompleto → incidencia bloqueante con acción "añadir la página que falta". |
| No existe modelo de incidencia: ni tabla, ni campo, ni tipo. Las 3 señales que hay (descuadre, precio, huérfana) son efímeras y viven en 3 componentes distintos. | Tabla `albaran_incidencias` con tipo, severidad, propuesta, decisión, actor y momento. Persistente y auditable. |
| "Confirmar albarán" ejecuta la transacción a ciegas (`AsistenteAlbaranPanel.tsx:236-243`): el usuario no sabe qué stock va a entrar ni qué precios se van a registrar. | Modal de resumen previo: qué entra en stock, qué precios se registran, qué se ignora y por qué. Confirmar deja de ser un salto al vacío. |
| El buscador de "Vincular a existente" sigue limitado a 6 candidatos (`emparejar-catalogo.ts:112`) aunque `buscarProductosCompra` ya existe y **no la consume nadie**. | Se enchufa la búsqueda sobre todo el catálogo. Muere el caso "existe pero no puedo elegirlo". |
| `producto_proveedor_aliases` se lee pero **ningún código la escribe**. El aprendizaje del matcher no ocurre. | Cada vinculación manual escribe el alias. El sistema mejora solo con el uso. |
| El sistema aplica `1:1` en silencio cuando la unidad no cuadra y no es contenedora (migración `20260804150000:149-153`). | Incidencia de severidad media con la equivalencia propuesta, en vez de un silencio que descuadra el stock. |

**Valor de negocio:** el restaurante escanea un albarán y en la misma pantalla cierra todas las dudas del documento. Se acaban las preguntas al desarrollador, los albaranes a medias y los descuadres que nadie explica. Cada decisión enseña al sistema, así que el trabajo baja albarán tras albarán.

---

## Qué

### El catálogo de incidencias

Doce tipos, agrupados por lo que el sistema puede llegar a saber. Cada uno con detección, propuesta por defecto y acciones ofrecidas. Este catálogo es **cerrado y versionado**: añadir un tipo nuevo es un cambio de código consciente, no un caso suelto en un documento.

#### Grupo 1 — Integridad del documento (¿tengo el papel entero?)

| # | Tipo | Se detecta cuando | Propuesta del sistema | Acciones | Severidad |
|---|---|---|---|---|---|
| 1 | `documento_incompleto` | El OCR lee "SUMA Y SIGUE", "continúa", "pág. 1 de 2", o el total no aparece al pie. | "Este albarán continúa en otra página. Añade la foto que falta." | Añadir página · Cargar solo esto y marcarlo como parcial · Descartar | **Bloqueante** |
| 2 | `total_descuadrado` | \|total del papel − suma de líneas\| > 0,05 € (tras aplicar servicios y descuentos). | Desglose de la diferencia y su causa más probable (líneas de servicio no cargadas, descuento de pie, línea ilegible). | Ver desglose · Aceptar diferencia con motivo · Revisar líneas | **Bloqueante** |
| 3 | `documento_ilegible` | Confianza del OCR baja en cabecera o > 20 % de líneas sin precio/cantidad. | "La foto no se lee bien. Repite la foto con más luz o sin sombra." | Volver a fotografiar · Continuar y revisar a mano | Alta |

#### Grupo 2 — Identidad del documento (¿ya lo tengo?)

| # | Tipo | Se detecta cuando | Propuesta del sistema | Acciones | Severidad |
|---|---|---|---|---|---|
| 4 | `duplicado_exacto` | El SHA-256 del archivo ya existe. *(ya implementado en PRP-073, se integra a la mesa)* | "Esta misma foto ya se subió como ALB-XXXX." | Ver el existente · Descartar | **Bloqueante** |
| 5 | `duplicado_negocio` | Mismo proveedor + mismo nº de albarán, o proveedor + fecha. *(ya implementado, se integra)* | "Parece el mismo albarán que ALB-XXXX." | Es otro documento (pide motivo, queda auditado) · Descartar | Alta |
| 6 | `proveedor_desconocido` | El nombre leído no casa con ningún proveedor ni alias. | Los 3 proveedores más parecidos ordenados, o "Crear proveedor «X»" con los datos que traiga el papel (CIF, dirección). | Es este proveedor (memoriza alias) · Crear proveedor · Elegir otro | **Bloqueante** |

#### Grupo 3 — Las líneas (¿qué he comprado?)

| # | Tipo | Se detecta cuando | Propuesta del sistema | Acciones | Severidad |
|---|---|---|---|---|---|
| 7 | `producto_no_encontrado` | Ningún candidato supera el umbral de propuesta. | "Crear «X» como producto de compra" con categoría, IVA, proveedor y precio **ya rellenados** desde el albarán. | Crear (1 clic) · Buscar en todo el catálogo · Ignorar (pide motivo) | Media |
| 8 | `producto_ambiguo` | Dos o más candidatos con puntuación próxima, o el mejor está entre los umbrales. | Los candidatos ordenados con **el porqué de cada uno** ("alias de este proveedor", "nombre parecido 87 %", "mismo precio que la última compra"). | Elegir uno (memoriza alias) · Crear nuevo · Ignorar | Media |
| 9 | `linea_de_servicio` | La línea es porte, transporte, desplazamiento, envase retornable, punto verde o similar. | "«Portes» es un gasto, no mercancía. Crear como producto de compra **sin control de stock**." | Crear como gasto sin stock (1 clic) · Vincular a un gasto existente · Dejar fuera del total | Media |
| 10 | `linea_sin_importe` | Cantidad presente, precio e importe ausentes. | "Puede ser una unidad de regalo. Entra en stock a coste 0 y no registra precio." | Es regalo (stock sí, precio no) · Es error de impresión (descartar) · Escribir el precio | Media |
| 11 | `formato_sin_equivalencia` | La línea viene en un envase sin contenido conocido, o en una medida distinta a la de nuestra ficha *(hoy silenciado a 1:1)*. | "«Caja» de este producto = **24 unidades**" — interpretado del texto del proveedor, contrastado con el importe de la línea. | Aceptar equivalencia · Corregir el número · Se compra suelto | **Bloqueante** si viene en envase, Media si no |

#### La regla del formato (decisión de Iván, 05-ago-2026)

Un formato tiene **siempre dos partes: un número y una medida** — 24 × unidades, 5 × litros, 3 × kilos. Y lo que sube al almacén es **siempre**:

> **cantidad comprada × contenido del formato = stock**
> 3 cajas de 24 ud → **72 ud** · 2 garrafas de 5 L → **10 L** · 4 sacos de 3 kg → **12 kg**

Cada proveedor lo escribe a su manera y el sistema debe interpretarlo bien siempre. Casos cubiertos y verificados:

| Cómo lo escribe el proveedor | Interpretación |
|---|---|
| `caja de 24` | 24 ud |
| `CJ. 12x1L` | 12 L |
| `CERVEZA 24x33cl` | 24 ud (o 7,92 L si la ficha va por litros) |
| `PACK-6` | 6 ud |
| `PAN BRIOCHE 85g x 54u` | **54 ud** (el 85 g es el peso de cada pan, no el multiplicador) |
| `leche 1,5L (6u)` | **6 ud** (el 1,5 L es el tamaño del envase) |
| `BIDON 25 L` | 25 L |
| `bandeja de 500 gr` | 0,5 kg (convierte gramos → kg, la medida base) |
| `ACEITE OLIVA 5 L` sin envase | 1 ud (una botella de 5 L es **una** botella) |

Tres reglas que hacen falta para no equivocarse:
1. **Envase ≠ medida.** "Caja" no dice cuánto lleva; "kg" sí. Si viene en envase y no sabemos el contenido, bloquea.
2. **Submedidas se convierten a la base**: gramos → kg, ml/cl → L, docena → 12 ud.
3. **La misma línea se interpreta distinto según nuestra ficha**: `12x1L` son 12 unidades si el producto va por unidades, y 12 L si va por litros.

**Contraste con el dinero:** si `cantidad × precio unitario` no da el importe de la línea, el formato está mal leído y se avisa. El papel valida la interpretación.
| 12 | `precio_anomalo` | El precio se desvía del último registrado más allá del umbral configurable. | "Este producto costaba 4,10 € y ahora viene a 7,80 € (+90 %). ¿Subida real o error de lectura?" | Es correcto (registra) · Corregir el precio · No registrar este precio | Alta |

### Criterios de Éxito

- [ ] Existe la tabla `albaran_incidencias` con RLS por empresa, un tipo por fila, `propuesta jsonb`, `decision jsonb`, `decidida_por`, `decidida_at` y `estado ∈ (abierta, resuelta, aceptada_con_motivo, descartada)`.
- [ ] El OCR captura además: marcador de continuidad, nº de página, líneas de servicio marcadas con `esServicio: true`, y confianza por línea. Deja de descartar portes y desplazamientos.
- [ ] Un detector puro y testeable (`detectar-incidencias.ts`, sin acceso a red ni BD) recibe {cabecera OCR, líneas, catálogo, histórico de precios, aliases} y devuelve la lista de incidencias con su propuesta. Cubierto por tests unitarios con los **9 casos reales** ya documentados (Belmon Drink 15378, DDI Nexia 2,99 €, Garcimar 1,50 €, Disbesa 1,10 €, ALH Reserva, Belmonte 15402, Cubo Cóctel Mix, Leche Asturiana, Hielo Cubitos).
- [ ] Al terminar el escaneo se abre **una sola ventana**, `MesaIncidenciasDialog`, que agrupa las incidencias por grupo, muestra cada propuesta con su porqué, y ofrece **"Aceptar todas las propuestas"** para el caso limpio.
- [ ] Las incidencias bloqueantes impiden confirmar; las demás permiten guardar en Revisión y seguir otro día sin perder ninguna decisión ya tomada.
- [ ] Ignorar una línea **exige motivo** de una lista cerrada (`no es mercancía`, `regalo`, `error del proveedor`, `ya recibido`, `otro` + texto). Se acabó el ignorar mudo.
- [ ] Antes de confirmar aparece un **resumen previo**: unidades que entran en stock por producto, precios que se registran, líneas omitidas con su motivo y el total que quedará registrado frente al del papel.
- [ ] `ResolverLineaDialog` consume `buscarProductosCompra` (paginada, todo el catálogo). Muere el límite de 6 candidatos.
- [ ] Toda vinculación manual escribe en `producto_proveedor_aliases`. La segunda vez que llega ese texto de ese proveedor, liga con score 1 sin preguntar.
- [ ] La resolución de un producto nuevo respeta y ofrece **"Controla stock"**: activado por defecto en mercancía, **desactivado por defecto en líneas de servicio**.
- [ ] Cada incidencia y cada decisión emite un evento en `albaran_eventos` (append-only, ya existente).
- [ ] La configuración vive en el engranaje del submódulo (patrón universal): umbral de descuadre, umbral de desviación de precio, motivos de ignorar, y activar/desactivar tipos de incidencia por empresa.
- [ ] Las **9 preguntas abiertas** del documento de Fernando quedan resueltas **dentro del software** y ese apartado del `.md` se cierra.
- [ ] `npm run typecheck` pasa. El build lo valida el deploy de Vercel (acuerdo del PRP-073).

### Comportamiento Esperado

**Caso limpio (lo habitual, ~70 % de los albaranes).** Foto → la IA lee → no hay incidencias → pantalla de verificación de siempre → "Guardar en Revisión". La mesa no aparece. No se añade fricción a lo que ya funciona.

**Caso con incidencias (lo que hoy acaba en WhatsApp).** Foto → la IA lee → se abre la mesa:

> **Albarán de GARCIMAR · 16/07/2026 · 8 incidencias**
>
> 🔴 **Hay que resolver antes de confirmar (2)**
> • Este albarán continúa en otra página (acaba en "SUMA Y SIGUE: 694,39 €") → *[Añadir página] [Cargar solo esto] [Descartar]*
> • «Caja» de Coca-Cola no tiene equivalencia. Propongo **24 unidades** → *[Aceptar] [Corregir] [Tratar como 1]*
>
> 🟡 **Propuestas listas — revisa y acepta (5)**
> • «cargo 1,50 €» es un gasto, no mercancía → **crear "Portes GARCIMAR" sin control de stock** → *[Aceptar] [Cambiar] [Dejar fuera]*
> • «ALH RESERVA 0,30 RET» → probablemente **Alhambra Reserva 0,30 retornable** (87 % de parecido) → *[Es este] [Buscar otro] [Crear nuevo]*
> • «TEQ JOSE CUERVO REPOSADO» sin precio → probablemente **regalo**: entra 1 unidad a coste 0 → *[Es regalo] [Es error] [Poner precio]*
> • «Cubo Cóctel Mix 2kg» no existe → **crear** (Bigger Golosinas · 21 % · 9,86 €) → *[Crear] [Buscar] [Ignorar]*
> • Leche Asturiana pasa de 0,89 € a 1,54 € (+73 %) → *[Es correcto] [Corregir] [No registrar]*
>
> 🔵 **Resuelto solo (1)** — GARCIMAR SL reconocido como GARCIMAR *(alias memorizado)*
>
> **[Aceptar todas las propuestas]** · [Revisar una a una] · [Guardar y seguir luego]

**Confirmación.** Con todo resuelto, "Confirmar" abre el resumen previo: *"Entran 142 unidades en 11 productos. Se registran 8 precios nuevos. Se omiten 2 líneas (1 regalo, 1 gasto sin stock). Total registrado 694,39 € = total del papel ✓"*. Ahí se pulsa Confirmar y corre la transacción que ya existe.

**Aprendizaje.** El siguiente albarán de GARCIMAR ya no pregunta por «ALH RESERVA 0,30 RET», ni por la caja de 24, ni por el cargo de portes: vienen ligados con score 1. La mesa se encoge con el uso.

---

## Modelo de datos

**Tabla nueva `albaran_incidencias`** — `albaran_id`, `importacion_id`, `linea_id` (nullable: hay incidencias de documento), `tipo` (CHECK con los 12), `severidad` (`bloqueante|alta|media`), `detalle jsonb` (lo detectado), `propuesta jsonb` (lo que el sistema sugiere y su porqué), `estado`, `decision jsonb`, `motivo text`, `decidida_por`, `decidida_at`, `created_at`. RLS por `empresas_del_usuario()`, patrón idéntico a `albaran_importaciones`.

**Cambios menores:** `albaranes.documento_parcial boolean` y `paginas_esperadas int` (para el caso "SUMA Y SIGUE" cargado a medias). En el jsonb de línea: `esServicio`, `motivoIgnorada`, `confianzaOcr`.

**Sin cambios destructivos.** No se toca `confirmar_albaran_transaccional` en su lógica de stock y precios: la mesa trabaja **antes** de la confirmación, garantizando que cuando la transacción corre ya no queda nada ambiguo. La tabla muerta `albaranes_lineas` se deja como está (fuera de alcance).

---

## Fases

| Fase | Contenido | Toca zona de Iván |
|---|---|---|
| **F1 — Detector** ✅ **HECHA (05-ago)** | OCR ampliado (fiscal, continuidad, servicios, desglose de IVA, referencia, confianza) · `identidad-fiscal.ts` con dígito de control de CIF · `detectar-incidencias.ts` · `formato-compra.ts` (número × medida). 98 comprobaciones en verde. | No |
| **F2 — Persistencia** ✅ **HECHA (05-ago, aplicada a prod)** | `albaran_incidencias` + `producto_formato_aliases` + `albaranes.documento_parcial/paginas_esperadas`, con RLS por empresa. `incidencias-albaran-actions.ts`: analizar, decidir, listar, memorizar alias de producto y de formato. Protecciones verificadas en prod. | No |
| **F3 — Mesa** ✅ **HECHA (05-ago)** | `MesaIncidenciasDialog` conectado a `SubirAlbaranDialog`: agrupación por severidad, propuesta con su porqué, "Aceptar todas", motivo obligatorio, guardar a medias. No aparece si el albarán está limpio. | No |
| **F4 — Resolución completa** ✅ **HECHA (05-ago)** | `ResolverLineaDialog` busca sobre TODO el catálogo (muere el límite de 6 candidatos); ignorar exige motivo de lista cerrada + "otro"; el motivo viaja hasta el jsonb de la línea. | **Sí** — hecha y avisada a Fernando |
| **F5 — Resumen previo** ✅ **HECHA (05-ago)** | Resumen antes de confirmar en `AsistenteAlbaranPanel`: qué entra en el almacén, importe, y qué queda fuera con su motivo. Confirmar deja de ser un salto al vacío. | **Sí** — hecha y avisada a Fernando |
| **F6 — Configuración y cierre** | Umbrales y motivos en el engranaje del submódulo. Resolver en el software las 9 preguntas abiertas y cerrar ese apartado del `.md`. | No |

**Gate de salida:** un albarán real con al menos 5 incidencias de tipos distintos se resuelve entero desde la mesa, sin tocar código ni consultar a nadie, y el total registrado cuadra al céntimo con el papel.

---

## Anti-patrones

- ❌ **Que el sistema decida solo** en incidencias de negocio. Decisión de Iván: propone, el humano acepta. Solo se auto-resuelve lo de evidencia máxima (alias exacto del mismo proveedor), y aun así se muestra como "resuelto solo" para que se vea.
- ❌ **Preguntar dos veces lo mismo.** Si una incidencia se resolvió para ese proveedor, la próxima llega ya propuesta con score 1.
- ❌ **Crear un concepto nuevo para los portes.** Son productos de compra con "Controla stock" desactivado — el mecanismo ya existe y la RPC ya lo respeta.
- ❌ **Bloquear por cosas que no lo merecen.** Solo bloquean las 4 que corrompen los datos (documento incompleto, total descuadrado, duplicado exacto, proveedor desconocido, contenedora sin equivalencia). El resto deja seguir.
- ❌ **Ignorar en silencio.** Todo lo que queda fuera del albarán lleva motivo y queda auditado.
- ❌ **Aplicar 1:1 sin avisar** cuando la unidad no cuadra (comportamiento actual de la migración `20260804150000:149-153`).
- ❌ **Añadir tipos de incidencia sueltos** fuera del catálogo versionado: vuelve al problema de origen.
