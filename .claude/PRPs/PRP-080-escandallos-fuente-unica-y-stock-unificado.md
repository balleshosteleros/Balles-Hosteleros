# PRP-080 — Escandallos como fuente única y Stock unificado

> **Estado:** propuesta, pendiente de aprobación
> **Fecha:** 2026-08-27
> **Origen:** decisiones de Iván (27-ago) sobre las preguntas de Fernando del 26-ago
> **Módulos:** Logística (Stock, Movimientos), Cocina (Escandallos, Mermas), Sala (ingesta Ágora)

---

## 1. Qué se decide aquí

Cuatro decisiones de Iván que se tocan entre sí y por eso van en un solo PRP:

1. **Stock y Movimientos se fusionan** en un único apartado: Stock.
2. **La unidad del escandallo la manda el producto**, sin conversiones.
3. **Ágora deja de ser fuente de configuración.** Solo informa qué se vendió y cuánto.
4. **No existe "deshacer"** sobre movimientos de stock.

Y una regla de lenguaje: **el módulo se llama Escandallos, nunca "Recetas"**.

---

## 2. Punto de partida (medido en producción, 27-ago)

| Dato | Valor |
|---|---|
| Productos de venta | 402 |
| Productos de compra | 672 |
| Escandallos escritos | **22** |
| Filas de `producto_composicion` | 288 (solo 22 vienen de escandallo real; el resto son espejos 1:1 de la migración) |
| Movimientos en `stock_movimientos` | **63**, todos `entrada`, todos de albarán, todos jun-jul |
| Mermas / inventarios / ajustes | **0** |
| Productos con existencias sin ni un movimiento | 257 de 319 |
| Productos con stock negativo | 12 (+1 nuevo creado hoy en la prueba) |

**Lectura:** el módulo está construido pero sin datos. Cualquier pantalla que se haga saldrá vacía hasta que se cuadre el stock y se escriban los escandallos. No es un fallo de este PRP.

---

## 3. Fase 1 — Stock unificado

### 3.1 Un solo apartado

- Desaparece `/logistica/movimientos` de la navegación.
- Queda **Stock** como único apartado.
- El historial de cada producto se consulta **desplegando el producto dentro de Stock**, sin salir a otra pantalla.

✅ **DECIDIDO (A):** todo lo de movimientos vive **dentro del submódulo Stock**. Al desplegar un producto salen todos sus movimientos. La pantalla suelta `/logistica/movimientos` **se elimina** (ruta, entrada de nav y `MovimientosAlmacenView.tsx`).

### 3.2 Columnas del historial por producto

Ordenado cronológicamente, con todos los tipos de movimiento (compra, venta, inventario, merma, ajuste y cualquier otro):

| Columna | Estado hoy |
|---|---|
| Fecha **y hora** | Parcial — el dato existe, solo se pinta el día |
| Tipo de movimiento | ✅ Ya existe |
| Cantidad ± (positivo/negativo) | ✅ Ya existe |
| Stock resultante | ✅ Ya existe (`saldo_resultante`) |
| **Coste unitario** | ❌ **No existe** |
| **Valor total del movimiento** | ❌ **No existe** |

**Ejemplo pedido:** 2 botellas de vino a 5 € → `+2 ud` · `5,00 €/ud` · `+10,00 €`.

### 3.3 El coste se congela

`stock_movimientos` gana dos columnas: `coste_unitario` y `valor_total`.

Se escriben **en el momento del movimiento**, no se calculan después.

**Por qué:** si el coste se leyera del precio de hoy, el histórico mentiría — 2 botellas compradas a 5 € deben seguir valiendo 10 € dentro de un año aunque el vino haya subido a 7 €. Es el mismo criterio que ya se aplica al puesto plantilla (se copia, no se referencia) y al precio de compra.

**Retroactivo:** los 63 movimientos existentes son todos de albarán, así que su coste se puede recuperar de las líneas del albarán. Para tipos sin documento de compra detrás no habrá coste retroactivo posible.

### 3.4 Bug destapado en la prueba de hoy

La merma de prueba de **Larios Rose** (5 ud, HABANA) dejó el stock en **−2,6**. El sistema permitió mermar 5 unidades habiendo 2,4, sin avisar ni bloquear.

**Se arregla:** una merma no puede dejar el stock por debajo de cero. Es la raíz de los negativos que Fernando encontró — el agujero sigue abierto y se siguen generando negativos nuevos.

---

