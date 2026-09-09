# Permiso de Google para publicar respuestas a reseñas — pasos

---

## ✅ SOLICITUD ENVIADA — 9 de septiembre de 2026 (LA BUENA)

| | |
|---|---|
| **ID de asistencia** | `6-7179000041984` |
| **Enviada el** | 9-sep-2026 |
| **Desde** | `balleshosteleros@gmail.com` |
| **Ficha usada** | Balles Hosteleros (Empresa de servicios locales, **Verificada**) |
| **Proyecto** | `131650182388` (My First Project) |
| **Plazo que da Google** | 7-10 días hábiles |
| **Respuesta esperada** | ~18-23 sep 2026 |
| **Estado** | ⏳ esperando |

**⚠️ Por qué esta vez sí y las dos anteriores no.** Al abrir el formulario,
Google mostró *"No se han encontrado casos anteriores que coincidan"*: las
solicitudes de agosto (`8-0006000041312` y `9-5913000041388`) **nunca llegaron a
generar un ticket**. No las rechazaron — no entraron. Se enviaron por un canal
que no abre caso.

**El canal bueno es este, y es un asistente por pasos, no un formulario suelto:**
https://support.google.com/business/contact/api_default → *"Solicitud de acceso
básico a las APIs"*. Empieza haciéndote elegir tu ficha verificada de una lista,
así que Google ya sabe quién eres desde el primer paso.

**Dos cosas que hay que hacer bien o la solicitud muere sin avisar:**
- El campo "Número del proyecto" quiere **solo dígitos** (`131650182388`), NO el
  ID con letras (`project-ed11b68e-3b8a-4daf-816`). Es el error natural.
- Enviar desde una cuenta que administre una ficha **verificada con 60+ días**.

**Cómo saber si está aprobada SIN esperar correo:** Cloud Console → APIs y
servicios → *My Business Account Management API* → **Cuotas**. `0 QPM` = no
aprobada; `300 QPM` = aprobada. A 9-sep no aparece ninguna API "business" entre
las habilitadas.

Cuando llegue la aprobación → seguir por el **Paso 2** de este documento.

---

**Qué se pide:** acceso a la **Google Business Profile API**, que es la que
permite **publicar** la respuesta en tu ficha. Es la misma que usa GoHighLevel,
y el motivo de que a ti "te responda solo" allí.

**Cuánto cuesta:** **nada**. Google no cobra por esta API.
**Cuánto tarda:** semanas (es aprobación manual de Google). Por eso conviene
empezar ya.
**Cuántas veces se hace:** **UNA**, para todo el software. No es por empresa ni
por restaurante. Después, cada restaurante nuevo solo pulsa "conectar" y acepta.

---

## Lo que YA tenemos (no hay que volver a hacerlo)

Esto ahorra buena parte del trámite:

- ✅ Proyecto de Google Cloud creado y en marcha — **número `131650182388`**.
- ✅ Pantalla de consentimiento OAuth ya configurada y **ya pasada por
  verificación de Google** (con los permisos de Gmail, que son de los
  "sensibles"). O sea: este camino ya se recorrió una vez.
- ✅ Credenciales OAuth (Client ID y Secret) funcionando.
- ✅ Dominio verificado.

**Falta solo:** pedir el acceso a la API de fichas de negocio y añadir su
permiso a la pantalla de consentimiento.

---

## ⚠️ Con qué cuenta hay que enviarlo (esto atasca a mucha gente)

Google exige que el correo que envía la solicitud sea **propietario o
administrador de una ficha de Google Business verificada y activa desde hace
más de 60 días**. Y dice literalmente que esa ficha **puede ser la de un
cliente que gestionas**, no hace falta que sea la del solicitante.

Por tanto:

| Concepto | Qué va |
|---|---|
| **Cuenta con la que se envía** | La que administra la ficha de **BACANAL** en Google Business |
| **Empresa solicitante** (en el texto) | La sociedad **del software**, no un restaurante |
| **Sitio web de empresa** | La web de **Balles** (la plataforma solicitante) |
| **Ficha que acredita** | BACANAL (o HABANA) |

⚠️ **La web y la ficha NO tienen por qué coincidir, y aquí no coinciden.** Son
dos requisitos distintos que conviven:

- La **web** es la de la plataforma que pide el acceso (Balles). Google evalúa
  a la plataforma, igual que a GoHighLevel le pidió gohighlevel.com y no la web
  de uno de sus restaurantes clientes.
- La **ficha verificada de +60 días** solo sirve para acreditar que se gestionan
  negocios reales, y Google admite expresamente que sea **de un cliente**.

Por eso el texto de justificación dice "our own restaurant group **and client
restaurants**": describe exactamente esta situación.

**No** es la cuenta del proyecto de Google Cloud: lo que Google mira son los
permisos sobre la **ficha del negocio**. Son cosas distintas.

