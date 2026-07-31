# Análisis funcional — albaranes de proveedores

Fecha de análisis: 2026-07-31  
Ámbito: flujo de alta documental de albaranes en **Logística**. No debe confundirse con
Dirección → Documentación, que es el archivo documental general de la empresa.

## Resumen ejecutivo

La aplicación ya dispone de un flujo completo para recibir albaranes de proveedores por
foto desde móvil o escritorio, extraer sus datos con IA, compararlos con el catálogo de
compra y decidir el tratamiento de cada línea. El principio de control es correcto:

> una lectura OCR no modifica existencias; solo un albarán revisado y confirmado genera
> entradas de stock.

El flujo cubre la mayor parte del objetivo: leer productos, reconocer los conocidos,
pedir decisión humana ante incertidumbre, crear productos de compra y aprender el nombre
con el que los llama el proveedor. Sus principales carencias son el buscador incompleto
del catálogo, la ausencia de detección de duplicados y la escasa contextualización de las
preguntas al crear un producto.

## Contexto del producto

El repositorio es una plataforma operativa multiempresa para hostelería. Está construida
con Next.js, TypeScript, Supabase (autenticación, base de datos, RLS y Storage) y Gemini
para tareas de IA. Sus áreas funcionales principales son:

- Dirección y documentación corporativa.
- Sala: punto de venta, reservas, clientes y tarifas.
- Cocina: comandas, recetas, escandallos, elaboraciones, mermas y temperaturas.
- Logística: proveedores, productos, pedidos, albaranes, stock e inventarios.
- RRHH, Gerencia, Calidad, Marketing, Contabilidad, Gestoría y Jurídico.

El albarán es una pieza de integración entre Logística, Cocina y Stock: registra lo que
se compra, actualiza el coste histórico y proporciona existencias que después consumen
inventarios y escandallos.

## Dos flujos distintos de recepción

### 1. Albarán suelto por fotografía

Ruta móvil: `/m/albaranes/subir`.

Se usa cuando se recibe un documento del proveedor sin partir necesariamente de un pedido
interno. El móvil permite hacer una foto con la cámara trasera o adjuntar una imagen/PDF.
Después se ejecuta este flujo:

1. El cliente comprueba un tamaño máximo de 20 MB y convierte el documento a base64.
2. La acción `analizarAlbaranFoto` envía el documento a Gemini con un esquema JSON estricto.
3. La IA extrae proveedor, número, fecha, total y líneas de producto: nombre, cantidad,
   unidad, formato, precio neto, IVA e importe.
4. La persona revisa y puede corregir cabecera, cantidades y precios antes de guardar.
5. Cada línea se empareja contra el catálogo de productos de compra de su empresa.
6. El albarán se crea en estado `Revisión`, se adjunta el original en Storage privado y no
   se altera el stock.
7. Desde escritorio se resuelven las líneas pendientes y se confirma el documento.

### 2. Recepción de un pedido ya enviado

Ruta móvil: `/m/albaranes/recibir/[pedidoId]`.

Este caso parte de líneas ya conocidas del pedido. Una foto se analiza mediante la función
`analizar-albaran` y se muestra una comparativa pedido ↔ albarán. La persona puede ajustar
las cantidades realmente recibidas, incluso sin foto, y confirmar la recepción. La foto
actúa como evidencia secundaria. La confirmación crea el albarán y actualiza existencias.

## Cómo se decide el destino de un producto leído

El emparejador consulta los productos de compra activos de la empresa y compara el texto
OCR con dos campos:

1. `productos.nombre_proveedor`: nombre literal usado por el proveedor en sus documentos.
2. `productos.nombre`: nombre interno de la empresa.

La comparación normaliza mayúsculas, tildes y puntuación, y usa distancia de Levenshtein.
Un resultado con puntuación igual o superior a 0,92 queda ligado automáticamente; a partir
de 0,55 se propone como candidato. El umbral alto evita que una similitud dudosa modifique
stock sin intervención humana.

En el asistente de revisión, cada línea admite tres decisiones:

