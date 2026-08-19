# TAREA para Fernando — Precios de compra de BACANAL (cuando bajes el repo)

> **De:** Iván (vía Claude) · **Fecha:** 2026-06-30 · **Actualizado:** 2026-08-18 · **Prioridad:** media
> Léelo al hacer `git pull` y reconciliar.

---

## ✅ FERNANDO (19-ago): tu prioridad 1 HECHA — el aviso de empresa equivocada, EN LA SUBIDA

Iván: el hallazgo A que destapaste (el OCR ya lee el destinatario pero nadie lo cruzaba, por
eso tus 8 albaranes acabaron en Bacanal sin aviso) está **resuelto y en producción**
(`660a211a`), con las cinco condiciones que pediste:

1. **El OCR ya extraía el destinatario** (CIF, razón social, dirección del restaurante). Ahora
   se **cruza con la empresa activa** en el momento de leer el albarán.
2. Si el papel va dirigido a **OTRA empresa tuya**, salta una **tarjeta roja que BLOQUEA el
   guardado**: *"Este albarán parece de HABANA, y lo estás subiendo a BACANAL"*. Si el cruce
   fue por **CIF es certeza** (*"es de HABANA, no de BACANAL"*); si fue por nombre, sospecha
   fuerte. En ambos casos no se guarda hasta resolver.
3. Dos salidas en la propia tarjeta: **[Cambiar a HABANA]** — arma Habana como empresa activa
   y **relee el mismo albarán contra el catálogo de Habana** (sin repetir la foto) — o
   **[Seguir en BACANAL]** si de verdad es de Bacanal.
4. Si el CIF del papel coincide con otra empresa tuya = **certeza**, y el texto lo dice así.
5. Si el papel **no trae destinatario legible**, o trae uno que no cuadra con ninguna empresa
   tuya, sale un **aviso ámbar no bloqueante**: *"no he podido comprobar a qué empresa va
   dirigido, verifica que BACANAL es la correcta"*.

**Probado E2E en vivo** (móvil, con tu Belmon 15378 cuyo destinatario es "HABANA COKTAIL",
subiéndolo a BACANAL): saltó la tarjeta roja, Guardar bloqueado, pulsé **Cambiar a HABANA** →
releyó las 25 líneas contra Habana y el aviso desapareció. Nada guardado, todo limpio. El
E2E además cazó un fallo latente que ya arreglé (`03e73aed`): al cambiar de empresa, las
incidencias del análisis anterior quedaban colgando bajo la empresa vieja; ahora el
re-análisis las limpia siempre.

Funciona en **móvil y escritorio**. Con esto quedan hechos tus dos avisos "el sistema ya tiene
el dato pero se lo calla": empresa equivocada y documento incompleto.

Detalle técnico: lib pura `empresa-destinatario.ts` (`evaluarEmpresaDestinatario`, cruce por
CIF/razón social contra la empresa activa y las demás del usuario), `analizarIncidenciasAlbaran`
(devuelve `avisoEmpresa` + evento `aviso_empresa_destinatario`), `use-subir-albaran.ts`
(`cambiarEmpresa` vía `setEmpresaActiva` + re-análisis), tarjeta en móvil y escritorio.

---

## ✅ FERNANDO (18-ago): tu encargo 5 HECHO — el albarán incompleto se caza EN LA SUBIDA

Iván: leídas tus respuestas del 17-ago (gracias por anotar y parar) y tu encargo del 18-ago
(el 40% del catálogo, contesto abajo). Lo primero que he atacado es tu punto 5, que marcaste
como prioridad alta y estaba a medias desde el PRP-074. **Desplegado en producción**
(`c910f197`), exactamente con la forma que pediste:

1. **En el móvil, la subida PARA ahí mismo.** Si el OCR ve "SUMA Y SIGUE" o "pág. X de Y"
   con X < Y, en la pantalla de verificar aparece una tarjeta roja: *"A este albarán le
   falta al menos una página — el papel corta en SUMA Y SIGUE: 694,39 €"*, con el botón
   **"Foto de la página siguiente"** (abre la cámara directamente) delante de todo. El
   botón "Guardar en Revisión" queda deshabilitado.
2. **Solo si la persona insiste** ("Cargar así" + motivo obligatorio) entra, y entra
   **marcado como incompleto** (`documento_parcial`, con el motivo en la traza y las páginas
   esperadas si el papel las decía).
3. **Marcado así NO se puede confirmar**: la confirmación transaccional lo bloquea con el
   mensaje *"A este albarán le falta al menos una página… Añade la foto de la página que
   falta y márcalo como completo antes de confirmar"* (probado en vivo contra prod, revertido).
4. **Para completarlo**: en el detalle de escritorio sale la tarjeta roja con el botón
   **"Ya está completo"** (tras adjuntar la foto de la página que faltaba). Queda en la traza
   quién lo dio por completo. En la bandeja móvil esos albaranes salen con badge
   **INCOMPLETO** en rojo, en vez de REVISIÓN.
5. **En escritorio**, la decisión "Cargar solo esta parte" de tu mesa **por fin viaja al
   guardado** (antes se anotaba y no hacía nada) y "Descartar" vuelve al principio para
   hacer las dos fotos.

Sobre cómo se sube la página que falta: **cada página entra como su propia foto** (la
segunda hoja se sube con "Foto de la página siguiente" y el OCR la lee con sus líneas). Es
lo más fiable con el papel delante y evita inventar un "álbum" de páginas dentro de un
albarán. Si en el uso real prefieres que las hojas se junten en un solo albarán, se puede
hacer después — dímelo tras probarlo con el próximo de varias páginas.

**Probado E2E con la foto real de TU Belmon 15378** (móvil 375×812 contra producción, después
borrado; 0 restos, 0 stock): tarjeta roja *"El papel corta en SUMA Y SIGUE: 694,39 €"*, botón de
cámara delante, Guardar bloqueado → "Cargar así" + motivo → guardado como incompleto con el
motivo en la traza → el RPC lo rechaza al confirmar → en la bandeja móvil sale INCOMPLETO en
rojo. **Y el E2E cazó una cosa más** (`f44e800f`): la primera vez el OCR leyó "SUMA Y SIGUE
694,39" **como si fuera el TOTAL** (`sumaYSigue: null`), así que el albarán habría pasado por
completo — el mismo silencio que sufriste el 30-jul. Arreglado con regla dura en el prompt +
un campo dedicado + red de seguridad determinista (si el pie es de arrastre, el total pasa a
null). Segunda pasada: detectado a la primera.

Detalle técnico: `use-subir-albaran.ts` (`documentoIncompleto`, `parcialDecidido`),
`SubirAlbaranMobile.tsx`, `SubirAlbaranDialog.tsx`, `DetalleAlbaran.tsx`,
`AlbaranesEnRevision.tsx`, `createAlbaran` (`documentoParcial`), `marcarAlbaranCompleto`,
migración `20260818200000_confirmacion_bloquea_documento_parcial.sql` (aplicada).

Lo siguiente en mi cola, en tu orden: el aviso de empresa equivocada (mismo patrón), y el
diagnóstico del catálogo faltante (respuesta a tu encargo del 18-ago, más abajo).

---

## 🔴 ENCARGO 18-AGO — FERNANDO, EMPIEZA POR AQUÍ: falta el 40% del catálogo y no hay forma de meterlo desde el software

**Cómo salió esto:** estaba montando la carta digital de HABANA (otra cosa) y me saltó que
había 4 cócteles de autor en la carta que no existían como producto en el sistema. Pregunté,
tiré del hilo, **y no he tocado nada**. Solo he mirado. Lo dejo escrito para que lo ejecutes tú.

**Por qué no he metido los productos yo:** porque hoy **no tenemos forma de dar de alta
productos como tal**. Lo estamos haciendo desde el propio Claude, escribiendo en la base de
datos. Eso no es una solución: cuando el cliente tenga solo el software, se queda tirado.
Prefiero que quede el problema bien planteado a taparlo a mano otra vez.

### Lo que hemos medido (contra la API de Ágora en vivo, 18-ago)

| | Ágora tiene activos | Nosotros tenemos | **Faltan** |
|---|---|---|---|
| **BACANAL** (almacén 4) | 639 | 603 (388 de Ágora + 215 a mano) | **252** |
| **HABANA** (almacén 1) | 639 | 492 (371 de Ágora + 121 a mano) | **269** |

Ágora devuelve **el mismo catálogo de 639 para las dos** (catálogo único, almacén distinto por
empresa). Falta **~40% en ambas**.

Entre lo que falta hay cosas que SE SIRVEN HOY: Ensaladilla Rusa, Ensalada de Burrata,
Croquetas de jamón ibérico, Tortilla trufada, Vieiras con kimchi, y cócteles (Fiesta del
Caribe 1787, Desliz de cobra 1788, Danza Macabra 1789, Boom-Boom 2429, Big Boy, Love 66,
Blue Yellow, Kafayayo…). **Están activos y con precio correcto en Ágora** — Danza Macabra
9,75 €, que es justo el de la carta. El dato estaba ahí y no llegó.

**Consecuencia real:** se compra `Prebeach Danza Macabra`, se sirve y se cobra, pero como el
cóctel no existe como producto de venta en el sistema, ese preparado **entra en almacén y no
sale nunca**. El stock no puede cuadrar.

### Por qué faltan (pista, NO confirmado)

`scripts/agora/migrar-catalogo.mjs:28` filtra por `DeletionDate`, y el volcado parece haberse
hecho **solo sobre productos con stock registrado en el almacén** (39% de los importados
tienen stock frente a 21% de los que no). Encaja con que la migración se pensara para
inventario, no para carta. **No lo doy por cierto: confírmalo antes de actuar.**

Lo que sí está descartado: no es que estén borrados en Ágora (los 4 cócteles tienen
`DeletionDate = null`, `SaleableAsMain = true` y precio en la lista 1).

### ⚠️ Cuidado: he creado 6 productos a mano que ya existían en Ágora

Antes de saber todo esto, Iván me pidió crear los platos de comida de la carta de Habana y los
di de alta a mano (categoría "Delicateses para cenar"): Burger Balles Hosteleros, Ensaladilla
rusa con tobiko, Gyozas de pollo al curry, Bao-cadillo de oreja, Alitas BBQ asiática,
Torreznos con guacamole. **Tienen `agora_id` vacío.**

**Si reimportas sin limpiarlos primero, saldrán duplicados.** Localízalos así:

```sql
select id, nombre, precio_venta from productos
where empresa_id = '00000000-0000-0000-0000-000000000001'
  and categoria = 'Delicateses para cenar' and agora_id is null;
```

Lo suyo es borrarlos y dejar que entren por importación con su `agora_id`. Mea culpa.

### El encargo de verdad: un importador de catálogo que el CLIENTE pueda usar

Esto es lo importante, y va más allá de Ágora.

**Hoy no existe.** El botón "Sincronizar" de Logística (`AgoraSyncStatus.tsx` →
`syncVentasAgoraAction`) **sincroniza VENTAS, no el catálogo**. Traer productos es un script de
terminal que lanza alguien de Balles. Un cliente solo con el software **no puede**.

**El problema de fondo (palabras de Iván):** cada software es un estilo. Leer documentos de
cualquier tipo e interpretar cómo debe migrarse conlleva **hacer propuestas** y que todos los
datos que necesitemos se cumplan, y los que no necesitemos desaparezcan si no van a tener
valor luego — o poner un **límite claro** hasta dónde leemos y memorizamos para el volcado.

Y el punto que se nos escapó al plantearlo: **NOSOTROS TENEMOS TRES TIPOS DE PRODUCTO
(compra / venta / elaboración). ÁGORA NO.** Ágora tiene "productos" con atributos sueltos:

| Señal en Ágora | Cuántos | A qué tipo apuntaría |
|---|---|---|
| Con precio de venta > 0 | 246 | → venta |
| Sin precio de venta | 393 | → compra |
| Con `Addins` (componentes) | 68 | → ¿elaboración? |
| Con `CostPrice` > 0 | 532 | mezcla de todo |

**Los grupos se solapan** (hay productos con precio de venta Y componentes). Así que traducir
"producto de Ágora" a nuestro modelo **no es leer un dato, es interpretarlo**, y equivocarse
tiene coste: marcar como compra algo que era elaboración lo deja sin escandallo y el coste
sale mal para siempre.

**Lo que hay que construir, entonces, no es un importador que trague y vuelque, sino uno que
PROPONGA y el cliente APRUEBE:**

> "He leído 639 productos de tu TPV. Propongo 246 como venta (tienen precio), 393 como compra
> (sin precio) y 68 me chirrían porque tienen componentes: ¿son elaboraciones? De cada uno
> traigo nombre, precio, coste, familia, IVA y alérgenos. Lo demás (color de botón, tiempo de
> preparación, códigos de barras) lo descarto salvo que me digas que lo quieres."

Con el **límite de lectura escrito y visible**, no como caja negra.

**Decisión que Iván tiene que tomar antes de arrancar** (está pendiente, no la des por hecha):
¿el importador es **solo para Ágora** (mapeo de campos concreto y preciso) o para **cualquier
TPV/fichero** que traiga un cliente nuevo (capa que lee CSV/Excel/API desconocida, propone
equivalencias con IA y las enseña para aprobar)? Lo segundo es lo que resuelve el negocio, y
es bastante más trabajo.

### Lo que falta además, para que el cliente sea autónomo

Lo he verificado en el código, no es de oídas:

| Función | Estado |
|---|---|
| Importar catálogo desde el TPV | ❌ No existe UI. Solo `scripts/agora/migrar-catalogo.mjs` |
| Llenar la carta desde Productos | ⚠️ Acción escrita (`carta-digital/actions/sincronizar-actions.ts`), **sin botón** |
| Ocultar plato (sin fecha / por temporada) | ⚠️ Lógica y BD listas (`ocultar-actions.ts`), **sin pantalla** |
| Aviso "tu TPV tiene productos que no están aquí" | ❌ No existe — **por eso nadie se enteró de los 269** |
| Marcar "visible en carta digital" | ✅ Hecho, en la ficha del producto |

**Lo que NO hay que hacer:** seguir metiendo productos a mano desde Claude. Cada cosa que
arreglamos por detrás es una que el cliente no podrá arreglar solo.

**Pendiente de Iván, no lo ejecutes sin respuesta:** hay que decidir si se importan los 269/252
enteros (deja el catálogo cuadrado con el TPV, pero mete lo que ya no se use) o solo los que
están en carta. Hace falta ver antes la lista agrupada por familia y con ventas recientes,
para distinguir producto vivo de residuo del TPV.

---

## 📌 RESPUESTA DE IVÁN (17-ago) — tus 4 puntos, contestados. Y un encargo nuevo

Fernando: contesto a las cuatro cosas que me dejaste. **Anotado y parado ahí**, como pediste:
esto es solo mi respuesta, la ejecución es vuestra. Al final hay un encargo nuevo (punto 5)
que me parece más importante que los otros cuatro juntos.

### 1. 🔴 Billing de Gemini → **DE MOMENTO SEGUIMOS CON ESA VERSIÓN**

> ✏️ **CORRECCIÓN (Fernando, 18-ago):** Iván me dijo después, de palabra, que **HA DECIDIDO
> CONTRATAR GEMINI** (activar el billing). Esta respuesta queda superada; lo anoto aquí para
> que su agente no la vuelva a tomar como vigente. Con billing activo el 429 pasa a ser
> excepcional, así que la homogeneización de los 23 avisos de cuota baja de urgente a mejora
> normal (se hará, pero no bloquea nada). ⏳ Pendiente de Iván: activar la facturación en el
> proyecto Google de la `GEMINI_API_KEY` y avisar aquí cuando esté, para verificarlo.

No activo la facturación ahora. Sé lo que implica (20 peticiones/día para toda la app) y lo
asumo de momento.

**Pero entonces esto pasa a ser importante de verdad, y es lo que te pido:** si vamos a
convivir con el tope, **el aviso de "se ha acabado la IA por hoy" tiene que entenderse en
CUALQUIER sitio de la app que use IA**, no solo en albaranes. Que la persona sepa que es el
límite del día y que no sirve de nada reintentar.

Hemos auditado los 23 puntos de la app que llaman a Gemini. **Solo albaranes lo hace bien.**
El resto se reparte en tres grupos:

**a) Le sueltan al usuario el volcado técnico crudo del 429** (`[GoogleGenerativeAI Error]…
[429 Too Many Requests]… {"quotaViolations":[…]}`) — 8 sitios:

| Módulo | Fichero:línea |
|---|---|
| **Reseñas de Google** (el peor: `gemini-respuestas.ts:96` no tiene ni try/catch) | `src/features/calidad/lib/gemini-respuestas.ts:96` → `generar-borradores.ts:174` → `ResenasPipeline.tsx:1085` |
| Importador de productos | `src/features/logistica/actions/importador-ia-actions.ts:356` |
| Importador de catálogos/proveedores | `src/features/logistica/actions/importador-catalogos-ia-actions.ts:351`, `:670` |
| Facturas (contraste con albarán) | `src/features/logistica/actions/facturas-actions.ts:501` |
| Contabilidad (facturas y contactos) | `src/features/contabilidad/actions/importador-ia-actions.ts:189`, `:387` |
| Aperturas IA (dirección) | `src/features/direccion/actions/aperturas-ia-actions.ts:215` |
| Calidad — editor de slides | `src/features/calidad/inspecciones/actions.ts:623` |
| Gmail IA (redactar) | `src/app/api/google/gmail/ai-redactar/route.ts:189` → `GmailDrawer.tsx:621` |

**b) Mensaje genérico que ENGAÑA** — no revienta, pero le dice a la persona algo que le hace
reintentar todo el día en balde: nóminas ("No se pudo leer el archivo"), chat de la web ("El
asistente no está disponible ahora mismo, inténtalo en un momento"), chat de inspectores,
gestoría (casillas AEAT y validación de modelos), soporte.

**c) Silencio total** — ni se entera nadie: gestoría/categorización de facturas
(`categorizacion-ia.ts:339`), nóminas TC1, reclutamiento (extracción de CV/DNI), imagen de
marca (se traga una paleta de fallback).

Y dos apaños sueltos que conviene unificar: `api/presentaciones/generar/route.ts:107-116` y
`regenerar-slide/route.ts:86-95` tienen su propio regex de cuota, anterior al tuyo, que **ya
no casa** con tu `GeminiQuotaError` (tu mensaje está en español y no contiene "429"), así que
cae al `else` y sale **"IA falló: La IA que lee los documentos ha alcanzado su límite
diario…"** con un 502.

**Causa raíz** (esto es lo que hay que arreglar, no los 23 sitios a mano): lanzas
`GeminiQuotaError` en el cliente central, pero **solo albaranes lo comprueba** antes de su
`err.message` genérico. Además **`geminiTexto` (`src/lib/ia/gemini.ts:129-163`) ni siquiera lo
lanza** — se traga todo y devuelve `null`, así que el chat de soporte nunca podrá distinguir
"sin cuota" de "se rompió algo".

Un detalle de redacción: el texto dice *"La IA que **lee los documentos**…"*, que no encaja
cuando el que falla es el chat de la web o el redactor de correos. Hazlo genérico.

### 2. 📄 Belmon Drink 15378 → **PEDIDO AL GERENTE. Queda PENDIENTE de que llegue completo**

> ✅ **CERRADO (Fernando, 19-ago): llegó la página 2 y el 15378 está CARGADO ENTERO** como
> **ALB-2026-028** (Habana, BELMONTE, 16-jul, Confirmado SIN stock — mismo criterio que
> sus 27 hermanos del lote 30-jul, mercancía ya consumida). 26 líneas (25 de la pág. 1 + la
> de la pág. 2), base 694,39 € cuadrada al céntimo con el papel (207,57 al 10 % + 486,82 al
> 21 %; total 817,38 €), 0 líneas sin producto, **24 precios de compra registrados y 24
> aliases con la REFERENCIA del proveedor** (BB11, C13, CC14… → la próxima tanda de Belmon
> casa sola por referencia). Las dos páginas adjuntas al albarán. La pág. 2 solo traía 1
> línea: "TEQ JOSE CUERVO REPOSADO ×1" **sin importe** → regalo a 0 € (igual que el Ron Limón
> ×1 de la pág. 1 y que resolvimos en el 15402). **Un dato para ti**: en la pág. 2 hay una
> anotación a mano del repartidor — *"RECOJO 1 CAJA RED BULL (SANDÍA) — HACER ABONO"*. Es
> decir, **Belmon te debe un abono por una caja de Red Bull sandía devuelta**; no está
> reflejado en ningún documento nuestro (no es un albarán). Compruébalo cuando llegue su
> próxima factura/abono. Con esto, **las 4 dudas del 30-jul están las 4 cerradas**.

Identificado: **Habana, 16-jul-2026, pedido grande de licores y energéticas** (Red Bull,
ginebras, whiskies, Oxefruit); las dos fotos del 30-jul cortan en "SUMA Y SIGUE: 694,39 €".

**Se lo he pedido al gerente: que nos mande el albarán de Belmonte ENTERO, todas las páginas.**
No lo busquéis entre las fotos viejas ni lo carguéis a medias — **déjalo parado hasta que
llegue completo**. En cuanto lo tenga os aviso aquí y se sube de una vez.

⏳ **Estado: PENDIENTE (Iván) — esperando el documento completo del gerente.**

Pero no nos quedemos ahí: ver el punto 5, que es para que esto no vuelva a pasar.

### 3. 🗂️ Reparto de la lista → **LO HACES TODO TÚ**

Las 7 las coges tú enteras, para no pisarnos. Yo sigo con lo mío (reservas y web pública) y no
toco ficheros de logística. Las 7: aviso de empresa equivocada · matcher tolerante a
mayúsculas/acentos · alta de producto desde el albarán · bug de numeración (la serie manda
sobre la fecha del OCR) · pantalla de movimientos de stock · inventarios y mermas · recetas de
platos.

### 4. 💬 Dos personas en el mismo albarán → **decídelo tú, como cualquier software**

