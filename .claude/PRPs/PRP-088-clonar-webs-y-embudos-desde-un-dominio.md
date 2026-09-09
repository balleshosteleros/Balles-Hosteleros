# PRP-088 — Clonar webs y embudos desde un dominio (salir de GoHighLevel)

> **Estado**: EN CURSO — clonado, guardado, servido, reconexión y CITAS hechos; falta el enlace de Google Calendar con su cuenta y la interfaz para clonar desde el software
> **Fecha**: 07-09-2026
> **Proyecto**: Balles-Hosteleros
> **Relacionado**: PRP-029 (submódulo Página Web), PRP-076 (web por chat con IA), PRP-046 (campañas y atribución)

---

## Objetivo

Dar un dominio y que el software se traiga la web **idéntica**: el mismo diseño, las mismas fotos, los
mismos vídeos y los mismos textos, servidos desde nuestro almacenamiento y sin una sola llamada al
servidor de origen. Es el proceso inverso al importador de GoHighLevel, y sirve tanto para sacar de ahí
lo que aún queda de Balles como para captar clientes nuevos: "dame tu dirección web y te la monto".

Además, las páginas dejan de ser solo webs: aparece el formato **embudo**, una secuencia de pasos
encadenados (Registro → VSL → Agendar → Reunión programada), con su lista de pasos y sus visitas, como
en GoHighLevel.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| El importador actual (`importador-html.ts`) **adivina** bloques con heurísticas: coge el `<h1>`, unas imágenes y unos párrafos. El resultado no se parece a la web original y hay que rehacerlo a mano. | Copia fiel: se abre la web en un navegador de verdad, se guarda el diseño ya pintado y **todos** los archivos que usa. |
| GoHighLevel sí sabe importar una web por URL. Mientras nosotros no sepamos hacer lo contrario, migrar a un cliente cuesta días de trabajo manual. | Un dominio, un botón, minutos. La barrera de entrada para traerse un cliente desaparece. |
| Los vídeos de GHL se sirven en HLS desde su CDN (`content.apisystem.tech`) con direcciones `blob:` que no se pueden copiar. Aunque la web se replicase, los vídeos seguirían siendo suyos. | Se le pregunta al propio reproductor por su lista de reproducción y se descarga el vídeo en la máxima calidad. Pasa a ser un mp4 nuestro, en R2. |
| El software solo entiende "web": una página con su menú y sus secciones. Un embudo de venta no es eso — son pasos, sin menú, cada uno con un único objetivo. | Formato **embudo**: pasos ordenados, sin navegación, con las visitas de cada paso. |

**Valor de negocio**: es la última pieza para dejar de pagar GoHighLevel, y a la vez un argumento de
venta: cualquier restaurante puede pasarse al software sin perder la web que ya tiene.

**Comprobado el 07-09-2026** sobre el embudo real *Evergreen 1 - Master*
(`/registro-clase-gratuita`, `/vsl`, `/agendar`, `/reunin-programada-page`): 4 páginas, 281 archivos,
129 MB, 4 vídeos (dos a 1440p, uno a 1080p), **cero** direcciones externas sin traer. Las capturas del
clon y del original tienen **exactamente el mismo alto en píxeles** en las cuatro páginas.

---

## Qué

### Criterios de Éxito

- [ ] Se pega un dominio o una dirección y el software devuelve la página clonada, servible, sin ninguna
      llamada al servidor de origen (se verifica: cero direcciones externas pendientes).
- [ ] La captura del clon y la del original tienen el mismo alto y se ven iguales al compararlas.
- [ ] Los vídeos en HLS se descargan en la mejor calidad disponible, con su fotograma de portada, y
      quedan en R2 bajo la empresa.
- [ ] Se puede clonar un embudo entero de una vez y queda montado como pasos ordenados.
- [ ] Los formularios y el calendario del original **no se copian muertos**: se sustituyen por los
      nuestros, y lo que entre por ahí cae en `leads_web` y en el calendario del software.