- **Vincular a existente.** Se asocia al producto elegido. Si ese producto no tenía alias,
  se memoriza el texto del proveedor para futuros albaranes.
- **Crear producto nuevo.** Solicita nombre, categoría, proveedor, IVA y precio. Se crea un
  producto de tipo `compra`, se conserva el texto OCR como alias del proveedor y se registra
  su primer precio de compra.
- **Ignorar.** Para portes, servicios, regalos u otros conceptos que no deben ser stock.

Al confirmar, ningún producto no ignorado puede quedar sin `productoId`. Se registran los
precios de compra que aún no existan para ese producto, proveedor y fecha; a continuación,
el albarán cambia a `Confirmado` y cada línea resuelta genera un movimiento de entrada en el
kardex.

## Persistencia y garantías actuales

| Elemento | Comportamiento actual |
| --- | --- |
| Documento original | Se guarda en el bucket privado `logistica-albaranes`, separado por empresa y albarán. |
| Resultado OCR | Se persiste junto al adjunto en `albaranes.documentos`. |
| Estado previo a aprobación | `Revisión`; permite líneas sin producto y no mueve stock. |
| Confirmación | Bloqueada si queda alguna línea no ignorada sin resolver. |
| Stock | Entrada por kardex, asociada a `documento_tipo=albaran` y al id del albarán. |
| Reintento de entrada del mismo albarán | El servicio revierte antes las entradas previas de ese mismo documento, evitando duplicación dentro del mismo albarán. |
| Precio | Histórico en `producto_precios_compra`; el precio vigente es el último aplicable por fecha. |
| IVA | El OCR evita tratar códigos de impuesto de Makro como porcentajes de IVA. |

Existe evidencia histórica en el repositorio de una prueba punta a punta con un albarán
real de Makro: lectura de 18 líneas, vinculación/creación de productos, movimientos de stock
y precios de compra verificados. Véase `docs/TAREA_FERNANDO_precios_compra_bacanal.md`.

## Evaluación respecto al objetivo

El objetivo —foto desde móvil, lectura del albarán y decisión sobre cada producto— está
materialmente implementado. La solución es sólida en su decisión más importante: no da por
buena una lectura de IA sin revisión cuando puede afectar al catálogo, precios o inventario.

No obstante, aún no es un asistente plenamente guiado. Actualmente pregunta siempre un
conjunto fijo de datos al crear, en vez de inferir lo posible y preguntar solo la incógnita
relevante. Tampoco distingue con suficiente estructura el mismo producto adquirido a varios
proveedores o formatos.

## Cobertura actual: botones y lógica

El flujo base se puede ejecutar de punta a punta y los controles principales ya existen.

| Momento | Botones/interfaz disponibles | Lógica conectada |
| --- | --- | --- |
| Captura móvil | Hacer foto, adjuntar archivo, cambiar, analizar. | Validación de tamaño, lectura del archivo y OCR estructurado con IA. |
| Verificación inicial | Editar proveedor, fecha, número, cantidad y precio; guardar en Revisión. | Crea el albarán sin tocar stock y adjunta el original con su análisis. |
| Bandeja móvil | Subir albarán por foto y consultar documentos en Revisión. | Lista pedidos enviados y albaranes pendientes de resolución. |
| Revisión en escritorio | Resolver/cambiar una línea, vincular a existente, crear producto e ignorar. | Vincula producto, memoriza alias, crea ficha de compra y registra precio inicial. |
| Confirmación | Confirmar albarán. | Impide confirmar líneas no resueltas, guarda precios y genera entradas de stock. |
| Pedido existente | Hacer/repetir foto, ajustar cantidades, marcar “No llegó” y confirmar recepción. | Compara pedido con documento, crea la recepción y actualiza stock. |

Por tanto, **sí está creada la base funcional para usar el proceso real**. No obstante, no
debe considerarse cerrado: los siguientes huecos afectan a la seguridad operativa y a la
calidad de uso.

- **No hay búsqueda completa del catálogo** al vincular una línea: solo se puede elegir entre
  candidatos sugeridos por el matcher.