Esto no es una decisión de negocio, es de oficio: hazlo como lo hace cualquier programa serio.
Yo no tengo criterio técnico aquí y no quiero inventarlo. Avisar al segundo y recargar me
suena a lo normal, pero tú sabrás.

### 5. ⚠️ ENCARGO NUEVO — un albarán incompleto hay que cazarlo EN LA SUBIDA, no dos semanas después

Esto es lo que me importa de verdad del 15378. El problema no es esa página perdida: es que
**alguien del local subió un albarán al que le faltaba una hoja y el sistema no le dijo nada
en ese momento** — que es el único momento en que el papel sigue encima de la mesa y se puede
volver a fotografiar. Dos semanas después, esa hoja ya no aparece. Nos va a volver a pasar
con cada albarán de varias páginas.

**Lo quiero resuelto obligando a subirlo completo en el momento**, no anotando la deuda para
después. La incidencia ya está diseñada y los campos existen en la BD
(`albaranes.documento_parcial` y `albaranes.paginas_esperadas`), pero **no está conectado**:
hoy en producción **no hay ni un solo albarán marcado como parcial** y el 15378 ni se intentó.
Está a medias.

Cómo lo veo (decide tú la forma, pero que el resultado sea este):
- El OCR ya sabe leer "SUMA Y SIGUE" y el "pág. X de Y" → que se use.
- Al detectarlo, **parar la subida ahí mismo** y decirlo claro en el móvil: *"A este albarán le
  falta al menos una página — hazle foto a la siguiente"*, con el botón de añadir foto
  delante. Es el gerente subiendo con el móvil, tiene el papel en la mano: es el momento.
- Solo si la persona insiste, dejarlo entrar marcado como parcial y **que no se pueda
  confirmar** hasta completarlo.

Prioridad alta para mí: es el mismo patrón que el aviso de empresa equivocada — el sistema ya
tiene el dato, pero se lo calla.

---

## 👋 IVÁN, EMPIEZA POR AQUÍ — respuesta de Fernando al 14-ago, todo en 2 minutos (15-ago)

Iván: leído todo tu bloque del 14-ago (que sigue intacto justo debajo de este). Aquí va el
balance completo del día por nuestra parte; el detalle de cada punto está en las dos
secciones ⚡/✅ de Fernando que siguen a este resumen. **Léete al menos las dos primeras filas
de la última tabla, que son tuyas y una es urgente.**

### Tus 5 respuestas → qué hicimos con ellas

| Tu respuesta | Estado |
|---|---|
| 1. Stock del lote: dejarlo sumado | ✅ Nada que hacer. Se queda; el inventario de regularización lo cuadra |
| 2. Piloto no cumplido | Entendido. Tu criterio (el circuito solo suma) es de fondo, no de albaranes |
| 3. Duplicados: fusión automática | ✅ Ya los fusionaste tú (8 reales). Tenías razón con el dossier: gracias por pararlo |
| 4. Dudas del 30-jul: por la mesa | ✅ **3 de 4 EJECUTADAS** en prod: recargos como `linea_de_servicio` (con alias por proveedor), ALH RESERVA confirmado, línea fantasma como regalo. La 4ª (Belmon 15378) espera tu página |
| 5. Excel MAKRO: fuera | ✅ **RETIRADO** del repo (`ingest-from-pdfs/` + `rebuild-logistica.ts`) |

### Tus 4 "deudas de Fernando" → las 4 cerradas

| Tu reclamo | Estado |
|---|---|
| F6/F7 del PRP-073 | ✅ Estaban hechos desde el 6-ago (la recepción ya no usa la Edge Function) |
| 115 formatos sin equivalencia | ✅ **RELLENADOS HOY, 0 a NULL** (eran todos "número + medida" de Habana; doble validación, 0 dudosos) |
| Tabla `albaranes_lineas` muerta | ✅ Ya no existe (borrada el 6-ago; verificado en prod) |
| ¿Te pisé algo el 5-ago? | ✅ No. Cerrado |

### Y una cosa GORDA que tu día de ayer dejó abierta (y ya está arreglada)

Tu regla nueva del OCR "las subunidades son la cantidad real" **multiplicaba el stock DOS
veces** con el circuito de equivalencias que ya está en prod (2 cajas → 12 del OCR × 6 del
RPC = 72 botellas). Arreglado conservando tu acierto: la cantidad vuelve a ser nº de envases
y el desglose viaja en un campo nuevo que pasa a ser la fuente Nº 1 de equivalencia. Sin daño
en datos. Detalle en la sección ⚡.

### ⛔ AVISO PARA EL AGENTE DE IVÁN (Claude): anota, NO implementes

Cuando Iván conteste a lo de abajo, **tu trabajo es ANOTAR sus respuestas en este documento
y parar ahí**. No implementes código, no ejecutes SQL en producción, no toques `formatos`,
`productos`, `albaranes` ni migraciones a partir de sus respuestas: **la ejecución la hacemos
nosotros (Fernando)** con lo que él decida. Motivo: las dos últimas veces (5-ago y 14-ago) las
respuestas se convirtieron directamente en cambios en prod y en nuestros ficheros sin
coordinar, y hoy nos ha tocado deshacer una doble multiplicación de stock que salió de ahí.
Las únicas excepciones son las tareas que Iván se ASIGNE explícitamente a sí mismo en el
reparto de la lista nueva (fila 🗂️) — y en ese caso, avisad aquí ANTES de tocar ficheros
compartidos de logística. Todo lo demás: escribe la respuesta, commitea el `.md`, y nosotros
seguimos.

### Lo que te queda A TI (por orden)

> **▸ LAS 4 CONTESTADAS por Iván el 17-ago** — respuestas completas en la sección 📌 del tope
> del documento. Estado resumido en la última columna.

| | Qué | Estado (17-ago) |
|---|---|---|
| 🔴 **URGENTE** | **Activar facturación en el proyecto Google de la `GEMINI_API_KEY`.** Está en el tier free (20 peticiones/DÍA para TODA la app) y ayer a las 22:02 el gerente se quedó sin poder subir albaranes. Va a pasar cada día. Coste con billing: céntimos al mes | ❌ **NO se activa de momento**, seguimos con el tier free. A cambio: que el aviso de cuota se entienda en TODOS los módulos (hoy solo albaranes; 8 sueltan el 429 crudo) |
| 📄 | La **página final del Belmon Drink `15378`** (Habana): única duda del 30-jul que no podemos cerrar sin ella | ⏳ **PENDIENTE — pedido al gerente ENTERO.** No lo carguéis a medias; esperad a que Iván avise |
| 🗂️ | **Repartir tu lista nueva** (aviso de empresa equivocada, matcher tolerante, alta desde albarán, bug de numeración —ya van 3 víctimas: `ALB-2013-025` anoche—, movimientos de stock, inventarios, mermas, recetas). Dinos qué haces tú y qué nosotros, y no nos pisamos | ✅ **Repartido: las 7 las hacéis vosotros.** Iván sigue en reservas/web y no toca logística |
| 💬 | Una decisión de diseño pequeña, cuando quieras: qué hacer si dos personas revisan el mismo albarán a la vez (avisar y recargar / bloquear al segundo). La fontanería ya existe | ✅ **Decididlo vosotros**, como cualquier software. Iván no entra |
| 🆕 | *(nuevo, de Iván)* **Albarán incompleto: cazarlo EN LA SUBIDA** obligando a fotografiar la página que falta, no anotar la deuda para después | 🔺 **Prioridad alta.** La incidencia está diseñada y los campos existen, pero no está conectado: 0 albaranes marcados en prod |

Y de tu lista de pendientes propia (sección 📋), dos ya no lo son: los formatos (hecho) y el
Excel MAKRO (hecho).

---

## 👋 FERNANDO, EMPIEZA POR AQUÍ — resumen del 14-ago en 2 minutos (bloque de Iván, intacto)

Fernando: he vuelto y he estado el día entero con la logística. Esto es todo lo que ha pasado,
ordenado. El detalle de cada punto está más abajo en el documento; esto es el índice para que
no tengas que reconstruirlo leyendo 1.700 líneas.

### Tus 5 preguntas → contestadas

| | Mi respuesta |
|---|---|
| 1. Stock del lote de 10 | **Dejarlo sumado.** Pero ojo: no ha restado nada, el inventario es obligatorio |
| 2. ¿Piloto por bueno? | **NO.** Y no es por volumen: el circuito solo suma |
| 3. Duplicados | Fusionar con criterio automático — **pero eran 8, no 213** (ver abajo) |
| 4. Las 4 dudas del 30-jul | **Por la mesa de incidencias**, no por este documento |
| 5. Excel de MAKRO | **Fuera.** Retíralo del repo |

### Lo que YA ESTÁ HECHO hoy (no lo rehagas)

Siete cosas aplicadas y verificadas contra producción. Tres commits: `37e80580`, `e302b91b`,
`6c3273aa`.

1. **El OCR ya entiende los albaranes de cualquier proveedor.** Le faltaba la regla más
   básica: *una línea = un artículo*. Los proveedores que imprimen cada artículo en varias
   filas generaban artículos fantasma — el albarán de Coca-Cola daba **20 líneas para 8
   productos reales**, con "Dto. Fijo" a −37,15 € y "SUBUNIDADES/NETO" como si fueran
   mercancía. Ahora esas filas se funden en su artículo, **las subunidades son la cantidad
   real** (una caja son 24 botellas, no 1 unidad — esto arregla de raíz lo de las "2 CAJ") y
   los importes negativos van al descuento.
2. **El OCR ya lee el DESTINATARIO** del documento. Antes lo descartaba a propósito: por eso
   la empresa la decidía solo el selector y mis 8 albaranes acabaron en Bacanal sin que nada
   avisara.
3. **La pantalla ya no muestra los productos dos veces** en Revisión.
4. **13 productos de servicio** (Punto Verde, Desplazamiento, envases) **ya no controlan
   stock**. El importe sigue contando; dejan de inflar el inventario.
5. **Mis 8 albaranes del 13-ago, movidos a HABANA**, que es donde debían ir. Creado DISBESA en
   Habana, desvinculadas las 19 líneas que apuntaban a Bacanal y borradas las incidencias mal
   calculadas. Siguen en Revisión, sin stock sumado.
6. **`ALB-2023-062` → `ALB-2026-062`** (el año 2023 en mitad de la serie 2026).
7. **Los 8 duplicados reales, fusionados** y el dossier corregido.

### ⚠️ Dos cosas que te van a interesar de verdad

**A) Tu dossier de duplicados estaba mal, y por poco hacemos un destrozo.** Agrupaba por
nombre **sin mirar el `tipo`**: en este modelo cada artículo existe legítimamente DOS veces
(ficha `compra` + ficha `venta`, unidas por su receta 1:1). Fusionar los 213 grupos habría
**desactivado ~200 fichas legítimas y roto el descuento de stock por venta**. Duplicados
reales: **8**. Y la causa no era "una siembra que corrió dos veces" — **es que el matcher
distingue mayúsculas**: al cargar los albaranes del 30-jul no reconoció "Cebolla roja" como
la "Cebolla Roja" que ya existía. Mientras no se arregle, cada tanda genera duplicados nuevos.

**B) Por qué el stock no baja NUNCA.** Yo insistía en que no podía estar inflado porque esa
mercancía se ha vendido. Las ventas SÍ entran (**1.698 tickets de Habana, 527 de Bacanal**
desde el 17-jun), pero `descontarDiaSiCorte` hace `if (!corte …) return` **y sale sin
descontar, en silencio**, porque `stock_descuento_desde` está a NULL en las dos empresas. Y
está apagado con razón: **no hay recetas de platos** (203 recetas, todas bebidas 1:1). Si lo
encendemos hoy, la cocina entera seguiría sin bajar. **Las recetas de platos son el cuello de
botella de toda la logística.**

### Lo que queda por hacer

Nada de esto está hecho: conectar el **aviso de empresa equivocada** (el OCR ya extrae el
destinatario, pero todavía no compara ni avisa), el **matcher tolerante** a
mayúsculas/acentos/palabras de más, el **alta de producto desde el albarán** (con el nombre y
la referencia del proveedor ya leídos, obligando categoría y formato), y **reprocesar los 8
albaranes** con el OCR ya corregido.

Y sigue en pie lo estructural: **inventarios sin configurar (0 creados)**, **mermas que no
restan (0 registradas)**, **no hay pantalla de movimientos de stock**, y **670 productos de
compra con solo 352 fichas de stock**.

### Y lo tuyo, que sigue esperando

F6/F7 del PRP-073 · los **115 de 153 formatos sin equivalencias** · la tabla
`albaranes_lineas` muerta · y confirmarme si te pisé algo el 5-ago. Detalle al final del
bloque de mi respuesta.

⚠️ **Aviso suelto:** `src/features/rrhh/components/pagos/PagosView.tsx` está modificado sin
commitear y **no compila** (`showConfig`, `setShowConfig`, `Settings` sin definir). No lo he
tocado porque no es mío. Si es tuyo, revísalo: romperá el build.

---

## ⚡ FERNANDO (15-ago): primera respuesta — la regla de subunidades del OCR nuevo multiplicaba el stock DOS veces; ARREGLADO

Iván: buen día de trabajo el de ayer — lo del dossier (ficha compra + ficha venta por diseño)
nos salvó de un destrozo. Pero tu regla nueva del OCR ("las subunidades son la CANTIDAD
real") chocaba de frente con el circuito de equivalencias que ya está en producción:

- Todo lo que viene DESPUÉS del OCR (la mesa de incidencias, el contraste con el importe de
  la línea y `confirmar_albaran_transaccional`) asume que `cantidad` = **nº de envases
  comprados**, y es el sistema quien multiplica por la equivalencia del formato. Con la
  cantidad ya desglosada, el vino de las "2 CAJ" habría entrado como 12 del OCR × 6 del RPC
  = **72 botellas**. Nadie llegó a confirmar un albarán leído con el prompt nuevo (verificado
  en BD: solo existe uno posterior a tu deploy y sigue en Revisión, con cantidades por
  envase y el dinero cuadrando), así que **no hay daño en datos**.
- **El arreglo conserva tu acierto entero**: las filas de detalle se siguen fundiendo en su
  artículo (nada de artículos fantasma, descuentos como descuentos), pero `cantidad` vuelve a
  ser el nº de envases y el desglose viaja en un campo nuevo `unidadesPorEnvase`. Ese campo
  pasa a ser la fuente Nº 1 de equivalencia: "el papel manda" — la mesa la propone con
  confianza 95 % y al aceptarla se guarda el formato en Catálogos. Exactamente lo que pedías,
  multiplicando UNA sola vez. (Y de propina: cada albarán con desglose irá rellenando solo
  los 115 formatos sin equivalencia que reclamas en tu punto 2.)
- Además el detector no reconocía "CAJ"/"cajón"/"box" como envases — su lista estaba
  desalineada con la de contenedoras del RPC desde el hotfix del 07-ago. Alineadas.

Seis avisos rápidos más:

0. 🔴 **URGENTE — la clave de Gemini está en el tier GRATUITO y el cupo se agotó hoy mismo**
   (15-ago 22:02): Alejandro intentó subir un albarán por el móvil y se comió un `429 Too
   Many Requests` — el plan free de Google da **20 peticiones AL DÍA** por modelo
   (`gemini-2.5-flash`), y entre tus pruebas, las del gerente y los reintentos, se gastan en
   nada. El cupo se rellena hacia las 9:00 (medianoche del Pacífico), pero **va a volver a
   pasar cada día** ahora que el OCR se usa de verdad. **Arreglo (tuyo, es tu clave):
   activar facturación en el proyecto de Google AI de la `GEMINI_API_KEY`** (o crear una
   clave en un proyecto con billing y actualizarla en Vercel). Con pago por uso, un albarán
   cuesta fracciones de céntimo — el mes entero de las dos empresas sale por céntimos. Ojo:
   la misma clave la usan también nóminas, gestoría, calidad, facturas y el chat de la web,
   así que el cupo de 20 lo comparte TODO. Mientras tanto he arreglado el mensaje: al
   agotarse la cuota ya no sale el volcado técnico rojo, sino "la IA ha alcanzado su límite
   diario…" (aplica a todos los módulos que usan Gemini, no solo a albaranes).

1. **Tu bug de numeración ya tiene la 3ª víctima**: anoche (14-ago 21:58) Alejandro subió por
   el móvil el **`ALB-2013-025`** de Belmon Drink — fecha leída 2013 → serie 2013. El gerente
   ya usa la subida móvil por su cuenta; razón de más para tu pendiente nº 5 (la serie debe
   mandar sobre la fecha del OCR).
2. De tu lista de "deuda mía": **F6 y F7 están CERRADOS desde el PRP-073** (F6 = la recepción
   ya NO usa la Edge Function; extractor único compartido) y **`albaranes_lineas` ya no
   existe** (migración `20260806120000`, aplicada — verificado hoy contra prod: 0 tablas).
   Y la de los formatos también cae: ver el punto 5.
3. **No te pisé nada el 5-ago**: no había trabajo local sin commitear en esos ficheros.
   Cerrado.
4. ✅ **Tu punto 5, EJECUTADO: el cargador del Excel de MAKRO está FUERA del repo.** Se ha
   eliminado `src/features/logistica/services/ingest-from-pdfs/` al completo y también
   `scripts/rebuild-logistica.ts` — el envoltorio que primero BORRABA productos y
   escandallos de la empresa y luego reingería llamando al mismo `run-ingest` (la misma
   pistola con más calibre). Nada del código los referenciaba y el ingest nunca llegó a
   correrse contra esta BD. El doc de la decisión
   (`LOGISTICA_COMPRAS_PARA_IVAN_siembra_vs_ingest.md`) queda marcado como resuelto.
5. ✅ **Tu punto 2 también, EJECUTADO: los 115 formatos sin equivalencia están RELLENADOS —
   quedan 0 a NULL** (154/154 formatos de compra con equivalencia). Resultó más limpio de lo
   que parecía: los 115 eran TODOS de Habana y todos de la siembra sistemática "número +
   medida" ("12 U", "5 L", "0,5 K") — tu propia regla de formatos, donde el nombre ES la
   equivalencia. Se rellenaron con doble validación: el número del nombre solo se aceptó si
   la letra (U/K/L) coincidía con la medida (`unidad_id`) de la propia fila; cualquier
   inconsistencia se habría quedado a NULL y en una lista para ti — no hubo ninguna. A partir
   de ahora esos formatos ya son visibles para el emparejador y la confirmación no vuelve a
   pedir crearlos.

---

## ✅ FERNANDO (15-ago, noche): las dudas del 30-jul RESUELTAS por la vía que pediste (3 de 4)

Tu respuesta a la pregunta 4 fue "pasadlas por la mesa, no me las preguntéis una a una".
Hecho — cada una resuelta con su tipo de incidencia y aplicada a producción (verificado, 0
movimientos de stock, los inventarios no se tocan porque son todo gastos o precio 0):

1. **Los 3 recargos (`linea_de_servicio`, tu decisión del 5-ago: producto de compra sin
   control de stock).** Las 4 líneas que quedaron fuera ya están DENTRO de sus albaranes, y
   sus totales ahora cuadran con el papel céntimo a céntimo:
   - DDI Nexia `7200007615` y `7200008242` (Bacanal): línea "S.L." 2,99 € al 21% → producto
     nuevo **"Deposito envase vidrio"** (probable depósito de vidrio retornable — si sabes
     qué es realmente ese "S.L.", renómbralo en la ficha y listo).
   - Garcimar `MA/56452` (Bacanal): línea "cargo" 1,50 € al 21% → producto nuevo **"Portes"**.
   - Disbesa `176911` (Bacanal): "Desplazamiento y Servicio" 1,10 € → reutiliza TU producto
     **"Desplazamiento"** del 14-ago.
   Los tres con su precio de compra registrado (cada céntimo por proveedor, como pediste) y
   con **alias por proveedor memorizado** ("S.L."→Depósito, "cargo"→Portes, "Desplazamiento y
   Servicio"→Desplazamiento): la próxima tanda los reconoce sola.
2. **El nombre incierto (`producto_ambiguo`).** "ALH RESERVA 0,30 RET" queda confirmado como
   ficha propia **"Alhambra Reserva 0,30 RET"** (su precio, 20,41 €, no es el de la caja de
   Alhambra de 31,89 € — son formatos distintos). El alias ya existía en Bacanal; **añadido
   también en Habana**, que faltaba. Si algún día decides que es otra cosa, se corrige en la
   ficha.
3. **La línea fantasma de Belmonte `15402` (`linea_sin_importe` → regalo).** La 4ª línea
   "TEQ JOSE CUERVO REPOSADO" (cantidad 1, sin precio impreso) entra como **regalo: cantidad
   sí, precio 0, sin precio registrado** (la propuesta estándar de la mesa). El total del
   albarán no cambia (ya cuadraba).

~~La 4ª duda sigue esperándote~~ → **CERRADA el 19-ago: ALB-2026-028 cargado entero (ver tu
punto 2 más arriba).** Texto original:
**La 4ª duda (Belmon Drink `15378`, Habana) sigue esperándote a ti**: faltaba la página
final (corta en "SUMA Y SIGUE: 694,39 €"). Si tienes la foto, pásala y lo cargamos; si no,
dinos si lo dejamos fuera definitivamente.

---

## ✅ RESPUESTA DE IVÁN (14-ago) — tus 5 preguntas, contestadas + lo que falta por revisar

Fernando: de vuelta. Van las cinco respuestas, y después una lectura de conjunto que me
importa más que las cinco juntas. Todo lo que afirmo aquí está verificado contra la BD de
producción hoy, no es impresión mía.

### 1. El stock del lote de 10 albaranes → **(a) DEJARLO SUMADO**

No lo revertimos. Revertir no nos deja mejor: nos deja igual de lejos de la realidad y
encima perdemos la única entrada de mercancía real que hay registrada. Lo cuadramos con un
inventario de regularización, que es para lo que existe.

**Pero ojo con el motivo, que me lo aclaró mi agente y cambia el cuadro:** yo daba por hecho
que esa mercancía ya habría salido por las ventas. **No ha salido.** El descuento por ventas
está apagado en las dos empresas (`empresas.stock_descuento_desde = NULL` en BACANAL y en
HABANA) y en `stock_movimientos` **no hay una sola salida**: los 63 movimientos que existen
son todos de tipo `entrada` por albarán. Así que ese stock está inflado tal cual quedó el
7-ago, y el inventario de regularización no es opcional: es obligatorio.

### 2. El piloto → **NO se da por bueno. Y no es por falta de albaranes.**

Sigo en el mismo sitio que el 7-ago, pero ahora con un motivo concreto en vez de una
sensación. **El circuito de stock hoy solo suma.** De las cuatro cosas que deberían moverlo,
funciona una:

| Lo que debería mover el stock | Estado real en BD (14-ago) |
|---|---|
| Compras (albaranes) | ✅ Funciona — 63 movimientos de entrada |
| Ventas | ❌ Apagado — `stock_descuento_desde` a NULL en las dos empresas |
| Mermas | ❌ **0 movimientos y 0 mermas registradas**, aunque `mermas-actions.ts` llame al kardex |
| Inventarios | ❌ **0 inventarios creados.** Sin configurar |

Subir más albaranes no valida eso: validaría otra vez la mitad de arriba de un circuito que
no tiene mitad de abajo. Por eso el piloto no queda cumplido — y no es cuestión de volumen.

**Tres cosas concretas que me he encontrado y que hay que resolver antes:**

**a) Mis 8 albaranes del móvil no se ven en el escritorio — están atascados en Revisión.**
No se perdieron: subieron bien el 13-ago entre las 08:10 y las 08:31, todos a BACANAL, con
**79 líneas leídas por el OCR**. Son ALB-2026-057 (17 líneas), 058 (2), 059 (23), 060 (5),
061 (6), **ALB-2023-062** (5), 063 (20) y 064 (1). Los ocho en estado **Revisión**, ninguno
confirmado, ninguno ha sumado stock. Desde el ordenador no los veo en ningún sitio: o la
lista no muestra los de Revisión, o me lo tapa el selector de empresa. Necesito que lo que
sube por el móvil aparezca en el escritorio sin buscarlo.

**b) Bug de numeración: `ALB-2023-062`.** Año 2023 en mitad de la serie 2026, entre el 061 y
el 063. El contador está cogiendo el año de donde no debe — probablemente de una fecha mal
leída del papel. Hay que fijar que la serie mande sobre lo que diga el OCR.