## 4. Fase 2 — Se elimina el "deshacer"

### 4.1 Qué se quita

Tres botones que hoy **borran histórico**:

| Dónde | Qué hace hoy |
|---|---|
| Mermas | Borra la fila **y** borra su movimiento del kardex |
| Elaboraciones | "Revertir y descontar del stock" |
| Inventarios | Reversión ya existente |

Motor común: `revertirMovimientosPorDocumento()` en `services/kardex.ts`.

**Contradicción que se resuelve:** el propio Fernando escribe que "el histórico no se borra ni se disimula", pero su botón de deshacer hace exactamente eso.

### 4.2 Qué queda en su lugar

✅ **DECIDIDO (B) — REGLA FUNDAMENTAL DEL SISTEMA DE STOCK**

Iván resuelve el problema por una vía mejor que las dos propuestas: **no es "se puede corregir o no", es "depende de si el período está cerrado"**.

#### La regla

| Estado | Qué se puede hacer |
|---|---|
| **Almacén abierto** | Cualquier movimiento se puede **crear, modificar o borrar**. El sistema **recalcula el stock histórico automáticamente**. |
| **Almacén cerrado** | **Nada anterior al corte se toca.** Ni mermas, ni albaranes, ni ventas, ni ajustes. |

#### Cómo se cierra

Al **aceptar un inventario** aparece la opción **"Cerrar almacén en esta fecha y hora"**. Al confirmarla se crea un **punto de corte histórico**.

#### Por qué

Evita que una modificación posterior **recalcule y descuadre todo el stock ya inventariado y cerrado**. Es el mismo principio que ya rige los cierres de caja y los documentos de logística inmutables.

#### Lo que esto sustituye

- **Desaparece el "Deshacer"** como concepto. Ya no hay un botón que borre histórico: hay un período abierto donde se edita con normalidad y un período cerrado donde no se toca nada.
- **Desaparece la necesidad del contra-apunte.** Si el almacén está abierto, la merma mal apuntada **se corrige o se borra directamente** y el stock se recalcula. Si está cerrado, no se toca — y la diferencia se resuelve en el inventario siguiente.

#### Qué hay que construir (NO EXISTE HOY — verificado 27-ago)

No hay ni rastro de cierre de almacén en el código ni en la base de datos. Hay que construirlo entero:

1. **Punto de corte por empresa.** `inventarios` ya tiene `confirmado_at` y `confirmado_por`, así que el corte encaja de forma natural ahí. Hace falta además saber cuál es el corte vigente de cada empresa.
2. **Guarda en el servidor.** Toda escritura sobre `stock_movimientos` con fecha anterior al corte se rechaza. **En el servidor, no solo en la pantalla** — si no, se salta con una petición manipulada.
3. **Recálculo del histórico.** Hoy `saldo_resultante` se escribe al insertar. Si un movimiento del pasado se modifica o se borra, **hay que recalcular en cascada el saldo de todos los movimientos posteriores de ese producto**. Es la pieza más delicada de esta fase.
4. **Que se vea.** En Stock debe verse hasta qué fecha está cerrado, y los movimientos anteriores al corte deben mostrarse bloqueados.

> ⚠️ **Alcance:** esto es una funcionalidad nueva completa, no un ajuste. Es la parte más grande de la Fase 2 y afecta a mermas, albaranes, ventas, inventarios y ajustes por igual.

> 📌 **Pendiente de definir más adelante** (Iván lo tendrá en cuenta al seguir definiendo el software): quién tiene permiso para cerrar almacén, si un cierre se puede reabrir y con qué autorización, y si el corte es por empresa o también por almacén.

### 4.3 Excepción que se mantiene

`revertirMovimientosPorDocumento()` la usa también el cron de Ágora para reprocesar ventas (`api/cron/agora-sync/route.ts:64`). Ahí no es un botón de usuario, es una resincronización automática. **Se mantiene.**

### 4.4 Datos de prueba

Comprobado en producción: **no hay nada que borrar**. 0 mermas previas, 0 ajustes, 0 inventarios. La única merma existente es la de Larios Rose creada hoy.

✅ **DECIDIDO (C):** **no se borra todavía.** Se conserva para que Fernando pueda comprobar que el descuento funciona. Se borrará cuando él lo confirme.

Mientras tanto Larios Rose (HABANA) queda en **−2,6**, que es un negativo conocido y voluntario. Anotado para no confundirlo con los 12 negativos históricos.

---

## 5. Fase 3 — La unidad la manda el producto

