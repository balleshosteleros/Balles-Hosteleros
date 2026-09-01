# PRP-083 — WhatsApp y SMS: avisos de reserva y monedero prepago

**Estado:** PROPUESTO — pendiente de aprobación
**Fecha:** 2026-09-02
**Objetivo:** que los avisos de reserva lleguen por WhatsApp con enlace de
cancelar a mano, que haya SMS de respaldo, y que cada restaurante lo pague por
adelantado desde un monedero de saldo dentro del software

---

## 1. Por qué

Hoy los avisos de reserva salen solo por correo. El correo se pierde entre
otros veinte, se va a promociones, y el cliente no lo ve. Resultado: mesas que
no se reconfirman y no-shows que nadie avisó porque cancelar costaba una
llamada.

WhatsApp se lee. Y si el enlace de cancelar está a un toque, el cliente que no
va a venir avisa — y la mesa se revende.

A futuro abre la otra puerta: **campañas de pago a la base de clientes**. Ese
es el motivo real de montarlo bien y no con un apaño.

---

## 2. Decisiones de Iván (2-sep-2026)

| Punto | Decisión |
|---|---|
| Proveedor | **Twilio** para WhatsApp y SMS. No por precio (pierde), sino porque da soporte al restaurante que se atasca y permite subcuentas |
| Modelo de cuenta | **Una sola cuenta de Twilio, nuestra**, con **subcuenta por restaurante**. El restaurante nunca ve Twilio |
| Quién paga | El restaurante, **por adelantado**, desde un **monedero de saldo** en el software |
| Reparto de canales | **WhatsApp primero; SMS solo si WhatsApp falla**. Si no hay saldo, cae a **correo** |
| Números | eSIM propias, ya disponibles — **pendiente confirmar que no están usadas en WhatsApp** (§9) |
| Avisos por WhatsApp | Confirmación, reconfirmación, recordatorio y cancelación. **La valoración se queda solo en correo** |

**Por qué la valoración no va por WhatsApp:** pedir opinión por WhatsApp quema
el canal y sube las bajas. El correo para eso ya funciona.

---

## 3. Lo que ya existe y se reutiliza

No se construye de cero casi nada. Lo que hay:

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Teléfono del cliente | `reservas.cliente_telefono` | El destinatario, ya guardado |
| Enlace de cancelar | `reservas.cancelacion_token` | El mismo enlace del correo vale tal cual |
| Cron de avisos | `src/app/api/cron/reservas-recordatorios/route.ts` | Ya decide QUIÉN y CUÁNDO |
| Mailer de reservas | `src/lib/email/reservas/mailer.ts` | El patrón a imitar: carga reserva, compone, envía, audita |
| Histórico de envíos | `reserva_email_envios` | El modelo de auditoría |
| Cobro con tarjeta | `src/app/api/revolut/webhook/route.ts` | El patrón de webhook de pago |
| Cifrado de claves | `revolut-config-actions.ts` (`encrypt`/`decrypt`) | Para las credenciales de Twilio |
| Notificaciones | `src/features/notificaciones/` | Los avisos de saldo bajo |
| Tope de gasto | Patrón del tope de IA | El límite mensual por empresa |

---

## 4. El nudo: cobrar el saldo

**Revolut NO sirve para esto.** La integración actual es del restaurante, para
que él cobre a sus clientes. Aquí es al revés: **nosotros le cobramos a él**.

Hacen falta cobros a nuestra cuenta, no a la suya. Dos caminos:

- **A) Pasarela propia nuestra** (Revolut/Stripe a nombre de Balles Hosteleros).
  Cobra el software al restaurante. Es lo correcto y lo que este PRP asume.
- **B) Recarga manual**: el restaurante transfiere y nosotros abonamos el saldo
  a mano desde el panel de admin. Sirve de arranque con pocos clientes.

**Propuesta: empezar por B y montar A en la fase 4.** Con dos restaurantes
propios, la recarga manual basta y no bloquea nada. Pero la tabla de saldo se
diseña ya pensando en A para no rehacerla.