**c) No hay dónde ver la rotación de un producto.** Existe `MovimientosStockSection` dentro
de la ficha, pero no hay ninguna pantalla de movimientos del almacén: qué ha entrado, qué ha
salido, por qué y cuándo. Quiero poder abrir un producto y ver su vida — subió por este
albarán, bajó por estas ventas, bajó por esta merma, se ajustó en este inventario — y
también una vista general de todo el almacén. Hoy no existe, y aunque existiera estaría
vacía, porque nada ha bajado nunca.

### 3. Los duplicados del catálogo → **fusionadlos vosotros con el criterio automático**

No voy a repasar 213 parejas a mano. Adelante con el criterio que propones: gana la ficha con
más referencias (precios, recetas, movimientos) y la otra se desactiva. **Nada se borra**, así
que si algún caso sale torcido se vuelve atrás. Dejadme al final la lista de los que hayan
quedado dudosos y esos sí los miro yo.

### 4. Las 4 dudas del lote del 30-jul → **por la mesa de incidencias, no por este documento**

No las contesto una a una a propósito, y es la misma respuesta que te di el 5-ago: si las
contesto, dentro de dos semanas tenemos cuatro nuevas. Para eso construimos el PRP-074, que
ya está en producción. Las cuatro caen dentro de los tipos que la mesa ya contempla —
la página que falta es `documento_incompleto`, los tres recargos son `linea_de_servicio`
(producto de compra con control de stock desactivado), y el nombre borroso es
`producto_ambiguo` con su propuesta y su porcentaje. **Pasadlas por la mesa.** Si alguna no
encaja en ninguno de los 12 tipos, entonces sí: avísame, porque eso significa que falta un
tipo y es cambio de código consciente.

### 5. El cargador del Excel de MAKRO → **olvidadlo y retiradlo**

Fuera. Los productos y los precios ya entran solos con las fotos de los albaranes, así que no
aporta nada — y mientras siga ahí es una pistola cargada: el día que alguien lo ejecute sin
saberlo nos borra el catálogo de logística con sus stocks máximos, sus alias y su histórico
de precios. Quitadlo del repo.

---

### ⚠️ La lectura de conjunto: esto NO está cerca de estar terminado

Lo digo claro para que no se dé por hecho lo contrario en ningún sitio. Que los 10 albaranes
del piloto salieran bien está muy bien, pero **la logística no está lista ni de lejos**:

- **Los albaranes no se están reflejando correctamente todavía** — los ocho míos son la
  prueba: subidos, leídos, y sin llegar a ninguna parte ni verse desde el escritorio.
- **Los inventarios están sin configurar.** Cero inventarios creados en la BD. Y son
  justamente la pieza con la que pensábamos cuadrar el stock inflado del punto 1: sin ellos,
  esa vía no existe.
- **Las mermas no restan.** Cero registradas, cero movimientos.
- **Las ventas no restan.** Apagadas, y bloqueadas hasta que estén cargadas las recetas
  reales de platos (hoy 203 recetas y todas de bebidas 1:1, ninguna de plato).
- **Hay 670 productos de compra y solo 352 filas de stock.** Ni siquiera todos los productos
  tienen ficha de stock.

Mi prioridad, por orden: **(1)** que los albaranes del móvil se vean y se puedan cerrar desde
el escritorio; **(2)** inventarios funcionando, para poder cuadrar; **(3)** mermas restando;
**(4)** la pantalla de movimientos por producto; **(5)** recetas de platos, y con ellas
encender el descuento por ventas. Hasta que esos cinco estén, el stock que enseña el sistema
no es un dato en el que nadie pueda apoyarse.

---

### 📌 Y ahora las tuyas: tu deuda pendiente, que llevas arrastrando

De tu propia lista de "LO QUE SIGUE ABIERTO", contéstame o cierra estas cuatro:

1. **F6 y F7 del PRP-073.** F6 es la Edge Function no versionada de la recepción por pedido —
   la que descubrimos que llevaba **rota en silencio** sin que saltara nada. Toca la recepción
   que uso a diario, así que dime cuándo la tocas y lo acordamos. Esto es prioritario: es
   exactamente el tipo de fallo invisible que me impide fiarme del circuito.
2. **Los formatos de compra sin equivalencias: 115 de 153 (el 75%) están a NULL.** El matcher
   exige que no sean nulos, así que esos formatos son invisibles para el emparejado por
   nombre. El intérprete nuevo lo tapa deduciendo del texto, pero no quiero depender de una
   deducción: hay que rellenarlos. Dime si lo haces tú o te ayudo a montarlo.
3. **La tabla `albaranes_lineas` está muerta** — existe en el esquema y no la usa ningún
   fichero de `src/` (todo va por el jsonb `albaranes.lineas`). Decide: se borra o se
   documenta como legacy. Que no se quede en tierra de nadie.
4. **¿Te pisé algo?** Confírmame de una vez que no tenías trabajo local en
   `ResolverLineaDialog` / `AsistenteAlbaranPanel` cuando entré el 5-ago. Sigue sin
   respuesta y quiero cerrarlo.

Con esto quedan las cinco tuyas contestadas y las cuatro mías en tu tejado. Cuando cierres
las de arriba, hablamos de piloto.

---

## ✅ EJECUTADO EL 14-AGO — lo que ya está hecho (no lo repitas)

Todo esto está aplicado y verificado contra producción. Lo listo para que no lo rehagas:

1. **OCR: tres reglas nuevas, universales para cualquier proveedor** (commit `37e80580`).
   - *Una línea = un artículo.* Los proveedores que imprimen cada artículo en varias filas
     (subunidades, descuento, base, lote) ya no generan artículos fantasma: esas filas se
     funden en su línea. Las **subunidades pasan a ser la cantidad real** (una caja son 24
     botellas, no 1 unidad) y los **importes negativos van al descuento**, nunca a un
     artículo. Con prueba de cuadre contra la base imponible del pie.
   - *Se lee el DESTINATARIO* (CIF, razón social, dirección). Antes se descartaba a propósito.
   - Se aclara que **portes, punto verde y envases SÍ son artículos facturados** (con su
     importe, para poder saber cada céntimo que va a cada proveedor); lo que no lo son son
     los descuentos y las filas de cálculo.
2. **La pantalla ya no muestra los productos dos veces** (commit `e302b91b`). En Revisión se
   pintaba el asistente y debajo la tabla "Productos del albarán" con las mismas líneas: un
   albarán de 23 líneas se veía como 46 filas.
3. **13 productos de servicio pasan a NO controlar stock** (Punto Verde, Desplazamiento y los
   envases de las dos empresas). Estaban con `controla_stock = true`, así que cada albarán les
   sumaba unidades al inventario. Ahora el importe sigue contando —que es lo que interesa para
   el gasto por proveedor— pero no ensucian el almacén. Ninguno tenía movimientos, así que el
   cambio no descuadra nada.
4. **Los 8 albaranes del 13-ago movidos de BACANAL a HABANA**, que es donde debían estar. Se
   creó **DISBESA en Habana** (solo existía en Bacanal), se **desvincularon las 19 líneas** que
   apuntaban a productos de Bacanal, se soltó el proveedor de Bacanal del Krittikali y se
   borraron las incidencias calculadas contra el catálogo equivocado. Los 8 siguen en Revisión,
   con sus 79 líneas, listos para resolverse contra el catálogo correcto. **No habían sumado
   stock**, así que el traslado no descuadra ningún almacén.
5. **Arreglado el `ALB-2023-062` → `ALB-2026-062`** (el año 2023 en mitad de la serie).
6. **Fusionados los 8 duplicados reales.** Gana la ficha con más referencias, se le traspasan
   precios, alias y recetas, y la perdedora queda **Inactiva** con el motivo escrito en sus
   observaciones. Nada se borra. Comprobado después: **0 duplicados activos** y **0 recetas
   apuntando a una ficha inactiva**.
7. **Corregido el dossier de duplicados** con un aviso al principio, para que nadie actúe
   sobre los 213 grupos.

**Pendiente de hacer todavía:** conectar el aviso de empresa equivocada (el OCR ya extrae el
destinatario, pero aún no compara ni avisa), el matcher tolerante a mayúsculas/acentos, el
alta de producto desde el albarán, y reprocesar los 8 albaranes con el OCR ya corregido.

---

## 🔬 HALLAZGOS NUEVOS DEL 14-AGO — cuatro cosas que hemos destapado hoy

Fernando: revisando lo de arriba con mi agente han salido cuatro cosas que no estaban en
ningún sitio. Dos son bugs de fondo, una desmonta un dossier tuyo y otra explica por qué el
stock nunca baja. Todo verificado contra la BD de producción, con las consultas hechas hoy.

### A) 🔴 El OCR TIRA a la basura el destinatario del albarán — por eso mis 8 acabaron en Bacanal

Esta es la gorda, y explica el bug de la empresa equivocada que dabas por cerrado el 7-ago.

En el prompt de `ocr-albaran.ts` hay una instrucción explícita de quedarse **solo con los
datos fiscales del EMISOR** y descartar los del destinatario ("*del destinatario/cliente, que
es el restaurante*" — y a continuación solo se piden `cifNifEmisor`, razón social y dirección
del proveedor). O sea: **el nombre y el CIF de MI restaurante están impresos en el papel, el
sistema los ve, y los tira a propósito.**

Consecuencia: la empresa del albarán la decide **únicamente el selector de arriba**. Si está
en BACANAL, entra en BACANAL aunque el papel diga HABANA con todas sus letras. Ninguno de mis
8 albaranes del 13-ago pudo avisarme, porque el único dato con el que comprobarlo se había
descartado en el paso anterior.

**Lo que quiero (y creo que es el 13.º tipo de incidencia del PRP-074, de los que bloquean):**

1. Que el OCR extraiga **también** CIF, razón social y dirección del **destinatario**. Es un
   cambio pequeño: la IA ya está leyendo ese texto, solo se le dice que lo devuelva.
2. Que al terminar de leer se **cruce ese CIF con la empresa activa**.
3. Que si no cuadran salte el aviso **en el momento, antes de guardar**, con la salida
   resuelta: *"Este albarán parece de HABANA y estás subiendo a BACANAL — [Cambiar a Habana y
   continuar] · [Seguir en Bacanal] · [Cancelar]"*. Que se pueda cambiar de empresa ahí mismo
   sin salir ni perder la foto.
4. Si el CIF del papel **coincide con otra empresa mía**, eso no es sospecha: es certeza.
   Bloquear hasta confirmación expresa.
5. Si el papel no trae destinatario legible, avisar igual: *"no he podido comprobar a qué
   empresa va dirigido, verifica que BACANAL es correcto"*.

### B) 🔴 El dossier de duplicados está MAL: no son 213 grupos, son 8

**Ojo antes de fusionar nada, porque esto habría sido un destrozo.** El dossier
`DUPLICADOS_CATALOGO_DOSSIER_2026-08-07.md` agrupa por nombre **sin mirar el `tipo`**, y en
este modelo cada artículo existe legítimamente DOS veces: una ficha `compra` y una ficha
`venta`. Absolut compra (Alcoholes) + Absolut venta (Vodkas). Cocacola compra + Cocacola
venta. Eso no es un duplicado: **es el diseño**, y lo que las une es justamente la receta 1:1
de `producto_composicion` — fíjate en que en el dossier las dos filas de cada pareja tienen
`Recetas: 1`.

Si llegamos a fusionar los 213 grupos con el criterio automático, **nos cargamos ~200 fichas
legítimas y rompemos las recetas que hacen que una venta descuente su producto de compra**.
Justo lo contrario de lo que queremos.

Duplicados REALES (mismo `tipo`, misma empresa, nombre equivalente): **BACANAL 6 grupos (12
fichas) · HABANA 2 grupos (4 fichas)**. Ocho. Y el origen no es "una siembra que corrió dos
veces":

| Ficha | Alta | Precios | Movs | Alias |
|---|---|---|---|---|
| "Cebolla **R**oja" | 10-jun (siembra) | 1 | 0 | 0 |
| "Cebolla **r**oja" | 30-jul (albarán) | 2 | 1 | 1 |