**Si al cambiar de cuenta el formulario rebota a otra página**, es que hay
varias sesiones de Google abiertas a la vez y se lía. Solución: **ventana de
incógnito** y entrar solo con la cuenta correcta.

Antes de empezar, comprobar en https://business.google.com que esa cuenta ve la
ficha y que aparece **verificada**.

---

## Paso 1 — Pedir el acceso a la API (el que tarda)

Este es **el paso lento y el único urgente**. Los demás se hacen en minutos y
solo tienen sentido cuando Google conteste.

1. Abrir el formulario de solicitud:
   **https://developers.google.com/my-business/content/prereqs#request-access**
   (botón *"Request access"* → lleva a un formulario de Google).

2. Rellenarlo con estos datos:

   | Campo del formulario | Qué poner |
   |---|---|
   | **Project ID / Project number** | `131650182388` |
   | **Nombre de la empresa** | La sociedad **del software** (⚠️ NO un restaurante: Google evalúa a la plataforma, igual que en su día evaluó a GoHighLevel) |
   | **Sitio web de empresa** | La web de **Balles** (la plataforma), NO la de un restaurante |
   | **Correo de contacto** | El que es **administrador de la ficha** de BACANAL |
   | **Tipo de uso** | Uso propio / gestión de negocios propios y de clientes |

   Y los dos campos de texto libre del formulario:

   - *"¿Cómo supiste que existe este formulario de acceso a la API?"* →
     `Through the official Google Business Profile API documentation
     (developers.google.com/my-business), in the prerequisites page.`
   - *"¿Cuál es el motivo principal por el que quieres acceder?"* → el texto
     en inglés del punto 3, más abajo.

3. En el campo de **descripción del uso** (el importante — es lo que un humano
   de Google va a leer), explicar en inglés algo así:

   > We operate a restaurant management SaaS used by our own restaurant group
   > and by client restaurants. Each business owner connects their own Google
   > Business Profile through OAuth. We need the API to read their reviews and
   > publish the owner's replies from within our platform, so they can manage
   > all their locations in one place instead of logging into Google for each
   > one. We do not resell data or share it with third parties.

   **Claves para que lo aprueben:** dejar claro que (a) cada dueño autoriza SU
   propia ficha por OAuth, (b) es para leer reseñas y publicar respuestas del
   propietario, y (c) no se revende ni comparte ningún dato.

4. **Guardar el correo de confirmación.** Google responde por email y puede
   pedir información adicional: hay que estar pendiente, porque si no se
   contesta, la solicitud se queda parada.

---

## Paso 2 — Activar la API (cuando Google apruebe)

En https://console.cloud.google.com/ con el proyecto `131650182388`:

1. *APIs y servicios* → *Biblioteca*.
2. Buscar y **activar** estas cuatro:
   - `My Business Account Management API`
   - `My Business Business Information API`
   - `Google Business Profile API`
   - `My Business Q&A API` *(opcional, solo si algún día se quieren preguntas
     y respuestas)*

> Antes de la aprobación estas APIs aparecen pero **dan error de cuota 0** al
> usarlas. Es normal: no están "rotas", es que aún no hay permiso.

---

## Paso 3 — Añadir el permiso a la pantalla de consentimiento

En *APIs y servicios* → *Pantalla de consentimiento de OAuth* → *Permisos*:

1. Añadir el scope: **`https://www.googleapis.com/auth/business.manage`**
2. Guardar y **volver a enviar a verificación** si Google lo pide (es un scope
   sensible, como los de Gmail que ya se pasaron en su día).

Los permisos que ya hay (Gmail, Calendar, Drive, Contacts, mapsbooking) **no se
tocan**: se añade uno más.

---

## Paso 4 — Lo que hago yo en el software

Cuando los pasos 1–3 estén hechos, el desarrollo es **un par de días**:

- Botón **"Conectar con Google"** real en Ajustes → Integraciones (con cuenta y
  pantalla de permisos, no como ahora que solo se señala el local).
- Publicación real de la respuesta en la ficha.
- **Modo goteo** como el de GHL: objetivo diario, ventana horaria (9:00–17:00) y
  espera de unos minutos antes de responder, para no parecer un robot.
- Marcar la reseña como publicada de verdad, no a mano.

---

## Mientras tanto

**GoHighLevel sigue respondiendo BACANAL con normalidad. NO apagarlo** hasta que
todo lo anterior esté funcionando y verificado aquí. Hoy GHL es lo único que
publica de verdad.

En el software, las respuestas ya se redactan solas y quedan listas: solo hay
que copiarlas y pegarlas en Google.

---

## Resumen: quién hace qué

| Paso | Quién | Cuándo |
|---|---|---|
| 1. Solicitar acceso a la API | **Iván** | **Ya — es lo que tarda** |
| 2. Activar las APIs | Iván (o yo con acceso) | Al aprobar Google |
| 3. Añadir el permiso `business.manage` | Iván (o yo con acceso) | Al aprobar Google |
| 4. Programar la publicación automática | Yo | Después del 3 |