- **No hay detección previa de duplicados** para impedir que el mismo albarán se registre y
  confirme dos veces como documentos diferentes.
- **No hay botón de guardar avance de revisión.** El backend admite resoluciones parciales
  sin confirmar, pero el panel actual solo ofrece confirmar; una recarga o cierre puede hacer
  perder decisiones manuales no confirmadas.
- **La resolución final no está disponible en móvil.** El teléfono captura, verifica y deja
  el documento en Revisión; vincular, crear y confirmar se hace desde escritorio.
- **No hay acceso visual al original en el detalle**, aunque el documento se persiste y existe
  una acción para generar una URL firmada.
- **La creación aún no formula preguntas adaptativas** ni resuelve suficientemente unidad,
  formato, IVA y categoría cuando la lectura es ambigua.

## Papel y evolución de la versión de escritorio

La versión de escritorio no es una alternativa secundaria al móvil: debe ser la **mesa de
control** del proceso. El móvil está bien orientado a la entrada rápida en muelle, almacén o
cocina; el escritorio es donde una persona con contexto puede resolver ambigüedades, verificar
el documento y decidir qué entra en catálogo y stock.

Actualmente el escritorio ya permite subir un albarán, abrir su detalle, ejecutar el
asistente de revisión, vincular/crear/ignorar líneas y confirmar. Para que funcione bien con
un volumen real de proveedores y documentos pendientes, se recomienda completar estas mejoras:

1. **Búsqueda de catálogo completa.** Al resolver una línea, el buscador debe acceder a todos
   los productos de compra de la empresa, no únicamente a las seis sugerencias del matcher.

2. **Guardar avance.** Añadir un botón visible de “Guardar revisión” que persista decisiones
   parciales sin confirmar el albarán. Debe indicar cuándo fue el último guardado y conservar
   las resoluciones tras cerrar, recargar o ceder el documento a otra persona.

3. **Documento y líneas lado a lado.** Mostrar o abrir el original privado del proveedor
   desde el detalle, idealmente junto a la tabla OCR y con acceso directo desde cada línea.
   Esto permite comprobar nombres, cantidades, precio, formato y total sin salir del flujo.

4. **Bandeja de Revisión gestionable.** Incorporar filtros por proveedor, fecha/antigüedad,
   responsable, número de líneas pendientes y posible duplicado; ordenar primero aquello que
   bloquea stock o lleva más tiempo esperando.

5. **Prevención de duplicados.** Antes de crear o confirmar, avisar de coincidencias por
   proveedor, número de albarán, fecha, total y huella del archivo. La persona debe poder
   abrir el posible duplicado o justificar explícitamente que es un documento distinto.

6. **Resolución rápida.** Para albaranes largos, habilitar acciones de teclado, selección
   masiva de líneas y confirmaciones por lote cuando varias comparten una decisión segura.

7. **Explicabilidad de sugerencias.** Cada propuesta debe expresar por qué se ofrece: alias
   del proveedor, similitud de nombre, unidad/formato o historial de precio. También debe
   mostrar claramente diferencias de precio y formato frente al producto habitual.

8. **Permisos y asignación.** Distinguir quién puede capturar, resolver, crear productos y
   confirmar stock. Si logística no puede crear una ficha, el escritorio debe permitir dejar
   una solicitud asignada a Dirección, en vez de obligar a ignorar la línea o bloquear el
   albarán sin contexto.

La prioridad de escritorio es: búsqueda completa, guardado parcial, consulta del original y
prevención de duplicados. Son las cuatro mejoras que más reducen errores y tiempo de revisión
sin automatizar decisiones que aún requieren criterio humano.

## Posibles fallos del flujo móvil pendientes de comprobación

Una persona informó de que no pudo subir un albarán desde móvil, pero no se dispone todavía
del dispositivo, archivo, punto exacto de fallo ni mensaje mostrado. Por tanto, los elementos
de esta sección son **hipótesis técnicas que deben verificarse**, no incidencias confirmadas.

### Hipótesis principal: tamaño efectivo de la petición OCR

