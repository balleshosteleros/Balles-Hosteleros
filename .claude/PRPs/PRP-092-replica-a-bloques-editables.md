# PRP-092 — Convertir una web clonada en páginas editables (réplica → bloques)

> ## ⚠️ ALCANCE REVISADO POR IVÁN (09-09-2026) — MANDA SOBRE LO DE ABAJO
>
> Ya NO son "las 20 páginas a bloques". El encargo real es **rehacer la web del
> grupo**, no copiarla. Lo de abajo (extractor, conversor, bloque `logos`) sigue
> valiendo como base técnica, pero el alcance es este:
>
> **1. Solo la PRIMERA PÁGINA se recrea.** El resto de páginas clonadas no se
> convierten.
>
> **2. En el menú, "Sistemas" pasa a llamarse "Software".** La página
> `/sistemas` **DESAPARECE**: no se copia ni se convierte.
>
> **3. Página nueva dedicada al SOFTWARE**, con:
> - qué es el software,
> - **cómo Iván lo creó** y por qué,
> - para quién es,
> - un **botón que lleva a la web de ventas** (`software.balleshosteleros.com`).
>
> **4. Master PRO + Master VIP → UNA sola página: "El Master", a secas.** No
> habrá dos. Argumentario dictado por Iván, a respetar:
> - Se puede contratar **el software por separado**, y **incluye clases todos los
>   miércoles**.
> - Es el **único software del mercado que da formación semanal** y
>   acompañamiento a toda la empresa.
> - **Pueden entrar TODOS los empleados** de la empresa.
> - Nosotros les formamos, para que **el empresario no tenga que encargarse** de
>   formarlos, y sepan dirigir su negocio.
> - Las **clases van incluidas en el software**, porque sabemos lo que importa
>   que los empleados sepan bien qué deben hacer.
> - Hay **clases para todos los puestos** de la empresa: que entren, entiendan
>   qué puntos pueden hacer mal, qué problemas se les presentan y cómo
>   resolverlos.
>
> **5. Páginas legales: IGUALES que las de HABANA y BACANAL**, cambiando datos y
> colores. No se convierten desde la copia: se generan con
> `generarPaginasLegales()`, que es lo que usan las otras dos empresas.
> Datos ya verificados en `empresas.datos_generales` de BALLES: CIF `B56558109`,
> razón social `COMPLEJOS HOSTELEROS GOURMET, S.L.`, domicilio
> `C/ Arte Plateresco, 3, 28905 Getafe (Madrid)`, teléfono `91 999 41 41`.
> ⚠️ Ojo: el campo `web` de esa empresa dice `software.balleshosteleros.com`;
> ahora la web del grupo es `balleshosteleros.com` y hay que decidir cuál va en
> los textos legales.
>
> **Pendiente de confirmar con Iván:** qué pasa con las páginas que quedan sin
> tocar (`agora`, `sesame`, `covermanager`, `revolut`, `banktrack`, `joombo`,
> `b2com`, `vsl`, `agendar`, `registro-clase-gratuita`, `reunin-programada-page`,
> `home`): ¿se quedan como copia, o desaparecen como `/sistemas`?


> **Estado**: PENDIENTE (requiere aprobación; incluye UN cambio de base de datos)
> **Fecha**: 09-09-2026
> **Proyecto**: Balles-Hosteleros
> **Relacionado**: PRP-088 (clonar webs y embudos), PRP-029 (submódulo Página Web), PRP-076 (web por chat con IA)

---

## Objetivo

