# PRP-082 — Políticas de tarjeta: cancelación y garantía

**Estado:** PROPUESTO — pendiente de aprobación
**Fecha:** 2026-09-01
**Objetivo:** que una reserva que cumple ciertas condiciones exija tarjeta al
cliente, y que el restaurante pueda cobrarle desde el software si no aparece

---

## 1. Por qué

Hoy un grupo de 12 reserva un sábado, no aparece, y el restaurante pierde la
mesa entera sin poder reclamar nada. La política de cancelación que ya existe
**avisa** de un cargo, pero no recoge ninguna tarjeta: es un texto en un
correo, no una garantía.

Lo que falta es la pieza que lo convierte en real: que el cliente deje su
tarjeta al reservar, y que el restaurante pueda ejecutar el cobro cuando el
cliente no se presenta.

---

## 2. Las dos políticas: en qué se diferencian

Ambas piden tarjeta. La diferencia es **qué se hace con ella**, y de ahí sale
todo lo demás:

| | **Política de cancelación** | **Política de garantía** |
|---|---|---|
| Qué hace con la tarjeta | La **guarda** para cobrar después | **Retiene** el importe por adelantado |
| ¿Aparta dinero del cliente? | No | Sí, queda bloqueado en su cuenta |
| Si el cliente no aparece | Se le cobra… **si tiene saldo** | Se captura lo retenido: **el dinero ya está** |
| ¿Puede fallar el cobro? | **Sí**: sin fondos, tarjeta cancelada… | No: por eso se retuvo |
| ¿Caduca? | **No** (Revolut no documenta caducidad) | **Sí**: 5 días con Visa en restaurante |
| Antelación máxima | Cualquiera | La tarjeta se pide **4 días antes** (§5.4) |
| Rigor | Más laxa | **Más estricta** |

**Cuándo usar cada una.** La de cancelación cubre el caso normal: disuade y
casi siempre cobra. La de garantía es para lo que no se puede permitir fallar
—Nochevieja, un reservado, un grupo de 20— donde hace falta la certeza de que
el dinero está.

**Pueden convivir en la misma reserva.** Son marcas independientes, así que un
grupo grande en Nochevieja puede llevar las dos.

En Revolut son dos mecanismos distintos: la cancelación guarda el método de
pago (`savePaymentMethodFor: "merchant"`, cobro posterior off-session) y la
garantía crea una orden con `capture_mode: "manual"`.

---

## 3. Decisiones de Iván (1-sep-2026)

| Punto | Decisión |
|---|---|
| Modelo | La garantía es una **marca independiente**: una reserva puede llevar garantía y política de cancelación a la vez |
| Disparo | **Automático** por condiciones configurables (fechas, días, personas, zonas/mesas) |
| Tarjeta | **Se pide al cliente** en el paso siguiente a elegir mesa, antes de que la reserva quede confirmada |
| Cobro | **Se ejecuta desde el software**, contra la tarjeta retenida, cuando el cliente no aparece |
| Dónde | **En la ficha de la reserva, junto al "Tipo de reserva"**: ahí se ve el estado de la garantía y desde ahí se cobra |
| Pasarela | **Revolut**, que ya está integrada para los Tickets (PRP-078) |
| Aviso | El correo de confirmación dice el importe retenido |
| Reservas lejanas | Si faltan **más de 4 días**, la tarjeta NO se pide al reservar: se pide **4 días antes**, y hay **24 h** para ponerla o la reserva se cancela |
| Cobro fallido | En la **cancelación**, si falla por falta de fondos se **reintenta solo, una vez al día**, hasta un tope configurable (§5.5) |
| Aviso en Sala | Al entrar en **Reservas** sale un aviso con lo que necesita atención: cobros pendientes, retenciones por caducar y garantías sin tarjeta (§5.6) |
| No-show / cancelada | Al marcar una reserva con tarjeta, el software **avisa de que hay que cobrar** — siempre en no-show, y en cancelada solo si se pasó del plazo (§5.7) |
| Cancelación del cliente | Si cancela por su cuenta **fuera de plazo**, se le cobra **automáticamente**, sin que nadie tenga que hacer nada (§5.7) |
| Correo del cobro | **Nunca se avisa al cliente de un cobro que no se ha ejecutado.** Si el cobro falla, no sale correo (§5.7) |

### Lo que ya está hecho (commit `8afdcc79`)

