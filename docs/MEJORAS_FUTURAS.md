# Mejoras para el futuro

Lista viva de mejoras identificadas que **NO están hechas** y que en su momento
se decidió aplazar, con el motivo de cada aplazamiento. Ordenadas por prioridad.

Cada mejora deja claro **qué la desbloquea**: unas dependen de dinero, otras de
un trámite externo y otras solo de tiempo de desarrollo.

**Última actualización:** 17 de agosto de 2026

---

## 1. Subir Vercel al plan Pro — mirar las reseñas cada hora

> **Estado:** aplazado a propósito para ahorrar los ~20 €/mes.
> **Decisión de Iván (17-ago-2026):** de momento seguimos mirando 1 vez al día.
> **Coste:** ~20 €/mes.
> **La desbloquea:** contratar el plan. El código YA está escrito y probado.

### ⚠️ Es un ajuste GLOBAL, no algo que se configure por empresa

No hay que "dejarlo hecho" para cada empresa nueva. Es **un único interruptor
para todo el software**: el día que se contrate el plan, se cambia una línea y
**todas** las empresas pasan a mirarse cada hora a la vez — las de hoy y todas
las que entren después, sin tocar nada más.

Lo que sí está resuelto empresa a empresa (y **ya funciona hoy**) es que una
empresa nueva nazca contestando sola: los agentes IA se le crean en el alta
desde el manifiesto canónico, y la ficha de Google se conecta desde
**Ajustes → Integraciones**, junto al resto de conexiones. Eso no depende de
Vercel ni de ningún plan de pago.

### El problema

Google, en la API que usamos, **solo devuelve las 5 reseñas más recientes**. No
hay forma de pedirle más: es un tope de Google, no del software.

Nuestro sistema pasa a mirar **una vez al día**, a las 07:00. Eso significa que
entre una pasada y la siguiente **solo caben 5 reseñas nuevas**.

Si un día entran 8, cuando el sistema mire por la mañana solo verá las 5
últimas: **las otras 3 no entrarán nunca en el software y se pierden para
siempre**. Y la que se caiga puede ser justamente la de 1 estrella que más
interesaba responder.

Pasando a mirar **cada hora**, el margen sube de 5 al día a unas **120 al día**.
Es la diferencia entre ir justo y ir sobrado.

### Por qué hace falta pagar Vercel

El plan Hobby (gratuito) solo permite tareas automáticas **una vez al día**. Es
un límite del plan, no del código. De hecho, si se intenta desplegar con
frecuencia horaria, el despliegue falla con:

```
Hobby accounts are limited to daily cron jobs
```

**El trabajo técnico ya está hecho.** Cambiar la frecuencia es literalmente
editar una línea en `vercel.json`:

```jsonc
{ "path": "/api/cron/google-resenas-sync", "schedule": "0 7 * * *" }  // hoy: diario
{ "path": "/api/cron/google-resenas-sync", "schedule": "0 * * * *" }  // con Pro: cada hora
```

### Por qué de momento NO compensa

Con los números reales de hoy el riesgo es bajo:

- BACANAL: 5 reseñas. HABANA: 17. Es un goteo de semanas, no decenas al día.
- **GoHighLevel sigue capturando BACANAL en paralelo**, así que ahí hay red de
  seguridad.

### ⚠️ Cuándo deja de ser opcional

**El día que se apague GoHighLevel.** En ese momento el software será lo único
que recoge las reseñas y ya no habrá red de seguridad: un pico de reseñas en un
día se traduce en reseñas perdidas sin remedio.

También conviene revisarlo si aparece un pico real: una mesa grande que reseñe a
la vez al salir, o una campaña que empuje reseñas.

**Ojo al balance:** si se migra de GHL al software, este plan Pro sale gratis en
la práctica — se deja de pagar GHL, que cuesta bastante más de 20 €/mes.

### Aviso automático ya activo

No hace falta vigilarlo a mano. El sistema **ya avisa solo** cuando detecta que
un día se llenó el cupo de 5 reseñas de una vez (señal de que probablemente se
perdió alguna). El aviso llega al área administrativa con enlace a
`/calidad/resenas`.

**Si ese aviso empieza a aparecer, es la señal de contratar Pro.**

---

## 2. Publicar las respuestas de reseñas en Google automáticamente

