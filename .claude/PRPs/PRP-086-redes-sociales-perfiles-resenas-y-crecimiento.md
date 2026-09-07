# PRP-086 — Redes sociales: perfiles, reseñas de todas las plataformas y crecimiento

**Estado:** propuesto, pendiente de aprobación
**Fecha:** 07-09-2026
**Relacionado:** PRP-046 (campañas y atribución), PRP-049 (Reserve with Google)

---

## 1. Punto de partida real (lo que ya hay, comprobado en el código)

**Calidad → Reseñas** (`/calidad/resenas`) ya reúne reseñas internas y externas
en la misma tabla `resenas`, con un campo `origen` que hoy admite: `manual`,
`qr`, `carta`, `google`, `encuesta` (las 2.611 traídas de CoverManager),
`reserva` (el correo posterior a la visita) y `otro`.

Lo que **no** es como la pantalla de referencia:

| Lo que pide Iván | Estado hoy |
|---|---|
| Todas las reseñas juntas, internas y externas | ✅ ya lo están |
| Ordenadas por fecha de entrada | ❌ la vista es un **kanban por estado** (nuevo comensal / no contesta / excelente / regular / malo), no una lista cronológica |
| Filtro por origen o plataforma | ❌ no existe; el único filtro es de **período** |
| Marcador 4,2/5 con el reparto de estrellas | ❌ solo hay una gráfica de evolución mensual (nota media + volumen) |
| Que el marcador cambie según el filtro | ❌ el resumen actual es global, no reacciona |
| Perfiles digitales y su optimización | ❌ no existe |
| Crecimiento mensual por red social | ❌ no existe |

Nada de esto es un bug: son piezas que no se construyeron. Las tres primeras se
pueden hacer **ya**, sin depender de nadie, porque los datos están.

---

## 2. Qué se construye

### 2.1 Reseñas — se queda en Calidad y se completa

La gestión de reseñas **no se muda** a Redes sociales: quien las trabaja a
diario es Calidad, y el kanban por estado es la herramienta de ese trabajo. Lo
que se añade encima:

- **Marcador de reputación**: nota media grande, total de reseñas y reparto de
  5★ a 1★ con barras. **Recalcula con los filtros activos**: si filtras Google,
  enseña la nota de Google; si marcas Google + encuesta, la de las dos juntas.
- **Filtro por plataforma**, multiselección, con el número de reseñas de cada
  una al lado. Se apoya en `origen`, que es el campo canónico.
- **Vista de lista cronológica** como alternativa al kanban (un conmutador
  lista/kanban): últimas primero, con autor, estrellas, texto, plataforma y la
  respuesta publicada debajo, como en la referencia.
- **Panel de respuesta**: respondidas, sin responder y tiempo medio de
  respuesta. Hoy hay 40 reseñas de Google sin contestar y nadie lo ve en pantalla.

### 2.2 Nuevo submódulo: MARKETING → REDES SOCIALES

Cuelga de Marketing (junto a Página web, Contenido y Campañas), no de Calidad:
es trabajo de marketing, y Marketing ya tiene sus tres puestos definidos.

Ruta: `/marketing/redes-sociales`. Tres pestañas:

**a) Perfiles** — una tarjeta por cada presencia digital de la empresa: Google,
Instagram, Facebook, TikTok, TripAdvisor, TheFork, YouTube y la página web.
Cada tarjeta enseña:
- foto o logo del perfil, nombre y enlace (abre en pestaña nueva),
- **puntuación de optimización** (por ejemplo 14/16, con barra),
- la lista de comprobaciones: las cumplidas en verde, las que faltan con la
  acción concreta ("no tienes botón de reservar en el perfil", "faltan horarios",
  "12 fotos, se recomiendan más de 30"),
- estado: conectado / sin conectar.

De dónde sale cada comprobación:
- **Google**: automática. Places API ya devuelve nombre, teléfono, web, horarios,
  fotos, nota y número de reseñas; el resto (respuestas pendientes, enlace de
  reserva) sale de nuestra base de datos.
- **Instagram y Facebook**: automática al conectar la cuenta de Meta (biografía,
  enlace, botón de acción, foto, publicaciones al mes).
- **TripAdvisor, TheFork, TikTok, YouTube**: comprobación manual —el software
  pregunta y guarda la respuesta— porque no hay API abierta que lo diga.
- **Página web**: la analítica propia sin cookies ya existe; se le añaden las
  comprobaciones técnicas (título, descripción, velocidad, versión móvil).

**b) Crecimiento** — evolución mensual por red: seguidores, alcance,
interacciones y publicaciones. Filtros por red, por período y por local. Una
gráfica de línea con el histórico y tarjetas con el crecimiento del mes y el
porcentaje frente al mes anterior. Un mes sin dato queda en hueco, no en cero.

**c) Reseñas** — el mismo marcador y la misma lista de 2.1, pero filtrada de
entrada a las plataformas públicas (Google, TripAdvisor, TheFork), que es lo que
mira marketing. Componente reutilizado, no copiado.

---

## 3. Modelo de datos