Un botón que coge la **copia fiel** de una web clonada y la devuelve convertida en **bloques editables**
del software, sin trabajo manual y sin tocar la web que está en el aire: la copia se sigue sirviendo
hasta que la versión en bloques está revisada y se aprueba. Se estrena con las **20 páginas de BALLES**
(`balleshosteleros.com`), y queda disponible para cualquier web que se clone después.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| Las 20 páginas de BALLES están **PUBLICADAS con `html_replica` lleno y `bloques` vacío**: se sirven como documento tal cual por `/api/replica/[paginaId]`. El editor visual no puede tocar ni una coma; cambiar una palabra obliga a volver a clonar desde GoHighLevel. | Un conversor que lee el HTML clonado y genera los bloques equivalentes. A partir de ahí, la web se edita como cualquier otra del software (editor, chat con IA, publicar). |
| Convertir 20 páginas a mano es una semana de trabajo **y no sirve para el siguiente cliente**. | El conversor es una pieza reutilizable: se clona una web y se convierte con el mismo botón, sea de GoHighLevel, de Lovable o de lo que venga. |
| El importador viejo (`importador-html.ts`) **adivina** con heurísticas de restaurante (h1 → hero, imágenes → galería) y el resultado no se parece al original. | Conversión por la **estructura real** del constructor (secciones, filas, columnas y elementos ya etiquetados en el HTML), no por adivinanzas. Lo que no encaja en un bloque conocido cae a `texto_libre`: nunca se pierde contenido. |
| Mientras se convierte, la web de BALLES **no puede caerse ni cambiar**: es la que recibe el tráfico de las campañas y del embudo de venta. | La copia manda hasta que se pulsa el interruptor. Convertir, revisar y publicar son tres actos separados, y volver a la copia es un clic. |
| La portada tiene una sección (los **Sistemas Operativos**: Ágora, Sesame, CoverManager, Revolut, BankTrack, Joombo, B2Com) que ningún bloque actual sabe pintar. | Un bloque nuevo de **rejilla/cinta de logos**, que sirve tanto para la portada como para la página `/sistemas`, y mañana para "nuestros proveedores" de cualquier restaurante. |

**Valor de negocio**: es la última atadura con GoHighLevel. Hoy la web de BALLES vive en nuestro
servidor pero es una fotografía; convertida, se edita desde el software como la de cualquier cliente, y
el conversor se convierte en argumento de venta ("te traigo tu web y además te la dejo editable").

---

## Qué

### Criterios de Éxito

- [ ] Desde el software, en cualquier página que tenga copia guardada, un botón **Convertir a bloques**
      devuelve los bloques en segundos, sin pasos manuales por página.
- [ ] **Inventario de contenido al 100 %**: el informe de conversión demuestra que todos los titulares,
      párrafos, imágenes, vídeos, botones y enlaces del HTML aparecen en los bloques resultantes.
- [ ] **No se pierde nada**: lo que no encaja en un bloque conocido cae a `texto_libre` saneado, y el
      informe dice qué secciones han caído ahí y por qué.
- [ ] La web pública **no cambia** al convertir. Solo cambia cuando se pulsa *Servir la versión
      editable*; y *Volver a la copia* la deja como estaba, sin esperar a un despliegue.
- [ ] Bloque nuevo de **logos/servicios**: pinta los sistemas operativos con su logo, su nombre y su
      enlace a la ficha, tanto en rejilla (página `/sistemas`) como en cinta (portada).
- [ ] Los **enlaces internos** de la web clonada (`/vsl`, `/agora`, `/pro`, `/politica-de-privacidad`…)
      siguen llevando a la página correcta después de convertir.
- [ ] La conversión es **determinista**: convertir dos veces la misma copia da exactamente el mismo
      resultado. No inventa ni reescribe textos.
- [ ] Las **20 páginas de BALLES** quedan convertidas, revisadas una a una y aprobadas por Iván antes de
      servirse.
- [ ] Una copia de otra empresa/constructor (la web del grupo hecha en Lovable, ya guardada en BACANAL)
      se convierte con el mismo botón y da un resultado utilizable.

### Lo que NO entra

- **Clonar el diseño píxel a píxel.** La versión en bloques se ve con NUESTRO sistema de diseño y con los
  colores de Imagen de marca. Si hace falta que se parezca más, se ajusta la marca en Ajustes, no el
  bloque (norma: los colores salen SIEMPRE de la imagen de marca).
- **Convertir automáticamente al clonar.** Clonar y convertir siguen siendo dos actos: una copia fiel
  sigue siendo útil por sí sola.
- **Inventar bloques nuevos para cada sección rara.** Solo entra el de logos/servicios. El texto largo de
  `/pro` y `/vip` (listas de "qué incluye") va a `texto_libre`, que ya es editable.
- **IA.** La conversión de esta versión es determinista, sin llamadas a modelos. Reescribir textos ya es
  trabajo del chat de web (PRP-076), que tiene su propia lista blanca de campos.
- **Tocar el clonador** (`scripts/clonar-web.mjs`) ni borrar ninguna copia guardada.

### Comportamiento Esperado (happy path)

1. En **Marketing → Página web**, la lista marca las páginas que son copia fiel.
2. Se abre una y se pulsa **Convertir a bloques**. En el servidor se lee `html_replica`, se extraen las
   secciones y se generan los bloques.