> **Fiscal:** vender saldo prepago nos convierte en revendedores. Tiene
> implicaciones de IVA que hay que confirmar con la gestoría antes de facturar
> el primer euro a un cliente externo. No bloquea el desarrollo.

---

## 5. Modelo de datos

### 5.1 `empresa_mensajeria_config`
Un registro por empresa. Estado de la conexión y ajustes.

- `empresa_id` (PK, FK empresas)
- `twilio_subaccount_sid` / `twilio_auth_token_cifrado` — **cifrado**
- `whatsapp_numero`, `whatsapp_sender_id`
- `estado_alta`: `SIN_CONECTAR` | `PENDIENTE_VERIFICACION` | `ACTIVO` | `SUSPENDIDO`
- `whatsapp_activo`, `sms_activo` (booleanos, master de cada canal)
- `sms_fallback_activo` — si el SMS entra cuando WhatsApp falla
- `avisos_activos` (jsonb) — qué tipos salen por WhatsApp
- `tope_mensual_cents` — límite de gasto, nulo = sin tope
- `recarga_auto_activa`, `recarga_auto_umbral_cents`, `recarga_auto_importe_cents`

### 5.2 `empresa_mensajeria_saldo`
El monedero. **Una fila por empresa, el saldo es un campo**, no una suma de
movimientos: evita recálculos y condiciones de carrera.

- `empresa_id` (PK)
- `saldo_cents` (integer, **nunca negativo** — CHECK)
- `aviso_saldo_bajo_enviado_at`, `aviso_saldo_cero_enviado_at`

### 5.3 `empresa_mensajeria_movimientos`
El extracto. Solo escritura, nunca se edita.

- `id`, `empresa_id`
- `tipo`: `RECARGA` | `CONSUMO` | `AJUSTE` | `DEVOLUCION`
- `importe_cents` (positivo suma, negativo resta)
- `saldo_despues_cents` — foto del saldo tras el movimiento
- `concepto`, `mensaje_id` (FK al envío que lo generó), `usuario_id`
- `creado_at`

### 5.4 `mensajeria_envios`
Hermano de `reserva_email_envios`. Todo lo que sale por WhatsApp o SMS.

- `id`, `empresa_id`, `reserva_id` (nullable — las campañas no llevan reserva)
- `canal`: `WHATSAPP` | `SMS`
- `tipo`: `CONFIRMACION` | `RECONFIRMACION` | `RECORDATORIO` | `CANCELACION` | `CAMPANA`
- `destinatario` (teléfono en E.164)
- `estado`: `PENDIENTE` | `ENVIADO` | `ENTREGADO` | `LEIDO` | `FALLIDO`
- `twilio_sid`, `error_codigo`, `error_mensaje`
- `coste_cents` — lo cobrado al restaurante
- `origen`: `MANUAL` | `AUTOMATICO` | `PORTAL_PUBLICO`
- `usuario_id`, `enviado_at`, `actualizado_at`

### 5.5 `mensajeria_tarifas`
Precio de venta al restaurante. **Configurable, no cableado.**

- `canal`, `precio_cents`, `vigente_desde`

Precios de partida: **WhatsApp 5 céntimos, SMS 10 céntimos**. Números limpios,
margen holgado sobre el coste real (~3-4 c.), y absorben subidas de Meta sin
tocar nada.

**RLS:** todas por `empresa_id`, con el filtro explícito de empresa activa —
la RLS acota a las empresas DEL usuario, no a la ACTIVA.

---

## 6. Arquitectura del envío

Módulo nuevo `src/lib/mensajeria/`, hermano de `src/lib/email/`:

```
src/lib/mensajeria/
├── proveedor.ts          # Interfaz: enviarWhatsapp() / enviarSms()
├── twilio.ts             # Implementación Twilio
├── enviar.ts             # Orquestador: saldo → canal → cobro → auditoría
├── plantillas.ts         # Textos por tipo de aviso
└── saldo.ts              # Reserva y cobro de saldo (transaccional)
```