La interfaz acepta archivos de hasta 20 MB, pero el límite configurado para Server Actions es
14 MB. Antes de invocar `analizarAlbaranFoto`, el cliente lee todo el archivo y lo envía en
base64. Esta codificación aumenta el tamaño aproximadamente un 33 %.

En consecuencia, un original de más de unos **10,5 MB** puede superar el límite real de la
petición, aunque la interfaz lo acepte. Las fotografías originales de cámaras móviles modernas
pueden llegar a ese tamaño. El flujo no comprime ni redimensiona la imagen antes de enviarla.

**Comprobación:** repetir con la misma cuenta tres imágenes JPEG de aproximadamente 2 MB,
8 MB y 12 MB; registrar el tamaño original, el mensaje de la interfaz y el código/registro
del servidor. Confirmar si la de 12 MB falla al pulsar “Analizar”.

### Compatibilidad de formato de imagen

El selector acepta `image/*`. En algunos teléfonos, especialmente iPhone, esto puede admitir
HEIC/HEIF. El flujo envía a Gemini el MIME original sin conversión; ese formato podría no ser
aceptado por el modelo o por la cadena de procesamiento.

**Comprobación:** probar la misma imagen como JPEG y como HEIC/HEIF. Registrar el MIME del
archivo y el error exacto. Si se confirma, convertir a JPEG/WEBP en cliente o restringir con
un aviso claro los formatos admitidos.

### Sesión, empresa activa o autorización

La pantalla móvil exige sesión. La extracción, el emparejado, la creación del albarán y la
subida a Storage necesitan también que el usuario tenga una empresa activa resoluble. Si la
sesión ha caducado, el perfil está incompleto o la empresa no se resuelve, una acción de
servidor puede devolver “No autenticado” o fallar al persistir.

**Comprobación:** abrir `/m/albaranes/subir` con una cuenta de logística conocida, verificar
que permanece autenticada, completar una prueba pequeña y revisar los avisos de la interfaz
y registros de Supabase/Vercel.

### Guardado de documento en Storage

Tras crear el albarán en `Revisión`, la foto se adjunta en una segunda operación. Si Storage
o sus políticas fallan, el albarán puede quedar creado pero sin original; la interfaz debería
mostrar una advertencia. El flujo actual no ofrece reintentar únicamente ese adjunto.

**Comprobación:** tras una carga correcta, verificar en la base de datos el albarán, su array
`documentos` y la existencia física del objeto en `logistica-albaranes`. Probar también con
conectividad móvil inestable.

### Flujo diferente: recepción de un pedido existente

La recepción móvil de un pedido no usa el mismo extractor que el alta libre. Invoca una Edge
Function llamada `analizar-albaran`, cuyo código no está versionado en este repositorio. Si el
fallo ocurrió tras pulsar “Hacer foto del albarán” dentro de un pedido, hay que comprobar el
despliegue, secretos y logs de esa función antes de diagnosticar el OCR de alta libre.

**Comprobación:** identificar si el usuario estaba en “Subir albarán por foto” o en la
recepción de un pedido; en el segundo caso, revisar el estado de la Edge Function y su log de
ejecución para el intervalo de la prueba.

### Evidencia mínima que debe recogerse en la próxima prueba

1. Modelo de teléfono, navegador o PWA, y sistema operativo.
2. Ruta utilizada y botón pulsado al fallar.
3. Archivo: formato, tamaño y si fue cámara o galería.
4. Captura del aviso/error en pantalla y hora aproximada.
5. Resultado esperado y resultado observado.
6. Registros correlacionados de Vercel, Gemini/Supabase o Edge Function, según el flujo.

Con esta evidencia será posible distinguir un límite de tamaño, formato no soportado, problema
de sesión, fallo de Storage o fallo de la función de comparación, y aplicar una corrección
proporcionada sin especular.

## Hallazgos y riesgos

### Prioridad alta

1. **Búsqueda limitada a candidatos.** El diálogo "Vincular a existente" muestra solamente
   los seis candidatos precalculados. Si el matcher no propone un producto que sí existe,
   la persona no puede buscarlo en todo el catálogo y puede acabar ignorándolo o creándolo
   duplicado.