### 5.1 La regla

Al añadir un producto de compra a un escandallo, el sistema **muestra su unidad configurada** y la cantidad se escribe en esa unidad. Sin conversiones.

- Producto en **Kilogramos** → se escriben kilos.
- Producto en **Litros** → se escriben litros.
- Producto en **Unidades** → se escriben unidades.

El campo de unidad pasa a ser **de solo lectura**: se hereda, no se teclea.

### 5.2 Cobertura real

| Medida configurada | Productos de compra | ¿Funciona? |
|---|---|---|
| Unidades (`ud` / `Unidades`) | 545 | ✅ |
| Kilogramos | 90 | ✅ |
| Litros | 16 | ✅ |

**El 92% del catálogo funciona directamente.** Resuelve el problema del cachopo: el filete está en Kilogramos, el escandallo dirá `0,35 Kg` y descontará 0,35 kg. Se acabó el "350 kg de filete por cachopo".

### 5.3 Deuda de datos que arregla

Las 87 líneas de escandallo existentes tienen la unidad escrita **de nueve formas distintas** (`Gr`, `GR`, `g`, `ud`, `Uni`, `uni`, `kg`, `KG`, `L`), porque hoy es texto libre. Al heredarse del producto, esto desaparece.

Hay que **convertir esas 87 líneas**: las que están en gramos pasan a la medida del producto (`350 Gr` de filete → `0,35 Kg`). Migración + revisión a ojo.

### 5.4 Excepciones encontradas (revisión pedida por Iván)

**Excepción 1 — Medidas de copa. 🔴 La importante.**
279 productos están en `ud` pero son botellas. En un combinado no se echa una botella entera, se echan 5 cl. Con la regla estricta, el escandallo diría `0,07 ud` de Larios Rose.

Son ~56 medidas de copa que alguien tiene que escribir a mano.

✅ **DECIDIDO (D):** se compra y se cuenta **por unidades (botellas)**, aunque la descripción diga "0,7 L". La unidad de stock es la botella.

- **Cada copa lleva la suya**: cada producto de venta define su propia cantidad en su escandallo. No hay una medida global.
- **Los combinados están a `0,1 ud`** sobre una botella de 0,70 L.
- Un producto puede comprarse por unidades aunque su descripción indique otra medida. **Manda la unidad configurada, no el texto del formato.**

**Implicación:** los escandallos de bebida se escriben en fracción de unidad (`0,1 ud`, `0,05 ud`). Para evitar el error de tecleo (`0,7` en vez de `0,07`), la pantalla debe avisar cuando una cantidad se salga de lo razonable para una botella.

**Excepción 2 — Especias y condimentos. 🟠**
Un plato lleva `0,002 Kg` de pimentón. Es un número incómodo: un cero de más son 20 gramos.

✅ **DECIDIDO (E), con matiz:** si se compra en kilos, **la equivalencia se pone en kilos**. Esa es la regla por defecto.

**A estudiar:** permitir escribir en **gramos** aunque se compre en kilos, con conversión automática al guardar. Iván lo ve interesante **pero exige definir muy bien dónde sí y dónde no** antes de implementarlo.

→ Se implementa **primero la regla en kilos**. La conversión opcional queda fuera de este PRP hasta que estén escritas sus reglas.

**Excepción 3 — Cajas de 24. 🟡 Ya resuelta.**
32 productos con formato `24 Ud`. Como el stock se lleva en unidades sueltas, `1` = una lata. Solo hay que que la pantalla lo deje claro, porque ver "24 Ud" al lado puede confundir.

---

## 6. Fase 4 — Ágora deja de ser fuente de configuración

### 6.1 La regla

De Ágora se recibe **únicamente**:

- Qué producto se ha vendido.
- Cuántas unidades.
- Fecha y hora.

**Todo lo demás se ignora**, aunque siga configurado en Ágora: composiciones, medidas, formatos de venta, costes.

**Flujo:** Ágora informa "3 unidades del producto X" → Balles consulta **su propio escandallo** → descuenta los productos de compra según **su** composición.

**Por qué:** mantener la misma información en dos sitios editables es una invitación al caos. Si mañana cambia un escandallo, se cambia en Balles y entra en vigor desde ahí.

### 6.2 Qué se corta exactamente

El campo `sale_format_ratio` (`agora-ventas-ingesta.ts:148`), usado hoy en tres sitios:

| Dónde | Hoy | Después |
|---|---|---|
| Descuento de stock | Multiplica por el ratio de Ágora | Solo escandallo |
| Consumo / reposición | Igual | Igual |
| **Camino "sin escandallo"** | 121 bebidas descuentan por ratio | **Desaparece** |

El tercero es el cambio de fondo: hoy un producto sin escandallo descuenta igualmente usando lo que dice Ágora. **Sin escandallo no se descuenta nada** — un producto sin escandallo está sin configurar y debe cantar, no inventarse el consumo.

El coste de Ágora ya se ignoraba (`CostPrice` está corrupto: Carrillera a 4.149,90 €). Eso ya estaba bien.

### 6.3 Qué se conserva, y por qué

- **`ProductName`**: para poder decir "Ágora vendió *Danza Macabra*" cuando ese producto no existe en Balles. Sin él, la propuesta de alta mostraría un número.
- **`precio_unitario`, `iva_pct`, `descuento_pct`**: no son configuración, son **el hecho de la venta** — lo que el cliente pagó. Cortarlos haría imposible saber cuánto se facturó. La regla apunta a la configuración, no a los importes cobrados.

✅ **DECIDIDO (F):** los importes de venta **deben verse en nuestro software**, aunque Ágora también los mande. Se mantienen.

### 6.3.1 Revisión de precios pedida por Iván (hecha 27-ago)

Comparado `productos.precio_venta` con lo que Ágora ha facturado de verdad, sobre **10.093 ventas**:

| Estado | Productos | Ventas |
|---|---|---|
| **Coinciden** | 136 | 7.402 |
| **Sin precio en Balles** | **67** | 2.065 |
| **Difieren** | 18 | 626 |

**🔴 Lo grave: 67 productos sin precio en Balles, y son los que más se venden.**
Brugal (393 ventas), Red Label (222), Seagrams (135), Black Label, Beefeater, Larios Rose, Absolut, Havana 7… **Todos los destilados de HABANA están a `null`.** Se venden a diario y el software no sabe a cuánto.

**Los 18 que difieren: la mayoría NO son errores.** El precio de Ágora varía por terraza, menú y suplementos. La Entraña está a 20,10 € en Balles y Ágora va de 3,50 a 20,10 — ese 3,50 es una ración de menú.

**Pero dos sí lo son y hay que corregirlos a mano:**

| Producto | En Balles | Se vende a | Diagnóstico |
|---|---|---|---|
| **Delizia** (HABANA) | 12,85 € | 4,17 € (27 ventas) | Parece confundido con el Delizia de BACANAL (~5,47 €) |
| **Licor de Crema El afilador** (HABANA) | 2,50 € | 8,00 € (6 ventas) | Se vende por más del triple de lo que dice la ficha |

> ⚠️ **Pendiente de Iván:** el precio bueno de esos dos. No se puede deducir de los datos.

**Se propone:** un aviso en el producto cuando su precio de venta esté vacío o se desvíe de forma sostenida de lo facturado. No corregir solo — Ágora informa, no manda.

### 6.4 Consecuencia: 121 bebidas pasan a necesitar escandallo

| | Criterio de Fernando | **Criterio de Iván** |
|---|---|---|
| Escandallos a escribir | 80 | **201** |
| Bebidas | "Ya funcionan" | Hay que escribirlas |

**No es trabajo perdido.** Los escandallos de bebida son de una línea (`1 ud de Coca-Cola`). Y buena parte **se puede generar automáticamente**: los 203 pares venta→compra ya están enlazados, así que un refresco o un botellín es `1 ud` de su producto de compra. Lo que sí requiere criterio humano son las ~56 medidas de copa.

**A cambio se gana:**
1. Ágora no puede alterar el consumo de stock sin que nadie lo apruebe.
2. El día que el TPV sea propio, la composición ya vive en Balles y no hay que reconstruir nada.

### 6.5 ⚠️ Orden obligatorio

**Primero se escriben los escandallos. Después se corta el ratio de Ágora.**

Hoy hay 22 escandallos frente a 402 productos de venta. Si se corta antes, el descuento de stock (hoy desactivado) no se podrá activar en mucho tiempo, porque las 121 bebidas que funcionan por el ratio dejarían de funcionar.

---

---

## 6-BIS. Catálogo de Productos: venta directa vs. venta por formato

> ✅ **DECIDIDO por Iván (27-ago).** Sustituye la propuesta anterior de desdoblar en productos separados.

### La estructura

Cada producto de venta elige **uno de dos tipos**:

#### 1. Venta directa

- Un único producto de venta.
- **Un precio de venta.**
- **Un escandallo**, donde se establecen equivalencias y cantidades de productos, materias primas o elaboraciones.

> Ejemplo: **Hamburguesa Clásica** → venta directa → 1 precio → 1 escandallo.

#### 2. Venta por formato

Permite crear **hasta 5 formatos** del mismo producto. Cada formato configura de forma independiente:

- **Nombre** (Pequeño, Mediano, Grande, Individual, Doble…)
- **Precio de venta propio**
- **Escandallo propio**

> Ejemplo: **Mojito** → Normal (8 €, escandallo normal) · Grande (12 €, escandallo grande).

✅ **DECIDIDO (J) — los destilados llevan TRES formatos:**

| Formato | Escandallo | Ejemplo |
|---|---|---|
| **Combinado** | `0,1 ud` | Brugal 8,78 € |
| **Chupito** | `0,05 ud` | Brugal 2,87 € |
| **Botella entera** | `1 ud` | Bot Red Label 92,25 € · Bot Black Label 112,75 € |

La botella entera de reservado **es un formato más**, no un producto aparte.

El sistema descuenta del stock **el escandallo del formato exacto que se ha vendido**.

### Regla de validación

| Tipo | Precios | Escandallos |
|---|---|---|
| **Venta directa** | Exactamente 1 | Exactamente 1 |
| **Venta por formato** | 1 por formato (máx. 5) | 1 por formato (máx. 5) |

En venta por formato, **cada formato debe tener obligatoriamente nombre, precio y escandallo**. Sin los tres, no se puede guardar.

### Por qué esto sustituye al desdoble

La propuesta anterior era crear un producto por formato (`Brugal Combinado`, `Brugal Chupito`). Este modelo es mejor:

- **Brugal sigue siendo un producto**, con sus formatos dentro. No se duplican 26 fichas.
- **No hace falta migrar el histórico de ventas** a productos nuevos: las 393 ventas de "Comb Brugal" siguen apuntando a Brugal, solo se les asigna su formato.
- El tope de 5 formatos evita que la ficha se convierta en un cajón desordenado.

### Cómo enlaza con Ágora (verificado 27-ago)

Ágora manda **dos identificadores** en cada línea de ticket:

| Producto | `agora_id` (ProductId) | `sale_format_id` | Formato | Precio |
|---|---|---|---|---|
| Brugal | `1550` | **1741** | Comb Brugal | 8,78 € |
| Brugal | `1550` | **1840** | Chupito Brugal | 2,87 € |
| Red Label | `1569` | **1779** | Comb Red Label | 8,85 € |
| Red Label | `1569` | **1867** | Chupito Red Label | 3,02 € |

- El **`agora_id`** identifica el producto → enlaza con el producto de Balles.
- El **`sale_format_id`** identifica el formato → enlaza con el formato de Balles.

**Importante:** el `sale_format_id` **sí se lee** (es identificación: qué se ha vendido). El `sale_format_ratio` **se sigue ignorando** (es configuración: cuánto consume) — eso lo dice nuestro escandallo. Coherente con la regla de la sección 6.

**Alcance real:** solo **26 productos** son multiformato hoy. El resto es venta directa.

### Lo que hay que construir

1. Campo `tipo_venta` en el producto: `directa` | `formato`.
2. Tabla de formatos: nombre, precio, escandallo, `sale_format_id`, orden. Máximo 5 por producto.
3. Validación: directa = 1 precio + 1 escandallo; formato = los tres campos obligatorios en cada uno.
4. El descuento de stock resuelve **producto + formato** → escandallo de ese formato.
5. Migración de los 26 multiformato actuales a este modelo, proponiendo formatos desde el histórico de tickets.

---

## 7. Fase 5 — Alta de producto detectado en Ágora

### 7.1 Comportamiento

Cuando llega una venta de un producto que no existe en Balles:

> **Nuevo producto detectado en Ágora: "Producto X".**
> Este producto todavía no existe en Balles. ¿Deseas crearlo?

Al confirmar, se piden solo los datos imprescindibles: nombre, tipo/categoría, si lleva escandallo, productos de compra que lo componen y cantidades. Al guardar queda vinculado por `agora_id` y las siguientes ventas se reconocen solas.

### 7.2 Problema de secuencia y cómo se resuelve

Entre que llega la venta y alguien configura el escandallo pueden pasar días. Esas ventas **no descontarían stock**, y si no se recuperan, ese consumo no se registra nunca.