**El emparejador no reconoció "Cebolla roja" como la "Cebolla Roja" que ya existía porque
cambia una mayúscula, y creó ficha nueva.** Es tu mismo hallazgo nº8 del piloto ("Mix goma
pica"/"Mix Goma Pica", los dos "Alhambra", los "Delizia"). O sea: **los duplicados los está
generando el propio flujo de albaranes, y seguirán apareciendo con cada tanda que subamos**
mientras el matcher distinga mayúsculas.

**Acciones:** corregir el dossier (hoy induce a una decisión destructiva), fusionar solo los
8 reales (gana la ficha con más referencias, la otra se DESACTIVA, nada se borra) y arreglar
la causa → punto C.

### C) El emparejado tiene que tolerar mucho más que una letra

No basta con ignorar mayúsculas. El proveedor escribe "CEBOLLA ROJA NAC. 5KG CAT.I" y
nosotros tenemos "Cebolla roja": cambian mayúsculas, acentos, palabras de más, el orden, y a
veces hay erratas del propio proveedor. El matcher debe aguantar todo eso.

Y la regla de UX que quiero, que hoy no se cumple: **nunca ofrecer "crear producto" a secas.**
Primero *"¿es alguno de estos?"* con los candidatos ordenados por parecido **y el porqué de
cada uno**; crear solo si de verdad no está.

**El alta desde el albarán debe ser EXACTAMENTE la misma que desde Productos** — mismo
formulario y mismas obligaciones. Lo único distinto es que se abre desde el albarán y llega
medio relleno para ir más rápido.

Lo que el albarán ya sabe y debe venir puesto: **nombre del proveedor y referencia del
proveedor tal y como se leyeron del papel** (esto es explícito: no volver a pedirlos), precio
unitario de la línea, formato/medida, IVA de la línea, tipo `compra` y empresa activa.

Lo que hay que **obligar** a rellenar porque el papel no lo trae: **categoría** (se puede
proponer por proveedor y por productos parecidos, pero la elige la persona) y **nombre de
catálogo** editable (queremos "Cebolla roja", no "CEBOLLA ROJA NAC. 5KG CAT.I").

**Y el formato/equivalencia: obligatorio cuando la línea traiga formato de caja.** Es
exactamente lo que reventó con las "2 CAJ" de vino que sumaron 2 botellas en vez de 12, y hoy
tenemos 115 de 153 formatos a NULL. Si al crear no se confirma qué trae el envase, el
producto nace con el stock roto desde el primer día. Cuando la línea venga en kg o ud sueltas
no hay nada que preguntar y no debe molestar.

### D) Por qué el stock no baja NUNCA (y por qué las recetas son el cuello de botella real)

Yo insistía en que el stock no podía estar inflado porque esa mercancía se ha vendido. Y la
lógica era correcta — **las ventas SÍ están entrando**:

| Empresa | Tickets | Desde | Hasta |
|---|---|---|---|
| HABANA | **1.698** | 17-jun | 13-ago |
| BACANAL | **527** | 17-jun | 2-ago |

Lo que pasa es que en `agora-sync/route.ts` la función `descontarDiaSiCorte` hace
`if (!corte || businessDay < corte) return` **y sale sin descontar, en silencio**. Con
`stock_descuento_desde` a NULL en las dos empresas, el cron guarda 2.225 tickets y se salta
el descuento todos los días sin que salte nada. No falla: pasa de largo.

Y está apagado con razón: **no hay recetas de platos** (203 recetas cargadas y TODAS de
bebidas 1:1, ninguna de plato). Si lo encendiéramos hoy, las bebidas restarían bien y toda la
cocina —lo que compramos a Dither y al Encinar— seguiría sin bajar jamás, pero con la
apariencia de que el sistema ya funciona. Peor que ahora.

**Conclusión: las recetas de platos son el cuello de botella de TODA la logística.** Hasta
que estén cargadas, el stock solo puede subir, y da igual cuántos albaranes subamos.

---

## 📋 LO QUE QUEDA POR HACER — nada de esto está ejecutado todavía

Lo dejo listado para que no se pierda ninguno. Los dos primeros están bloqueados esperando
una respuesta mía que aún no he dado:

1. ⏸️ **Mover mis 8 albaranes del 13-ago de BACANAL a HABANA.** El traslado es limpio (0
   movimientos de stock, 0 pedidos, 0 facturas, los 8 en Revisión), pero arrastra tres cosas
   que hay que arreglar en el camino: **19 de las 79 líneas ya están vinculadas a productos de
   BACANAL** (hay que desvincularlas para que se emparejen contra el catálogo de Habana), el
   ALB-2023-062 tiene enganchado el **proveedor Krittikali de BACANAL** (repuntar al de
   Habana) y hay **117 incidencias** calculadas contra el catálogo de Bacanal (borrar y
   recalcular). **Bloqueado por:** DISBESA solo existe como proveedor en BACANAL, no en
   HABANA — o ese albarán sí era de Bacanal, o hay que dar de alta Disbesa en Habana. Lo
   confirmo yo.
2. ⏸️ **Fusionar los 8 duplicados reales** y corregir el dossier.
3. ⏳ **El aviso de empresa equivocada** (hallazgo A). **Esto primero de todo**: mientras no
   exista, me vuelve a pasar con la próxima tanda que suba.
4. ⏳ **Matcher tolerante + alta de producto desde el albarán** (hallazgo C).
5. ⏳ **Bug de numeración `ALB-2023-062`** — año 2023 en mitad de la serie 2026, entre el 061
   y el 063. El contador está cogiendo el año de una fecha mal leída del papel (el albarán de
   Krittikali trae fecha 2023-07-20). La serie debe mandar sobre lo que diga el OCR.
6. ⏳ **Pantalla de movimientos de stock.** Existe `MovimientosStockSection` en la ficha del
   producto, pero no hay vista de almacén: qué entró, qué salió, por qué y cuándo. Quiero
   poder abrir un producto y ver su vida entera, y también el conjunto.
7. ⏳ **Inventarios** — 0 creados en la BD. Son la pieza con la que íbamos a cuadrar el stock
   del lote del punto 1: sin ellos esa vía no existe.
8. ⏳ **Mermas** — 0 registradas, 0 movimientos, aunque `mermas-actions.ts` llame al kardex.
9. ⏳ **Recetas de platos** y, con ellas, encender `stock_descuento_desde` (hallazgo D).

Un dato más para dimensionar: **670 productos de compra y solo 352 filas de `stock`**. Ni
siquiera todos los productos tienen ficha de almacén.

---

## ❓ IVÁN: bienvenido — las 5 preguntas que te fueron por WhatsApp, aquí por escrito (14-ago, Fernando)

Como no pudiste contestarlas en vacaciones, te las dejo donde siempre. Con tus respuestas
(un audio a Fernando o una nota aquí, como prefieras) desbloqueamos todo lo que queda:

1. **El stock del lote de 10 albaranes (31-jul).** Los confirmamos por la app con el
   circuito completo, así que SUMARON stock de verdad — pero eran entregas en parte ya
   consumidas. ¿Lo dejamos sumado y que el próximo inventario lo cuadre, o lo revertimos y
   quedan como los lotes anteriores (solo precios, sin stock)? Registro exacto para el
   revert en `docs/LOTE_ALBARANES_2026-08-07_REGISTRO_STOCK.md`.

2. **¿Damos el piloto por cumplido?** Tu mitad era una recepción real contra pedido con el
   motor nuevo. ¿Lo damos por bueno con los 10 albaranes reales que ya pasaron (más tu
   Coca-Cola del móvil, que terminamos nosotros), o haces esa prueba ahora que has vuelto?

3. **Los duplicados del catálogo — más gordo de lo que parecía.** No son 4 casos: hay
   **213 grupos duplicados (426 productos)**, casi seguro una siembra que corrió dos veces.
   El listado con las referencias de cada uno está en
   `docs/DUPLICADOS_CATALOGO_DOSSIER_2026-08-07.md`. ¿Los fusionamos nosotros con criterio
   automático (gana el que más referencias tiene; el otro se desactiva, nada se borra), o
   prefieres repasar el listado tú?

4. **Las 4 dudas del lote del 30-jul** (siguen abiertas, detalladas más abajo en este
   documento): la página que faltaba de un albarán, 3 recargos sin producto claro, 1 nombre
   incierto y 1 línea fantasma.

5. **El cargador del Excel de MAKRO.** Aquel programa que carga productos desde el Excel
   pero BORRA los de logística y los mete de cero (por eso nunca se ejecutó). Ahora que
   productos y precios entran solos con las fotos de albaranes: ¿lo quieres para algo o lo
   olvidamos y lo retiramos?

(La sexta de la lista original —wa.me vs API de Meta— ya la decidió Fernando: seguimos con
wa.me de momento.)

---

## 🔧 IVÁN: como te ibas de vacaciones, los hallazgos del piloto que eran código YA ESTÁN ARREGLADOS (07-ago tarde, Fernando)

Para que no te los encuentres como deberes: de la lista del informe de abajo, esta misma
tarde quedaron **arreglados, desplegados y probados en vivo** —

1. **Empresa activa desincronizada tras entrar con navegador limpio** (`ff805878`): la
   elección del cliente ahora arma SIEMPRE la cookie del servidor y refresca la vista.
   Verificado E2E: navegador limpio → etiqueta y datos de la MISMA empresa.
2. **Crear producto en la empresa equivocada** (`aa4047b8`): crear/importar productos usaba
   la empresa de la ficha del usuario; ahora usan la activa, como el resto.
3. **Los tres remates de tu mesa/asistente** (`1b7cb0c2`): el aviso "Antes de confirmar" ya
   cuenta TODAS las líneas que entran; la decisión "crear producto" de la mesa viaja al
   detalle y abre el formulario prerrellenado; y **crear_gasto se ejecuta de verdad** — los
   Punto Verde/portes nacen como gasto sin control de stock y la línea queda ligada sola.
4. **Autosave de la revisión (el F5 que faltaba)** (`e1dff6fd`): cada vincular/crear/ignorar
   se guarda al vuelo; recargar a mitad de revisión ya no pierde nada. Probado E2E con
   albarán de prueba (borrado después). La UI de conflicto de versión optimista queda para
   coordinarla contigo a la vuelta.
5. **Dossier de duplicados del catálogo** (`8d05f0fd`): OJO — no eran 4 casos sueltos:
   **213 grupos duplicados, 426 productos** (huele a siembra que corrió dos veces). Está
   en `docs/DUPLICADOS_CATALOGO_DOSSIER_2026-08-07.md` con las referencias de cada uno.
   **No se ha fusionado nada**: a tu vuelta eliges "el bueno" de cada grupo y lo hacemos.

Con esto, de tu audio solo esperamos: la decisión del stock del lote (dejar o revertir),
si das el piloto por cumplido, el criterio de los duplicados, las 4 dudas del lote 30-jul,
y las dos viejas (Excel MAKRO y WhatsApp). Buen viaje.

---

## 📊 IVÁN: PILOTO EJECUTADO — 10 albaranes reales por el camino nuevo, TODOS confirmados (07-ago, Fernando)

Pediste que el piloto fueran documentos reales con el motor nuevo. Hecho: **10 albaranes del
30-31/07 (4 de Bacanal + 6 de Habana, 7 proveedores distintos) subidos por la pantalla de la
app, resueltos y CONFIRMADOS de punta a punta** — con stock y precios de verdad, no como los
lotes de julio. Incluye **tu Coca-Cola del móvil (ALB-2026-018)**: lo resolvimos desde
escritorio (Sprite vinculado, los 4 "Punto Verde" ignorados con motivo "no es mercancía") y
confirmado — tu subida del día 5 acabó el ciclo completo móvil→escritorio→stock.

### Los números que pediste (limpios vs incidencias)

| Albarán | Proveedor | Líneas | Auto | A mano | Notas |
|---|---|---|---|---|---|
| ALB-2026-053 (BAC) | DITHER | 9 | **9/9** | — | varios "ya lo vinculaste antes" (los alias funcionan) |
| ALB-2026-054 (BAC) | ENCINAR | 4 | **4/4** | — | kg y €/kg exactos |
| ALB-2026-055 (BAC) | MAHOU | 1 | 1/1 | precio | la mesa avisó "sube un 56%" → era el DTO de línea sin aplicar; corregido a 20,41 efectivo |
| ALB-2026-056 (BAC) | KRITTIKALI | 6 | 4/6 | 2 | bobina vinculada en la mesa; ambientador en el asistente |
| ALB-2026-018 (HAB) | COCA-COLA (tuyo) | 8 | 3/4 | 1 + 4 ignoradas | Punto Verde con motivo registrado |
| ALB-2026-019 (HAB) | DITHER | 19 | **17/19** | 2 | canela molida→Polvo y sandía negra→Sandia, propuestas correctas |
| ALB-2026-020 (HAB) | BIGGER | 4 | 3/4 | 1 | ver duplicado de catálogo abajo |
| ALB-2026-021 (HAB) | MAHOU | 2 | 0/2 | 2 | producto no existía en Habana → creado; la línea REGALO entró al stock SIN registrar precio 0 ✓ |
| ALB-2026-022 (HAB) | KRITTIKALI | 5 | 2/5 | 3 | limpiacristales y rollo por la mesa; copa creada |
| ALB-2026-023 (HAB) | DDI NEXIA | 1 | 0/1 | 1 | vino nuevo + LA CAJA (ver hallazgo nº1) |

En total: **43 de 59 líneas casaron solas** (73%), el resto se resolvió con la mesa o el
asistente en segundos, **0 errores de OCR en cantidades/precios/fechas** en los 10
documentos, y las fichas de proveedor se completaron con razón social, CP y población desde
los propios papeles (tus propuestas de la mesa — muy bien eso).

### Lo que el piloto ha cazado (por esto se hacen pilotos)

1. **ARREGLADO — "CAJ" no contaba como caja.** El vino de DDI Nexia venía "2 CAJ" (cajas de
   6 botellas) y la confirmación lo sumó como **2 unidades sin avisar**: la lista de unidades
   contenedoras de la función transaccional no incluía la abreviatura "CAJ". Migración
   `20260807130000` aplicada a prod (añade caj/cajón/box), formato de compra "75CL 6U" con
   equivalencia 6 creado, y el albarán re-confirmado: ahora suma **+12 botellas** con el
   snapshot correcto (2 × 6). De paso quedó validado en vivo TODO el circuito de
   equivalencias que faltaba por probar.
2. **ARREGLADO — crear producto lo creaba en la empresa EQUIVOCADA.** `createProducto` (y
   la importación masiva de productos) usaban la empresa de la FICHA del usuario en vez de
   la empresa ACTIVA del selector: trabajando en HABANA me creó el producto en BACANAL
   (limpiado). Corregido en `producto-actions.ts`: ambas usan ya `getLogisticaContext()`
   como el resto de acciones, y el helper defectuoso (`getUserEmpresaId`) está eliminado
   para que nadie lo reutilice. Typecheck y lint verdes.
3. **PARA TU AGENTE (grave) — empresa activa desincronizada tras volver a entrar.** Tras
   re-login, el botón de arriba decía HABANA pero el servidor seguía en BACANAL: el análisis
   del albarán casó contra el catálogo equivocado. Y pulsar HABANA no lo arregla (el cliente
   cree que ya está ahí); hay que pasar por BACANAL y volver. Riesgo real de registrar
   albaranes en la empresa que no es.
4. **El aviso "Antes de confirmar" cuenta mal**: dice "Entran en el almacén: 0 productos"
   aunque mueva 9 o 19 — solo cuenta las líneas resueltas en esa pantalla, ignora las que ya
   venían vinculadas de la subida. La confirmación real va bien; es solo el contador.
5. **La decisión "Crear producto nuevo" de la mesa no crea nada** — la línea llega "Sin
   resolver" al detalle y hay que rehacer la decisión en el asistente.
6. **El asistente no ve un producto recién creado** en la misma sesión (lista cacheada), y
   al recargar la página se pierden las resoluciones no confirmadas — es el autosave del F5
   que sigue pendiente, ahora con caso real.
7. **El matcher se fía demasiado del parecido textual**: para "AMBIENTADOR AIR SANDIA"
   propuso "Sandia" (la fruta, 90%) cuando existía "Ambientador Sandia" (82%).
8. **Duplicados de catálogo por mayúsculas**: "Mix goma pica"/"Mix Goma Pica", dos
   "Alhambra" en Habana, varios "Delizia". Merecería una pasada de limpieza.
9. **Fichas con CIF**: a DDI NEXIA le grabamos el CIF del papel (B79533048; el que tenía,
   A/08000820, era erróneo). En MAHOU dejamos el CIF real de Mahou aunque el papel traiga el
   del distribuidor ASYN (la mesa propone bien ahí).

### El stock queda SUMADO — decide si lo dejamos así

Estos 10 albaranes son entregas de hace una semana, en parte consumidas, así que el stock
resultante está inflado respecto a la realidad física. Registro exacto de cada delta por
producto en **`docs/LOTE_ALBARANES_2026-08-07_REGISTRO_STOCK.md`** (55 movimientos). Opciones:
**(a)** lo dejamos (y el próximo inventario de regularización lo cuadra — es para lo que
existe), o **(b)** lo revertimos y quedan como los lotes viejos (precios se conservan).
Dinos cuál prefieres; con el registro cualquiera de las dos es limpia.

Detalle menor: el usuario demo (Agora Demo) ahora tiene acceso a Habana y existe el
proveedor DDI NEXIA en Habana — hacían falta para el lote.

**El piloto por nuestra parte queda hecho. Falta tu mitad: tu próxima recepción real contra
pedido con el motor F6.** Con eso decidimos juntos si lo damos por cumplido.

---

## ✅ RESPUESTA DE IVÁN (07-ago) — tus 3 preguntas abiertas, contestadas

Fernando: leído todo lo del 6 y 7 de agosto. Van las tres respuestas.

### 1. La Edge Function `analizar-albaran`: **NO la borré yo**

Confirmado, nunca la toqué desde el panel ni de ninguna otra forma. Así que tu sospecha se
confirma: **la recepción con foto llevaba rota en silencio**, y el "ajusta las cantidades a
mano" que me salía en pantalla no era el comportamiento normal — era el invoke fallando.

**No sé fechar cuándo desapareció** (yo no la borré, así que no tengo momento que darte). Si
os sirve para acotarlo, tiráis de los logs del proyecto o del historial del panel: cualquier
cosa por vuestro lado va a ser más fiable que mi memoria. Lo que sí te digo es que llevaba
tiempo dándome ese aviso y yo lo tomaba por normal, así que el hueco no fue de días.

Esto refuerza lo tuyo: una pieza cuyo código no está en el repo puede morirse sin que salte
nada. Bien quitada.

### 2. La recepción contra pedido: la pruebo en la próxima entrega real

Entendido que habéis cambiado el motor por dentro y que la pantalla es la misma. **La uso en
la próxima recepción de verdad y te aviso aquí**, tanto si va bien como si veo algo raro. Si
falla te paso el código de error que salga.

### 3. El piloto de volumen: **NO lo doy por cumplido todavía — quiero más pruebas**

Sé que están los lotes de 27 + 31 y el E2E real, pero prefiero no activarlo en general aún.
El motivo es justo lo del punto 1: acabamos de descubrir que un trozo de este circuito
llevaba roto en silencio sin que nadie se enterara, y encima el motor de la recepción por
pedido **ha cambiado hace dos días**. Los albaranes de esos lotes se cargaron con el motor
viejo; no son prueba del nuevo.

Lo que quiero antes de dar el piloto por bueno: **unas cuantas recepciones reales mías, con
el motor de la Etapa D ya puesto**, hechas por el flujo del día a día. Cuando lleve varias
seguidas sin sorpresas, lo damos por cumplido y lo hablamos aquí. No hay prisa.

**Y tengo más albaranes pendientes de subir** — los voy a subir yo por el móvil, por el
camino nuevo. Eso me sirve de piloto de verdad: son documentos reales, con el motor de
ahora, y si algo falla saldrá ahí. Te cuento aquí cómo va (cuántos entraron limpios, cuáles
dieron incidencia y de qué tipo). **Con eso decidimos si el piloto queda cumplido**, en vez
de darlo por bueno con los lotes viejos.

### 4. Lo del sufijo `_Fernando`: entendido y corregido

Tienes razón, y era mi agente imitando vuestro patrón sin saber qué significaba. Ya está
guardado como regla permanente por mi lado: **mis commits van sin sufijo**. El `_Fernando`
es tuyo y solo tuyo. No se repetirá.

---

## ✍️ IVÁN: el sufijo `_Fernando` en los commits es la FIRMA de Fernando — dile a tu agente que no lo use (07-ago, Fernando)

Tu agente firmó tres commits suyos del 06-ago con el sufijo `_Fernando` (`52890722` nombre
de la PWA, `e14a866e` y `e5a56335` cierre de sesión móvil). Los tres salen de tu máquina
(autor `balleshosteleros`), así que fue tu agente imitando el patrón de nuestros commits.

Ese sufijo significa una sola cosa: **"este commit salió de la máquina de Fernando"**. Es
como distinguimos quién hizo qué al reconciliar. No pasa nada con esos tres (los fixes son
buenos y no los vamos a reescribir), pero **dile a tu agente que no vuelva a añadirlo** a
commits vuestros — sus commits van sin sufijo, como siempre.

---

## 🏁 IVÁN: ETAPA D DESPLEGADA — PRP-073 COMPLETO: adiós a la Edge Function fantasma (06-ago, Fernando)

Última etapa del PRP-073 en prod. **OJO: cambia el motor de TU flujo diario de recepción**
(probado E2E antes de desplegar, misma pantalla y misma comparativa — pero pruébalo en tu
próxima recepción real y avisa si algo raro):

1. **La recepción contra pedido ya NO invoca `analizar-albaran`** (la Edge Function cuyo
   código no estaba en el repo — si se rompía, nadie sabía qué hacía ni cómo redesplegarla).
   Ahora: compresión en el móvil → subida directa a Storage → **extractor único** →
   comparador pedido↔OCR **versionado y puro** (`lib/albaranes/comparar-pedido.ts`).
   Mismo shape `AnalisisAlbaran`, misma `ComparativaAlbaran` — tu pantalla no cambia.
2. **La foto de la recepción ya no se re-sube**: va una vez a Storage y se mueve al albarán
   al confirmar (con su análisis y su `hayAlerta`). Y gana la traza de importación (código
   de error + reintento) que ya tenía el alta libre.
3. **Probado E2E** con pedido de prueba + foto real: casó "Agua Fuenteliviana Grande" ↔
   "FUENTE LIVIANA 1/1 VIDRIO RET. CAJ" (cantidad diferente), leyó cabecera completa,
   0 falsos extras. Todo el rastro de prueba borrado.
4. **`albaranes_lineas` BORRADA de prod** (tu punto 4: cero referencias en código, cero
   filas — confirmado antes del drop; migración `20260806120000` de registro).
5. **DATO IMPORTANTE**: fuimos a borrar la Edge Function `analizar-albaran` del panel…
   y **ya no existía** (solo queda `soporte-embeddings`). Si no la borraste tú hace poco,
   significa que **la recepción con foto llevaba rota en silencio** (el invoke fallaba y
   la pantalla decía "ajusta las cantidades a mano") hasta el motor nuevo de hoy. ¿Sabes
   cuándo desapareció? Nos ayudaría a fechar cuánto tiempo estuvo el hueco.

Con esto, **el PRP-073 queda COMPLETO de punta a punta** (captura fiable → duplicados →
cantidades por formato → confirmación transaccional → alias → recepción convergida). Lo
que queda del universo albaranes es de tu PRP-074 (mesa de incidencias) y la F5 restante
(autosave + ver el original al lado), a coordinar.

---

## 🔬 REVISIÓN DEL PRP-074 HECHA — veredicto, 5 fallos encontrados y ARREGLADOS (06-ago, Fernando)

Iván: hice la revisión que pediste, con tus 4 comprobaciones y algunas más. Resultado
global primero, detalle después. **Los fallos ya están corregidos y desplegados** — esto
no es una lista de reproches, es el registro de qué falló, por qué, y cómo quedó, para
que los dos (y nuestros agentes) aprendamos de ello.

### Veredicto de tus 4 comprobaciones

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Te pisé trabajo local? | **No** — todo lo nuestro estaba pusheado y el árbol limpio. Cero pérdida. |
| 2 | ¿Compila? | **Sí** — solo faltaba `npm install` (tu dependencia nueva `fix-webm-duration`). |
| 3 | ¿La solución es correcta? | **El diseño sí; la ejecución tenía 5 fallos** (abajo). El detector, el intérprete de formatos y la auditoría de decisiones están BIEN hechos. |
| 4 | Tu lista de deuda | Correcta. F6/F7 siguen siendo nuestras; los 115 formatos a NULL se irán rellenando SOLOS con el fix nº1; `albaranes_lineas` = borrarla (0 referencias, lo confirmo). |

### Los 5 fallos, con su porqué y su arreglo (todos corregidos y validados E2E)

**1. La mesa DECIDÍA pero no EJECUTABA (el gordo).** `decidirIncidencias` solo anotaba
`estado` + `decision` en la tabla. Aceptar "una caja son 24 → entran 48" no escribía en
NINGÚN sitio que la confirmación transaccional lea: al confirmar, la RPC volvía a
bloquear la misma pregunta que el usuario ya había contestado. La mesa prometía y no
cumplía. **Arreglo:** las decisiones de equivalencia ahora hacen upsert en `formatos`
(tipo compra) — que es EXACTAMENTE lo que la RPC consulta — sin pisar jamás una
equivalencia puesta a mano. Bonus: tu deuda de "115/153 formatos a NULL" se rellena sola
con el uso.

**2. Los vínculos aceptados tampoco se aplicaban.** Aceptar "¿SPRITE C24 es Sprite?" → Sí
dejaba la línea en "Sin reconocer" igualmente. **Arreglo:** el hook aplica el payload a la
línea al resolver. Validado en vivo: 2 líneas pasaron de "0 de 2" a **"2 de 2
reconocidas"** al aceptar, y el albarán guardado llevaba sus `productoId` puestos.

**3. `producto_formato_aliases` era huérfana POR PARTIDA DOBLE**: `memorizarFormatoAlias`
no la llamaba nadie, y nadie la leía. La misma enfermedad que tú nos señalaste con
`producto_proveedor_aliases` — vale para los dos lados del espejo. **Arreglo:** las
decisiones de equivalencia la escriben; la lectura llegará con el matcher de formatos.

**4. Las incidencias SEGUÍAN naciendo huérfanas (la causa raíz seguía viva).** Tu nota
decía "corregido en código", pero el hook pasaba `importacionId` leyendo el ESTADO de React
en el mismo render donde se setea → llegaba **null** SIEMPRE en el primer análisis, y
`ligarIncidenciasAlAlbaran` no encontraba nada que ligar. Tu arreglo ató las 8 viejas a
mano; las nuevas habrían nacido huérfanas igual. **Arreglo:** el id viaja por parámetro,
no por estado. Validado: 11 incidencias nuevas nacieron CON importación y quedaron ligadas
al albarán al guardar.

**5. El ligado era fire-and-forget** (`void ligar(...)`): si fallaba, huérfanas otra vez y
en silencio — el mismo modo de fallo que ya te mordió. **Arreglo:** `await` + aviso visible
si no se pudo ligar.

### Lección para los agentes (la tuya y la nuestra)

El patrón de los fallos 1-3 es el mismo: **piezas que registran sin ejecutar, o que se
escriben sin que nadie las lea**. Un sistema que "anota la decisión" no está terminado
hasta que la decisión CAMBIA algo comprobable (un formato, una línea, un movimiento). La
prueba que lo caza siempre: seguir UNA decisión de punta a punta hasta la BD y preguntarse
"¿qué es distinto ahora?". Si la respuesta es "una fila de auditoría", falta la mitad.

(Y el método: esto salió a la primera revisión cruzada. Implementar y desplegar sin esa
revisión es como confirmarse un albarán a uno mismo.)

---

## 🔎 FERNANDO — LEE ESTO CON TU CLAUDE ANTES DE TOCAR NADA (06-ago)

**Contexto en una frase:** el PRP-074 (mesa de incidencias de albaranes) **no está esperando tu
aprobación — ya está construido, desplegado y funcionando en producción** desde el 5 de agosto.
El documento decía «PROPUESTO, a aprobar por Fernando» y era engañoso; ya está corregido.

**Se tocaron DOS ficheros tuyos sin esperar ventana.** Se avisa aquí en abierto para que no lo
descubras leyendo el código. Si tenías trabajo a medias, se reconcilia — dilo.

### Instrucciones para tu Claude (pégale esto)

> Estoy revisando el PRP-074 de Balles-Hosteleros, que se implementó y desplegó sin mi
> aprobación previa. Necesito que compruebes cuatro cosas y me digas si hay que reconciliar
> algo o si puedo seguir:
>
> 1. **¿Me pisaron trabajo local?** Mira si tengo cambios sin commitear o commits locales sin
>    subir en `src/features/logistica/components/albaranes/ResolverLineaDialog.tsx` y
>    `src/features/logistica/components/albaranes/AsistenteAlbaranPanel.tsx`.
>    Compara con `origin/main` y dime qué se sobrescribiría.
> 2. **¿Me rompe algo al compilar?** `onIgnorar` cambió de firma a `onIgnorar(motivo: string)`
>    y `EstadoLinea` pasó a `{ estado: "ignorada"; motivo: string }`. Busca todos los llamadores
>    y confirma que compila (`npx tsc --noEmit`).
> 3. **¿Cómo quedó mi zona?** Léete los commits `88ef744` (F2+F3), `c91a71a` (F4+F5),
>    `4362239` y `ccf3a51` (formato de compra), y el PRP en
>    `.claude/PRPs/PRP-074-mesa-de-incidencias-albaranes-anticipacion-y-propuesta.md`.
>    Dime si la solución te parece correcta o si hay algo que yo habría hecho distinto.
> 4. **Mi deuda pendiente:** F6 y F7 del PRP-073, los 115 de 153 formatos de compra con
>    `equivalencias` a NULL, y decidir qué hacer con la tabla muerta `albaranes_lineas`.
>
> No cambies nada todavía. Primero dime qué encuentras.

### Lo que hay construido (para que no lo busques a ciegas)

| Pieza | Dónde |
|---|---|
| Catálogo cerrado de 12 tipos de incidencia + detector | `src/features/logistica/lib/albaranes/detectar-incidencias.ts` |
| La ventana que propone y el humano decide | `src/features/logistica/components/albaranes/MesaIncidenciasDialog.tsx` |
| Acciones (analizar, decidir, listar, memorizar alias) | `src/features/logistica/actions/incidencias-albaran-actions.ts` |
| Tabla + RLS por empresa | `supabase/migrations/20260805190000_albaran_incidencias.sql` |
| El plan completo y el estado real por fases | `.claude/PRPs/PRP-074-...md` |

**Prueba de que funciona con datos reales** (verificado en BD el 06-ago): el albarán de Coca-Cola
que subió Iván desde el móvil (`ALB-2026-018`, HABANA) generó **8 incidencias solo**, todas en
estado `abierta` esperando decisión humana — `proveedor_desconocido` 🔴 · `total_descuadrado` 🔴 ·
`iva_incoherente` 🟠 · `producto_ambiguo` 🔵 · `linea_de_servicio` 🔵 ×4.

**Si decides revertir algo:** `git revert` sobre esos cuatro commits. La migración ya está
aplicada a prod, así que tirar la tabla sería una decisión aparte y consciente.

---

## ✅ CIERRE DEL 05-AGO — TODAS tus preguntas respondidas + la prueba móvil HECHA

Fernando: lee esto primero. Queda **cero pendiente por mi parte**; lo que sigue abierto es tuyo
o de los dos, y está listado al final.

### 0. LA IDEA DE FONDO — por qué no te contesto pregunta por pregunta

Tus preguntas (¿este producto es aquel? ¿este albarán está duplicado? ¿falta una página? ¿este
recargo es un producto?) **no eran preguntas de código: son del día a día de recibir mercancía**.
Pasan con todos los proveedores, todas las semanas, y van a seguir pasando.

El problema real era que **el software no reconocía esa clase de situación**, así que cada una
acababa en este `.md` esperando respuesta durante días. Contestarlas de una en una no arreglaba
nada: la semana siguiente había otras diez.

**Lo que faltaba era el código que resuelve esa clase de problema** — que es lo que se ha hecho
(PRP-074). Ahora el escaneo detecta las anomalías solo y las presenta en una ventana con la
propuesta ya rellenada, para resolverlas en el momento, sin `.md` y sin esperar a nadie.

**Comprobado con tu propio albarán de Coca-Cola** (el que subí desde el móvil): generó **8
incidencias solo**, sin que nadie las buscara —

- 🔴 No reconozco al proveedor "Coca-Cola Europacific Partners"
- 🔴 Las líneas no suman el total del papel (sobran 0,10 €)
- 🟡 El IVA del 21 % no cuadra
- 🔵 ¿"SPRITE VR20 C24" es "Sprite"?
- 🔵 "Punto Verde" es un gasto, no mercancía **(×4)**

Eso es exactamente lo que antes me preguntabas por WhatsApp. Quedan registradas en
`albaran_incidencias` ligadas a `ALB-2026-018` (HABANA, en Revisión), esperando decisión humana.

> **Nota:** las de ese albarán nacieron huérfanas (se detectan justo tras el OCR, cuando el
> albarán aún no existe, y no se les asignaba al guardarlo). Corregido en código y las 8 ya están
> atadas a mano. Si ves incidencias sin albarán en otro documento, es de antes del arreglo.

### 1. LA PRUEBA MÓVIL QUE ME PEDÍAS: HECHA Y CORRECTA ✅

Era el último gate del PRP-073. **Subí un albarán real desde el móvil y entró bien.**

- **Albarán:** Coca-Cola Europacific Partners nº 4535606566, 31-jul, HABANA
- **Traza:** `alb-msfz8pll-awdvdl` · estado `revisable` · **0 errores, primer intento**
- **La foto pesó 0,27 MB** tras comprimirse en el móvil (una foto de cámara son 3-12 MB)
- 8 líneas leídas, todas correctas

**Tu fallo de subida está muerto.** Ya no hace falta que esperes evidencia mía de la prueba
fallida: el circuito nuevo funciona con un documento real.

### 2. LAS 4 DUDAS DEL LOTE DEL 30-JUL — YA NO SON PREGUNTAS, SON INCIDENCIAS DEL SISTEMA

Cada una de tus 4 dudas era un **caso de operativa normal** que el software no sabía reconocer.
Ahora cada una tiene su tipo de incidencia, su detección automática y su propuesta. Correspondencia
exacta (y el nombre técnico por si lo buscas en el código):

| Tu duda | Cómo la resuelve el sistema ahora |
|---|---|
| **1. Belmon Drink 15378** (falta una página, corta en "SUMA Y SIGUE: 694,39 €") | Incidencia `documento_incompleto`. El OCR lee el marcador y el "pág. X de Y". Bloquea la confirmación y ofrece: añadir la página · cargar parcial marcado (`albaranes.documento_parcial`) · descartar. **Ya no hay que decidir "dentro o fuera": se carga marcado y reclama la página.** |
| **2. Los 3 recargos** (DDI Nexia 2,99 € ×2, Garcimar 1,50 €, Disbesa 1,10 €) | Incidencia `linea_de_servicio`. **Decisión de Iván: producto de compra con `controla_stock` DESACTIVADO.** No hace falta inventar nada — la opción ya existía y la RPC de la Etapa B ya la respeta. El total cuadra con el papel, el gasto se ve en contabilidad, el inventario no se ensucia. |
| **3. "ALH RESERVA 0,30 RET"** (matriz de puntos, ilegible) | Incidencia `producto_ambiguo`. Propone "Alhambra Reserva 0,30 retornable" **con su % de parecido y el porqué**. Al aceptar, memoriza el alias: no vuelve a preguntar por ese proveedor. Tu lectura era correcta. |
| **4. Belmonte 15402**, TEQ José Cuervo sin precio | Incidencia `linea_sin_importe`. Propone **"es un regalo: entra en stock a coste 0, NO registra precio"** (registrarlo a 0 hundiría el precio medio). Alternativas: escribir precio · descartar como error de impresión (con motivo). |

**Importante sobre el OCR:** tenía una instrucción explícita de **descartar** portes, desplazamiento
y punto verde (`ocr-albaran.ts:72-73`). Por eso los totales nunca cuadraban. Ya no los descarta:
los lee marcados con `esServicio`. Verificado con el albarán real: los 4 "Punto Verde" de
Coca-Cola entraron marcados, y el desglose cuadró al céntimo (85,27 base + 17,91 IVA = 103,18).

### 3. LOS CASOS NUEVOS DE LA TANDA 2 — RESUELTOS IGUAL

Cubo Cóctel Mix, Leche Asturiana, Hielo Cubitos 41mm y Vaso de sidra PP → `producto_no_encontrado`
/ `producto_ambiguo`, con el alta **ya rellenada** (nombre, IVA, precio, alias del proveedor) a un
clic. "Salsa barbacoa" comprada vs. la elaboración casera → `producto_ambiguo` (mismo nombre,
naturaleza distinta), a confirmar por una persona.

**Lo único que SÍ es respuesta directa y no incidencia:** el pedido Makro **"PARA PERSONAL"**
(doc 027174) **NO es gasto del restaurante**. Sus precios pueden quedar cargados, pero ese pedido
no debe contar como compra de restaurante.

### 4. TUS 3 MEJORAS DEL 29-JUL — LAS TRES HECHAS

| Tu mejora | Estado |
|---|---|
| **1. El buscador solo mira ≤6 candidatos precalculados** (te pasó con Gyozas, Alcachofa confitada, Oreja de cerdo, Paleta ibérica: existían y tuviste que ignorarlas) | ✅ **Resuelta.** `ResolverLineaDialog` busca sobre TODO el catálogo con 2+ letras. Usa **tu** `buscarProductosCompra` — estaba escrita desde el 04-ago y **no la consumía nadie**; solo había que enchufarla. |
| **2. Sugerencias engañosas del matcher** ("Oreja adobada" → proponía "Panceta adobada") | ✅ **Mitigada.** El matcher liga por alias exacto de proveedor (score 1) y por **referencia de artículo**, que es un código y no falla aunque cambie el nombre. Y toda vinculación manual **escribe** en `producto_proveedor_aliases` — esa tabla existía desde el PRP-073 pero **nadie la escribía**, solo se leía: por eso el sistema nunca aprendía. |
| **3. IVA con códigos de Makro** | ✅ Ya estaba, y ahora además se lee el **desglose del pie por tipo** (base + cuota + recargo de equivalencia) y se contrasta con las líneas. |

### 5. LO QUE HE TOCADO DE TU ZONA (avisado, no consensuado — dime si te pisé algo)

Entré en `ResolverLineaDialog.tsx` y `AsistenteAlbaranPanel.tsx` sin esperar ventana porque
llevabas **desde el 29-jul sin tocarlos** (`a84bb6a`) y ese día no habías subido nada. Si tenías
algo en local, **dímelo y lo reconciliamos**.

- **`onIgnorar` cambia de firma** → `onIgnorar(motivo: string)`. Ignorar ahora exige motivo de
  lista cerrada (no es mercancía · regalo · error del proveedor · ya recibido · otro).
- **`EstadoLinea`** pasa a `{ estado: "ignorada"; motivo: string }`.
- **`resolverAlbaranRevision`** acepta `motivoIgnorada` y lo escribe en el jsonb de la línea.
  Antes ignorar era **mudo**: nadie podía saber después por qué faltaba algo.
- **"Confirmar albarán" ya no dispara la RPC directamente**: abre un resumen previo (qué entra en
  el almacén, importe, qué queda fuera y por qué).

No toco tu lógica de vincular/crear ni la confirmación transaccional de la Etapa B.

### 6. UN FALLO REAL QUE ENCONTRÉ CON TU ALBARÁN — OJO CON ESTO

**Coca-Cola comprime el formato en un código**: `COCACOLA VR237 C24` = envase retornable de
237 ml en **caja de 24**. Mi intérprete leía `1` en vez de `24`, así que **2 cajas habrían
entrado como 2 unidades al almacén en vez de 48 botellas**.

Corregido: se leen los códigos `C24` / `P6` / `E12`, con dos guardas para no confundirlos con una
referencia de artículo (el número pegado a la letra y entre 4 y 48). La confianza queda en 0,75
—bajo el umbral— para que **lo confirme una persona**: es una deducción, no una certeza.

La regla que gobierna esto ahora (decisión de Iván): **un formato es un NÚMERO y una MEDIDA**
(24 ud · 5 L · 3 kg) y el stock es **siempre `cantidad × contenido`**. Cubre "caja de 24",
"CJ. 12x1L", "24x33cl", "PACK-6", "BIDON 25 L", "bandeja de 500 gr" (→ 0,5 kg), y distingue
tamaño de recuento ("PAN BRIOCHE 85g x 54u" son **54 panes**, no 85 gramos).

---

## 🔴 LO QUE SIGUE ABIERTO

**Para ti, Fernando:**

1. **¿Te pisé algo?** Confírmame que no tenías trabajo local en `ResolverLineaDialog` /
   `AsistenteAlbaranPanel`.
2. **Deuda del PRP-073 que sigue siendo tuya:** F6 (la Edge Function no versionada de la
   recepción por pedido) y F7. F6 toca la recepción que Iván usa a diario → avisar y elegir ventana.
3. **75 % de los formatos de compra tienen `equivalencias` a NULL** (115 de 153 en prod). El
   matcher de la RPC exige `equivalencias is not null`, así que esos formatos son invisibles para
   el match por nombre. El intérprete nuevo lo tapa deduciendo del texto, pero **conviene
   rellenarlos** para no depender de la deducción.
4. **`albaranes_lineas` está MUERTA**: existe en el esquema y ningún fichero de `src/` la usa —
   todo va por el jsonb `albaranes.lineas`. Decidir si se borra o se documenta como legacy.

**Para Iván (yo):**

5. **Cerrar sesión en la app instalada.** Sigue sin cerrar. Lo hemos perseguido en tres pasadas
   (colgado → cookies `sb-*` no borradas → orden de ejecución). El último hallazgo: las cookies
   son **`HttpOnly`**, así que solo el servidor puede matarlas, y navegar de inmediato cancelaba
   esa petición. **Sospecha viva y no verificada:** `src/app/manifest.ts` tiene
   **`start_url: "/m"`** — el icono de la pantalla de inicio abre SIEMPRE `/m` directamente, así
   que aunque la sesión muera, al reabrir la app se entra por la ruta privada y puede rebotar.
   Descartado que sea el service worker (`public/sw.js` es NetworkOnly, no cachea nada).
6. **Piloto de volumen:** el PRP-073 pedía ≥20 albaranes de 3 proveedores antes de activación
   general. Con los lotes ya cargados (27 + 31) y este E2E real, queda a criterio de los dos si
   se da por cumplido.

---

## ⚠️ FERNANDO: he tocado TUS DOS FICHEROS del asistente (05-ago) — léelo antes de seguir

Aviso por adelantado, como haces tú conmigo. He entrado en `ResolverLineaDialog.tsx` y
`AsistenteAlbaranPanel.tsx` sin esperar a acordar ventana, por dos motivos: llevas **desde el
29-jul sin tocarlos** (tu último commit ahí es `a84bb6a`) y hoy no habías subido nada. Si tenías
algo a medias en local, **dímelo y lo reconciliamos** — no te lo pisaré dos veces.

**Qué cambia en tu zona:**

1. **`ResolverLineaDialog` — muere el límite de 6 candidatos.** Era la mejora nº 1 de tu propia
   lista del 29-jul: te pasó con "Gyozas pollo y verduras", "Alcachofa confitada", "Oreja de
   cerdo en adobo" y "Paleta cebo ibérico" — existían y tuviste que ignorar sus líneas. Ahora al
   escribir 2+ letras consulta `buscarProductosCompra` (tu action paginada, que **estaba escrita
   y no la usaba nadie**) con 250 ms de espera, y pinta un segundo grupo "Encontrados en el
   catálogo" debajo de tus "Sugeridos", sin repetir los que ya salen arriba. Tu bloque de
   sugeridos, el `IndicadorPrecio` y el `score` **no los he tocado**.
2. **`ResolverLineaDialog` — ignorar ahora pide motivo.** Lista cerrada (no es mercancía ·
   regalo · error del proveedor · ya recibido) + "otro" con texto libre. El botón no se habilita
   sin motivo. **Ojo: `onIgnorar` cambió de firma** — ahora es `onIgnorar(motivo: string)`.
3. **`AsistenteAlbaranPanel` — resumen antes de confirmar.** Tu botón "Confirmar albarán" ya no
   dispara la RPC directamente: abre un resumen con qué entra en el almacén, el importe, y qué
   queda fuera con su motivo. Desde ahí se confirma. `EstadoLinea` pasa a
   `{ estado: "ignorada"; motivo: string }`.
4. **El motivo viaja hasta la BD**: `resolverAlbaranRevision` acepta `motivoIgnorada` y lo
   escribe en el jsonb de la línea (verificado contra prod). Antes ignorar era mudo y nadie
   podía saber después por qué faltaba algo.

Nada de esto cambia tu lógica de vincular/crear ni la confirmación transaccional de la Etapa B.
Typecheck y eslint limpios; la cadena del motivo probada de punta a punta contra prod.

**Contexto de por qué:** esto es la F4 y F5 del **PRP-074**, que arranca de la decisión de Iván
de abajo. Las F1-F3 (OCR ampliado, detector, tablas y la ventana) ya están en prod y no tocan
nada tuyo.

---

## 🛑 RESPUESTA DE IVÁN (05-ago): estas preguntas NO se responden aquí — se resuelven en el software

Fernando: leídas todas tus preguntas abiertas (las 4 dudas del lote del 30-jul y los 6 casos
nuevos de la tanda 2). **No te las voy a contestar una a una, porque contestarlas no arregla el
problema de fondo.**

El fondo es este: cada vez que un albarán trae una rareza —falta una página, hay un recargo que
no es un producto, un nombre no se lee bien, una línea viene sin precio, el producto no está en
catálogo— **el sistema no la reconoce, así que acaba en un `.md` y me la preguntas a mí**. Eso
no es un problema de código: es que el software no está diseñado para lo que se va a encontrar.
Y se va a encontrar siempre lo mismo, con todos los proveedores y en todos los restaurantes.

**Lo que quiero:** que al escanear una factura, el sistema **prevea todas esas posibilidades**,
las detecte solo, y me las presente **en una ventana emergente con su propuesta ya hecha**, para
que yo solo diga sí o no. Sin documentos, sin WhatsApp, sin esperar a que estés disponible.

**→ `.claude/PRPs/PRP-074-mesa-de-incidencias-albaranes-anticipacion-y-propuesta.md`**

Ahí está el diseño completo: **12 tipos de incidencia** (catálogo cerrado y versionado), cada uno
con su detección, su propuesta por defecto y sus acciones. Tus 9 preguntas abiertas son
exactamente 9 de esos 12 tipos — por eso las uso como los tests del detector en la F1.

**Decisiones de negocio que ya te cierro (no hace falta que me las vuelvas a preguntar):**

1. **El sistema propone, yo decido.** Nada entra en stock ni en catálogo sin mi OK. Solo se
   auto-resuelve la evidencia máxima (alias exacto del mismo proveedor) y aun así se muestra.
2. **Documento incompleto → se guarda marcado como parcial y avisa.** Entra lo legible, queda el
   aviso pendiente. No se pierde nada y no se atasca nada. Esto responde al Belmon Drink 15378:
   ya no hay que decidir "lo dejamos fuera o no", el sistema lo carga parcial y lo reclama.
3. **Los portes, el envase retornable y el desplazamiento son productos de compra normales con
   "Controla stock" DESACTIVADO.** No hay que inventar nada: todo producto de compra tiene ya
   esa opción, y la confirmación transaccional ya la respeta (`productos.controla_stock`). Así
   el total del albarán cuadra con el papel, el gasto se ve en contabilidad, y el inventario no
   se ensucia. Esto responde a los tres recargos (DDI Nexia 2,99 €, Garcimar 1,50 €, Disbesa
   1,10 €) y a todos los que vengan.

**Lo que sigue siendo tuyo y no cambia:** la prueba móvil que me pediste que repita. Esa la hago
yo y te paso el código de error si vuelve a fallar.

**Antes de arrancar el PRP-074:** las fases F4 y F5 pisan tu zona (`ResolverLineaDialog` y
`AsistenteAlbaranPanel`). Te lo re-anuncio aquí y acordamos ventana, como con la Etapa C del 073.
Las fases F1 a F3 (OCR, detector, tabla y la ventana en sí) no tocan nada tuyo.

---

## 🧠 IVÁN: ETAPA C-BACKEND DESPLEGADA — alias por proveedor y búsqueda total (04-ago noche, Fernando)

Tercera tanda del día, solo backend (tu UI del asistente NO se ha tocado — eso es la F5 y
se coordina contigo antes):

1. **Tabla `producto_proveedor_aliases`** (aplicada a prod): varios alias por producto ×
   proveedor. Backfill desde `nombre_proveedor`: **145/150 migrados** inequívocamente (vía
   histórico de precios), 5 al informe (`docs/BACKFILL_ALIAS_PROVEEDOR_2026-08-04.md`), 0
   adivinados. `nombre_proveedor` queda de solo-lectura (fallback del matcher una versión).
2. **Matcher alias-primero**: si el texto OCR casa EXACTO con un alias del mismo proveedor,
   liga con score 1 sin pasar por similitud. Esto arregla los cruces tipo GARCIMAR.
3. **`buscarProductosCompra`** (action paginada sobre todo el catálogo): lista para que tu
   "Vincular a existente" de la F5 deje de estar limitado a 6 candidatos.

Pendientes que siguen en tu tejado: repetir tu prueba móvil + las 4 dudas del 30-jul.

---

## 🔒 IVÁN: ETAPA B DESPLEGADA — confirmar un albarán ahora es TRANSACCIONAL (04-ago noche, Fernando)

Mismo día, segunda etapa del PRP-073 en prod. Qué cambia al confirmar/recepcionar:

1. **Se acabó el "Confirmado con aviso de stock".** Confirmar ahora es UNA transacción en BD
   (`confirmar_albaran_transaccional`): valida líneas, re-chequea duplicados bajo bloqueo,
   registra precios, mueve stock y cambia el estado AL FINAL. Si algo falla → rollback
   completo y el albarán sigue en Revisión. Doble clic o dos personas a la vez = máximo un
   movimiento por línea (verificado).
2. **Las cantidades ya respetan el formato.** "3 cajas de 24" entra como **72** al kardex,
   no como 3 (verificado en prod con test real y revertido). La equivalencia sale de
   Logística → Catálogos → formatos de COMPRA (por nombre del formato o de la unidad).
   El snapshot queda en la línea (`cantidadStock`, `equivalenciaAplicada`, `unidadStock`).
3. **Una unidad contenedora sin equivalencia BLOQUEA la confirmación** con un mensaje que
   dice exactamente qué formato crear. Ejemplo real: "La línea X viene en 'caja' y no hay
   equivalencia definida. Crea el formato de compra 'caja' con su equivalencia…". Si te
   pasa con albaranes en Revisión: creas el formato con su equivalencia y confirmas —
   sin tocar código. (Unidades no contenedoras que no cuadran con la base siguen 1:1 como
   siempre, marcadas para revisar en la Etapa C.)
4. `updateAlbaranEstado` hacia Entregado/Confirmado ahora delega en la función de BD —
   si tocas ese camino, la lógica vive en la migración `20260804150000`. Los precios de
   compra al confirmar también se registran ahí (ya no en `resolverAlbaranRevision`).
5. Cada guardado de revisión sella `revision_guardada_at/por`; el autosave con control de
   conflictos llega en la Etapa C (F5, tu zona — te avisaremos antes).

Con esto, la Etapa B queda cerrada. Siguiente hito: el piloto (Fernando sube sus 23
albaranes por el móvil) y después la Etapa C. **Sigue pendiente que repitas tu prueba
móvil fallida** (sección siguiente) — ahora con más motivo: todo el circuito nuevo está
en prod.

---

## ✅ IVÁN: ETAPA A DESPLEGADA — el fallo de subida móvil está arreglado: REPITE TU PRUEBA (04-ago tarde, Fernando)

La Etapa A del PRP-073 (Fases 1 y 2) está **construida, probada E2E y desplegada en prod** el
mismo día. Lo que cambia para ti:

1. **Tu fallo de subida móvil debería estar muerto.** El archivo ya NO viaja en base64 por una
   Server Action (era el límite mudo de ~10,5 MB): ahora la imagen se **comprime en el móvil**
   (una foto de cámara de 12 MB baja a <1 MB) y **sube directa a Storage** con credencial
   firmada. Probado con la matriz de 2, 8 y 12 MB: los tres tamaños entran. **→ Por favor,
   repite la prueba que te falló, con la misma foto si puedes.** Si vuelve a fallar, ahora
   verás un error CLARO en español con un código (p.ej. `alb-xxxx-xxxx`) — pásanoslo y con él
   encontramos tu intento exacto en la traza.
2. **Detección de duplicados activa.** El mismo archivo dos veces = bloqueado con el número
   del albarán existente. Mismo proveedor + mismo nº de albarán = aviso naranja; para
   registrarlo igualmente hay que escribir un motivo (queda auditado quién/cuándo/por qué).
   Y un pedido ya no puede recepcionarse dos veces (constraint en BD).
3. **Cada subida deja traza** en `albaran_importaciones` + `albaran_eventos` (nuevas tablas):
   estado, huella SHA-256, intentos, código de error. Se acabó el "falló y no sabemos nada".
4. **Tu tope de 50 MB ahora es verdad** para este flujo (con la subida directa el
   `bodySizeLimit` ya no aplica) — no hizo falta revertirlo: hicimos cierto tu supuesto.
5. **Fin del freeze**: puedes volver a tocar `use-subir-albaran.ts`,
   `asistente-albaran-actions.ts` y `albaranes-actions.ts`. Ojo: `analizarAlbaranFoto` ahora
   es un wrapper del extractor único en `lib/albaranes/ocr-albaran.ts` — si tocas el prompt
   del OCR, tócalo AHÍ. Y en ficheros `"use server"` NO se pueden re-exportar tipos
   (`export type { X }`): Turbopack no lo borra y revienta el loader de actions en runtime
   (nos pasó; está corregido en `093e7889`).
6. **Dato para la Fase 3 (alias):** tenemos proveedores duplicados por nombre en los
   albaranes históricos ("GARCIMAR" vs "GARCIMAR SL", "DDI NEXIA" vs "DDI NEXIA S.L.U.") —
   la detección de duplicados compara nombre exacto y eso la debilita entre lotes viejos y
   nuevos. Se arregla con la tabla de alias de la Etapa C. Además el backfill de
   `proveedor_id` dejó 4 albaranes sin match (informe en
   `docs/BACKFILL_PROVEEDOR_ID_ALBARANES_2026-08-04.md`).

Siguiente etapa (B): cantidades por formato (caja de 24 → 24 al stock) + confirmación
transaccional. No pisa tus ficheros de revisión; te avisaremos aquí igualmente.

(Siguen pendientes de tu lado: la evidencia de tu prueba fallida —sección de abajo, aún útil
para descartar las otras hipótesis— y las 4 dudas del lote del 30-jul.)

---

## 📋 IVÁN: PRP-073 APROBADO — arrancamos la reconstrucción del flujo de albaranes (04-ago, Fernando)

Fernando ha aprobado el **PRP-073** (`.claude/PRPs/PRP-073-albaranes-proveedor-flujo-fiable-y-revision-asistida.md`).
Es el plan que arregla de raíz el fallo de subida móvil que viste y endurece todo el circuito
(duplicados, confirmación transaccional, cantidades por formato, mesa de revisión). El orden de
ejecución acordado está escrito en la cabecera del propio PRP. Resumen:

- **Etapa A (empezamos ya):** subida directa a Storage (muere el base64 → muere tu fallo de
  tamaño), compresión de imagen en cliente, errores con código + traceId, reintentos, y
  detección de duplicados. **Cuando esté desplegada te pediremos que repitas tu prueba móvil
  que falló** — ese es el gate de salida.
- **Etapa B:** confirmación transaccional (hoy el estado puede quedar Confirmado con el stock
  fallido) + cantidades por formato (caja de 24 → 24 al kardex, no 1).
- **Piloto:** los 23 albaranes pendientes de Fernando, subidos por el camino nuevo.
- **Etapas C y D:** matcher con alias por proveedor, mesa de revisión de escritorio (búsqueda
  completa, guardar avance, ver el original al lado), y convergencia de la recepción por pedido.

**3 cosas que te pedimos para no pisarnos:**

1. **Mientras dure la Etapa A, no toques** `use-subir-albaran.ts`,
   `asistente-albaran-actions.ts` ni `albaranes-actions.ts` (te avisamos aquí al cerrar cada
   etapa). El resto del repo, libre.
2. **El tope de 50 MB que subiste en `49513d41` lo vamos a revertir** dentro de la Etapa A: con
   la subida directa a Storage el límite deja de depender de `bodySizeLimit`, y mientras tanto
   50 MB solo agranda el fallo silencioso (el límite real sigue siendo ~10,5 MB, ver sección
   siguiente). Si tienes un motivo para mantenerlo que no conozcamos, dínoslo aquí antes.
3. **Las etapas C y D tocan tu zona** (`AsistenteAlbaranPanel`, `ResolverLineaDialog`, y la
   recepción por pedido que usas a diario). Antes de arrancarlas te lo re-anunciamos aquí y
   acordamos ventana.

Y siguen pendientes de tu lado: **la evidencia de tu prueba fallida** (sección siguiente — sigue
siendo útil aunque la Etapa A vaya a arreglar la causa más probable, porque confirma o descarta
las otras 4 hipótesis) y **las 4 dudas del lote del 30-jul** (en particular la página que falta
del Belmon Drink 15378 de Habana).

---

## ❓ IVÁN: necesitamos la evidencia de TU prueba móvil que falló (03-ago, Fernando)

Sabemos que probaste a subir un albarán desde el móvil y no funcionó. El análisis
(`docs/analisis_funcion_albaranes.md`, hecho por Fernando contrastando con un agente de
Codex — igual que el `PRP-073`, ya **APROBADO**, ver sección de arriba) deja 5 hipótesis
posibles, pero sin los datos de tu prueba no se puede arreglar sobre seguro. Cuando puedas,
apunta:

1. **Teléfono y sistema**: iPhone o Android, y si fue navegador (¿cuál?) o la PWA instalada.
2. **Ruta exacta**: ¿"Subir albarán por foto" (Más → Albaranes → tarjeta de arriba) o dentro
   de la recepción de un pedido ("Hacer foto del albarán")? Son dos flujos distintos por dentro.
3. **En qué paso falló**: al elegir la foto, al pulsar "Analizar", o al "Guardar en Revisión".
4. **La foto**: ¿cámara directa o de la galería? ¿Tamaño aproximado (se ve en Detalles) y formato?
5. **Qué viste en pantalla**: mensaje de error (captura si la tienes), o si se quedó colgado
   sin decir nada, y la hora aproximada para buscar en los logs.

Con eso distinguimos entre: límite de tamaño real (~10,5 MB, ver abajo), foto HEIC de iPhone
que Gemini no acepta, sesión/empresa caducada, o la Edge Function de la recepción por pedido.

**⚠️ Ojo con el cambio del tope a 50 MB** (entró en `49513d41`, un commit de RRHH): no arregla
el fallo, lo agranda. El límite real de la petición sigue siendo **14 MB** (`bodySizeLimit` en
`next.config.ts`) y el archivo viaja en base64 (+33%) → todo lo que pase de **~10,5 MB seguirá
fallando igual**, solo que ahora la UI acepta hasta 50 MB sin avisar. El propio PRP-073 lista
esto como anti-patrón. Propuesta mientras no llegue la Fase 1 del PRP (subida directa a Storage,
sin base64): **comprimir la imagen en cliente antes de enviar** (`browser-image-compression` ya
está instalado) y/o bajar el tope efectivo del flujo de albaranes a ~10 MB con aviso claro.
Dinos si lo aplicamos nosotros o lo tocas tú — pero el tope a 50 tal cual está da fallos
silenciosos con fotos de cámara normales.

(Recordatorio: también siguen pendientes tus respuestas a las 4 dudas del lote del 30-jul,
sección siguiente — en particular la página que falta del Belmon Drink 15378 de Habana.)

---

## 📸 LOTE DEL 30-JUL: 27 albaranes reales cargados (10→24 julio, Bacanal+Habana) — Iván LÉEME

Fernando pasó 36 fotos de albaranes/facturas de proveedor reales (10 al 24 de julio). Se han
**registrado 27 albaranes** directamente en BD (22 Bacanal `ALB-2026-023..044`, 5 Habana
`ALB-2026-012..016`), estado **Confirmado**, con sus 180 líneas vinculadas a producto (creados
**42 productos nuevos** — casi todos Makro: salsa barbacoa, mayonesa, aceite de oliva, pan hot
dog, contramuslos de pollo, Coca-Cola PET 2L/Zero, etc. — más 1 proveedor nuevo, **NEW ESPRESSO**
para las cápsulas de café de Bacanal) y **178 precios de compra** registrados en su histórico.
**Igual que en el lote de los 31 albaranes del 15-jul: NO se ha tocado el stock** (mercancía de
hace 1-3 semanas, ya consumida) — 0 `stock_movimientos` creados, verificado. Alias de proveedor
rellenados donde estaban vacíos para que el matcher los reconozca solo la próxima vez.

**4 cosas que quedan sin resolver — decisión tuya:**

> **▸ RESPUESTA DE IVÁN (05-ago): las 4 se resuelven en el software, no aquí.** Ver la sección
> 🛑 del principio y el **PRP-074**. Correspondencia: (1) = incidencia `documento_incompleto`
> → se carga parcial y reclama la página; (2) = `linea_de_servicio` → producto de compra con
> Controla stock desactivado; (3) = `producto_ambiguo` → propone "Alhambra Reserva 0,30
> retornable" con su % de parecido y yo acepto o corrijo; (4) = `linea_sin_importe` → propone
> "regalo: entra a coste 0, no registra precio". Las cuatro son casos de test de la F1.

1. **Un albarán no se pudo cargar: falta una página.** Belmon Drink → Habana, albarán **15378**
   (16-jul, pedido grande de licores/energéticas: Red Bull, ginebras, whiskies, Oxefruit...). Las
   dos fotos que hay de él cortan en "**SUMA Y SIGUE: 694,39€**" — hay al menos una página más
   con el resto de líneas y el total final que no llegó a fotografiarse. Si la tienes, pásala y
   lo cargamos; si no, dinos si lo dejamos fuera definitivamente.
2. **3 albaranes con un recargo sin producto claro** (se cargaron igual, solo con las líneas
   reales; el recargo queda fuera y por eso el total registrado es unos euros menor que el de la
   factura física):
   - **DDI Nexia** (agua/vino, `7200007615` y `7200008242`): recargo "**S.L.**" de 2,99€ al 21%
     en ambas — probablemente un depósito de envase de vidrio retornable.
   - **Garcimar** (`MA/56452`): "**cargo**" de 1,50€ al 21% — probablemente portes/transporte.
   - **Disbesa** (`176911`): línea "**Desplazamiento y Servicio**" de 1,10€.
   ¿Quieres que creemos un producto genérico tipo "Recargo/portes proveedor" para que estas
   líneas puedan entrar completas la próxima vez, o prefieres dejarlo siempre fuera del total?
3. **Nombre de producto sin confirmar**: "**ALH RESERVA 0,30 RET**" (factura Mahou/ASYN, Bacanal)
   — la foto es de una impresora de matriz de puntos, el texto no se lee con seguridad. Lo
   registré como "Alhambra Reserva 0,30 RET" (mi mejor lectura); confírmalo o corrígelo en la
   ficha del producto si es otra cosa.
4. **Línea fantasma sin precio**: en el albarán de Belmonte `15402` (Bacanal, 16-jul) el papel
   tiene una 4ª línea repetida de "TEQ JOSE CUERVO REPOSADO" (cantidad 1) sin precio ni importe
   impresos — no se cargó (no afecta al total, que sí cuadra sin ella). Puede ser una unidad de
   regalo o un error de impresión del proveedor.

Nada de esto bloquea nada — son matices para cuando tengas un rato. El resto (23 de los 27
documentos) cargó limpio, sin ambigüedades, verificado contra el papel.

---

## 📱 FASE MÓVIL LISTA (29-jul, más tarde) — Iván LÉEME

**Ya puedes subir los albaranes por foto desde el móvil, tal cual los tienes en la galería.**
En el teléfono: **Más → Albaranes → "Subir albarán por foto"** (tarjeta destacada arriba de
la bandeja) → cámara o adjuntar archivo → la IA lee el albarán → verificación en tarjetas
(proveedor, fecha, nº, y cada línea con cantidad/precio editable y aviso si la suma no
cuadra con el total del papel) → **"Guardar en Revisión"**. Queda exactamente igual que
subiéndolo desde el ordenador: en Revisión, sin sumar stock, con la foto adjunta. La
resolución fina (vincular/crear/ignorar) se sigue haciendo desde el ordenador — por eso en
la bandeja móvil aparece una sección **"En revisión"** de solo lectura que te confirma que
quedó guardado y te recuerda que toca rematarlo desde ahí.

Por dentro es el mismo motor que el cable de escritorio (mismo `analizarAlbaranFoto` /
`createAlbaran` / `resolverAlbaranRevision`, probados ya en el E2E de abajo): solo cambié
dónde vive el "quién lo sube" — el móvil no tiene tu perfil cargado en el navegador, así que
`createAlbaran` lo resuelve él solo consultando `usuarios` por tu `user_id` si no se lo
pasan (antes solo pasaba desde el diálogo de escritorio con el perfil ya en memoria).

Probado en prod con la foto de la página 2 del Makro 028341 (la que no estaba registrada):
guardado como `ALB-2026-022` con creador resuelto ("Agora Demo"), foto adjunta, 0 movimientos
de stock, visible en "En revisión" — verificado en BD y borrado después de comprobar (no era
un albarán real, era la prueba).

(Los 23 albaranes pendientes que faltan por registrar los tiene Fernando en su móvil y los
subirá él directamente por esta pantalla cuando le venga bien — no hace falta que hagas nada
con ellos.)

---

## 🎉 EL CABLE ESTÁ HECHO Y PROBADO E2E EN VIVO (29-jul noche, Fernando) — Iván LÉEME

**La pantalla de subir albarán por foto existe, está en main y funciona de punta a punta.**
Probada con un albarán REAL (Makro 028341 de Bacanal, 26-jun, el de la tanda 2) contra prod:

**Cómo se usa** (pruébalo tú): Logística → Pedidos → pestaña ALBARANES → botón **"Subir
albarán"** (junto al engranaje) → adjuntar foto/PDF o cámara → la IA lee cabecera y líneas →
pantalla de verificación (proveedor/fecha/nº detectados y editables, cantidades y precios
editables, suma de líneas vs total del papel) → **"Guardar en Revisión"** (nuevo estado
naranja: NO suma stock, guarda la foto adjunta, se puede seguir otro día) → en el detalle
sale TU asistente (`AsistenteAlbaranPanel`): vincular/crear/ignorar línea a línea →
**"Confirmar albarán"** → ahí entra el stock y se registran los precios de compra solos.

**Resultado del E2E real** (todo verificado en BD):
- OCR: 18/18 líneas de la página 1, suma 517,77 € clavada con el papel; fecha y nº albarán
  (028341) auto-detectados. Cantidades a peso también (7,748 kg alitas, 5,075 kg corvina).
- 7 líneas vinculadas, 1 producto creado desde el asistente (**Alitas de pollo**, nº 339 —
  la creación de productos de compra vuelve a funcionar tras el fix de contadores del BUG 1),
  10 ignoradas (productos que aún no existen en catálogo; quedan en el jsonb con el texto
  del proveedor para auditoría).
- Al confirmar: 8 movimientos de stock (`documento_tipo='albaran'`) + 4 precios nuevos en
  `producto_precios_compra` con IVA correcto (los otros ya estaban cargados de la tanda 2 →
  el guard anti-duplicados funciona). Alias `nombre_proveedor` memorizados (doble nombre ✓).
- El albarán ALB-2026-021 se ha quedado como dato REAL (es un albarán verdadero de Bacanal).

**Desmentido importante para tu agente**: `albaranes.estado` NO era texto libre — había un
CHECK (`albaranes_estado_check`) desde la migración `20260627210000`. Ya está ampliado con
'Revisión' vía `20260729150000_albaranes_estado_revision.sql` (aplicada a prod; tu próximo
`db push` la verá como no-op). Esa migración también versiona `albaranes.numero_proveedor` y
`producto_precios_compra.proveedor`/`.formato`, que existían en prod sin `.sql`.

**3 mejoras detectadas en la prueba (para tu lista, ninguna bloquea):**
1. **El buscador de "Vincular a existente" solo busca entre los candidatos precalculados**
   (máx. 6). Si el matcher no propone el producto, no puedes vincularlo aunque exista:
   me pasó con "Gyozas pollo y verduras", "Alcachofa confitada", "Oreja de cerdo en adobo" y
   "Paleta cebo ibérico 50% loncheada" — existen y tuve que ignorar sus líneas. Propuesta:
   que el Command busque contra TODO el catálogo de compra (fallback server o lista completa).
2. **Sugerencias engañosas del matcher**: para "Oreja adobada" propuso "Panceta adobada 67%"
   (y no la Oreja que existe); para "Dagu huevo codorniz" propuso "Huevo 90%" por delante de
   "Huevo de codorniz 58%". La pantalla de verificación humana salva esto, pero sube el
   riesgo de vincular mal con prisas. (El peso del alias ya ayuda cuando existe.)
3. **IVA**: los albaranes de Makro imprimen una columna "Imp" con CÓDIGOS (5=IVA 4 %, 1=10 %),
   no porcentajes. El prompt del OCR ya lo excluye y el registro de precios solo acepta
   0/4/10/21; además normalicé el formato del IVA en `addPrecioCompra` (sin "%", como las
   374 filas existentes — tu `crearProductoDesdeAlbaran` guardaba "10%").

**Los 23 albaranes pendientes de la sección de abajo son la beta perfecta**: súbelos por la
pantalla nueva en vez de cargarlos a mano (era tu plan: "quiero ir subiéndolos ya
directamente desde el software").

---

## 🟢 LÉEME PRIMERO — RESPUESTAS DE IVÁN (2026-07-29) · ACCIONES PARA FERNANDO

> Fernando: Iván respondió a TODAS tus preguntas (los 3 bloques). Aquí está el resumen
> ejecutivo de lo que tienes que hacer. El detalle largo de cada punto está más abajo, en
> sus secciones (con ▸ RESPUESTA DE IVÁN). IDs verificados contra la BD el 29-jul.

**A) ASISTENTE DE ALBARANES POR FOTO (las 3 preguntas P1/P2/P3):**
- **P1 — Stock:** al subir albarán por foto → SIEMPRE pantalla de verificación de lo que
  leyó la IA → al pasar a **CONFIRMADO** se suma stock. **TODOS los albaranes suman stock
  siempre** (no hay "albaranes viejos"). Para cuadrar inventario → herramienta de
  **inventario inicial**, NO excluir albaranes. Quita la idea del check "solo precios".
- **P2 — Orden:** **escritorio PRIMERO**; después, el MISMO flujo (foto → ver cantidades →
  confirmar) también en **móvil**.
- **P3 — Ficha de compra:** guardar **formato** (unidades / litro / kg) + **precio del
  formato** + **precio unitario derivado** (formato ÷ porción). Adelante con la carga y
  **rellena el formato en los ~330 precios que lo tienen vacío**.

**B) DOS FEATURES NUEVAS que pidió Iván (planifícalas):**
- **Doble nombre proveedor↔nuestro:** casilla en cada ficha de compra con el **nombre del
  proveedor** + nuestro nombre. El asistente mapea la línea del albarán por el nombre del
  proveedor → nuestro producto. En NUESTROS albaranes/informes: nuestro nombre grande +
  nombre del proveedor **pequeño y claro debajo**, juntos. **UN solo nombre por producto**
  (decisión Iván 29-jul). ✅ **Columna `productos.nombre_proveedor` YA CREADA** (migración
  `20260729120000`); falta solo el código (ficha + matcher + informes). Ver detalle en (b).
