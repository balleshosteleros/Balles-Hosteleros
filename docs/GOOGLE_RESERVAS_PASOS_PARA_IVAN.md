# Botón «Reservar» de Google — pasos para activarlo

> **Qué es:** que la gente reserve mesa **dentro de Google Maps y de la
> búsqueda de Google**, sin salir de ahí y sin pagar comisión a nadie.
> No es lo mismo que el permiso de reseñas: son dos trámites distintos con
> Google. Este es el de reservas.

---

## Resumen en una línea

**El software ya está terminado y esperando.** Lo único que falta es que Google
nos acepte como partner de reservas. Eso se pide con un formulario y lo aprueba
una persona de Google.

---

## Lo que YA está hecho (no hay que volver a hacerlo)

- ✅ **El programa entero.** Google puede consultar nuestros huecos, crear la
  reserva, modificarla y cancelarla. Está probado.
- ✅ **Los dos restaurantes ya están identificados ante Google:**

  | Restaurante | Ficha de Google conectada |
  |---|---|
  | BACANAL | ✅ Sí |
  | HABANA | ✅ Sí |

- ✅ **La reserva de Google respeta las mesas de verdad.** Si no hay mesa libre,
  Google no la vende. No puede haber overbooking.
- ✅ **El cliente recibe su correo de confirmación** igual que si reservara por
  la web.
- ✅ **Cuando abras un restaurante nuevo, no hay que tocar nada:** basta con
  conectar su ficha de Google desde Ajustes y entra solo.

---

## Lo que falta: 3 pasos

### Paso 1 — Enviar el formulario a Google

**Enlace del formulario:**
https://services.google.com/fb/forms/reservationsappointmentsonlinebooking-interestform/

**⚠️ Envíalo desde `balleshosteleros@gmail.com`.**

Esto es importante. La solicitud del permiso de reseñas se intentó dos veces y
**las dos murieron en silencio** (casos `8-0006000041312` y `9-5913000041388`),
seguramente porque se envió desde un buzón que nadie miraba. Google contesta por
correo, y si pide un dato más y nadie responde, la solicitud se cierra sola sin
avisar.

**Datos que te va a pedir, ya preparados para copiar:**

| Campo | Qué poner |
|---|---|
| Empresa | Balles Hosteleros |
| Web | `https://software.balleshosteleros.com` |
| País | España |
| Sector | Restaurantes |
| Tipo de integración | Reservas de restaurante (end-to-end) |
| Nº de locales | 2 (BACANAL y HABANA) |
| ¿Software propio o de terceros? | Propio |

Si pregunta si somos el restaurante o un proveedor de software: **las dos
cosas** — tenemos software propio y lo usamos en nuestros propios locales.

**Apunta el número de caso que te dé Google** y añádelo abajo en este documento.

---

### Paso 2 — Cuando Google conteste

Google manda unas credenciales (un usuario de subida de archivos y una clave).
**No hay que entender nada de eso: me las pasas y yo las pongo.**

Son 9 datos que van en la configuración del servidor. Cinco minutos.

---

### Paso 3 — Encender el canal

Una vez puestas las credenciales, se enciende un interruptor y el canal arranca
solo. Al día siguiente ya se ve en Ajustes → Canales → Reserve with Google →
Ver panel si Google está recibiendo bien los huecos.

---

## ⚠️ Un aviso sobre el plan de Vercel

Google necesita saber los huecos libres **cada pocos minutos**, o venderá mesas
que ya están ocupadas.

El programa está configurado para avisarle cada 5 minutos, pero **eso requiere
que Vercel esté en plan de pago**. En el plan gratuito solo permite avisar una
vez al día — y con eso Google trabajaría todo el servicio con la disponibilidad
de las 2 de la mañana.

**Antes de encender Google hay que confirmar que el plan de Vercel es de pago.**
Si no lo es, mejor no activarlo todavía.

---

## Registro del trámite

| | |
|---|---|
| **Formulario enviado el** | ⏳ pendiente |
| **Nº de caso de Google** | ⏳ pendiente |
| **Estado** | ⏳ sin enviar |

*(Rellenar en cuanto se envíe, para que no pase como con las reseñas.)*

---

## Y mientras tanto — Instagram y Facebook ya funcionan

Google tarda porque depende de ellos. **Instagram y Facebook no dependen de
nadie y ya están activables hoy** desde Ajustes → Canales.

Ojo con una cosa, porque suele malentenderse: **Meta no deja reservar dentro de
Instagram ni de Facebook**. No existe forma de hacerlo — ni nosotros ni
CoverManager ni TheFork pueden. Lo que sí se puede, y es lo que hacen todos, es
poner un botón «Reservar» en el perfil que abre tu página de reservas.

La ventaja real es que **cada reserva queda marcada con su canal**, así sabes
cuántas mesas te trae Instagram de verdad.

Está explicado paso a paso dentro del propio programa, en cada canal.