- [ ] Los enlaces entre pasos apuntan a las páginas nuestras, no a las del origen.
- [ ] Ninguna página clonada ejecuta scripts de terceros (analítica y píxeles del origen fuera).

### Lo que NO entra

- Recrear la web como bloques editables. La copia se guarda tal cual; convertirla a bloques es otro
  trabajo (y lo natural es hacerlo con la IA del chat, PRP-076).
- Clonar webs de terceros sin permiso. La herramienta se usa sobre webs propias o de un cliente que la
  encarga; queda escrito en el propio módulo.

---

## Cómo

### 1. El clonador (`services/clonador-web.ts`)

Ya probado como prototipo. El orden importa:

1. Abrir la dirección en un navegador real y esperar a que la red se calme.
2. **Bajar hasta el final**: dispara la carga perezosa de imágenes y las animaciones de entrada.
3. Guardar todo lo que pide el navegador (hojas de estilo, tipografías, imágenes, vídeos) tal cual.
4. Preguntar a los reproductores por sus vídeos HLS y descargarlos con ffmpeg en la mejor calidad, con
   su fotograma de portada.
5. Antes de serializar: quitar los scripts, **pasar todas las rutas a absolutas** (si no, las relativas
   `/_next/…` apuntarían al servidor que sirva la copia y la web sale sin estilos — error real cometido
   en la prueba) y sustituir los reproductores por un `<video>` normal.
6. Segunda pasada: descargar lo que el navegador nunca llegó a pedir (otras resoluciones del `srcset`,
   precargas, imagen de compartir).
7. Reescribir las direcciones dentro de las hojas de estilo y del propio HTML a nuestro almacenamiento.

### 2. Dónde corre el navegador

**Fase 1 — desde el puesto de trabajo.** Clonar es un acto puntual de migración, no algo que el cliente
haga a diario. Se ejecuta como herramienta interna: cero coste y cero dependencias nuevas.

**Fase 2 — dentro del software**, cuando se abra a que el cliente pegue su dominio solo. Requiere un
navegador sin interfaz en el servidor (paquete nuevo, y las funciones de Vercel ya admiten hasta 5 GB).
Se decide entonces, no ahora.

### 3. Dónde se guarda

- El HTML de la copia, en `paginas_web`.
- Los archivos, en **R2** (`src/shared/lib/r2.ts`), bajo `empresa_<id>/web/replica/<pagina>/…`. Van a R2
  y no a Supabase por el peso: solo los vídeos de este embudo son 120 MB.

### 4. Cómo se sirve

`PaginaPublicaShell` mira si la página es una copia: si lo es, sirve su HTML en vez de pintar bloques.
Todo lo demás (dominios, manifest, favicon con el isotipo, analítica de visitas) sigue igual.

### 5. Reconexión (lo que NO se copia, y hay que enchufar)

| En el original | Qué se hace |
|----------------|-------------|
| Formularios de GHL | Se sustituyen por el nuestro; lo que entre va a `leads_web` con su origen. |
| Calendario de citas | Se sustituye por el nuestro. El clonado queda de foto muerta si no se toca. |
| Iframes de terceros (mapa, reproductores) | El mapa se reemplaza por nuestro bloque de mapa. |
| Enlaces entre pasos | Se reescriben a las páginas nuestras. |
| Analítica y píxeles del origen | Se eliminan. |

### Cambios de base de datos (⚠️ requieren autorización)

```sql
-- 1. Un formato nuevo de página
alter type pagina_web_tipo add value if not exists 'EMBUDO_PASO';

-- 2. La copia fiel, dentro de la página
alter table public.paginas_web
  add column if not exists html_replica          text,
  add column if not exists replica_origen_url    text,
  add column if not exists replica_capturada_at  timestamptz,
  add column if not exists replica_assets        jsonb;

-- 3. El embudo que agrupa los pasos
create table if not exists public.paginas_web_embudos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  created_at  timestamptz not null default now()
);
alter table public.paginas_web
  add column if not exists embudo_id    uuid references public.paginas_web_embudos(id) on delete set null,
  add column if not exists embudo_orden int;
```