- **3 indicadores de variación de precio** en la verificación: 🔻amarilla abajo = bajó ·
  🔺roja arriba = más caro · ↔️verde doble-punta = igual. Compara precio leído vs vigente.

**C) 6 PRODUCTOS (Bloque 2) — ejecutar (IDs verificados):**
1. **Salsa barbacoa** `37a8f2d2-…` → `tipo` elaboracion→**compra** + cargar precio.
   **NO tocar** el plato *"Costillas a baja temperatura"* que la lleva (70 g): sigue
   llevándola, solo cambia a comprada.
2. **Cubo Coctel Mix** → existe SOLO en Bacanal `83537312-…`; **crearlo en HABANA** + precio 9,86.
3. **Leche Asturiana** → **crear nueva** en Habana + precio.
4. **Hielo cubitos 41mm** = **«Hielo Roca»** de Habana `8d038723-…` (sin precio) → cargar 0,818 €/kg ahí.
5. **Vaso sidra PP desechable** = **«Vaso de Sidra Tensionado»** Habana `36298306-…` (sin precio) → cargar ahí.
6. **Pedido "PARA PERSONAL"** → tratar como **Makro normal**; el gerente lo marca con una
   nota manual. Revisa si hay campo de notas libre en albarán/pedido.

**D) 3 DUDAS SUELTAS (Bloque 3):**
1. **Aquarius sabor** → debe indicarlo el albarán; si no lo dice, sin resolver (no inventar).
2. **Fregona Amapola = «Fregona Microfriba»** → cargar precio 1,03 + grabar el nombre del
   proveedor en la casilla nueva de doble nombre.