La configuración de las dos políticas, cada una con su interruptor de
activar/desactivar, y la baja del sistema de "políticas custom" que nunca se
usó. Este PRP construye encima.

---

## 4. La parte legal que condiciona el diseño

**Los números de la tarjeta no pueden tocar nuestro servidor.** Recogerlos en
un formulario propio exige certificación PCI-DSS, que no tenemos ni queremos.

Lo que se guarda es un **identificador que devuelve Revolut** (un token). Con
él se puede ejecutar el cobro desde el software —que es lo que se quiere— sin
almacenar jamás un número de tarjeta. Es exactamente cómo retiene un hotel.

El formulario de tarjeta lo pinta Revolut, no nosotros.

### Preautorización, no cobro

Revolut cobra al instante en los Tickets (`capture_mode: "automatic"`). Una
garantía es distinta: **retiene sin cobrar**, y el dinero solo se mueve si el
cliente no aparece. Endpoints verificados:

| Acción | Endpoint |
|---|---|
| Retener | `POST /api/orders` con `capture_mode: "manual"` |
| Cobrar | `POST /api/orders/{id}/capture` |
| Liberar | `POST /api/orders/{id}/cancel` (devuelve el dinero al instante) |

Los últimos 4 dígitos de la tarjeta llegan en `payment_method.last_four` (con
guion bajo, no `last4`) junto a `brand`.

⚠️ **Caducidad de la retención — datos verificados en la documentación de
Revolut (1-sep-2026).** Una preautorización no dura para siempre, y el plazo lo
fija la RED DE LA TARJETA según el código de comercio (MCC), no Revolut:

| Tarjeta | Plazo en un restaurante (MCC 5812) |
|---|---|
| **Visa** | **5 días** · NO extensible |
| **Mastercard** (pre-auth) | 30 días · extensible |
| Maestro | 7 días · no extensible |

Los 30 días de Visa existen solo para hoteles (MCC 7011) y alquiler de
vehículos. Un restaurante no entra en esa categoría.

**Manda el caso peor: 5 días (Visa).** Por eso la tarjeta se pide **4 días
antes**, no 5: la propia documentación recomienda capturar al menos 24 h antes
del vencimiento, así que ese día de colchón evita quedarse sin margen si algo
se retrasa.

⚠️ **La fuente autoritativa no es esta tabla, sino el campo `capture_deadline`
que Revolut devuelve en cada orden**, calculado para la tarjeta concreta del
cliente. Hay que guardarlo y respetarlo: si dice menos de lo esperado, manda él.

Fuente: developer.revolut.com → *clearing-windows* y *pre-authorisation*.

---

## 5. Cómo funciona

### 5.1 Condiciones (Configuración → Reservas → Políticas)

**Cada política tiene su propio juego de condiciones**, con los mismos ejes.
Así se puede pedir cancelación a partir de 6 comensales y garantía solo en los
reservados de Nochevieja. Se reutiliza el patrón que ya usan los Tickets:

| Condición | Comportamiento |
|---|---|
| **Personas** | A partir de N comensales. 0 = todas las reservas |
| **Días de la semana** | Días en los que aplica. Vacío = todos |
| **Fechas concretas** | Fechas sueltas en las que aplica (Nochevieja, etc.) |
| **Franja horaria** | Entre dos horas. Vacío = todo el día |
| **Turnos** | Comida y/o cena. Vacío = ambos |
| **Zonas** | Zonas comerciales concretas. Vacío = todas |
| **Mesas** | Mesas concretas (reservados, mesa del chef). Vacío = todas |

Las condiciones se **suman**: si se marca "sábados" y "8 personas", pide
garantía el sábado con 8 o más. Un eje vacío no restringe.

**Importe**: fijo por reserva, o multiplicado por comensal.

**Plazo mínimo de aviso** (cada política el suyo): con cuánta antelación tiene
que cancelar el cliente para NO pagar. Es lo que decide si un cobro procede o
no (§5.7). La de cancelación ya lo tiene hoy (`cancelacionHorasAntes`); la de
garantía necesita el suyo, porque los plazos no tienen por qué coincidir.

### 5.2 El cliente reserva en el portal

```
Elige fecha, hora y personas → mesa / zona → sus datos
      ↓
┌──────────────────────────────────────────────────┐
│ ¿Cumple las condiciones de garantía?             │
│   NO → reserva confirmada, fin                   │
│   SÍ → ¿cuántos días faltan?                     │
│         ≤ 4 → tarjeta AHORA (§5.2)               │
│         > 4 → reserva en espera de tarjeta (§5.4)│
└──────────────────────────────────────────────────┘
```