> **Estado:** pendiente de un trámite con Google.
> **Coste:** **gratis** — Google no cobra por esta API.
> **La desbloquea:** una solicitud de acceso que presenta **el software una sola
> vez, para toda la plataforma**. Tarda **semanas** en aprobarse.

### ⚠️ Importante: es UN trámite para todo el software, no uno por empresa

Es exactamente lo que hizo GoHighLevel en su día: GHL pidió el permiso **una
vez, para su plataforma entera**. Por eso a Iván le "responde solo" sin haber
pedido nada — él únicamente pulsó "conectar con Google" y aceptó la pantalla de
permisos sobre su ficha. El trámite pesado ya lo tenían ellos hecho.

Balles-Hosteleros es la plataforma, igual que GHL. Así que:

- **El trámite se hace UNA vez**, no por empresa ni por ficha.
- Una vez aprobado, **cualquier empresa nueva solo pulsa "conectar con Google" y
  acepta** — igual que hizo Iván en GHL. Sin trámites, sin esperas y sin
  necesidad de saber nada técnico.

Hoy la IA **redacta sola** la respuesta de cada reseña, pero **no la publica**:
alguien la copia, la pega en la ficha de Google y vuelve a marcarla como
publicada.

El motivo es que el software lee con la **Places API**, que es de solo lectura y
no tiene ningún método para escribir respuestas. Publicar exige la **Google
Business Profile API**, que es otra distinta — la misma que usa GoHighLevel, y
por eso GHL sí puede responder solo.

**No es caro: es lento.** Hay que rellenar una solicitud, explicar el uso y
esperar aprobación de Google. El desarrollo posterior son un par de días.

**Conviene empezar el trámite cuanto antes precisamente porque tarda.**

Detalle completo en
[RESENAS_GOOGLE_PARA_IVAN_migracion_desde_ghl.md](./RESENAS_GOOGLE_PARA_IVAN_migracion_desde_ghl.md).

---

## 3. Completar el pie de página del agente "2 o menos"

> **Estado:** falta un dato.
> **Coste:** ninguno.
> **La desbloquea:** que Iván confirme el correo de calidad.

El pie de las respuestas a reseñas negativas se copió de GoHighLevel, pero en la
captura estaba **cortado**: falta el correo de calidad del final.

Está marcado con un `TODO` en `src/lib/seeds/resenas-agentes-ia.ts`. En cuanto
se confirme el correo, se completa y se propaga a todas las empresas.

---

## 4. Cuota de Gemini (plan gratuito)

> **Estado:** no molesta hoy. Vigilar.
> **Coste:** el plan de pago de Gemini, si algún día hiciera falta.

El plan gratuito de Gemini permite **20 peticiones por minuto**. Al generar de
golpe los 22 borradores atrasados se alcanzó ese tope y hubo que espaciarlos.

**No es un error del software** y se recupera solo en unos 30 segundos. Solo
sería un problema real si algún día entraran muchísimas reseñas a la vez.

---

## 5. Definir el onboarding de empresa nueva

> **Estado:** sin definir. Existe el andamiaje (PRP-067) pero no la decisión.
> **Coste:** ninguno.
> **La desbloquea:** decidir con Iván, de una vez y en conjunto, qué es
> obligatorio para que el sistema empiece a funcionar bien.

Hay 8 pasos montados (Locales, Puestos, Empleados, Imagen de marca…), pero
**Iván todavía no ha definido qué debe ser obligatorio**. La decisión se tomará
de una vez, mirando el conjunto — no añadiendo pasos sueltos según van
surgiendo.

Criterio que se viene aplicando: **es obligatorio si, al faltar, algo que el
cliente da por hecho deja de funcionar sin avisar de nada.**

Candidatos ya detectados que rompen en silencio:

- **Ficha de Google** — sin vincular no entra ninguna reseña, así que los
  agentes IA no tienen nada que contestar. Ya se puede conectar desde
  Ajustes → Integraciones, pero nada obliga a hacerlo.
- **Imagen de marca (logo)** — ya es obligatorio. Sin logo, todos los correos
  de la empresa (nóminas, contratos, candidatos, proveedores) salen sin
  cabecera de marca.

---

## Cómo usar este documento

Cuando aparezca una mejora que se decide aplazar, **añadirla aquí con el
motivo** en vez de dejarla solo en la conversación. Así no se pierde y se puede
retomar sabiendo por qué se aparcó.