**`proveedor.ts` es la clave:** el proveedor queda intercambiable. Si mañana
compensa Meta directo, se escribe `meta.ts` y se cambia una línea. No se
rehace el módulo.

### El flujo de un aviso

1. ¿Canal activo y este tipo de aviso encendido? Si no → solo correo
2. ¿Hay teléfono válido (E.164)? Si no → solo correo
3. ¿Hay saldo y no se superó el tope? Si no → **correo + aviso al restaurante**
4. **Reservar el saldo** (descontar antes de enviar, no después)
5. Enviar por WhatsApp
6. Si falla y el respaldo está activo → SMS (nuevo cobro de saldo)
7. Si todo falla → **devolver el saldo reservado** y salir por correo
8. Escribir el envío en `mensajeria_envios`

**El orden importa:** se cobra antes de enviar. Si el envío falla, se devuelve.
Al revés se puede enviar sin cobrar y perder dinero.

### Estado de entrega

Webhook nuevo en `src/app/api/twilio/webhook/route.ts`. Twilio avisa de
entregado, leído o fallido; se actualiza `mensajeria_envios`.
**Firma verificada** con el token de la subcuenta, como el de Revolut.

---

## 7. El alta del restaurante

El punto que decide si esto se puede vender. Un dueño de restaurante no sabe
qué es Meta y no va a pelearse con su panel.

**Embedded Signup:** en `Reservas → Configuración → Comunicaciones` aparece
"Conectar WhatsApp". Se abre una ventana de Meta encima de la pantalla donde:

1. Inicia sesión en Meta (o crea la cuenta ahí mismo)
2. Mete su número
3. Recibe el código y lo teclea

Vuelve y pone **"WhatsApp conectado"**. Lo demás — crear la subcuenta de
Twilio, dar de alta el número, enviar las plantillas a aprobación — lo hacemos
nosotros por debajo.

**Lo que no se puede esconder, y cómo se cuenta:**

- Va a ver una pantalla de Meta pidiendo sesión. Se avisa antes con una frase
  clara: *"WhatsApp pertenece a Meta, así que te pedirá iniciar sesión. Si no
  tienes cuenta, la creas ahí mismo en un minuto."* Esperado no asusta.
- La verificación de empresa (CIF) tarda días y depende de Meta. El software
  **muestra en qué punto está** — enviada, aprobada, faltan documentos. La
  incertidumbre es lo que genera llamadas, no la espera.

### Plantillas de Meta

Cada tipo de aviso es una plantilla que Meta aprueba una a una. Se registran de
fábrica, iguales para todas las empresas, con variables: nombre, fecha, hora,
personas, restaurante y **enlace de cancelar**.

Fuera de las 24 h desde el último mensaje del cliente **solo se puede escribir
por plantilla aprobada**. Es exactamente el carril de las campañas futuras.

---

## 8. Interfaz

### Reservas → Configuración → Comunicaciones
La pestaña que ya existe gana una sección de WhatsApp y SMS: estado de la
conexión, botón de conectar, interruptores por canal y por tipo de aviso, y el
respaldo por SMS.

### Ajustes → Monedero de mensajería
Vista nueva: saldo grande y claro, botón de recargar, avisos de saldo bajo,
recarga automática, tope mensual y el extracto de movimientos.

**Móvil:** ningún botón de configuración — solo ordenador, como marca la norma.

### Ficha de reserva
`HistoricoEmailsReserva` pasa a mostrar también WhatsApp y SMS: qué salió, por
dónde, cuándo y si se entregó. Se renombra a `HistoricoComunicaciones`.

---

## 9. Riesgos