Todo idempotente. RLS por empresa igual que el resto de `paginas_web`, y la vista pública
`empresas_web_publica` no cambia.

---

## Fases

| Fase | Qué | Estado |
|------|-----|--------|
| 1 | Clonador fiel, con vídeos HLS (`scripts/clonar-web.mjs`) | ✅ Hecho |
| 2 | Base de datos + subida de los archivos a R2 | ✅ Hecho |
| 3 | Servir la copia (`/api/replica/[paginaId]` + `replicasComoRutas()` en next.config) | ✅ Hecho |
| 4 | Formato embudo: pasos ordenados, visibles en la lista de páginas | ✅ Hecho |
| 5a | Reconexión de botones y captación de datos (`scripts/reconectar-replica.mjs`) | ✅ Hecho |
| 5b | Citas: calendarios por estrategia, huecos reales, reserva pública y agenda en Producto | ✅ Hecho |
| 5c | Espejo en Google Calendar (código hecho; falta elegir la cuenta desde el software) | Parcial |
| 6 | Botón "Clonar desde un dominio" dentro del software | Pendiente: necesita navegador sin interfaz en el servidor |

**Estado del embudo de Balles** (07-09-2026): las 4 páginas clonadas y guardadas
en la empresa BALLES, en BORRADOR. No se ven publicadas todavía porque
`balleshosteleros.com` sigue apuntando a GoHighLevel y el software solo sirve una
web cuando su dominio está dado de alta y verificado.

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| La copia se queda congelada: si el original cambia, la copia no. | Se guarda la dirección de origen y la fecha de captura; se puede volver a clonar. |
| Peso: 129 MB un solo embudo. | R2, con 500 GB por empresa. Las imágenes se sirven optimizadas, como ya se hace. |
| Sin los scripts del origen, lo interactivo deja de funcionar (menú de móvil, carruseles). | Se detecta y se avisa al terminar; lo que importe se rehace con lo nuestro. |
| Clonar una web ajena sin permiso. | Aviso en el módulo: solo webs propias o encargadas por su dueño. |


---

## Lo aprendido al construirlo (07-09-2026)

**El almacenamiento no manda cabeceras CORS.** Una tipografía servida desde otro
dominio las exige: el navegador se negaba a cargarlas y la copia salía con otra
letra. Solución: **el css y las tipografías viajan DENTRO del documento** (las
tipografías como datos en base64, y solo en formato woff2 — incrustar además
eot, ttf y svg multiplicaba por cinco el peso para algo que ningún navegador
pide). Las imágenes y los vídeos siguen en R2, que no sufren CORS. Si algún día
se configura CORS en el bucket, las tipografías podrían volver a ser archivos y
la página adelgazaría ~1 MB.

**GoHighLevel deja rastro por tres sitios**: los `<link rel="prefetch">`, decenas
de `<link as="script">` **sin `rel`** (inertes, pero delatan el origen) y los
trozos del vídeo en streaming (`video/MP2T`), que se colaban en el
almacenamiento por decenas de MB sin servir para nada. Los tres se descartan.

**Las tipografías de un `@font-face` que la página no llega a usar no las pide el
navegador**: hay que buscarlas también dentro del css, no solo en el html, o se
quedan apuntando al CDN del origen.

**En la página de registro no hay ningún formulario**: GoHighLevel lo abre con
JavaScript al pulsar. Al quitar sus scripts, los botones se ven pero no hacen
nada. Por eso la reconexión no va de "sustituir el formulario" sino de
**devolverle la acción a los botones**.