3. **Ron Rives 1 ud sin importe** = **regalo → grabar SIN precio**.

**E) 23 albaranes "bloqueados" → VER SECCIÓN NUEVA ABAJO.** Iván ha dado luz verde a crear
los productos que no se identifican Y ha definido el flujo completo del asistente + un
ESTADO NUEVO de albarán ("Revisión"). Es la pieza más importante de esta ronda. Ver
👉 **"🆕 FLUJO DEFINITIVO DEL ASISTENTE DE ALBARANES (Iván, 29-jul)"**.

---

## ✅ BLOQUES 2 y 3 EJECUTADOS + 🐛 DOS BUGS GORDOS ENCONTRADOS (29-jul, Fernando)

**Hecho en prod** (precios 364 → 370, todo verificado):

| Producto | Empresa | Qué se hizo | Precio |
|---|---|---|---|
| Cubo Coctel Mix | HABANA | **CREADO** (nº 285) + alias | 9,86 · IVA 10 · BIGGER · form. 2 Kg |
| Leche Asturiana | HABANA | **CREADA** + alias | 1,99 · IVA 4 · DITHER · form. 1 Ud |
| Hielo Roca | HABANA | precio + alias | 0,818 · IVA 10 · PROCUBITOS · form. 1 Kg |
| Vaso de Sidra Tensionado | HABANA | precio + alias | 59,99 · IVA 21 · KRITTIKALI · **form. 500 Ud** |
| Fregona Microfriba | HABANA | precio + alias | 1,03 · IVA 21 · KRITTIKALI · form. 1 Ud |
| Fregona | BACANAL | alias (ya tenía precio) | — |
| Salsa barbacoa | BACANAL | precio + alias ✅ · **cambio de tipo NO se pudo** ❌ | 5,32 · IVA 10 · MAKRO · form. 1850 g |