2. **Sin detección de albarán duplicado.** No se comprueba una combinación como empresa,
   proveedor, número de proveedor, fecha, total y/o huella del archivo antes de crear un
   albarán nuevo. El kardex es idempotente dentro del mismo albarán, pero dos altas distintas
   del mismo papel podrían duplicar stock.

3. **Permisos de creación.** `createProducto` requiere rol de Dirección. Un usuario de
   logística puede subir y dejar un documento en revisión, pero quizá no pueda completar el
   alta de un producto. Es necesario decidir si se delega ese permiso o se habilita una cola
   de aprobación.

### Prioridad media

4. **Alias de proveedor único.** Solo existe `nombre_proveedor` por producto. Es insuficiente
   si un mismo producto se compra a varios proveedores o si un proveedor alterna referencias.
   El modelo recomendable es una tabla de alias por `producto × proveedor`.

5. **Matcher textual simple.** La similitud puede proponer productos parecidos pero erróneos.
   Debería ponderar proveedor, unidad, formato, código del artículo y precios históricos,
   además del nombre.

6. **Preguntas poco contextuales.** Al crear se elige una categoría y un IVA sin propuesta
   explicada; por defecto puede inducir una ficha incorrecta. El sistema debería pedir
   confirmación solo cuando el OCR o el catálogo no permitan inferir el dato.

7. **Unidad y formato no normalizados para stock.** Las líneas almacenan unidad y formato,
   pero la entrada de kardex suma directamente `cantidad`. Para formatos como cajas, kilos,
   botellas o unidades hace falta una política de conversión explícita antes de considerar
   el stock comparable.

### Prioridad de experiencia y mantenimiento

8. **El original no se abre desde el detalle.** La acción para generar URL firmada existe,
   pero la interfaz muestra metadatos y análisis sin un acceso visible al documento original.
   Revisarlo lado a lado con las líneas resolvería mejor las dudas de OCR.

9. **Edge Function no versionada en este repositorio.** El flujo de comparación contra pedido
   invoca `analizar-albaran`, pero no se encuentra su código en `supabase/functions`. Debe
   incorporarse al repositorio o documentarse y verificarse su despliegue para que los
   entornos reproducibles no dependan de infraestructura implícita.

## Evolución recomendada

Orden sugerido, sin alterar el principio de revisión humana:

1. Permitir buscar y vincular contra todo el catálogo de compra.
2. Detectar y bloquear/avisar de posibles albaranes duplicados antes de crear el registro.
3. Convertir el alta en un cuestionario mínimo: proponer categoría, proveedor, unidad,
   formato e IVA con evidencia, y preguntar solamente lo que requiera decisión humana.
4. Modelar alias y referencias por producto y proveedor, no como una sola columna.
5. Añadir reglas de conversión de formatos a unidad de stock y obligar a revisarlas cuando
   haya ambigüedad.
6. Mostrar el documento original junto a la resolución de líneas.
7. Versionar y comprobar en despliegue la función `analizar-albaran` usada por la recepción
   vinculada a pedidos.

## Referencias de implementación

- Captura móvil: `src/features/logistica/mobile/components/SubirAlbaranMobile.tsx`.
- Orquestación OCR, revisión y guardado: `src/features/logistica/hooks/use-subir-albaran.ts`.
- Extracción, matching y resolución: `src/features/logistica/actions/asistente-albaran-actions.ts`.
- Asistente de revisión: `src/features/logistica/components/albaranes/AsistenteAlbaranPanel.tsx`
  y `ResolverLineaDialog.tsx`.
- Persistencia de albaranes y documentos: `src/features/logistica/actions/albaranes-actions.ts`.
- Entradas de stock: `src/features/logistica/services/entradas-stock-por-albaran.ts`.
- Migraciones: `20260627230000_albaranes_documentos_storage.sql`,
  `20260729150000_albaranes_estado_revision.sql` y
  `20260729120000_productos_nombre_proveedor.sql`.
