# PRP-085 — WhatsApp en Comunicación: sesión vinculada por QR (autoservicio, multi-empresa)

> **Estado**: PENDIENTE
> **Fecha**: 2026-09-06
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Que cada restaurante conecte **su propio número de WhatsApp** escaneando un QR desde
Ajustes, y a partir de ahí converse con sus clientes desde la **bandeja de Comunicación
que ya existe** — sin coste por mensaje, sin ventana de 24 horas y sin que nadie toque
código ni variables de entorno para dar de alta a un cliente nuevo.

La sesión vive en el **VPS Hetzner que ya tenemos** para el relay FTP de cámaras, en un
proceso aparte; y de paso se deja ese relay FTP desplegado, que sigue pendiente.

---

## Por Qué

| Problema | Solución |
|---|---|
| El cliente escribe al WhatsApp del restaurante y esa conversación vive en el móvil de una persona: no se ve en el software, no queda registro y se pierde al irse el empleado | La conversación entra en Comunicación, con su historial, sus leídos y su visibilidad por departamento, como un canal más |
| La vía oficial de Meta cobra por conversación y cierra la ventana a las 24 h: contestar tarde a un cliente cuesta dinero o directamente no se puede | Sesión vinculada (el mismo WhatsApp Web que ya usa el restaurante): conversación bidireccional normal, sin ventana ni coste por mensaje |
| Dar de alta el WhatsApp de un cliente nuevo hoy exigiría alta en Meta, verificación de empresa y configuración cableada | El propio restaurante escanea un QR desde Ajustes y queda conectado; el software no necesita ningún cambio para el cliente 101 |
| Una sesión vinculada se cae sola (el móvil sin batería, cierre de sesión desde el teléfono) y nadie se entera hasta que un cliente se queja | Detección de caída con aviso automático (correo + notificación) y reconexión autoservicio con QR y pasos en pantalla |
| El envío masivo por esta vía es la forma más rápida de que WhatsApp banee el número del restaurante | Está **prohibido por diseño**: sin selección múltiple, sin importar listas, sin iniciar a varios, y freno ante texto repetido. Las campañas siguen por la vía oficial de Meta ya montada en Marketing (PRP-083) |
| Con ~100 clientes hay que saber qué empresa vive en qué máquina y cuál está caída | Registro de sesión→máquina y panel de estado |

**Valor de negocio**: el canal por el que de verdad habla el cliente entra en el software
sin coste variable. Un no-show avisado por WhatsApp es una mesa que se revende; una
conversación guardada es una ficha de cliente que se enriquece sola. Y es una función que
se vende a los 100 clientes sin coste marginal por mensaje.

---

## Qué

### Criterios de Éxito

- [ ] Un restaurante conecta su número **sin ayuda**: entra en Ajustes → Sala → WhatsApp, escanea el QR con su móvil y en menos de 2 minutos el estado pasa a **Conectado**, sin que nadie toque código ni variables de entorno.
- [ ] Un mensaje que un cliente envía al WhatsApp del restaurante aparece en Comunicación en **menos de 5 segundos**, y la respuesta escrita desde Comunicación llega al móvil del cliente.
- [ ] Los adjuntos funcionan en los dos sentidos (imagen, audio, documento) reutilizando el bucket `chat-archivos` que ya existe.
- [ ] **Aislamiento**: la empresa A nunca ve ni un mensaje ni un contacto de la empresa B. Verificado con las dos empresas reales (BACANAL y HABANA) conectadas a la vez.
- [ ] **Imposible el envío masivo**: no existe selección múltiple, ni importación de listas, ni "iniciar conversación con varios". El mismo texto a más de N destinatarios distintos en la ventana configurada queda **bloqueado**, no advertido.
- [ ] Si la sesión se cae, en menos de 2 minutos el restaurante tiene **correo + notificación** y la pantalla le ofrece el QR nuevo con los pasos.
- [ ] La sesión **sobrevive a un reinicio del proceso y a un cambio de máquina** sin volver a escanear (credenciales persistidas fuera del proceso).
- [ ] El hilo de un cliente muestra su **ficha de sala** vinculada y permite **crear/ver reserva** desde la propia conversación.
- [ ] La visibilidad respeta **departamento y rol**, igual que el resto de canales de Comunicación.
- [ ] El **relay FTP de cámaras queda desplegado y operativo** en el mismo VPS, con un clip real del XVR de HABANA llegando a R2.