**Reserva a 4 días o menos:** Revolut pide la tarjeta y retiene el importe. Si
el cliente no la completa, **la reserva no se crea** y la mesa se libera. Sin
garantía no hay reserva.

### 5.4 Reservas a más de 4 días: la tarjeta se pide después

Pedir la tarjeta al reservar con un mes de antelación no sirve de nada: la
retención habría caducado el día de la reserva (5 días con Visa). Así que se
pide cuando falta poco, en tres correos:

```
Día 0 · el cliente reserva (faltan 30 días)
   → Correo de CONFIRMACIÓN CON GARANTÍA PENDIENTE
     "Tu reserva está confirmada. Como es un grupo grande, unos días antes te
      pediremos una tarjeta en garantía de XX €. Estate atento a tu correo."
        ↓
Día 26 · faltan 4 días
   → Correo de SOLICITUD DE TARJETA, con su enlace
     "Necesitamos tu tarjeta para mantener la reserva. Tienes 24 horas."
     La reserva pasa a estado "garantía pendiente".
        ↓
   ┌────────────────────────────────────────────┐
   │ ¿Pone la tarjeta en 24 h?                  │
   │   SÍ → retenida. Reserva firme             │
   │   NO → reserva CANCELADA + correo avisando │
   └────────────────────────────────────────────┘
```

**La cancelación automática es la parte delicada del PRP:** el software anula
una reserva sin que nadie lo pida. Por eso:

- El plazo de 24 h y el umbral de 4 días son **configurables**, no fijos.
- La reserva **avisa en Sala** cuando entra en "garantía pendiente", para que
  el restaurante pueda llamar al cliente antes de que se cancele sola.
- La cancelación **se puede desactivar**: si se apaga, la reserva se queda
  marcada como sin garantía y decide una persona.
- Todo queda en el historial de la reserva.

### 5.6 El aviso al entrar en Reservas

Los reintentos corren solos, de madrugada, y nadie los está mirando. Si el
resultado no salta a la vista, el restaurante se entera de que no cobró cuando
ya da igual. Por eso, **al entrar en Sala → Reservas** aparece arriba un aviso
con lo que necesita una decisión:

```
┌────────────────────────────────────────────────────────────┐
│  ⚠  3 reservas necesitan tu atención                       │
│                                                            │
│  · 2 cobros pendientes — se sigue intentando               │
│  · 1 retención caduca mañana — cobra o se pierde           │
│                                          [ Ver reservas ]  │
└────────────────────────────────────────────────────────────┘
```

**Qué entra en el aviso:**

| Situación | Por qué urge |
|---|---|
| **Cobro pendiente** | Falló y se sigue intentando. Quizá haya que llamar al cliente |
| **Cobro agotado** | Se acabaron los intentos. Ya solo se puede reclamar a mano |
| **Retención por caducar** | Quedan menos de 24 h para cobrar o se pierde el dinero |
| **Garantía sin tarjeta** | Reserva de Sala con garantía: hay que pedir la tarjeta por teléfono |
| **Garantía pendiente** | Se pidió la tarjeta al cliente y el plazo corre (§5.4) |

**Reglas del aviso:**

- **No se puede silenciar**, pero cada línea se resuelve al actuar sobre ella:
  en cuanto se cobra, se libera o se renuncia, desaparece sola.
- Al pulsar, **filtra la lista de reservas** por esas mismas reservas. No abre
  otra pantalla: lleva a donde se actúa.
- **Solo lo ve quien puede actuar.** Es información de dinero, así que se rige
  por los permisos del rol, igual que el resto del módulo.
- Si no hay nada pendiente, **no aparece nada**. Una barra permanente diciendo
  "todo bien" solo estorba.

### 5.7 Cuándo procede cobrar: no-show y cancelaciones

Tener la tarjeta no basta: hace falta saber **cuándo toca cobrar**. La regla
depende de qué pasó con la reserva.

#### El restaurante marca la reserva

| Se marca como | ¿Avisa de cobrar? |
|---|---|
| **No presentado** | **Siempre.** No aparecer no tiene plazo que valga |
| **Cancelada** dentro de plazo | **No.** El cliente avisó a tiempo, no se le cobra |
| **Cancelada** fuera de plazo | **Sí.** Canceló tarde: la mesa ya no se pudo revender |