**El listado de páginas hacía `select("*")`**: con las copias dentro, la lista se
traía cientos de KB de html por página para no enseñar ninguno. Ahora las
consultas piden columnas concretas (`COLUMNAS_PAGINA`).


---

## Citas (Producto → Citas)

Lo que pidió Iván: **"son todos los clientes que vienen hasta el restaurante y ahora
hay que convertirlos en dinero"**. Por eso las citas NO viven en una tabla suelta de
formularios: quien reserva queda como **cliente en Producto** (`clientes_sala`, la
misma ficha que usa Sala), y la reunión se ve en un **calendario mensual o anual**
con el **equipo en el lateral**, para mirar la agenda de una persona concreta.

- **Varios calendarios, uno por estrategia** (`citas_calendarios`): cada uno con su
  duración, cada cuánto empieza un hueco, la antelación mínima, hasta cuándo se
  puede reservar, su color y su equipo. Se crean desde el **engranaje** de la
  pantalla, como el resto de la configuración base del software.
- **Los huecos se calculan en el servidor** (`services/huecos.ts`) y se vuelven a
  comprobar al reservar: lo que enseña el navegador puede tener diez minutos.
- **Las horas son de la EMPRESA**, nunca del navegador de quien reserva.
- **Un índice único** (`empleado_id`, `inicio`) impide que dos personas cojan el
  mismo hueco a la vez. La comprobación previa sola no basta: dos reservas
  simultáneas la pasan las dos.
- **Google Calendar es un espejo, no la fuente**: si Google falla, la cita ya está
  guardada. Como quien reserva no tiene sesión, el calendario guarda a nombre de
  qué cuenta se crean los eventos (`google_cuenta_email` + `google_user_id`).
- **El teléfono exige país** y el correo pasa por el validador del software: en la
  prueba rechazó `ejemplo.com` por dominio falso, que es justo lo que tiene que hacer.

**Probado el 07-09-2026**: calendario "Llamada de valoración" (L-V 10:00-14:00 y
16:00-19:00, 60 min), widget puesto en la copia de `/agendar`, reserva completa
desde la página → cita creada a las 10:00 de Madrid, cliente dado de alta con su
origen, y el hueco de las 10:00 desaparecido de la lista. Datos de prueba borrados.

**Falta**: elegir desde el software qué cuenta de Google recibe cada calendario
(hoy hay que ponerla a mano en `citas_calendarios`), y avisar por correo a quien
reserva desde nuestro sistema (ahora el aviso lo manda Google al invitar).


---

## Cómo se ve el embudo (09-09-2026)

**En la lista** (Marketing → Página web) los pasos ya NO salen sueltos: hay una
**tarjeta por embudo**, con su nombre, cuánta gente entra, cuánta llega al final,
el porcentaje que convierte y el recorrido dibujado en pequeño. Los pasos sueltos
en una tabla ordenada por fecha era justo como un embudo no se entiende.

**Al entrar**, los pasos van **en columna, de arriba abajo** (`/marketing/pagina-web/embudo/[id]`).
Cada paso lleva su número, su nombre, su dirección, las **visitas totales**, las de
los **últimos 30 días**, su estado y una **barra centrada** cuyo ancho es su gente:
al bajar se estrecha, y ese estrechamiento es lo que se pierde. Entre paso y paso
se dice **cuántos siguen y cuántos se caen**.

Iván lo pidió primero horizontal y lo corrigió a vertical: un embudo se lee de
arriba abajo.

**De dónde salen los números**: `paginas_web_visitas`, que ya existía y guarda una
fila por página, día y tipo de aparato — sumadas por paso. **Son visitas, no
personas únicas**: el módulo no guarda identificador de quien visita, por decisión
de privacidad ya tomada. Distinguir visitantes únicos exigiría tocar datos
personales y es una decisión aparte.

⚠️ Mientras el embudo se sirva desde GoHighLevel, todos los números salen a
**cero**, y la pantalla lo dice en vez de fingir datos.