### Comportamiento Esperado

**Conectar (autoservicio).** El gerente entra en Ajustes → Departamentos → Sala → WhatsApp.
Ve una tarjeta con el estado (**Sin conectar**). Pulsa "Conectar". El software pide al
servidor de sesiones que arranque una sesión para esa empresa; el servidor devuelve un QR
que se pinta en pantalla y se refresca solo mientras no se escanee. El gerente abre
WhatsApp en el móvil del restaurante → Dispositivos vinculados → Vincular dispositivo →
escanea. La tarjeta pasa a **Conectado**, mostrando el número y la fecha de conexión.

**Recibir.** Un cliente escribe al número del restaurante. El servidor de sesiones recibe
el mensaje, lo empuja al software, y este busca o crea el **canal de tipo `whatsapp`** de
ese teléfono dentro de esa empresa, inserta el mensaje en `mensajes` y lo publica por
Realtime. En Comunicación aparece una sección **WhatsApp** junto a los canales de
departamento y de asunto; el hilo se comporta como cualquier otro chat (no leídos, doble
tick, adjuntos, buscar).

**Responder.** Un empleado con acceso al departamento escribe en el hilo. El software
registra el mensaje como saliente y lo pide al servidor de sesiones, que lo entrega por
WhatsApp. El estado del mensaje (enviado / entregado / leído / fallido) se refleja en el
hilo.

**El cliente detrás del teléfono.** Al abrir el hilo, si el teléfono casa con un
`clientes_sala` de esa empresa, la cabecera muestra su ficha (nombre, visitas, última
visita, etiquetas) y un acceso a **ver o crear reserva**. Si no casa, ofrece crear la
ficha con ese teléfono. La vinculación es la misma normalización de teléfono que ya usa
sala.