```
redes_perfiles
  id · empresa_id · red ('google'|'instagram'|'facebook'|'tiktok'
    |'tripadvisor'|'thefork'|'youtube'|'web')
  handle · url · nombre_publico · avatar_url
  conectado_at · cuenta_externa_id · activo · created_at · updated_at
  UNIQUE (empresa_id, red)

redes_metricas_mensuales
  id · perfil_id · mes ('2026-09')
  seguidores · alcance · interacciones · publicaciones · visitas_perfil
  capturado_at
  UNIQUE (perfil_id, mes)

redes_revisiones            -- histórico de la puntuación de optimización
  id · perfil_id · fecha · puntuacion · maximo · detalle (jsonb)

redes_checklist_manual      -- respuestas de las redes sin API
  id · perfil_id · clave · cumplido · comprobado_por · comprobado_at
```

RLS por `empresas_del_usuario()`, como el resto. Las métricas se guardan como
**foto mensual**: Meta solo deja consultar los últimos 30 días, así que si no se
guarda cada mes, el histórico no se puede reconstruir después.

**Las credenciales de Meta no van aquí**: OAuth y tokens van a
**Ajustes → Integraciones**, como Revolut y Google. Este módulo solo lee.

**Ampliación de `origen`** en `resenas`: se añaden `tripadvisor`, `thefork`,
`instagram` y `facebook` al tipo y a las etiquetas. Migración idempotente.

---

## 4. Qué se puede conectar de verdad, y qué no

Esto es lo que decide hasta dónde llega el módulo. Sin adornos:

| Plataforma | Leer reseñas | Publicar respuesta | Métricas de crecimiento |
|---|---|---|---|
| **Google** | ⚠️ Places API: solo las **5 más recientes**, cron diario | ❌ **bloqueado** — necesita Business Profile API | ✅ con Business Profile API |
| **Instagram** | ❌ Meta no expone reseñas | ❌ | ✅ Graph API: seguidores, alcance, interacciones |
| **Facebook** | ⚠️ solo "recomendaciones", muy limitado | ❌ | ✅ Graph API |
| **TikTok** | — | — | ✅ Display API (seguidores y vídeos) |
| **YouTube** | — | — | ✅ Data API (gratuita) |
| **TripAdvisor** | ❌ sin API abierta (es de pago y para partners) | ❌ | ❌ |
| **TheFork** | ❌ sin API pública | ❌ | ❌ |
| **Página web** | — | — | ✅ ya la tenemos, sin cookies |

**El bloqueo grande sigue siendo Google.** La solicitud de la Business Profile
API se ha enviado dos veces (17-ago desde BACANAL y 29-ago desde
`balleshosteleros@gmail.com`, caso `9-5913000041388`) y **no hay respuesta ni
acuse, con el plazo vencido**. Hasta que llegue: GoHighLevel es lo único que
publica respuestas de verdad, y **no se apaga**.

Para TripAdvisor y TheFork la única vía honesta es **carga manual o pegar un
CSV**. No se va a prometer una sincronización que no existe.

---

## 5. Fases

**Fase 1 — Reseñas completas (sin dependencias externas)**
Marcador dinámico, filtro por plataforma, vista de lista cronológica y panel de
respuesta. Ampliación de `origen`. Es lo único que se puede tener funcionando
hoy mismo y ya cubre la pantalla de la referencia.

**Fase 2 — Submódulo Redes sociales + Perfiles**
Ruta, permisos por rol, tablas, tarjetas de perfil con puntuación. Google
automático vía Places; el resto por comprobación manual. Pestaña de reseñas
reutilizando la fase 1.

**Fase 3 — Crecimiento con Meta**
OAuth de Instagram y Facebook en Ajustes → Integraciones, cron mensual que
guarda la foto de métricas, gráficas con filtros. Añadir TikTok y YouTube
después, que son más simples.

**Fase 4 — Google completo (bloqueada)**
En cuanto Google apruebe la Business Profile API: traer **todas** las reseñas
(no 5), publicar respuestas desde el software y las métricas de la ficha
(búsquedas, llamadas, cómo llegan). Solo entonces se apaga GoHighLevel.

**Fase 5 — TripAdvisor y TheFork**
Carga manual o CSV, para que la nota agregada no mienta por dejarlas fuera.

---

## 6. Riesgos

- **Meta pide revisión de la app** para los permisos de métricas
  (`instagram_manage_insights`, `pages_read_engagement`). Son semanas. La fase 3
  puede quedarse esperando igual que la 4.
- **Places API es de pago por consulta**: revisar las llamadas de las
  comprobaciones de Google para no dispararlo. Cachear un día.
- **Las 5 reseñas de Google al día siguen perdiéndose** si un día entran más. El
  cron horario está escrito pero necesita Vercel Pro.
- La puntuación de optimización debe decir **qué hacer**, no solo un número: un
  14/16 sin decir cuáles son los 2 que faltan no sirve para nada.

---

## 7. Pendiente antes de empezar

- Las **tres capturas** de referencia para el diseño de las pestañas de perfiles
  y crecimiento no han llegado al chat.