El aviso sale **al marcar el estado**, en el mismo momento, y dice el importe y
por qué procede:

```
┌──────────────────────────────────────────────────────────┐
│  Esta reserva tiene garantía de 40,00 €                  │
│                                                          │
│  Canceló a 2 h de la reserva, y el plazo son 24 h.       │
│  Procede cobrar el importe retenido.                     │
│                                                          │
│              [ No cobrar ]   [ Cobrar 40,00 € ]          │
└──────────────────────────────────────────────────────────┘
```

**El aviso propone, no ejecuta.** Decide una persona: puede haber un motivo
—el cliente llamó, hubo un problema del restaurante— y el software no puede
saberlo. Si se elige "No cobrar", queda registrado quién lo perdonó.

Si la reserva lleva **las dos políticas**, el aviso las presenta juntas y se
cobra cada una por su lado: la garantía se captura, la cancelación se cobra
contra la tarjeta guardada.

#### El cliente cancela por su cuenta

Aquí no hay nadie a quien preguntar, así que **el cobro es automático**:

```
El cliente cancela desde el enlace de su correo
      ↓
¿Cumple el plazo mínimo de aviso?
      SÍ → reserva cancelada. No se le cobra nada
      NO → reserva cancelada + SE LE COBRA automáticamente
             · garantía   → se captura lo retenido
             · cancelación → se cobra la tarjeta guardada
```

La pantalla de cancelación **ya avisa hoy** del cargo antes de confirmar, así
que el cliente no se lleva ninguna sorpresa: acepta sabiendo lo que le cuesta.

**Si cancela DENTRO de plazo, todo sigue igual que hoy:** recibe el correo de
cancelación normal, sin una palabra sobre cargos, porque no ha habido ninguno.
El correo de cobro es un añadido que solo aparece cuando el dinero se ha movido
de verdad.

#### El correo del cobro: solo si se cobró de verdad

⚠️ **Regla firme: al cliente no se le escribe sobre un cobro que no ha
ocurrido.** El correo sale *después* de que el dinero se haya movido, nunca
antes ni "por si acaso".

| Qué pasó | ¿Correo al cliente? |
|---|---|
| Cobro **ejecutado** | **Sí**, con el importe y el motivo |
| Cobro **falla** (sin fondos) | **No.** Se reintenta en silencio (§5.5) |
| Cobro que acaba **cobrando** tras varios intentos | **Sí**, ese día |
| Se agotan los intentos sin cobrar | **No** al cliente. Solo aviso interno en Sala |
| Alguien elige **"No cobrar"** | **No.** No ha pasado nada que contarle |
| Cancela **dentro de plazo** | **Sí**, pero el correo de cancelación **normal**: no se le habla de cargos |

El motivo es simple: un correo diciendo "te hemos cobrado 40 €" cuando el cargo
falló genera una reclamación garantizada, y deja al restaurante explicando algo
que no ocurrió.

### 5.3 El restaurante cobra — en la ficha, junto al tipo de reserva

El bloque vive **al lado del desplegable "Tipo de reserva"**, en la misma fila
donde hoy aparece "Importe retenido (€)". Es el sitio donde el camarero ya
mira cuando abre una reserva, así que la garantía se ve sin buscarla.

Según el estado de la garantía, el bloque enseña una cosa u otra:

```
┌──────────────────────┬─────────────────────────────────────────┐
│ Tipo de reserva      │ Garantía                                │
│ [Sin tipo        ▾]  │ 40,00 € retenidos · Tarjeta ····4242    │
│                      │ [ Cobrar ]  [ Liberar ]                 │
└──────────────────────┴─────────────────────────────────────────┘
```

| Estado | Qué se ve |
|---|---|
| **Retenida** | Importe, últimos 4 dígitos de la tarjeta y los botones **Cobrar** y **Liberar** |
| **Cobrada** | "Cobrados 40,00 € el 3-sep por Marta". Sin botones |
| **Liberada** | "Liberada el 3-sep por Marta". Sin botones |
| **Caducada** | "La retención caducó el 8-sep". Sin botones: ya no hay nada que cobrar |
| **Sin tarjeta** | "Garantía de 40,00 € — sin tarjeta". Es una reserva de Sala, se pide por teléfono |