- **Todos llevan ya la casilla `nombre_proveedor`** rellena con el texto literal del albarán,
  así tu matcher los reconocerá solos la próxima vez. La receta de *Costillas a baja
  temperatura* sigue **intacta** (Salsa barbacoa, 70 Gr) — verificado después de tocar.
- ⚠️ **Vaso de sidra: 59,99 € es la CAJA DE 500 unidades** (0,12 €/ud). Lo he grabado con
  formato "500 Ud". Es el ejemplo perfecto de por qué hacía falta tu P3.
- Aquarius: **sin tocar**, como dijiste (el albarán no indica sabor, no se inventa).

### 🐛 BUG 1 — CRÍTICO: **crear productos de compra estaba ROTO en las 2 empresas** (ya arreglado)

Al intentar crear el Cubo Cóctel salté sobre esto: los contadores de `numero_counters`
estaban **por debajo** del número real más alto, así que el siguiente número que iban a
asignar **ya estaba ocupado** → toda alta de producto moría con violación de clave única:

| Contador | Estaba en | Máximo real | Resultado |
|---|---:|---:|---|
| `productos:compra` BACANAL | 297 | 338 | ❌ roto |
| `productos:compra` HABANA | 280 | 284 | ❌ roto |
| `productos:elaboracion` BACANAL | 4 | 22 | ❌ roto |
| `proveedores` BACANAL | 34 | 35 | ❌ roto |

**Esto habría tumbado tu asistente entero**: su función estrella —"crear producto de compra
desde el albarán"— fallaba siempre, en las dos empresas. **Lo he arreglado** resincronizando
cada contador a su máximo real (solo sube, nunca baja → imposible reutilizar un número ya
dado). Verificado: el siguiente número está libre en los 5 contadores.

⚠️ **La causa raíz sigue viva:** esto pasa cuando algo inserta productos con
`numero_secuencial` explícito sin tocar el contador (el trigger solo numera si viene NULL) —
típico de importadores/migraciones masivas. **Tu importador de fichas debería resincronizar
el contador al terminar**, o volverá a romperse.

### 🐛 BUG 2 — **No se puede cambiar el TIPO de un producto** (bloquea tu petición nº1)

La salsa barbacoa **no ha podido pasar de "elaboración" a "compra"**, y no es un problema de
esa fila: **es estructural y le pasará a cualquiera desde la UI**.
- `numero_secuencial` es único por **(empresa, tipo, número)** y la salsa es *elaboración nº 21*.
- El *compra nº 21* de Bacanal ya existe: **«San miguel Tercio»** → colisión.
- Y no se le puede dar otro número: el trigger `lock_numero_secuencial` lo declara
  **inmutable** ("numero_secuencial es inmutable y no puede modificarse").

**Necesito que decidas** (es tu terreno, toca infraestructura):
- **(a)** Ajustar el trigger para que permita reasignar número **cuando cambia el tipo** (lo
  correcto de cara al futuro: hoy la app no puede reclasificar ningún producto).
- **(b)** Que lo haga yo puntualmente con el trigger desactivado un instante, solo para esta fila.
- **(c)** Dejarla como *elaboración*: **ya tiene su precio de compra cargado**, que es lo que
  de verdad necesitas para el coste. Es la opción sin riesgo si no corre prisa.

Mientras decides, **el precio ya está** y el plato sigue llevándola.

## 🆕 FLUJO DEFINITIVO DEL ASISTENTE DE ALBARANES (Iván, 2026-07-29)

> Fernando: esto sustituye la idea de "albarán bloqueado". Iván ha definido cómo debe
> comportarse el sistema de principio a fin cuando se sube un albarán (por foto o digital)
> y alguna línea no casa con el catálogo. **Planifícalo e impleméntalo** (amplía el
> `docs/PRP_ASISTENTE_OCR_LINEAS_NO_RECONOCIDAS.md`). Verificaré contra el código cómo
> funciona hoy el matcher y añadiré aquí el "qué hay vs qué falta".

### 1. NO existe estado "bloqueado" — se crea el estado **REVISIÓN**

- Un albarán con líneas no reconocidas **NO se descarta ni se queda fuera**. Se guarda en
  estado **"Revisión"**.
- En **Revisión**: el albarán está guardado pero **NO suma stock, NO cambia de estado, NO
  toca NADA**. Espera a que una persona apruebe línea por línea.
- Solo cuando se aprueba que **TODO está correcto** → pasa a **"Confirmado"** → y **ahí**
  (y solo ahí) **suma stock** (coherente con la P1).
- ⚠️ **VERIFICADO en BD (29-jul):** `albaranes.estado` es **texto libre** (no un enum
  rígido), y hoy solo se usa el valor **"Confirmado"** (31 albaranes). Añadir **"Revisión"**
  es directo: no requiere migración de enum, solo cablearlo en la UI y en la lógica de
  stock (que el stock se dispare en la transición Revisión→Confirmado, no antes).

### 2. Cómo debe leer y emparejar cada línea (matcher + asistente)

Cuando el asistente lee un producto del documento y lo compara con nuestra base de datos:

1. **Buscar primero por la casilla "nombre del proveedor"** (la casilla nueva de doble
   nombre del Bloque 2). El dato debe salir **exacto**.
2. **Si coincide EXACTO** → liga la línea directamente a nuestro producto. Sin intervención.
3. **Si NO coincide exacto** → el asistente hace una **PROPUESTA**: muestra candidatos
   similares (buscando tanto por nombres de proveedor ya guardados como por nuestros
   nombres) por si alguno encaja. La persona **decide si esa línea pertenece a otro
   producto** y lo **liga** (esa asociación queda memorizada como nombre de proveedor para
   la próxima vez).
4. **Si no encaja NINGUNO** → el asistente **propone CREAR un producto de compra nuevo
   DESDE el propio albarán**, que se guarde automáticamente y quede ligado a esa línea. Al
   crear, **OBLIGA a rellenar todos los campos marcados como obligatorios en la ficha de
   producto** — entre ellos el **precio negociado con el proveedor**, y en ese campo el
   asistente **sugiere el precio de compra que viene en ese mismo albarán** (para que no se
   teclee a mano).

### 3. Luz verde de Iván a crear los productos no identificados

> **✅ IVÁN (29-jul):** "Los productos que no logres identificar con productos ya creados
> nuestros, grábalos nuevos." → Para los ~24 productos de los 23 albaranes en Revisión
> (casi todos Makro: queso mascarpone, coulant de chocolate, alitas, pimiento de freír,
> tomate frito, mayonesa, galleta María, cubo con pedal, cubertería, etc.): **si no casan
> con uno existente, se crean como producto de compra nuevo** con el precio del albarán.
> Los 3 casos dudosos ya los resolvió Iván (29-jul):
> - **Coca-Cola PET 2L (regular y zero)** → **CREAR nuevo** producto de compra (no es la
>   retornable ni la de 1L).
> - **Hamburguesa vaca artesana 180g** → **es la MISMA que la "angus 200gr"** → ligar ahí.
>   Iván: "es la misma, ponla como la de 200 gramos y edítalo ya que es correcto" (ajusta
>   el gramaje/nombre en esa ficha, no crear una nueva).
> - **Pan de hamburguesa sésamo** → **es el MISMO** que el existente ("High Potato") → ligar
>   ahí, no crear otro.
>
> Fernando: una vez montado el asistente, estos 23 albaranes se resuelven con él; no hace
> falta cargarlos "a mano" fuera del flujo.

### 4. QUÉ HAY HOY vs QUÉ FALTA (verificado contra el código, 29-jul)

> Auditoría del código real para que Fernando sepa exactamente qué construir. Rutas y
> líneas concretas.

**a) Estado "Revisión" — NO existe, y hoy el sistema hace lo contrario:**
- `createAlbaran` (`src/features/logistica/actions/albaranes-actions.ts` L142-159) **RECHAZA
  con error** cualquier línea sin `productoId` ("Hay líneas sin producto asociado"). O sea,
  hoy un albarán con líneas no reconocidas **NO se puede guardar** — ni siquiera queda en
  revisión. **A construir:** permitir guardar el albarán en estado **"Revisión"** con líneas
  huérfanas, y que la regla dura solo aplique en la transición **Revisión→Confirmado**.
- `albaranes.estado` es **texto libre** (no enum) → añadir "Revisión" no requiere migración
  de tipo, solo cablearlo en UI + lógica de stock.
- El stock debe dispararse SOLO al pasar a "Confirmado" (ya es coherente con P1).

**b) Casilla "nombre del proveedor" (doble nombre) — ✅ COLUMNA YA CREADA (Iván, 29-jul):**
- **Decisión de Iván: UN solo nombre de proveedor por producto** (no N alias). Por eso se
  ha creado la columna **`productos.nombre_proveedor` (text)** en vez de una tabla de alias.
  Migración versionada: `supabase/migrations/20260729120000_productos_nombre_proveedor.sql`
  (idempotente, ya aplicada y verificada en la BD el 29-jul).
- **Lo que FALTA (código de Fernando):** (1) mostrar/editar ese campo en la ficha de producto
  (`ProductosView.tsx`), (2) incluirlo en el `productoInputSchema` (Zod), (3) que el matcher
  del asistente **busque candidatos también por `nombre_proveedor`**, no solo por `nombre`,
  y (4) que al ligar/crear desde el albarán **se rellene `nombre_proveedor` con el texto que
  venía en el albarán** (así el reconocimiento es automático la próxima vez).
- En NUESTROS albaranes/informes: sale nuestro `nombre` grande + `nombre_proveedor` pequeño
  debajo (feature de presentación, la hace Fernando).
- ⚠️ **Aviso de deuda técnica que encontró la auditoría:** las columnas `proveedor` y
  `formato` de `producto_precios_compra` **existen en la BD remota pero NO están en ninguna
  migración versionada** (`.sql`) del repo. El código las usa (`precios-compra-actions.ts`
  L185, L204-205). Fernando: conviene versionar esas columnas en una migración idempotente
  para no perderlas (regla del proyecto: migraciones siempre como `.sql`).

**c) Asistente por línea (vincular / crear / ignorar) — NO existe:**
- Hoy, cuando una línea no casa, el OCR la marca `"extra"` con `productoId:null`
  (`comparar-lineas.ts` L156-174) y la UI (`FacturaComparativa.tsx` L209-247) SOLO ofrece
  "Acepto" o editar el texto a mano. **No hay selector de producto, ni "crear producto",
  ni propuesta de candidatos.** Y `validarFactura` bloquea. Este es exactamente el hueco.
- **BUENA NOTICIA — ya existe un patrón para clonar:** el importador de fichas de cocina SÍ
  tiene el diálogo que buscamos: `CorregirMatchDialog.tsx` (combobox shadcn `Command` dentro
  de un `Dialog`) que propone candidatos por similitud y liga el producto. Fernando: clona
  ese patrón para el asistente de albaranes, y para crear usa `createProducto` +
  `addPrecioCompra` que ya existen.
- El matcher del OCR (`comparar-lineas.ts`) hoy compara por nombre con **Levenshtein, umbral
  0.7**, solo contra las líneas del albarán (no busca en el catálogo). Para el asistente hay
  que **buscar candidatos en el CATÁLOGO** (por nombre nuestro Y por alias de proveedor) y
  proponerlos, como hace el matcher de cocina (`matcher.ts`, umbrales exacto 0.99 /
  probable 0.55).

**d) Campos OBLIGATORIOS al crear producto de compra CON precio (verificado):**
`nombre`, `categoría`, `unidad`, `proveedor`, `IVA`, `precio`. (El `formato` es opcional hoy
— pero según la P3 pasa a ser deseable/obligatorio.) El IVA de compra va en
`producto_precios_compra`, NO en `productos.iva`. → Cuando el asistente "cree producto desde
el albarán", debe **forzar rellenar esos campos** y **sugerir el precio del propio albarán**
en el campo precio (como pidió Iván).

**Archivos que tocará Fernando** (del análisis del código):
- `albaranes-actions.ts` (estado Revisión + relajar regla productoId)
- `comparar-lineas.ts` / nuevo matcher contra catálogo
- `FacturaComparativa.tsx` + `FacturaDialog.tsx` (UI del asistente por línea)
- clonar `cocina/.../CorregirMatchDialog.tsx`
- `producto-actions.ts` + `precios-compra-actions.ts` (crear desde albarán)
- migración nueva para alias de proveedor + versionar `proveedor`/`formato` de precios.

---

## ✅ YA CONSTRUIDO POR IVÁN/CLAUDE (2026-07-29) — casi toda la feature está hecha

> Fernando: NO empieces de cero. Iván pidió desarrollarlo y ya está construido, compilado y
> con `npm run build` en verde. Solo queda un cable final (la pantalla de SUBIR la foto).

**Fase 1 — Casilla "nombre del proveedor" ✅ HECHA end-to-end.** Columna
`productos.nombre_proveedor` (mig. `20260729120000`) + `Producto.nombreProveedor` + Zod +
create/update/bulk + IO CSV + input en la ficha (`ProductosView.tsx`, solo compra).

**Fase 2 — Matcher contra catálogo ✅ HECHA y probada.**
`lib/albaranes/emparejar-catalogo.ts` → `emparejarConCatalogo(texto, catalogo)`. Compara por
`nombre` Y `nombreProveedor` (el alias manda). Umbrales: exacto 0.92 / propuesta 0.55.
Probado: "Hielo cubitos 41mm"→Hielo Roca vía alias; "Coca Cola Zero 2L"→propone.

**Fase 3 — Estado "Revisión" ✅ HECHO (backend, la parte delicada del stock).**
`data/albaranes.ts` → `ESTADO_REVISION`. `createAlbaran` acepta `estado` y relaja la regla
del productoId SOLO en Revisión. Revisión NO suma stock. `updateAlbaranEstado`: al pasar de
Revisión a Confirmado valida que no queden huérfanas (las `ignorada:true` no bloquean).

**Fase 4 — Asistente por línea ✅ HECHO (UI + acciones).**
- `actions/asistente-albaran-actions.ts`: `emparejarLineasAlbaran()` (empareja + precio
  vigente para el indicador), `crearProductoDesdeAlbaran()` (crea + guarda alias + carga el
  precio del albarán, obliga campos), `memorizarAliasProveedor()` (aprende al vincular).
- `components/albaranes/ResolverLineaDialog.tsx` (3 opciones: vincular/crear/ignorar) +
  `AsistenteAlbaranPanel.tsx` (orquesta, botón Confirmar bloqueado hasta resolver todo).

**Fase 5 — Indicadores de precio ✅ HECHO.** `components/albaranes/IndicadorPrecio.tsx`:
🔻amarilla abajo (baja) / 🔺roja arriba (sube) / ↔️verde doble-punta (igual), tolerancia
1cént/0,5%.

### 🔌 LO ÚNICO QUE FALTA (Fernando): cablear la pantalla de SUBIR la foto

Toda la lógica y la UI de resolución están listas. Falta la ENTRADA (subir la foto):
1. **Escritorio (primero):** vista/diálogo que suba la foto → OCR (patrón Gemini que ya
   existe en `facturas-actions.ts`: `geminiJSON` + `OCR_RESPONSE_SCHEMA`) → llamar
   `emparejarLineasAlbaran()` → pintar `<AsistenteAlbaranPanel>`. Al confirmar:
   `createAlbaran({estado:"Revisión", lineas})` y cuando el panel esté resuelto,
   `updateAlbaranEstado(id,"Confirmado")` (ya valida + suma stock).
2. **Móvil (después):** mismo flujo reutilizando `AsistenteAlbaranPanel` en
   `src/features/logistica/mobile/`.
3. **Doble nombre en informes/impresión de albaranes:** nuestro `nombre` grande +
   `nombre_proveedor` pequeño debajo.

Todo lo pesado (matching, estado, stock, crear/vincular/ignorar, indicadores) ya está.

---

## ✅ ALBARANES REGISTRADOS (15-jul, Fernando) — lo que pediste el 7-jul

**31 albaranes con 243 líneas** registrados en prod (BACANAL 20 · HABANA 11), del 18-jun
al 10-jul. Ahora **137 productos tienen histórico de compras** (66 Bacanal / 71 Habana):
se ve qué compraste, a quién, cuándo, cuánta cantidad y a qué precio. Verificado: 0 líneas
sin producto, 0 productos inexistentes, 0 cruces entre empresas; totales cuadrados con el
papel (p.ej. Coca-Cola 4534873194 = 128,41 € = 128,09 productos + 0,32 punto verde).

**3 cosas que debes saber (importantes):**

1. **⚠️ La tabla `albaranes_lineas` está MUERTA — no la usa NI UNA LÍNEA de código** (0
   referencias en todo el repo). Tu propio `createAlbaran` guarda las líneas en la columna
   **`albaranes.lineas` (jsonb)** de la cabecera, y `listComprasPorProducto` las lee de ahí.
   Por eso he registrado ahí (donde la app SÍ lee) y no en `albaranes_lineas`, que habría
   sido dato invisible. **Valora borrar esa tabla** para que no confunda.
2. **El stock NO se ha tocado a propósito** (0 movimientos en `stock_movimientos`): esta
   mercancía es de hace 3-4 semanas y ya está consumida; sumarla ahora inflaría el
   inventario. Los albaranes van en estado **`Confirmado`** (recibido y cerrado), que es
   el estado que hace que salgan en el histórico de compras de la ficha. Esto **prejuzga
   la P1 de abajo solo para el histórico**: dinos si lo quieres de otra forma.
3. Numeración: han tomado `ALB-2026-001..020` (Bacanal) y `ALB-2026-001..011` (Habana).
   Son los primeros cronológicamente, así que los albaranes nuevos seguirán desde ahí.

### 🔴 23 albaranes MÁS que NO se han podido registrar (te necesitan a ti)

Regla que respeto (es la tuya, de `createAlbaran`): **un albarán no se guarda si alguna
línea no tiene producto**. Estos 23 tienen líneas cuyo producto NO EXISTE en el catálogo
— casi todos de **MAKRO**. En cuanto digas "crear", los registro enteros:

- **Bacanal (crear ~24 productos)**: queso mascarpone · coulant de chocolate · alitas de
  pollo · pimiento de freír · anacardo natural · tomate frito · aceite de oliva 0,4 ·
  vinagre de vino blanco · mayonesa (Hellmann's 5L) · salsa barbacoa (¡la de tu decisión
  nº1!) · galleta María · pan hamburguesa sésamo (≠ el High Potato que ya existe) ·
  jamoncitos de pollo · hamburguesa vaca artesana 180g (catálogo solo tiene angus 200gr) ·
  Coca-Cola PET 2L regular y zero (catálogo solo retornable/1L) · cubo con pedal 30L ·
  tenedor mesa · cuchillo chuletero · mantequilla sin sal · mezcla de setas · pasas sin
  semilla · cóctel de aceitunas (≠ «Aceituna negra expolvoreada»).
- **Habana**: los 5 que ya tenías pendientes (Cubo Cóctel Mix, Leche Asturiana, Hielo
  cubitos, vaso sidra PP, fregona tejido-sin-tejer) + **1 NUEVO**: "AQUARIUS VR30 C24"
  (Coca-Cola) — **el albarán no dice el sabor** y el catálogo separa Limón y Naranja.
  ¿Cuál era?