**Cuando se cae.** El servidor detecta la desconexión, lo marca y avisa al software. El
software cambia el estado a **Desconectado**, emite **notificación** a quien tenga el
permiso de Sala y envía **correo** desde el remitente de notificaciones. La tarjeta de
Ajustes muestra el motivo en lenguaje llano ("El teléfono ha cerrado la sesión desde
Dispositivos vinculados") y el botón para volver a escanear, con los pasos numerados.

**Lo que NO se puede hacer.** En el hilo no hay "reenviar a varios", ni selección múltiple
de contactos, ni importar una lista. Iniciar una conversación es siempre **de uno en uno**
tecleando un teléfono. Si el mismo texto se manda a más de N teléfonos distintos dentro de
la ventana configurada, el envío se **bloquea** con un aviso que remite a Marketing. Las
campañas siguen saliendo por la vía oficial de Meta (PRP-083) — este canal no las hace.

---

## Contexto

### Referencias

**Lo que se reutiliza (no se construye de cero):**

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Canales, mensajes, adjuntos, leídos, doble tick, realtime | `src/features/comunicacion/actions/comunicacion-actions.ts` (1077 líneas) | Toda la bandeja. Se añade un `tipo` de canal, no un sistema nuevo |
| Tablas `canales` / `mensajes` / `canales_preferencias` | `supabase/migrations/056_chat_consolidado.sql` | Modelo de chat ya consolidado con RLS |
| Visibilidad por departamento | `supabase/migrations/20260606190000_rrhh_canales_visibilidad_departamentos.sql` (`bh_canon`, `canales.departamentos`) | El gate de quién ve qué canal, ya resuelto |
| UI del chat | `src/features/google-workspace/components/ChatDrawer.tsx` (2411 líneas) + `src/features/mi-panel/mobile/components/ComunicacionMobile.tsx` | Donde entra la nueva sección WhatsApp |
| Realtime de mensajes | `supabase/migrations/20260731130000_chat_realtime_mensajes.sql` | Los mensajes entrantes ya se propagan solos |
| **Emparejamiento por token de dispositivo** | `src/app/api/conector/pair/route.ts` + `supabase/migrations/20260621100000_conectores_videovigilancia.sql` | **El patrón exacto**: código de un solo uso → `device_token` entregado una vez → solo se guarda el hash → endpoints `/api/conector/*` autentican por token con service role, fuera de RLS |
| Relay fuera de Vercel | `ftp-relay/` (Dockerfile, docker-compose, README) | El precedente de proceso propio en VPS y su razón documentada |
| Vía oficial Meta (campañas) | `src/features/mensajeria/` + `supabase/migrations/20260902150000_mensajeria_envios_y_config.sql` (PRP-083) | El canal de campañas que **NO** se toca; este PRP es el canal conversacional, complementario |
| Cifrado de credenciales | `RevolutPanel` / `revolut-config-actions.ts` (`encrypt`/`decrypt`) | Para cifrar las credenciales de sesión persistidas |
| Notificaciones | `src/features/notificaciones/actions/notificaciones-actions.ts` (`emitirNotificacion`) | El aviso de caída de sesión |
| Correo saliente | remitente único de notificaciones, `getSiteUrl()` | El correo de caída |
| Ficha de cliente y teléfono | `public.clientes_sala.telefono` (campo único con prefijo, `20260904130000`) | La vinculación conversación ↔ cliente |
| Tarjetas de integración en Ajustes | `src/features/ajustes/components/IntegracionesTab.tsx` + `AgoraPanel` / `RevolutPanel` | El patrón visual de la tarjeta de conexión |

**Externas:**
- Baileys (WhatsApp Web multi-dispositivo, `@whiskeysockets/baileys`) — librería del servidor de sesiones.
- Docker + docker compose en el VPS Hetzner ya contratado.

### Arquitectura Propuesta

```
   Móvil del cliente
        │  WhatsApp
        ▼
┌──────────────────────────┐   webhook firmado    ┌────────────────────────┐
│  wa-gateway  (VPS)       │ ───────────────────▶ │  Vercel (el software)  │
│  proceso Node aparte     │ ◀─────────────────── │  /api/whatsapp/*       │
│  Baileys · 1 sesión por  │   enviar / QR / estado│  Comunicación + Ajustes│
│  empresa                 │                       └───────────┬────────────┘
│  credenciales → Supabase │                                   │
└──────────────────────────┘                                   ▼
        (mismo VPS)                                      Supabase
┌──────────────────────────┐                     canales · mensajes ·
│  ftp-relay (ya escrito,  │                     whatsapp_sesiones ·
│  pendiente de desplegar) │                     whatsapp_contactos
└──────────────────────────┘
```

**Decisiones de arquitectura:**

1. **Proceso separado del relay FTP, misma máquina.** Comparten VPS y `docker compose`,
   pero son contenedores distintos: un fallo de ffmpeg no puede tumbar las sesiones de
   WhatsApp, ni al revés. El relay FTP ya está escrito (`ftp-relay/src/index.js`); esta
   intervención solo lo despliega.

2. **Las credenciales de sesión NO viven en el disco del contenedor.** Se persisten
   cifradas en Supabase (tabla `whatsapp_sesiones`, columna `credenciales_cifradas`). Esto
   es lo que permite matar el contenedor, moverlo a otra máquina o reconstruirlo sin que
   el restaurante vuelva a escanear. Es el requisito que separa "un experimento" de "un
   producto para 100 clientes".

3. **El gateway se autentica con el software exactamente como la cajita de cámaras**:
   `device_token` por instancia, del que solo se guarda el hash. Los endpoints
   `/api/whatsapp/*` usan service role y quedan fuera de RLS, igual que `/api/conector/*`.
   No se inventa un mecanismo nuevo.

4. **El aislamiento no lo da la RLS**, lo da que cada sesión de Baileys pertenece a una
   `empresa_id` y el webhook entrante escribe con esa `empresa_id`; la RLS es la segunda
   barrera. (Regla ya aprendida: `p:aislamiento_empresa_activa_no_lo_da_la_rls`.)

5. **El freno al envío masivo se aplica en el servidor, no en la UI.** La UI no ofrece la
   función, pero el bloqueo real vive en la server action: sin él, bastaría una llamada
   directa para quemar el número del cliente.

6. **`wa-gateway` es multi-empresa dentro del mismo proceso** (N sesiones), y la tabla
   registra en qué máquina vive cada una (`nodo_id`). Con eso, escalar a la máquina 2 es
   levantar otro contenedor con otro `nodo_id`, sin cambiar el software.

```
src/features/whatsapp/
├── actions/         # conectar, estado, enviar, vincular cliente, freno antimasivo
├── components/      # tarjeta de Ajustes (QR + pasos), cabecera de hilo con ficha
├── lib/             # normalización de teléfono, firma de webhook, antimasivo
└── types/

src/app/api/whatsapp/
├── entrante/        # webhook del gateway: mensaje recibido
├── estado/          # webhook del gateway: conectado / QR / caído
└── pair/            # el gateway canjea su código y obtiene device_token

wa-gateway/          # proceso del VPS (Docker), hermano de ftp-relay/
├── src/
├── Dockerfile
└── README.md
```

### Modelo de Datos

```sql
-- 1) Una fila por empresa: su sesión de WhatsApp.
CREATE TABLE IF NOT EXISTS public.whatsapp_sesiones (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- El número conectado, en formato internacional. Se rellena al vincular.
  numero TEXT,

  --   SIN_CONECTAR  nunca se ha vinculado
  --   ESPERANDO_QR  hay QR en pantalla, sin escanear todavía
  --   CONECTADA     operativa
  --   CAIDA         se ha perdido la sesión (avisado al cliente)
  estado TEXT NOT NULL DEFAULT 'SIN_CONECTAR'
    CHECK (estado IN ('SIN_CONECTAR','ESPERANDO_QR','CONECTADA','CAIDA')),

  -- Motivo de la caída en lenguaje llano, para pintarlo en la tarjeta.
  motivo_caida TEXT,

  -- Credenciales de Baileys CIFRADAS. Viven aquí y no en el disco del
  -- contenedor: es lo que permite migrar de máquina sin volver a escanear.
  -- NUNCA viaja al navegador.
  credenciales_cifradas TEXT,

  -- Qué máquina atiende esta sesión. Con 100 clientes es la única forma de
  -- saber dónde mirar cuando una falla.
  nodo_id TEXT,

  conectada_at   TIMESTAMPTZ,
  last_seen_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_sesiones ENABLE ROW LEVEL SECURITY;
-- Solo lectura desde el navegador, y sin la columna cifrada: la escritura va
-- por server actions y por los endpoints del gateway (service role).
CREATE POLICY whatsapp_sesiones_select ON public.whatsapp_sesiones
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));


-- 2) Nodos del gateway: qué proceso vive en qué máquina y con qué credencial.
--    Mismo patrón que `conectores`: token de un solo uso, solo el hash.
CREATE TABLE IF NOT EXISTS public.whatsapp_nodos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nodo_id           TEXT UNIQUE NOT NULL,
  pairing_code      TEXT UNIQUE,
  pairing_expira    TIMESTAMPTZ,
  device_token_hash TEXT,
  last_seen_at      TIMESTAMPTZ,
  version           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.whatsapp_nodos ENABLE ROW LEVEL SECURITY;
-- Sin policies: tabla de infraestructura, solo servidor.


-- 3) El canal de chat gana el tipo 'whatsapp' y el teléfono del contacto.
--    Se reutiliza `canales`/`mensajes` enteros: no hay bandeja paralela.
ALTER TABLE public.canales
  ADD COLUMN IF NOT EXISTS wa_telefono  TEXT,
  ADD COLUMN IF NOT EXISTS wa_cliente_id UUID REFERENCES public.clientes_sala(id) ON DELETE SET NULL;

-- Un hilo por teléfono y empresa: sin esto, dos mensajes seguidos abrirían dos hilos.
CREATE UNIQUE INDEX IF NOT EXISTS canales_wa_telefono_uq
  ON public.canales (empresa_id, wa_telefono)
  WHERE wa_telefono IS NOT NULL;


-- 4) Los mensajes ganan dirección y estado de entrega.
ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS wa_direccion TEXT
    CHECK (wa_direccion IS NULL OR wa_direccion IN ('ENTRANTE','SALIENTE')),
  ADD COLUMN IF NOT EXISTS wa_mensaje_id TEXT,
  ADD COLUMN IF NOT EXISTS wa_estado TEXT
    CHECK (wa_estado IS NULL OR wa_estado IN ('PENDIENTE','ENVIADO','ENTREGADO','LEIDO','FALLIDO'));

-- El gateway confirma entregas por SU identificador: sin índice, cada acuse
-- recorrería la tabla entera.
CREATE INDEX IF NOT EXISTS mensajes_wa_mensaje_id_idx
  ON public.mensajes (wa_mensaje_id) WHERE wa_mensaje_id IS NOT NULL;


-- 5) Freno antimasivo: huella de lo enviado, para bloquear el texto repetido.
CREATE TABLE IF NOT EXISTS public.whatsapp_envios_huella (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  texto_hash  TEXT NOT NULL,       -- SHA-256 del texto normalizado
  destinatario TEXT NOT NULL,
  enviado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wa_huella_empresa_hash_idx
  ON public.whatsapp_envios_huella (empresa_id, texto_hash, enviado_at DESC);
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar en cada fase (bucle agéntico).

### Fase 0: Desplegar el VPS (y saldar el relay FTP pendiente)
**Objetivo**: el VPS Hetzner queda operativo con Docker, firewall y `docker compose`, y el
`ftp-relay` que ya está escrito pasa a estar **corriendo de verdad**. Se deja el hueco del
segundo contenedor preparado.
**Validación**: un clip real del XVR de HABANA llega por FTP, se convierte y aparece en R2
atribuido a su cámara. El relay sobrevive a `reboot` del VPS.

### Fase 1: Modelo de datos y emparejamiento del nodo
**Objetivo**: las cinco piezas del modelo migradas (idempotentes), y el gateway capaz de
canjear su código y obtener su `device_token`, clonando el patrón de `/api/conector/pair`.
**Validación**: migraciones re-ejecutables sin error; un `curl` con código válido devuelve
token una sola vez y con código repetido falla; RLS verificada con las dos empresas.

### Fase 2: `wa-gateway` — sesión, QR y persistencia fuera del proceso
**Objetivo**: el proceso del VPS levanta una sesión Baileys por empresa, emite el QR,
guarda las credenciales cifradas en Supabase y las recupera al arrancar.
**Validación**: se vincula un número de prueba; se **mata y recrea el contenedor** y la
sesión vuelve sola sin escanear; se cambia el `nodo_id` y la sesión migra igual.

### Fase 3: Conectar desde Ajustes (autoservicio)
**Objetivo**: tarjeta en Ajustes → Sala → WhatsApp con estado, QR que se refresca solo,
pasos numerados y número conectado. Cero configuración cableada.
**Validación**: una empresa se conecta de principio a fin **sin tocar código ni variables
de entorno**, con Playwright confirmando la pantalla.

### Fase 4: Recibir y responder dentro de Comunicación
**Objetivo**: el webhook entrante abre/reutiliza el canal `whatsapp` y publica el mensaje;
la sección WhatsApp aparece en el chat (escritorio y móvil); responder entrega al cliente.
Adjuntos en los dos sentidos y estados de entrega.
**Validación**: conversación bidireccional real con un teléfono de prueba, mensaje visible
en menos de 5 s, adjuntos que abren, doble tick coherente.

### Fase 5: Aislamiento y visibilidad por departamento
**Objetivo**: cada empresa ve solo lo suyo y el canal respeta los permisos de Sala igual
que el resto de canales (`bh_canon` / `canales.departamentos`).
**Validación**: con BACANAL y HABANA conectadas a la vez, un usuario de una no ve ni un
mensaje ni un contacto de la otra; un usuario sin permiso de Sala no ve la sección.

### Fase 6: Freno antimasivo (bloqueo real, en servidor)
**Objetivo**: sin selección múltiple, sin importar listas, sin iniciar a varios; y bloqueo
por huella de texto repetido en la server action, con el aviso que remite a Marketing.
**Validación**: intentar el mismo texto a N+1 teléfonos **falla** — también llamando a la
acción directamente, no solo desde la UI.

### Fase 7: Caída, aviso y reconexión autoservicio
**Objetivo**: detección de desconexión, estado `CAIDA`, notificación + correo al cliente y
pantalla de reconexión con QR y pasos.
**Validación**: se cierra la sesión desde el móvil ("Dispositivos vinculados"); en menos de
2 minutos llegan notificación y correo, y la reconexión por QR devuelve el servicio.

### Fase 8: Ficha de cliente y reserva desde el hilo
**Objetivo**: el teléfono se casa con `clientes_sala`, la cabecera muestra la ficha y
permite ver o crear reserva; si no existe, ofrece crear la ficha.
**Validación**: un cliente real de sala escribe y su hilo muestra su ficha y sus visitas;
se crea una reserva desde el hilo y queda registrada con su origen.

### Fase 9: Panel de estado de sesiones (escala a 100)
**Objetivo**: panel interno con qué empresa está conectada, en qué nodo y desde cuándo,
con las caídas visibles.
**Validación**: el panel refleja el estado real de las dos empresas y detecta una caída
provocada.

### Fase 10: Validación Final
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright confirma conexión, hilo y reconexión
- [ ] Todos los criterios de éxito cumplidos
- [ ] `ftp-relay` sigue operativo tras convivir con `wa-gateway`

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación. El mismo error nunca ocurre dos veces.

*(vacío — se rellena al ejecutar)*

---

## Gotchas

- [ ] **Riesgo de baneo: hay que decírselo al cliente por escrito.** La sesión vinculada no es una API oficial de Meta. Un número puede ser bloqueado si se percibe abuso. Por eso el freno antimasivo es del producto, no una opción — y por eso la tarjeta de Ajustes debe advertirlo al conectar. Conviene recomendar que el número conectado **no sea el móvil personal de nadie**.
- [ ] **La persistencia fuera del proceso no es opcional.** Si las credenciales viven en el disco del contenedor, cada reinicio o cambio de máquina obliga a 100 clientes a reescanear. Es la diferencia entre producto y experimento: va en la Fase 2, no "más adelante".
- [ ] **El aislamiento no lo da la RLS** cuando el que escribe es el gateway con service role. La `empresa_id` la fija la sesión que recibió el mensaje; la RLS es la segunda barrera, no la primera. (Regla ya aprendida en este proyecto.)
- [ ] **Este canal NO sustituye a PRP-083.** Las campañas y los avisos de reserva siguen por la vía oficial de Meta. Si algún día se mezclan, se quema el número. Los dos caminos conviven a propósito.
- [ ] **Vercel no puede alojar esto**: una sesión de WhatsApp es un socket permanente y las funciones son efímeras. Es exactamente la misma razón ya documentada en `ftp-relay/README.md`.
- [ ] **Un teléfono, un hilo.** Sin el índice único `(empresa_id, wa_telefono)`, dos mensajes casi simultáneos abren dos canales y la conversación se parte.
- [ ] **Teléfonos en formato único con prefijo** (`"+34 612345678"`), como ya quedó fijado para `clientes_sala`. La normalización debe ser la misma o la vinculación con la ficha fallará en silencio.
- [ ] **La caída silenciosa es el peor fallo posible**: el restaurante cree que atiende y no atiende. El aviso (correo + notificación) es criterio de éxito, no un extra.
- [ ] **`nodo_id` desde el día uno.** Añadirlo cuando ya hay 60 clientes repartidos obliga a un censo manual.
- [ ] **Los adjuntos entrantes pesan.** Reutilizar el bucket `chat-archivos` y respetar el tope de 50 MB ya establecido.
- [ ] **Nada de avisos nativos del navegador** en la pantalla de conexión ni en los frenos: componentes propios, como el resto del software.

## Anti-Patrones

- NO crear una bandeja de mensajes paralela: se reutilizan `canales` y `mensajes`.
- NO guardar credenciales de sesión en claro ni dejarlas solo en el disco del contenedor.
- NO exponer nunca `credenciales_cifradas` al navegador.
- NO cablear ningún número, token o empresa en código o en variables de entorno: el alta es autoservicio por QR.
- NO añadir selección múltiple, importación de contactos ni difusión "porque sería fácil".
- NO poner el freno antimasivo solo en la UI: el bloqueo real va en el servidor.
- NO mezclar este canal con el de campañas de Meta.
- NO usar `toLocale*` sin la zona horaria de la empresa en fechas de conversación.
- NO usar `any`; Zod en todo input de usuario y en los payloads del webhook.

---

*PRP pendiente de aprobación. No se ha modificado código.*