**Cobrar** pide confirmación antes de mover dinero: es irreversible desde el
software (una devolución se hace en Revolut). **Liberar** suelta la retención
cuando el cliente vino o se le perdona.

Si nadie hace nada, la retención caduca sola y el dinero vuelve al cliente.

Todo movimiento queda en el historial de la reserva: quién cobró, cuándo y
cuánto.

---

## 6. Fases

| # | Fase | Qué entrega |
|---|---|---|
| **1** | **Condiciones** | Motor de reglas + pantalla de configuración, para las DOS políticas. La reserva se marca sola y el correo avisa. **Sin tarjeta todavía** |
| **2** | **Tarjeta en el portal** | Paso de tarjeta tras elegir mesa. Cancelación → guarda la tarjeta; garantía → retiene (`capture_mode: "manual"`). La reserva no se crea si no se completa |
| **3** | **Cobro desde la ficha** | Bloque junto al tipo de reserva: estado y botones de cobrar/liberar. Cobrar una retención captura; cobrar una cancelación lanza un pago off-session, **que puede fallar** y se reintenta solo a diario (§5.5). Incluye el aviso al entrar en Reservas (§5.6) |
| **4** | **Reservas lejanas** | Solo afecta a la GARANTÍA (la cancelación no caduca): los tres correos de §5.4, el estado "garantía pendiente", el aviso en Sala y la cancelación automática a las 24 h |

La fase 1 **ya es útil sola**: el restaurante ve qué reservas exigen tarjeta y
puede pedirla por teléfono, como hace ahora, pero sin decidirlo a ojo.

⚠️ **La fase 3 tiene dos caminos distintos.** Capturar una retención casi nunca
falla: el dinero está apartado. Cobrar una tarjeta guardada sí puede fallar, y
la interfaz tiene que decirlo con claridad y gestionar los reintentos.

---

## 7. Modelo de datos

Sobre lo ya creado (`reservas.tiene_garantia`, `reservas.garantia_importe`):

```
empresa_reservas_config          (condiciones, fase 1)
  garantia_dias_semana      TEXT[]   -- días en los que aplica
  garantia_fechas           DATE[]   -- fechas sueltas
  garantia_turnos           TEXT[]   -- COMIDA / CENA
  garantia_hora_desde       TEXT
  garantia_hora_hasta       TEXT
  garantia_grupo_zona_ids   UUID[]   -- zonas
  garantia_mesa_ids         UUID[]   -- mesas concretas

reservas · GARANTÍA — retención     (fase 2)
  garantia_revolut_order_id TEXT     -- identificador de la retención
  garantia_capture_deadline TIMESTAMPTZ -- hasta cuándo deja cobrar Revolut
  garantia_estado           TEXT     -- pendiente|retenida|cobrada|liberada|caducada
  garantia_retenida_at      TIMESTAMPTZ
  garantia_cobrada_at       TIMESTAMPTZ
  garantia_cobrada_por      UUID     -- quién ejecutó el cobro
  garantia_tarjeta_ultimos4 TEXT     -- solo para mostrar "····4242" en la ficha

reservas · CANCELACIÓN — tarjeta guardada  (fase 2)
  cancelacion_customer_id       TEXT  -- cliente en Revolut
  cancelacion_payment_method_id TEXT  -- la tarjeta guardada (NO son sus dígitos)
  cancelacion_estado            TEXT  -- pendiente|guardada|cobrada|fallida|liberada
  cancelacion_guardada_at       TIMESTAMPTZ
  cancelacion_cobrada_at        TIMESTAMPTZ
  cancelacion_cobrada_por       UUID
  cancelacion_tarjeta_ultimos4  TEXT
  cancelacion_error             TEXT  -- por qué falló el último intento
  cancelacion_intentos          INT   -- cuántos van
  cancelacion_ultimo_intento_at TIMESTAMPTZ
  cancelacion_proximo_intento_at TIMESTAMPTZ -- NULL = no se reintenta más

empresa_reservas_config          (reintentos, fase 3 · solo cancelación)
  cancelacion_reintento_activo  BOOLEAN -- default true
  cancelacion_reintentos_max    INT     -- default 5
  cancelacion_reintento_hora    TEXT    -- default "10:00", zona de la empresa

reservas · decisión de cobro       (fase 3)
  cobro_perdonado_at        TIMESTAMPTZ -- alguien eligió "No cobrar"
  cobro_perdonado_por       UUID
  cobro_motivo              TEXT        -- no_show | cancelacion_fuera_plazo

reservas                         (reservas lejanas, fase 4 · solo garantía)
  garantia_solicitada_at    TIMESTAMPTZ  -- cuándo se pidió la tarjeta
  garantia_limite_at        TIMESTAMPTZ  -- hasta cuándo hay para ponerla
  garantia_token            TEXT         -- enlace del correo, secreto por reserva

empresa_reservas_config          (reservas lejanas, fase 4 · solo garantía)
  garantia_dias_antes       INT     -- cuántos días antes se pide (default 4)
  garantia_horas_limite     INT     -- plazo para poner la tarjeta (default 24)
  garantia_cancelar_si_falta BOOLEAN -- si no, la decide una persona
```