**Solución propuesta:** la venta **no se descarta, queda en espera**. Se guarda marcada como pendiente de configurar, y **al completar el escandallo se procesan hacia atrás** las acumuladas. Así no se pierde nada aunque el alta tarde.

✅ **DECIDIDO (G):** el sistema **avisa y obliga** a crear el producto y rellenar su ficha para asociarlo. No es una sugerencia que se pueda ignorar.

Las ventas de productos sin enlazar **quedan en espera**, no se descartan, y se procesan hacia atrás al completar la ficha. Si no, se perdería el consumo de los días que tarde el alta.

### 7.3 Dato de contexto

396 de los 402 productos de venta ya tienen `agora_id`, así que el caso de "producto nuevo" será poco frecuente — pero es justo el que hoy se pierde en silencio.

---

## 8. Renombrado: Escandallos, no "Recetas"

El módulo ya se llama Escandallos, pero el lenguaje está mezclado: hay pantallas, documentos y comentarios que dicen "receta".

**Razón de Iván:** una receta puede contener otros datos; aquí se habla específicamente de la composición y el coste de los productos vendidos.

Se revisa y corrige todo el texto de interfaz. Incluye renombrar `docs/RECETAS_PENDIENTES_PRIORIZADAS.md` → `docs/ESCANDALLOS_PENDIENTES_PRIORIZADOS.md`.

**Nota para Fernando:** sus documentos y notas usan "recetas" en todas partes. No es un reproche — es la nomenclatura que hay que unificar de aquí en adelante.

---

## 9. Decisiones pendientes (bloquean la implementación)

| # | Decisión | Recomendación |
|---|---|---|
| **A** | Movimientos dentro de Stock | ✅ **Decidido** — todo dentro de Stock, la pantalla suelta se elimina |
| **C** | Merma de prueba de Larios Rose | ✅ **Decidido** — no se borra hasta que Fernando lo compruebe |
| **D** | Medidas de copa | ✅ **Decidido** — por unidades/botellas; combinados a `0,1 ud` |
| **E** | Especias | ✅ **Decidido** — en kilos. Conversión a gramos, a estudiar aparte |
| **F** | Importes de venta | ✅ **Decidido** — se mantienen y se muestran |
| **G** | Producto sin enlazar | ✅ **Decidido** — avisa y obliga; ventas en espera |
| **B** | Corrección de movimientos | ✅ **Decidido** — abierto se edita y recalcula; cerrado es inmutable |
| **H** | Precio de Delizia y Licor de Crema | ✅ **Resuelto** — eran multiformato, no precios mal puestos. Copa Delizia 3,60 € HABANA / 3,40 € BACANAL; botella 19 €. Chupito Licor de Crema 2,60 €, combinado 8,00 €. Los 12,85 € y 2,50 € de la ficha no corresponden a ningún formato: son datos inventados de la migración del 10-jun |
| **I** | **La ingesta de Ágora no guarda el `ProductId`** | ⏳ **PENDIENTE** — bloquea enlazar los 7 productos nuevos |
| **J** | Botella entera | ✅ **Decidido** — es un tercer formato (`1 ud`), no un producto aparte |

---

## 10. Orden de ejecución propuesto

1. **Fase 1** — Stock unificado + coste/valor + hora + bloqueo de negativos.
2. **Fase 2** — Fuera el deshacer + **cierre de almacén con punto de corte** (funcionalidad nueva completa).
3. **Fase 3** — Unidad heredada del producto + conversión de las 87 líneas.
4. **Escribir escandallos** (trabajo de negocio, no de desarrollo).
5. **Fase 4** — Cortar el ratio de Ágora. **Solo cuando 4 esté hecho.**
6. **Fase 5** — Alta de producto detectado.

Las fases 1-3 son independientes de Ágora y se pueden hacer ya.

---

## 11. Lo que este PRP NO cubre

- **Cuadrar el stock** (los 12 negativos y las 6.300 unidades sin justificar). Es trabajo de gerencia con las herramientas que ya existen, no desarrollo. Ver `docs/STOCK_CUADRE_DIAGNOSTICO.md`.
- **Escribir los escandallos.** Ver `docs/RECETAS_PENDIENTES_PRIORIZADAS.md`.
- **Los 3 arreglos del importador de catálogo** que Fernando devolvió (sin marcha atrás, se salta `createProducto`, `parejaCompraId` sin validar). Van aparte.