3. Se muestra el **informe**: cuántas secciones, en qué bloque ha caído cada una, cuántas han ido a
   texto libre, y el recuento de titulares/imágenes/botones/enlaces recuperados frente a los del HTML.
4. Se acepta y los bloques se guardan en la página (con copia de seguridad para deshacer). **La web
   pública sigue enseñando la copia.**
5. Se revisa en la vista previa del editor y se ajusta lo que haga falta a mano o por chat.
6. Cuando está bien, **Servir la versión editable**: a partir de ese momento el dominio pinta los
   bloques. La copia se conserva guardada por si hay que volver.

---

## Contexto

### Referencias del código (ya investigadas)

| Archivo | Qué aporta |
|---------|------------|
| `src/features/marketing/pagina-web/types/index.ts` | `BLOQUE_TIPOS` (18 tipos) y la forma de `PaginaWeb`, con `html_replica`, `replica_origen_url`, `replica_assets`. |
| `src/features/marketing/pagina-web/services/bloque-schemas.ts` | Zod de cada bloque. Todo bloque nuevo entra por aquí (`datosSchemaPorTipo`, `bloqueSchema`). |
| `src/features/marketing/pagina-web/data/bloques-catalogo.ts` · `bloques-defaults.ts` | Biblioteca del editor y valores iniciales. |
| `src/features/marketing/pagina-web/components/public/BloquePublico.tsx` (1.834 líneas) | Render público de cada bloque. |
| `src/features/marketing/pagina-web/components/public/PaginaPublicaShell.tsx` | Menú, tema de marca, pie, cookies. **El menú se calcula por anclas de la propia página**. |
| `src/features/marketing/pagina-web/components/admin/editor/*` | Editor: `EditorShell`, `Canvas`, `PropiedadesPanel`, `forms/*` (un formulario por bloque). |
| `src/features/marketing/pagina-web/services/importador-html.ts` | El importador viejo por heurísticas. Queda **sustituido** por este conversor. |
| `src/features/marketing/pagina-web/actions/paginas-actions.ts` | `COLUMNAS_PAGINA` **excluye `html_replica`** a propósito (pesa cientos de KB): hay que leerlo aparte. |
| `next.config.ts` → `replicasComoRutas()` (línea 194) | Genera **en tiempo de compilación** los rewrites `dominio/slug → /api/replica/<id>` para toda página PUBLICADA con `html_replica` no nulo. |
| `src/app/api/replica/[paginaId]/route.ts` y `/preview/route.ts` | Sirven la copia como documento propio. |
| `src/features/marketing/pagina-web/services/hostname-resolver.ts` · `src/app/sitio-publico/[[...slug]]/page.tsx` | El camino normal (bloques) cuando no hay rewrite de copia. |
| `scripts/clonar-web.mjs` · `scripts/reconectar-replica.mjs` · `scripts/lib/reconexion-replica.mjs` | El clonador y la reconexión de botones/formularios de PRP-088. |

### Estado real de los datos (comprobado el 09-09-2026)

Empresa BALLES `eb99bddd-9f49-4348-96ee-37f930c0d5d0`: **20 páginas, todas PUBLICADA, todas con
`bloques` vacío y `html_replica` lleno**.

| Grupo | Páginas | Peso del HTML |
|-------|---------|---------------|
| Portada + duplicada | `principal`, `home` | 757 KB · 805 KB |
| Embudo (`29a87875-…`) | `registro-clase-gratuita`, `vsl`, `agendar`, `reunin-programada-page` | 620 KB – 1,17 MB |
| Formaciones | `pro`, `vip`, `sistemas` | 686 – 778 KB |
| Fichas de sistemas | `agora`, `sesame`, `covermanager`, `revolut-453894`, `banktrack-365136`, `joombo-sistemas`, `b2com-sistemas`, `gohighlevel` | ~4,5 MB cada una |
| Legales | `aviso-legal`, `politica-de-cookies`, `politica-de-privacidad` | ~600 KB |

Dominios: `balleshosteleros.com` VERIFICADO (apunta a `principal`), `www.balleshosteleros.com`
PENDIENTE_DNS.

**Ojo con el peso**: en esas páginas el `<body>` son 12–130 KB; el resto es `<head>` (CSS y tipografías
incrustadas, hasta 4,3 MB en las fichas de sistemas — así se resolvió que R2 no manda CORS, PRP-088).
El conversor trabaja sobre el `<body>` y consulta el CSS por selectores concretos.

