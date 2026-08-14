# Reseñas de Google — migración desde GoHighLevel

**Fecha:** 15 de agosto de 2026
**Decisión de Iván:** migrar la respuesta automática de reseñas desde GHL a Balles-Hosteleros.

---

## Por qué GHL sí publica solo y nuestro software no (todavía)

No es un problema del código. Es un permiso de Google que GHL tiene y nosotros no
hemos pedido.

| | GoHighLevel | Balles-Hosteleros (hoy) |
|---|---|---|
| API que usa | Google **Business Profile** API | Google **Places** API |
| Permiso de Google | Concedido (lo pidieron hace años) | No solicitado |
| ¿Puede leer reseñas? | Sí | Sí (las 5 más recientes) |
| ¿Puede **escribir** la respuesta? | **Sí** | **No — esa API no tiene método de escritura** |

La Places API es la pública de solo lectura, la misma que alimenta el mapa de
Google Maps. Sirve para leer, pero no existe en ella ninguna forma de publicar
una respuesta. Es la diferencia entre leer un periódico y poder publicar en él:
para escribir hay que estar acreditado.

El código para publicar es poco trabajo (un par de días). **El cuello de botella
es la aprobación de Google: semanas.** No depende de nosotros.

---

## Lo que YA quedó funcionando hoy (15-ago-2026)

### 1. Los agentes IA, que era el fallo real

El software tenía el motor de IA bien construido, pero **cero agentes creados**
en ninguna empresa. Un agente define a qué estrellas aplica, con qué tono y en
qué idioma responde. Sin agente, el sistema mira la reseña, no encuentra quién
la cubra y la salta. Por eso BACANAL y HABANA acumulaban **22 reseñas sin
contestar** desde que se activó la sincronización.

Se han creado los **dos agentes exactos que Iván ya tenía en GHL**, copiando sus
instrucciones literales para que el software responda con la misma voz:

- **"3 o mas"** → 3, 4 y 5 estrellas. Tono cordial. Agradece y se despide.
- **"2 o menos"** → 1 y 2 estrellas. Tono cordial, muy empático, pide disculpas.
  Con las tres reglas duras de Iván: **nunca ofrecer devolución del dinero**,
  nunca comprometer decisiones propias, y no firmar con nombre ni empresa.

Viven en el manifiesto canónico `src/lib/seeds/resenas-agentes-ia.ts`, así que
**toda empresa nueva nace con ellos** y contesta sola desde el primer día. Es
aditivo: si un cliente personaliza su agente, no se le pisa.

### 2. Bug corregido: reseñas que se quedaban huérfanas para siempre

El cron solo generaba borradores cuando entraban reseñas **nuevas**. Efecto: una
reseña que llegara mientras no había ningún agente creado se quedaba sin
borrador **para siempre** — al día siguiente ya no contaba como nueva y nadie
volvía a mirarla. Así se acumularon las 22. Ahora el cron redacta el borrador de
toda reseña que no tenga uno, sin importar cuándo entró.

### 3. Endurecidas las reglas de redacción (prevención)

Se revisó una a una la calidad de las respuestas generadas. **Ninguna se
inventó hechos**: cuando una respuesta menciona un detalle (por ejemplo, salir
"con la garganta destrozada de gritar"), ese detalle está escrito literalmente
en la reseña original de la clienta.

Aun así se han endurecido las reglas como prevención, porque una respuesta se
publica en la ficha pública del restaurante y ahí un adorno inventado sería lo
más grave que podría pasar:

- Prohibición explícita de añadir hechos, consecuencias o síntomas que el
  cliente no haya escrito, aunque parezcan deducirse.
- Temperatura del modelo bajada de 0,7 a 0,4: menos libertad creativa, texto
  más pegado a lo que dice la reseña.
- Saludo con el **nombre de pila**, no con nombre y apellidos (antes escribía
  "Blanca López Muñoz", ahora "Blanca").

### 4. La tabla, versionada

`resenas_agentes_ia` existía en producción pero **nunca tuvo migración en el
repo**: se creó a mano. Una instalación limpia se rompía al llegar al módulo.
Ya está escrita en `supabase/migrations/`.

---

## Lo que queda pendiente

### A) Publicación automática en Google — bloqueado por Google (semanas)

Pasos, en orden:

1. **Solicitar acceso a la Google Business Profile API.** Lo tiene que pedir
   Iván como propietario de las fichas. Google revisa y aprueba (o pide más
   información). Es el paso lento.
2. Configurar el OAuth de Google Business en el software.
3. Conectar cada ficha (BACANAL, HABANA) autorizando al software, igual que en
   su día se autorizó a GHL.
4. Implementar la publicación real + el **modo goteo** de GHL (objetivo diario,
   ventana horaria 9:00–17:00, espera de 5 min antes de responder para no
   parecer un bot).

**Mientras tanto GHL sigue respondiendo BACANAL con normalidad, así que no hay
ni un día descubierto.** No apagar GHL hasta que el punto 4 esté verificado.

### B) Riesgo de perder reseñas — decisión de Iván (~20 $/mes)

Google devuelve solo las **5 reseñas más recientes** y nuestro cron pasa **una
vez al día**. Si un día entran más de 5, **las que sobran se pierden para
siempre**. Con 17 reseñas acumuladas en HABANA, el riesgo es real.

La solución (cron cada hora, que sube el margen a ~120/día) ya está escrita y
probada en el código. Solo hace falta **pasar el plan de Vercel de Hobby a Pro**,
porque Hobby únicamente admite crons diarios. Es cambiar una línea en
`vercel.json` una vez contratado.

### C) Cuota de Gemini (gratuita: 20 peticiones/minuto)

Al generar 22 borradores de golpe se agotó la cuota del plan gratuito. No es un
error del software: se recupera solo. Pero si algún día entran muchas reseñas a
la vez, conviene tener en cuenta que el plan gratuito limita el ritmo.

### D) Pie de página del agente "2 o menos" — falta un dato

En la captura de GHL el pie estaba cortado. Falta el **correo de calidad** del
final. Está marcado con un `TODO` en el seed para completarlo en cuanto Iván lo
confirme.

---

## Resumen para decidir

| Punto | Estado | Depende de |
|---|---|---|
| Agentes IA creados y propagados | ✅ Hecho | — |
| Borradores de las 22 reseñas | ✅ Hecho | — |
| Empresa nueva contesta desde el día 1 | ✅ Hecho | — |
| Enlazar ficha de Google (empresa nueva) | ✅ Ya funcionaba | — |
| Publicar en Google sin humano | ⏳ Pendiente | **Aprobación de Google (semanas)** |
| No perder reseñas en días punta | ⏳ Pendiente | **Vercel Pro (~20 $/mes)** |
| Correo de calidad en el pie | ⏳ Pendiente | **Dato de Iván** |