| Riesgo | Cómo se trata |
|---|---|
| **Las eSIM ya están en WhatsApp** | **Pendiente de confirmar.** Migrar un número que está en la app del móvil **borra ese WhatsApp**. Es de ida. Verificar ANTES de la fase 3 |
| eSIM que caduca | El número debe seguir activo o la conexión se cae. Si son prepago de viaje, revisar caducidad |
| Meta tarda en verificar | Se puede enviar antes con límite bajo. El software muestra el estado |
| Restaurante sin saldo a mitad de servicio | Los avisos **siguen saliendo por correo**. Se degrada el canal, no el servicio. Las campañas sí se bloquean |
| Gasto descontrolado | Prepago + tope mensual configurable. Sin saldo no sale nada |
| Meta bloquea el número | Solo plantillas aprobadas y nunca fuera de las 24 h sin plantilla |
| IVA del saldo prepago | Confirmar con la gestoría antes de facturar a un cliente externo |

---

## 10. Fases

**Fase 1 — Monedero.** ✅ HECHA. Tablas de saldo, movimientos y tarifas con RLS. Vista de
Ajustes con saldo y extracto. Recarga manual desde admin. Avisos de saldo bajo.
*Cierra cuando:* se puede abonar saldo a una empresa y verlo en el extracto.

**Fase 2 — Motor de envío.** ✅ HECHA. `src/lib/mensajeria/` con el proveedor
intercambiable, el orquestador con reserva y devolución de saldo, tabla de
envíos y webhook de estado.
*Cierra cuando:* se envía un WhatsApp de prueba, se descuenta el saldo y consta
el estado de entrega.

**Fase 3 — Avisos de reserva.** ✅ HECHA (código). Enganche al cron y a la
confirmación al reservar. Textos de WhatsApp y SMS. Enlace corto `/c/<codigo>`
para que el SMS quepa en uno solo. Histórico unificado en la ficha.
Plantillas documentadas en `docs/plantillas-whatsapp-reservas.md`.
*Pendiente para que funcione:* dar de alta las 4 plantillas en Meta y poner sus
identificadores en el entorno; eSIM confirmadas y credenciales de Twilio.

**Fase 4 — Alta autoservicio.** Embedded Signup, creación automática de
subcuenta, estado de verificación en pantalla, y pasarela propia para que el
restaurante recargue con tarjeta.
*Cierra cuando:* un restaurante ajeno se conecta y recarga solo, sin ayuda.

**Fase 5 — Campañas.** Envío masivo a la base de clientes con plantilla de
marketing, cobro del saldo por adelantado, segmentación y métricas.
*Cierra cuando:* se manda una campaña con coste conocido antes de enviarla.

**Las fases 1 y 2 no dependen de las claves de Twilio ni de las eSIM.** Se
pueden hacer ya.

---

## 10.bis Hallazgo de la fase 3

Ya existía `src/features/marketing/services/whatsapp-service.ts`: un envío de
campañas contra **Meta directo**, escrito antes de este PRP. **Nunca ha
funcionado** — sus variables de entorno están vacías, así que
`isWhatsAppConfigured()` siempre devuelve false y no ha salido ni un mensaje.

No se ha tocado: borrarlo o migrarlo es trabajo de la fase 5, cuando las
campañas se hagan de verdad. Entonces habrá que decidir si se unifica con este
motor (recomendado: un solo camino, un solo sitio donde mirar cuando falle) o
si las campañas siguen por su lado.

Mientras tanto conviven sin estorbarse: uno manda avisos de reserva y el otro
está apagado.

---

## 11. Lo que hace falta de Iván

1. **Confirmar que las eSIM no están usadas en WhatsApp** — bloquea el encendido
2. **Cuenta de Twilio a nombre de Balles Hosteleros** (no de los restaurantes)
3. **Validar los precios de venta:** WhatsApp 5 c., SMS 10 c.
4. **Dar de alta las 4 plantillas en Meta** (texto listo en
   `docs/plantillas-whatsapp-reservas.md`) y pegar sus identificadores
5. **Confirmar con la gestoría** el IVA del saldo prepago (antes de la fase 4)