### La gramática de la copia (verificada sobre la portada)

El HTML clonado de GoHighLevel no es una sopa: cada pieza viene etiquetada.

```
.c-section#section-XXXX          → sección (su fondo vive en CSS: .bg-section-XXXX{background-image:…})
  .inner > .c-row > .c-column    → maquetación (1 columna = apilado, 2 = texto/imagen a los lados)
      .c-heading                 → titular            .c-sub-heading → entradilla / párrafo destacado
      .c-paragraph               → párrafo con enlaces .c-button     → botón (<a href>)
      .c-image                   → <picture> con 6 fuentes + <img> de reserva
      .c-video                   → <video src=…mp4 poster=…> ya en R2
      .c-form                    → formulario         .c-custom-code → código pegado (WhatsApp flotante)
      .logo-item                 → logo de la cinta de aliados
      .desktop-only / .mobile-only → la MISMA sección repetida para cada pantalla
```

Estructura real de la portada, sección a sección: barra con logo y menú → hero ("Solo para hosteleros
ambiciosos" + "12 años abriendo locales") → WhatsApp flotante → "Soy Iván Ballesteros" (foto + texto) →
"Da el siguiente paso" (dos formaciones con foto y botón) → "Sistemas Operativos imprescindibles" →
"Y sí, ¡soy hostelero como tú!" → cinta de logos "NUESTROS PARTNERSHIP ALIADOS · SISTEMAS OPERATIVOS"
(8 logos, repetidos en bucle) → pie con enlaces legales y copyright.

La página `/sistemas` es exactamente la rejilla del bloque nuevo: 8 tarjetas logo + botón CONTRATA
apuntando a `/agora`, `/sesame`, `/covermanager`, `/revolut-453894`, `/banktrack-365136`,
`/joombo-sistemas`, `/b2com-sistemas`, `/gohighlevel`.

### Arquitectura propuesta

Dos etapas separadas a propósito, para que el conversor no quede atado a GoHighLevel:

```
src/features/marketing/pagina-web/
├── services/replica-bloques/
│   ├── modelo-crudo.ts        # SeccionCruda / ElementoCrudo: modelo NEUTRO, sin nada de GHL
│   ├── extraer-ghl.ts         # adaptador GoHighLevel: HTML clonado → SeccionCruda[]
│   ├── extraer-generico.ts    # adaptador de reserva (Lovable, WordPress…): <section>/<header>/<footer>
│   ├── estilos-seccion.ts     # lee del CSS el fondo, el color y la alineación de cada sección
│   ├── mapear-bloques.ts      # SeccionCruda[] → Bloque[] (reglas por composición) + informe
│   └── informe-conversion.ts  # cobertura: qué se recuperó y qué cayó a texto libre
├── actions/convertir-replica-actions.ts   # convertir (previsualizar), guardar, servir bloques/copia
├── components/admin/ConvertirReplicaDialog.tsx
└── (bloque nuevo) types + zod + catálogo + defaults + forms/LogosForm.tsx + render en BloquePublico
```

**Reglas de mapeo** (por composición de la sección, no por palabras clave):

| Composición de la sección | Bloque |
|---------------------------|--------|
| Primera sección, con barra de navegación y logo | se descarta: el menú lo pinta el shell |
| Titular + entradilla + botón, a pantalla completa, con fondo o vídeo | `hero` |
| Imagen a un lado y texto al otro (2 columnas) | `historia` |
| Vídeo suelto | `video` |
| Fila de tarjetas iguales (imagen + botón) o `.logo-item` repetidos | **`logos`** (nuevo) |
| Titular + texto + botón, centrado, sin imagen | `cta` |
| Formulario | `formulario` (campos leídos del DOM) |
| Citas / testimonios repetidos con nombre | `testimonios` |
| Párrafo con enlaces legales y copyright | `footer` |
| Cualquier otra cosa | `texto_libre` (HTML saneado, troceado por sección) |

### Bloque nuevo: `logos`

```ts
export interface LogosDatos {
  titulo?: string;
  subtitulo?: string;
  /** "cinta" = pasa sola en bucle (portada); "rejilla" = tarjetas fijas (/sistemas). */
  modo: "cinta" | "rejilla";
  items: Array<{
    nombre: string;
    imagen_url?: string;
    href?: string;
    descripcion?: string;
    cta_label?: string;
  }>;
}
```

Entra en `BLOQUE_TIPOS`, en la unión `Bloque`, en `bloque-schemas.ts`, en el catálogo del editor, en
`bloques-defaults.ts`, en un formulario propio y en `BloquePublico.tsx`. Sirve igual para "nuestros
proveedores" o "marcas con las que trabajamos" en cualquier restaurante.

### Cambios de base de datos (⚠️ REQUIEREN AUTORIZACIÓN)

Uno solo, y es el que garantiza que la web no se caiga durante la conversión:

```sql
-- Qué versión de la página se sirve: la copia fiel o los bloques.
-- Por defecto TRUE: todas las copias que ya existen siguen sirviéndose igual.
alter table paginas_web
  add column if not exists replica_activa boolean not null default true;

comment on column paginas_web.replica_activa is
  'PRP-092. true = el dominio sirve html_replica; false = sirve los bloques. La copia NUNCA se borra.';
```

No hace falta ninguna tabla nueva: el informe de conversión es de un solo uso y viaja a la pantalla; la
copia de seguridad de los bloques ya la da `bloques_previos` y `paginas_web_versiones`.

---

## Blueprint (fases)

### Fase 1 — Extractor: de la copia a secciones crudas
**Objetivo**: `html_replica` → `SeccionCruda[]` con sus elementos tipados, sus imágenes (la buena, no las
seis del `<picture>`), sus enlaces y el fondo que le toca de CSS. Modelo neutro + adaptador de GHL.
**Validación**: pasado sobre las 20 páginas de BALLES, el recuento de titulares, párrafos, imágenes,
vídeos y botones coincide con el del DOM, y ninguna página tarda más de unos segundos.

### Fase 2 — Bloque nuevo de logos/servicios
**Objetivo**: el tipo, su Zod, su valor por defecto, su ficha en el catálogo, su formulario y su render
público, en los dos modos (cinta y rejilla).
**Validación**: se inserta a mano desde la biblioteca del editor, se rellena con los 8 sistemas y se ve
bien en escritorio y en móvil, con los colores de la empresa.

### Fase 3 — Mapeador e informe de cobertura
**Objetivo**: `SeccionCruda[]` → `Bloque[]` con las reglas por composición, más el informe que demuestra
que no se ha perdido nada.
**Validación**: la portada da hero + historia + cta + logos + footer; el informe declara 100 % de
titulares, imágenes, botones y enlaces recuperados; convertir dos veces da el mismo resultado.

### Fase 4 — Interruptor copia/bloques, sin cortar la web
**Objetivo**: columna `replica_activa`, filtro en `replicasComoRutas()`, y **guarda en
`/api/replica/[paginaId]`**: si el interruptor está apagado, esa ruta ya no devuelve la copia aunque el
rewrite siga vivo del despliegue anterior. Acciones *Servir la versión editable* / *Volver a la copia*.
**Validación**: con la copia activa el dominio sirve el documento clonado; al apagar el interruptor
sirve los bloques **sin esperar a un despliegue**; al volver a encenderlo, la copia otra vez.

### Fase 5 — Navegación de web de varias páginas
**Objetivo**: el shell público sabe pintar un menú con enlaces a **otras páginas del mismo dominio**
(Inicio, Formaciones, Sistemas, Acceso Alumnos) y un pie con las legales. Hoy el menú es de anclas
porque se pensó para la web de una sola página de un restaurante; BALLES son 20 páginas enlazadas.
**Validación**: navegando por `balleshosteleros.com` en versión bloques se llega a las 20 páginas y
ningún enlace interno se rompe.

### Fase 6 — La conversión dentro del software
**Objetivo**: la lista de páginas marca las copias; el diálogo *Convertir a bloques* enseña el informe y
la vista previa antes de guardar; guardar deja copia de seguridad para deshacer.
**Validación**: un usuario con permiso convierte una página, la revisa y la deshace, sin tocar la web
pública en ningún momento.

### Fase 7 — Las 20 páginas de BALLES
**Objetivo**: convertir, revisar una a una y aprobar. Decidir qué se hace con `home` (duplicada de la
portada) y reconectar formulario y calendario del embudo a los nuestros.
**Validación**: Iván da el visto bueno página por página; los enlaces del embudo
(registro → vsl → agendar → reunión) siguen encadenados.

### Fase 8 — Validación final
**Objetivo**: el sistema funciona de punta a punta y sirve para el siguiente clon.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` correcto
- [ ] Capturas de Playwright de la versión en bloques frente a la copia, página a página
- [ ] La copia de Lovable de BACANAL se convierte con el mismo botón
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes

> Se rellena durante la implementación.

---

## Gotchas

- [ ] **Los rewrites de las copias se calculan al COMPILAR** (`replicasComoRutas()` en `next.config.ts`).
      Cambiar `replica_activa` no basta por sí solo: por eso la fase 4 pone también la guarda dentro de
      `/api/replica/[paginaId]`. Sin ella, apagar el interruptor no se nota hasta el siguiente despliegue.
- [ ] **El `<head>` de una copia son de 600 KB a 4,3 MB de CSS.** Trabajar sobre el `<body>` y buscar en
      el CSS por selector concreto. Una expresión regular golosa sobre el `<head>` se cuelga: pasó
      durante esta investigación (más de dos minutos sin terminar).
- [ ] **Los fondos de sección no están en el HTML**, están en `.bg-section-<id>{background-image:url(…)}`.
      Sin leer el CSS, los hero salen sin foto.
- [ ] **Cada imagen es un `<picture>` con seis fuentes** (avif/webp y variantes de `srcset`). Quedarse con
      el `src` del `<img>` de reserva; si no, la galería sale con la misma foto seis veces.
- [ ] **El bloque de reconexión de PRP-088 es NUESTRO, no del origen**: viene entre los comentarios
      `<!-- Reconexión con el software (PRP-088)… -->` … `<!-- /Reconexión -->` y ya lleva un
      `<form id="bh-form">`. No convertirlo como si fuera contenido clonado: su formulario se sustituye
      por el bloque `formulario` y el calendario por el módulo de citas.
- [ ] **Secciones duplicadas por pantalla**: la cinta de logos de la portada viene marcada `desktop-only`
      y repetida. Convertir una sola vez o saldrán logos por duplicado.
- [ ] **Colores y tipografía NUNCA salen de la réplica.** Norma del proyecto: siempre de Imagen de marca
      (Ajustes). Si la web convertida no se parece, se corrige la marca, no el bloque.
- [ ] **Los enlaces internos son rutas del dominio** (`/agora`, `/vsl`, `/politica-de-privacidad`) y hay
      que casarlos con el `slug_interno` de la página correspondiente, o la web convertida se queda con
      enlaces muertos.
- [ ] **`html_replica` no viaja en `COLUMNAS_PAGINA`** (a propósito, por peso). Leerlo aparte y solo en
      el servidor: nunca mandar cientos de KB al navegador.
- [ ] **`texto_libre` tiene tope de 50.000 caracteres en Zod.** Las páginas `/pro` y `/vip` son listas
      larguísimas: trocear por sección en vez de volcar la página entera en un solo bloque.
- [ ] **El menú del shell se calcula DESPUÉS de resolver los bloques visibles** (norma ya establecida):
      cualquier navegación nueva tiene que respetar eso.
- [ ] **El WhatsApp flotante de la portada es un `custom-code`** y no tiene bloque equivalente. Sale del
      número de la empresa en Ajustes, no se convierte como contenido.
- [ ] **`home` está duplicada de `principal`.** Convertir las dos sería trabajo tirado: decidir antes si
      se archiva.
- [ ] **La copia jamás se borra.** `html_replica` se conserva aunque se sirvan los bloques: es el único
      respaldo de la web original de GoHighLevel.

## Anti-Patrones

- NO usar IA para "mejorar" los textos al convertir: se copia lo que hay, literal. Reescribir es trabajo
  del chat de web, con su lista blanca.
- NO borrar `html_replica` ni desactivar el rewrite hasta que la versión en bloques esté aprobada.
- NO tocar `scripts/clonar-web.mjs`: clonar y convertir son piezas distintas.
- NO perseguir el píxel exacto de GoHighLevel; el objetivo es el CONTENIDO editable con nuestro diseño.
- NO inventar un bloque nuevo por cada sección que no encaje: para eso está `texto_libre`.
- NO hacer el conversor específico de GoHighLevel: el modelo intermedio es neutro y el adaptador,
  intercambiable.
- NO saltarse Zod al guardar los bloques generados ni el `bloques_previos` de deshacer.

---

*PRP pendiente de aprobación. No se ha modificado código ni base de datos.*
