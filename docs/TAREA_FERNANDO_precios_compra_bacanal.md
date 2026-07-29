# TAREA para Fernando — Precios de compra de BACANAL (cuando bajes el repo)

> **De:** Iván (vía Claude) · **Fecha:** 2026-06-30 · **Actualizado:** 2026-07-29 · **Prioridad:** media
> Léelo al hacer `git pull` y reconciliar.

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
- **"Cubo Cóctel Mix 2kg" (Bigger Golosinas, Habana)** — no existe en catálogo; aparece en 2 albaranes (9,86€). ¿Crear?
- **"Leche Asturiana" (Dither, Habana)** — catálogo Habana solo tiene "Leche Condesada" (producto distinto). ¿Crear "Leche"?
- **Hielo en cubitos 41mm (Procubitos, Habana)** — no encaja con "Hielo Roca" ni "Hielo Pile" del catálogo (0,818€/kg). ¿Crear "Hielo Cubitos"?
- **Vaso de sidra PP desechable 50cl (Krittikali, Habana)** — catálogo solo tiene "Vaso de Sidra Tensionado" (vidrio); material distinto (59,99€/500u). ¿Mismo producto o crear aparte?
- **Un pedido Makro es "PARA PERSONAL"** (no para el restaurante, doc 027174) — cargamos igual sus precios (bacon, carne picada, Coca-Cola) pero **confirma si corresponde** o si hay que excluirlo del gasto de restaurante.
- **"Salsa barbacoa" comprada (Makro, Bacanal)** — el catálogo la tiene como **elaboración** (receta casera); esta línea es la salsa ya envasada de proveedor. ¿Es el mismo producto (y cargamos el precio ahí) o creamos "Salsa barbacoa (compra)" aparte?

**Igual que la tanda 1:** revertible por el tag → `delete from producto_precios_compra where observaciones like '%tanda 2%';`