`garantia_tarjeta_ultimos4` son los cuatro últimos dígitos que devuelve
Revolut. Sirven para que el camarero identifique la tarjeta por teléfono; no
permiten cobrar nada por sí mismos.

El importe se **congela** en la reserva al crearla: si mañana cambia la
configuración, la reserva conserva lo que se le dijo al cliente en su correo.

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| **La retención caduca antes de la reserva** | La tarjeta se pide 4 días antes (§5.4) y se guarda el `capture_deadline` real de Revolut |
| **El cobro es de UN SOLO disparo** | Revolut solo deja capturar una vez: lo no capturado se libera para siempre. El importe se cobra entero, sin cobros parciales |
| **El cliente abandona en el paso de tarjeta** | La mesa se libera. No queda reserva fantasma |
| **Doble cobro** | El identificador de Revolut es único por reserva; el botón se bloquea tras cobrar |
| **Cada empresa cobra en SU cuenta** | Ya resuelto: las credenciales de Revolut son por empresa y van cifradas |
| **Revolut no está configurado** | Si la empresa no tiene credenciales activas, las políticas solo avisan: ni retienen ni guardan tarjeta |
| **El cobro de una cancelación falla por falta de fondos** | Es inherente al mecanismo, y la razón de que exista la garantía. La ficha lo muestra y deja reintentar |
| **Confundir las dos políticas** | En la ficha y en los correos se nombran siempre distinto: "retenidos" (garantía) frente a "se cobrará" (cancelación) |
| **Avisar de un cobro que falló** | El correo sale SOLO tras confirmar el movimiento real de dinero (§5.7). Nunca antes |
| **Cobrar cuando no procedía** | El aviso propone, nunca ejecuta: siempre decide una persona, y queda registrado quién perdonó un cobro |

---

## 9. Fuera de alcance

- Cobros parciales (cobrar 20 € de una retención de 50 €). Revolut los admite,
  pero solo UNA vez: lo que no se captura se libera y ya no se puede cobrar.
  Se cobra el importe completo o nada.
- Devoluciones tras cobrar: se hacen desde Revolut.
- Garantía en reservas creadas a mano desde Sala: el camarero pide la tarjeta
  por teléfono como hasta ahora. Solo el portal público pide tarjeta.
- Reintentos de tarjeta rechazada: si la tarjeta falla, el cliente puede volver
  a intentarlo desde el mismo enlace mientras esté en plazo. No se avisa al
  restaurante de cada intento fallido.

---

## 10. Preguntas abiertas

1. ~~¿Qué se hace con las reservas a más de 7 días?~~ **Resuelto**: se pide la
   tarjeta 4 días antes, con 24 h de plazo (§5.4).
2. ~~¿Cuál es el plazo real de caducidad en Revolut?~~ **Resuelto**: 5 días con
   Visa en un restaurante, 30 con Mastercard. Manda el caso peor.
3. **¿La versión de API 2024-09-01 que usa el proyecto admite pre-auth de 30
   días?** La extensión llegó en 2026-04-20. Hay que probarlo en sandbox; no
   bloquea, porque con 4 días basta la ventana estándar.
4. **¿Los Tickets y la garantía comparten las credenciales de Revolut?**
   Asumido que sí (una cuenta por empresa).
5. **¿La garantía se pide también al modificar una reserva** que pasa de 4 a 10
   personas? Asumido que sí: al cambiar, se revalúan las condiciones.
6. **¿Qué pasa si el cliente pone la tarjeta pero luego cambia la reserva** a
   menos gente y ya no le tocaría garantía? Asumido: se libera la retención.