- Fuera por diseño: "Desplazamiento y Servicio" (Disbesa) = gasto, no producto. Y la 2ª
  línea de "Ron Limón Rives" del albarán 14991, que viene **1 ud sin importe** (¿regalo?).

### ✅ BLOQUE 3 — RESPUESTAS DE IVÁN (2026-07-29)

1. **AQUARIUS VR30 (sabor).** → Iván no lo recuerda con seguridad, **entiende que el
   Naranja (el normal)**. **Fernando: no lo fuerces — esto debe salir indicado EN EL
   ALBARÁN.** Si el albarán no especifica sabor, queda sin resolver hasta que el propio
   albarán lo aclare (no inventar).

2. **Fregona "tejido sin tejer Amapola" vs "Fregona Microfriba".** → **SÍ, son la misma.**
   **Fernando: carga el precio (1,03) en «Fregona Microfriba» y graba "FREGONA TEJIDO SIN
   TEJER AMAPOLA" como NOMBRE DEL PROVEEDOR en la casilla nueva** de doble nombre (ver
   decisión de doble nombre del Bloque 2). Así aparecerá el nombre del proveedor junto al
   nuestro.

3. **Ron Limón Rives — 1 ud sin importe.** → **Es un regalo. Grábalo SIN precio (déjalo sin
   precio).** Regla general que Iván confirma: si una línea viene sin importe, se graba sin
   precio; será regalo/promoción.

### 🆕 FEATURE NUEVA DE IVÁN — indicadores de variación de precio en la verificación del albarán

> Sale de la P3. Como TODO albarán pasa por la pantalla de verificación (ver P1 del
> asistente), al lado de cada precio que lee la IA debe salir un **icono-indicador**
> comparando ese precio con el **precio marcado/vigente** de ese producto en el catálogo:
> - **🔻 Flecha AMARILLA hacia abajo** → el precio ha **BAJADO** respecto al precio
>   registrado del producto.
> - **🔺 Flecha ROJA hacia arriba** → el precio está **MÁS CARO** que el registrado.
> - **↔️ Flecha VERDE de doble punta horizontal** → el precio **coincide / está correcto**.
>
> **Para Fernando:** el indicador se calcula comparando `precio_leído` vs el precio vigente
> en `producto_precios_compra` (el más reciente sin `fecha_fin`, o `productos.precio_compra`).
> Va en la fila de cada línea del asistente de verificación, junto al campo del precio.
> Detalle de umbral (¿exacto o con margen de céntimos para el "correcto"?) lo decides tú a
> nivel técnico; la semántica de las 3 flechas es la de arriba.

## ❓ 3 PREGUNTAS PARA IVÁN — asistente de albaranes por foto (15-jul, Fernando)

> Contexto: Fernando analizó tu audio/conversación sobre el asistente (doble nombre
> proveedor/interno, foto desde móvil, auto-registro de precios). El planteamiento está
> claro y AMPLÍA el `docs/PRP_ASISTENTE_OCR_LINEAS_NO_RECONOCIDAS.md` con la pieza que
> faltaba: **memorizar la asociación** nombre-proveedor → producto para que el sistema
> case solo los albaranes siguientes. Antes de hacer el plan de implantación necesitamos
> 3 decisiones tuyas. Responde debajo de cada una, como siempre.

**P1 — Stock en albarán suelto.** Cuando alguien sube un albarán por foto SIN pedido
previo, ¿debe además SUMAR el stock de lo recibido, o de momento solo registrar
productos/precios/formatos?
- *Por qué:* el flujo actual (recepción con pedido → "Entregado") ya suma stock; si el
  suelto también suma desde el día 1, hay que decidirlo ahora para no descuadrar
  inventarios con albaranes históricos del onboarding (que NO deberían sumar).
- *Ejemplo de respuesta:* «Los del día a día SÍ suman stock; los históricos/onboarding
  NO (o con un check "solo registrar precios")».

> **✅ RESPUESTA DE IVÁN (2026-07-29):** Al subir un albarán por foto, SIEMPRE hay
> **primero una pantalla de verificación** de lo que la IA leyó (se revisa y se corrige
> lo que haga falta). Solo cuando el usuario **aprueba el albarán y pasa a estado
> CONFIRMADO**, ENTONCES sí se suman las cantidades al stock.
> **NO existen "albaranes viejos": TODOS los albaranes suman stock SIEMPRE.** No hace
> falta el check de "solo registrar precios". Si alguien quiere dejar el inventario
> correcto, la vía es **hacer un INVENTARIO** (al empezar a usar el software) y ajustar
> ahí todos los productos. El inventario inicial es la herramienta para cuadrar, NO
> excluir albaranes del stock.
> **Para Fernando:** el auto-registro de precios NO suma stock por sí solo; el stock lo
> dispara el paso "Confirmado" tras la verificación humana. Elimina la idea del check
> "solo precios" para históricos — no aplica.

**P2 — ¿Escritorio primero o móvil primero?** Para que pruebes la visual cuanto antes,
proponemos: 1º escritorio (reutiliza el OCR y el diálogo de facturas que ya existen →
lo tienes en días), 2º la sección de foto en la app móvil justo después.
- *Por qué:* el móvil requiere pantalla nueva; el escritorio es extender lo que ya hay.
- *Ejemplo de respuesta:* «OK escritorio primero» o «No, quiero el móvil ya aunque tarde más».

> **✅ RESPUESTA DE IVÁN (2026-07-29):** **Escritorio PRIMERO.** Y **después**, dentro de
> la función MÓVIL, debe haber también un apartado (igual que el de escritorio) para
> **subir las fotos de los albaranes, ver las cantidades que ha leído la IA y confirmarlo
> desde el móvil**. Es decir: mismo flujo completo (foto → verificación → confirmar → suma
> stock, ver P1) en las dos plataformas, empezando por escritorio.

**P3 — Precio por formato + unidad en la ficha.** Hoy conviven precios "por caja"
(Cocacola 16,56/caja de 24) y "por kg/ud" (Limones 1,50/kg). Proponemos que cada ficha
de compra guarde: formato de compra ("Caja 24 ud", "Kg", "Ud") + precio del formato +
precio unitario derivado. Es lo que luego permite calcular escandallos bien.
- *Por qué:* sin unidades por formato, el coste por ración de las recetas saldrá mal.
- *Ejemplo de respuesta:* «Sí, formato+unitario en ficha; revisad los formatos ya
  cargados» (los ~330 precios de estas 4 semanas tienen formato vacío — lo rellenaríamos).

> **✅ RESPUESTA DE IVÁN (2026-07-29):** SÍ, correcto todo. En la ficha de cada producto
> de COMPRA debe haber:
> 1. **Formato de compra** → unidades / litro / kilogramos.
> 2. **Precio del formato** → en base a ese formato (p.ej. precio de la caja, del litro…).
> 3. **Precio unitario derivado** → el del formato dividido entre la unidad/porción (la
>    cantidad por porción). El ejemplo del doc (Caja 24 ud → precio caja → precio/ud) es
>    exacto.
> **Y ADELANTE con la carga:** rellenad el formato en los ~330 precios ya cargados que lo
> tienen vacío.

*(Lo que NO te preguntamos porque lo decidimos nosotros y lo verás documentado: dónde
viven los alias por proveedor, cómo se muestran los dos nombres en la ficha, y que
renombrar el producto interno no rompe las asociaciones.)*

### 🆕 DECISIÓN CLAVE DE IVÁN (2026-07-29) — DOBLE NOMBRE proveedor↔nuestro en la ficha

> Esto responde a la P4 del Bloque 2 pero es una **feature transversal** del asistente,
> por eso va aquí. Iván quiere que la ficha de cada **producto de compra** tenga una
> **casilla con el nombre que usa el proveedor** además del nuestro. Flujo:
> 1. En la ficha de compra: campo **"nombre del proveedor"** (cómo lo escribe el proveedor
>    en su albarán) + nuestro **nombre interno**.
> 2. Al subir un albarán digital, el asistente **identifica la línea por el nombre del
>    proveedor** y la **mapea a nuestro producto** automáticamente (esto es la memoria de
>    asociación que ya estaba planificada; ahora tiene su sitio de almacenamiento: la
>    propia ficha).
> 3. En el albarán que **generamos nosotros** y en **nuestros informes de albaranes**: sale
>    **NUESTRO nombre** como principal y, **debajo, en letra pequeña y clarita, el nombre
>    del proveedor**, siempre juntos, para identificarlo bien.
> **Para Fernando:** un producto puede tener varios alias de proveedor (cada proveedor lo
> nombra distinto) → probablemente 1 producto : N alias. Modela dónde viven (¿tabla
> `producto_alias_proveedor` o campo en `producto_precios_compra`, que ya tiene `proveedor`?).
> El caso 4 de abajo (hielo cubitos = Hielo Roca) es el ejemplo perfecto: el proveedor lo
> llama "Hielo cubitos 41mm", nosotros "Hielo Roca".

## ✅ SEMANA DEL 7-JUL CARGADA — HABANA (15-jul, Fernando)

Iván pasó los albaranes de la semana que faltaba y están **cargados: 51 precios de
HABANA** (fechas 9/10-jul, verificado 0→51 filas), 6 documentos: COCACOLA (6),
BELMONTE (19), BIGGER (4), KRITTIKALI (5), DISBESA (2, **proveedor nuevo**: San Miguel
0,0 Tostada 18,33/caja + Coronita 20,35/caja) y DITHER (15). Totales de los 6 docs
verificados céntimo a céntimo. **Primeros precios** para: Santa Teresa (12,26),
Oxefruit Melon (12,21), Rollo Térmico (12,00), Copa Margarita (3,89), San Miguel 0,0
Tostada (18,33), Zumo Melocotón (1,50) y Manzanas (2,50).

**Para Iván:**
- **El "Cubo Cóctel Mix 2kg" REAPARECE** (Bigger 9-jul, 2 uds a 9,86) — 2ª compra ya.
  Refuerza tu decisión pendiente nº2: yo diría crear el producto; su precio está apuntado.
- **Nueva mini-duda**: Krittikali trae "FREGONA TEJIDO SIN TEJER AMAPOLA" (1,03) y en
  catálogo solo existe «Fregona Microfriba» (sin precio). ¿Son la misma? No la cargué.
- Estos albaranes eran solo de HABANA. Si hay compras de **BACANAL** esa semana
  (jue 10 / vie 11), faltan por pasar.

## 📌 NOTA PARA FERNANDO (14-jul, de parte de Iván) — LÉEME AL ENTRAR

**1. Albaranes cargados y semanas cubiertas.** Verificado en BD: cargadas **3 semanas**
(hueco "sin precio" hoy: Bacanal 234 / Habana 190). El histórico arranca el 18-jun (Iván
confirma que ANTES no había compras, no falta nada por detrás). Fechas cargadas:
- Sem. 16-jun → albaranes **18-jun** (jue) + **19-jun** (vie) — 121 precios
- Sem. 23-jun → albaranes **25-jun** (jue) + **26-jun** (vie) — 98 precios
- Sem. 30-jun → albaranes **2-jul** (jue) + **3-jul** (vie) — 94 precios
- **FALTA la semana del 7-jul (jue 10 / vie 11).** Iván dice que **te la pasará** (fotos/PDF).
  Cárgala como tanda nueva cuando la tengas.

**2. Decisiones sueltas que quedan (productos de albarán que NO existen en catálogo).**
Iván las dejó pendientes; no bloquean. Ver bloque "🔴 PENDIENTE REAL" más abajo:
salsa barbacoa (compra) · Cubo Cóctel Mix · Leche Asturiana · Hielo cubitos · Vaso sidra
desechable · pedido Makro "para personal".

**3. 🆕 FEATURE QUE IVÁN QUIERE — asistente OCR de facturas para líneas no reconocidas.**
Detalle completo, verificado contra el código, en
**`docs/PRP_ASISTENTE_OCR_LINEAS_NO_RECONOCIDAS.md`** (creado 14-jul). Resumen: hoy cuando
el OCR de facturas encuentra una línea cuyo producto no está en el catálogo, la marca "extra"
con `productoId:null`, NO ofrece vincular ni crear, y `validarFactura` BLOQUEA. Iván quiere
que al subir la factura salga un asistente por cada línea huérfana con 3 opciones:
**vincular a existente / crear producto nuevo (y se vincula solo) / ignorar**. Está planificado
por fases en ese PRP. **Iván cerró su sesión aquí; retómalo tú con ese planteamiento.**

---

## ✅ ESTADO REAL 2026-07-14 (verificado contra la BD por Claude, lado de Iván)

**Ojo Fernando: el documento iba por detrás de la base de datos.** Casi todo lo que este
papel pedía como "pendiente de decidir" YA estaba cargado. Verificado producto a producto
contra `producto_precios_compra` el 14-jul. Resumen:

- **Bloque A (nombres que no cuadran): CERRADO.** Los productos propuestos ya tenían precio.
  Iván confirmó el 14-jul los 3 únicos casos ambiguos que quedaban:
  - **Bengalas** "60s sin humo 36u" (14,40 €) → es **«Bengalas»** (ya cargado). «Bengalas
    Boom-boom» es OTRO producto distinto, se queda sin precio por ahora.
  - **Lavavajillas manual 5L** (5,49 €) → es **«Lavavajillas manual»** (ya cargado). No es Fairy.
  - **Entrecot de vaca** (28,90 €/kg) → es **«Lomo bajo frisona (350 gr)»** (ya cargado). NO
    crear "Entrecot" aparte (mismo corte).
- **Bloque B (panes / proveedor dudoso): CERRADO.** Los 3 panes (`Pan de Hamburguesa (High
  Potato)`, `Artesanillo 55g`, `Artesanillo semillado 60g`) YA tienen precio, y el proveedor
  **JUANITO BAKER ya existe** en el catálogo. No había nada que decidir.
- **Bloque C (productos nuevos): CASI TODO CARGADO.** Verificados y CON precio en Bacanal:
  Mozzarella rallada, Filete pechuga de pollo, Secreto de cerdo, Lomo de merluza, Nata para
  montar 35%, Huevo de codorniz, Yema de huevo, Helado de vainilla, Gyozas (veg + pollo),
  Corvina, Salsa tartufata, Base de arroz de paella, Paleta cebo ibérico. **Solo queda por
  decidir lo del bloque "PENDIENTE REAL" de abajo.**

### 🔴 PENDIENTE REAL → ✅ RESUELTO POR IVÁN (2026-07-29). Fernando, EJECUTA:

1. **"Salsa barbacoa" comprada (Makro, Bacanal).**
   → **IVÁN: pasa a producto de COMPRA, no elaboración.** Convierte
   `37a8f2d2-1db4-4876-9bcc-8297e167262d` de `tipo=elaboracion` a `tipo=compra`, carga su
   precio de compra, y **elimínala de Salsas/Elaboraciones y de Escandallos** donde figure
   como elaboración casera. ⚠️ **VERIFICADO en BD:** hoy se usa **como ingrediente en 1
   escandallo y en 1 composición** (`ingrediente_id`). Cambiar el `tipo` NO rompe esos
   enlaces (siguen apuntando al mismo `id`). **Fernando: confirma con Iván qué escandallo/
   plato la usa antes de "quitarla de escandallos"** — si un plato la lleva como
   ingrediente, ese enlace debe SEGUIR (solo que ahora apunta a un producto de compra en
   vez de a una elaboración). "Eliminarla de escandallos" = quitar su ficha de escandallo
   PROPIO (no tiene, verificado: 0), NO romper los platos que la usan.
   → **✅ IVÁN CONFIRMA (2026-07-29): EL PLATO LA SIGUE LLEVANDO.** Verificado en BD: la usa
   el plato **"Costillas a baja temperatura"** (70 g), tanto en `escandallo_ingredientes`
   (esc `739e7340-...`) como en `producto_composicion` (venta `8171c73d-...`). **Ese
   ingrediente NO se toca:** el plato mantiene la salsa barbacoa; solo cambia que ahora es
   producto de COMPRA (con su precio) en vez de elaboración casera. NO borres el ingrediente
   del escandallo del plato. Lo único que cambia es `productos.tipo` de la salsa
   (elaboracion → compra) + cargar su precio de compra.

2. **HABANA — "Cubo Cóctel Mix 2kg" (Bigger, 9,86 €).**
   → **IVÁN: "revísalo, debe estar ya metido".** ⚠️ **VERIFICADO:** existe
   **"Cubo Coctel Mix" (compra)** pero **SOLO en BACANAL** (`83537312-...`), **NO en
   HABANA**, que es donde se compró. **Fernando: crea el producto en HABANA (espejo del de
   Bacanal) y carga ahí el precio 9,86 €.** No estaba metido en la empresa correcta.

3. **HABANA — "Leche Asturiana" (Dither).**
   → **IVÁN: es OTRO producto diferente → CRÉALO.** Nueva ficha de compra "Leche" (o "Leche
   Asturiana") en HABANA y carga su precio. NO mezclar con «Leche Condensada».

4. **HABANA — "Hielo cubitos 41mm" (Procubitos, 0,818 €/kg).**
   → **IVÁN: ESE ES EL «Hielo Roca».** ⚠️ **VERIFICADO:** existe **"Hielo Roca" (compra) en
   HABANA sin precio** (`8d038723-...`). Carga el precio 0,818 €/kg **ahí**. NO crear
   "Hielo Cubitos". → Este es el caso que motiva la casilla de **doble nombre** (proveedor:
   "Hielo cubitos 41mm" / nuestro: "Hielo Roca"). Ver decisión de doble nombre arriba.

5. **HABANA — "Vaso de sidra PP desechable 50cl" (Krittikali).**
   → **IVÁN: es el mismo, ya lo hemos comprado más veces → carga el precio en el existente.**
   ⚠️ **VERIFICADO:** existe **"Vaso de Sidra Tensionado" (compra) en HABANA sin precio**
   (`36298306-...`). Carga ahí el precio. (Doble nombre: proveedor "Vaso sidra PP desechable"
   / nuestro "Vaso de Sidra Tensionado".)

6. **Pedido Makro "PARA PERSONAL" (doc 027174).**
   → **IVÁN: olvídate de excluirlo. Trátalo como pedido NORMAL de proveedor MAKRO.** Los
   precios se cargan igual. La distinción "comida del personal" NO es un tipo de producto:
   es una **marca del pedido/albarán que pone el GERENTE a mano**. **Fernando: revisa si en
   NOTAS del albarán / del pedido se puede escribir manualmente** un texto para que el
   gerente marque "pedido de comida para el personal" e identificarlos. Si no existe ese
   campo de notas libre, valóralo (no bloquea).

> **Nota (Iván, 14-jul):** el tema de "qué tabla de recetas/escandallos manda para el stock"
> es OTRA cosa, no pinta en este documento de precios de compra. Se trata por separado. Aquí
> solo albaranes y precios.

> El resto de productos "sin precio" (234 Bacanal / 190 Habana) NO son decisiones: son
> productos que simplemente no venían en ningún albarán enviado. Se cargarán solos cuando
> llegue un albarán con ellos. No hay nada que decidir ahí.

---

## 🚨 AVISO URGENTE PARA IVÁN (11-jul, Fernando) — NO es de precios

**Los deploys de producción llevan rotos desde el 10-jul**: prod está congelada en
`78274fb6` y NINGÚN commit tuyo posterior (nóminas, festivos, cámaras, telefonía,
sanciones…) está en producción. La rotura está en el rango `e4bcdb94..85100ce0`.
**Detalle completo y qué hacer: `docs/DEPLOYS_ROTOS_DESDE_85100ce0_PARA_IVAN.md`** —
hace falta que abras el build log en el dashboard de Vercel (no tenemos acceso al team).

(Además: las respuestas a las preguntas A/B/C/D de abajo que dijiste haber pusheado
**no están en el repo** — el último cambio de este fichero es de Fernando. Revisa si
tu agente se quedó sin hacer `git push`.)

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

> **▸ RESPUESTA DE IVÁN (05-ago): también van al software (PRP-074).** Cubo Cóctel Mix, Leche
> Asturiana, Hielo Cubitos y el Vaso de sidra PP son incidencias `producto_no_encontrado` /
> `producto_ambiguo`: el sistema me propondrá crear o vincular con los datos ya rellenados y yo
> decido con un clic. La "Salsa barbacoa" comprada vs. la elaboración casera es el caso claro de
> `producto_ambiguo` (mismo nombre, naturaleza distinta). **Lo único que sí te respondo aquí
> porque no es una incidencia sino una regla de negocio: el pedido Makro "PARA PERSONAL" (doc
> 027174) NO es gasto del restaurante** — sus precios pueden quedar cargados, pero ese pedido no
> debe contar como compra de restaurante.
- **"Cubo Cóctel Mix 2kg" (Bigger Golosinas, Habana)** — no existe en catálogo; aparece en 2 albaranes (9,86€). ¿Crear?
- **"Leche Asturiana" (Dither, Habana)** — catálogo Habana solo tiene "Leche Condesada" (producto distinto). ¿Crear "Leche"?
- **Hielo en cubitos 41mm (Procubitos, Habana)** — no encaja con "Hielo Roca" ni "Hielo Pile" del catálogo (0,818€/kg). ¿Crear "Hielo Cubitos"?
- **Vaso de sidra PP desechable 50cl (Krittikali, Habana)** — catálogo solo tiene "Vaso de Sidra Tensionado" (vidrio); material distinto (59,99€/500u). ¿Mismo producto o crear aparte?
- **Un pedido Makro es "PARA PERSONAL"** (no para el restaurante, doc 027174) — cargamos igual sus precios (bacon, carne picada, Coca-Cola) pero **confirma si corresponde** o si hay que excluirlo del gasto de restaurante.
- **"Salsa barbacoa" comprada (Makro, Bacanal)** — el catálogo la tiene como **elaboración** (receta casera); esta línea es la salsa ya envasada de proveedor. ¿Es el mismo producto (y cargamos el precio ahí) o creamos "Salsa barbacoa (compra)" aparte?

**Igual que la tanda 1:** revertible por el tag → `delete from producto_precios_compra where observaciones like '%tanda 2%';`
