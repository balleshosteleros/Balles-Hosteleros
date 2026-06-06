# PRP-054: Llamadas internas por WebRTC entre empleados (voz)

> **Estado**: COMPLETO (Fases 1-6) — pendiente prueba de voz real manual
> **Fecha**: 2026-06-06
> **Proyecto**: Balles-Hosteleros

---

## Decisiones cerradas (2026-06-06)

- **Alcance v1 = SOLO VOZ.** El vídeo queda diferido a una v2. El modelo de datos ya contempla `tipo IN ('voz','video')` para no migrar después, pero la UI, la negociación de medios y los criterios de éxito de esta v1 son **solo audio**. Cualquier mención a vídeo más abajo es contexto futuro, NO alcance de esta entrega.
- **TURN = servicio gestionado** (Metered o Cloudflare Calls), arrancando con plan gratuito. Nada de coturn autohospedado en v1. Las credenciales se sirven temporales desde `/api/llamadas/ice` (el secret nunca llega al cliente).
- **Acceso desde móvil = barra inferior, para TODOS los usuarios.** El icono de **Llamar** (📞 `Phone`) se inserta en `MobileBottomNav` **a la izquierda de Fichar**, y el de **Chat** (💬 ya existente, `/m/comunicacion`) queda a la derecha de Fichar. Orden final: **Inicio · Llamar · Fichar · Chat · Más** (Fichar mantiene el centro). Sin gating por rol: visible para cualquier empleado.

---

## Objetivo

Permitir que un empleado llame a otro empleado **de su misma empresa** por voz o vídeo directamente desde la app/PWA, gratis y sin números de teléfono ni operador externo (estilo WhatsApp/Meet). La conexión de medios es peer-to-peer vía WebRTC; la señalización viaja por Supabase Realtime; STUN/TURN garantizan la conectividad incluso tras NAT/firewall corporativo.

## Por Qué

| Problema | Solución |
|----------|----------|
| Comunicación interna entre turnos/locales depende de WhatsApp personal o teléfono real (coste, privacidad, números personales expuestos) | Llamadas internas gratuitas dentro del propio software, sin exponer móviles |
| El softphone actual (`TelefonoDrawer`) es solo VoIP externo (Twilio/SIP), pensado para llamar a clientes/proveedores, no entre compañeros | Canal nativo empleado→empleado, separado del marcador externo |
| Coordinar cocina/sala/dirección en tiempo real requiere salir de la herramienta | Voz y vídeo dentro del flujo de trabajo, multi-tenant y respetando accesos |

**Valor de negocio**: Cero coste por llamada interna (solo TURN bajo NAT severo), comunicación inmediata entre empleados de la misma empresa, refuerza la PWA como herramienta única de trabajo y reduce dependencia de apps externas no controladas.

## Qué

### Criterios de Éxito (v1 — solo voz)
- [ ] En la **barra inferior móvil** aparece el icono **Llamar** a la izquierda de Fichar (Chat ya está a la derecha) para **todos los usuarios**; orden: Inicio · Llamar · Fichar · Chat · Más.
- [ ] Un empleado ve un directorio con los empleados **conectados** de su empresa activa y puede iniciar una llamada de **voz** a cualquiera de ellos.
- [ ] El empleado destinatario recibe una **UI de llamada entrante** (ringtone + tarjeta aceptar/rechazar) aunque esté en otra pantalla de la app; con la PWA en background recibe una **notificación push** que abre la app en la llamada.
- [ ] Al aceptar, ambos establecen audio peer-to-peer; funciona entre redes distintas gracias a STUN + TURN gestionado.
- [ ] Controles en llamada: silenciar micro, activar/desactivar altavoz, colgar; temporizador de duración; reconexión automática ante corte breve de red.
- [ ] _(Diferido a v2)_ Vídeo con cámara y PiP.
- [ ] **Aislamiento multi-tenant estricto**: solo se pueden llamar empleados que comparten la empresa activa (vía `user_empresas` ∪ `profiles.empresa_id`); la señalización está protegida por RLS y nadie fuera de la empresa puede unirse ni escuchar la negociación.
- [ ] Registro de llamadas (historial): quién llamó a quién, tipo, estado (aceptada/rechazada/perdida), duración, timestamps.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Happy path (llamada de voz):**
1. Ana (sala) abre el panel de Llamadas internas desde la barra superior / Mi Panel. Ve a Beto (cocina) con punto verde "Disponible".
2. Ana pulsa "Llamar". Se crea una fila `llamadas_internas` (estado `iniciando`) y se envía una señal `offer` por el canal Realtime de la empresa dirigida a Beto, además de un push si Beto no tiene la app en foreground.
3. Beto recibe la tarjeta de **llamada entrante** con foto/nombre de Ana y ringtone. Acepta.
4. Se intercambian SDP (offer/answer) e ICE candidates por Realtime; se abre `RTCPeerConnection` usando los ICE servers (STUN público + TURN propio con credenciales temporales). Estado pasa a `conectada`.
5. Hablan. Cualquiera puede silenciar/colgar. Al colgar se cierra la `RTCPeerConnection`, se actualiza la fila a `finalizada` con `duracion_seg`, y se notifica al otro extremo por Realtime para cerrar su UI.

**Vídeo:** idéntico, pero la `offer` solicita pista de vídeo y la UI muestra el `<video>` remoto a pantalla completa con el local en miniatura (PiP).

**Casos borde:** destinatario ocupado en otra llamada → respuesta `ocupado`; no contesta en N segundos → `perdida` + push de llamada perdida; rechaza → `rechazada`; el llamante cancela antes de aceptar → `cancelada`.

---

## Contexto

### Referencias
- `src/features/google-workspace/components/TelefonoDrawer.tsx` — softphone VoIP externo (Twilio/SIP). El nuevo panel es una **pieza separada** (empleado→empleado), pero reutiliza el patrón de UI: Sheet en la barra superior, estados `idle/ringing/connected/ended`, controles mute/altavoz, temporizador `formatDuration`, evento global `llamarDesdeApp`. NO mezclar el marcador externo con el directorio interno.
- `src/features/layout/components/app-layout.tsx` (líneas ~46-264) — punto de montaje de los drawers en la barra superior (`MeetDrawer`, `TelefonoDrawer`, `GoogleHeaderPill`). El nuevo `LlamadasDrawer` se monta junto a estos (escritorio).
- `src/features/mi-panel/mobile/components/MobileBottomNav.tsx` (líneas 15-20, array `items`) — barra inferior móvil. Insertar `{ href: "/m/llamar", label: "Llamar", icon: Phone }` **antes** de Fichar; Chat (`/m/comunicacion`) ya existe a la derecha. Resultado: Inicio · Llamar · Fichar · Chat · Más. Para todos los usuarios (sin gating por rol).
- `src/features/mi-panel/mobile/lib/push-server.ts` — `sendPushToUser({ userId, empresaId, eventType, payload })`. Añadir `eventType: "llamada_entrante"` y respetar opt-in. **Gotcha**: el opt-in `optInMap` exige columna en `profiles`; añadir `push_llamadas`.
- `src/features/mi-panel/actions/push-subscription-actions.ts` y `public/sw.js` — el SW ya maneja `push` + `notificationclick` (abre/enfoca la PWA en `data.url`). Reutilizable para abrir la app directamente en la llamada entrante.
- `src/lib/supabase/get-context.ts` — `getAppContext()` devuelve `{ supabase, userId, empresaId }` con la **empresa activa** (cookie del selector). Toda action y la suscripción Realtime deben usar `empresaId` activo, no `profiles.empresa_id`.
- `src/lib/supabase/client.ts` — singleton del browser client (necesario para Realtime; **una sola instancia por pestaña**, ya garantizado).
- `supabase/migrations/20260518000000_user_empresas_canonico.sql` + helper `empresas_del_usuario()` (MEMORY) — fuente de verdad multi-tenant. Toda RLS de las nuevas tablas DEBE usar `empresas_del_usuario()` (profiles ∪ user_empresas).
- MEMORY `project_empleado_multiempresa_espejo` — un empleado = una ficha reflejada en todas sus empresas vía `user_empresas`. El directorio de llamables = empleados con acceso a la empresa activa.
- MEMORY `project_telefonia_un_numero_por_empresa` / `project_telefonia_integracion_b2com` — la telefonía **externa** sigue su rumbo (B2COM/SIP). Esta feature es interna y **no** depende de ella.
- Supabase Realtime Broadcast — https://supabase.com/docs/guides/realtime/broadcast (señalización efímera, baja latencia).
- WebRTC `RTCPeerConnection` / `getUserMedia` — https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- TURN: **servicio gestionado** (Metered / Cloudflare Calls) con credenciales temporales — decisión cerrada para v1. https://www.metered.ca/stun-turn / https://developers.cloudflare.com/calls/

### Arquitectura Propuesta (Feature-First)
```
src/features/llamadas-internas/
├── components/
│   ├── LlamadasDrawer.tsx        # Panel en barra superior: directorio + recientes
│   ├── DirectorioEmpleados.tsx   # Lista de empleados de la empresa con presencia
│   ├── LlamadaEntranteCard.tsx   # Overlay global de llamada entrante (ringtone)
│   ├── LlamadaEnCursoView.tsx    # UI en llamada: video remoto/local, controles
│   └── LlamadasProvider.tsx      # Provider global: monta señalización + overlays
├── hooks/
│   ├── usePeerConnection.ts      # RTCPeerConnection: offer/answer/ICE, tracks
│   ├── useSignaling.ts           # Canal Realtime por empresa (broadcast + presence)
│   └── usePresencia.ts           # Presence: quién está conectado en la empresa
├── services/
│   └── llamadas.ts               # ICE servers (fetch credenciales TURN), helpers
├── actions/
│   └── llamadas-actions.ts       # createLlamada / updateEstado / historial (RLS)
├── store/
│   └── llamada-store.ts          # Zustand: estado de la llamada activa
└── types/
    └── index.ts                  # Tipos de señal, estado, llamada
src/app/api/llamadas/ice/route.ts  # Endpoint: credenciales TURN temporales (server-only)
```

**Decisiones clave:**
- **Señalización por Supabase Realtime** (Broadcast + Presence), un canal por empresa activa (`llamadas:empresa:{empresaId}`). Cero infra nueva de WebSocket; ya hay Supabase. Presence resuelve "quién está conectado". Realtime debe activarse para Broadcast (no requiere replicación de tablas).
- **Media P2P puro** (sin SFU) por ser 1-a-1, **solo audio en v1**. STUN público (Google) + **TURN gestionado (Metered / Cloudflare Calls) con credenciales temporales** servidas por `/api/llamadas/ice` (nunca exponer secret TURN al cliente).
- **Overlay global montado en el layout principal**: `LlamadasProvider` envuelve la app autenticada para que la tarjeta de llamada entrante aparezca en cualquier vista.
- **Push para background**: si el destinatario no responde por Realtime en ~3s (no tiene la app en foreground), se envía push `llamada_entrante` que abre la PWA en la llamada.

### Modelo de Datos
```sql
-- Historial / señal persistente de llamadas internas
CREATE TABLE public.llamadas_internas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  caller_id     UUID NOT NULL REFERENCES auth.users(id),
  callee_id     UUID NOT NULL REFERENCES auth.users(id),
  tipo          TEXT NOT NULL DEFAULT 'voz' CHECK (tipo IN ('voz','video')),
  estado        TEXT NOT NULL DEFAULT 'iniciando'
                CHECK (estado IN ('iniciando','sonando','conectada','finalizada',
                                  'rechazada','perdida','cancelada','ocupado')),
  duracion_seg  INTEGER NOT NULL DEFAULT 0,
  iniciada_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conectada_at  TIMESTAMPTZ,
  finalizada_at TIMESTAMPTZ
);

ALTER TABLE public.llamadas_internas ENABLE ROW LEVEL SECURITY;

-- Solo participantes, y solo dentro de empresas del usuario.
CREATE POLICY llamadas_select ON public.llamadas_internas FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario())
         AND (auth.uid() = caller_id OR auth.uid() = callee_id));

CREATE POLICY llamadas_insert ON public.llamadas_internas FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario())
              AND auth.uid() = caller_id);

CREATE POLICY llamadas_update ON public.llamadas_internas FOR UPDATE
  USING (empresa_id IN (SELECT empresas_del_usuario())
         AND (auth.uid() = caller_id OR auth.uid() = callee_id));

-- Opt-in de push para llamadas (cascada del patrón existente)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_llamadas BOOLEAN DEFAULT TRUE;
```

> Nota: la señalización SDP/ICE viaja por **Broadcast efímero** (no se persiste en tabla); `llamadas_internas` es solo el registro/estado. El aislamiento del canal Realtime se refuerza nombrando el canal por `empresaId` activo y validando en cliente que el `callee_id` pertenece a la empresa (la verdad última es la RLS de la tabla y la imposibilidad de unirse a un canal de empresa ajena sin sesión válida).

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Cimientos — datos y multi-tenant
**Objetivo**: Migración `llamadas_internas` + RLS con `empresas_del_usuario()`, columna `profiles.push_llamadas`, tipos TS, action `createLlamada/updateEstado` y query de historial. Action que lista los empleados llamables de la empresa activa (vía `user_empresas` ∪ profiles).
**Validación**: Insert/select bloqueados correctamente por RLS desde otra empresa (probado con SQL); `npm run typecheck` pasa.

### Fase 2: Señalización por Realtime
**Objetivo**: `useSignaling` (canal `llamadas:empresa:{empresaId}` con Broadcast para offer/answer/ICE/hangup) + `usePresencia` (Presence: empleados conectados). Verificar activación de Realtime en el proyecto Supabase.
**Validación**: Dos pestañas en la misma empresa intercambian mensajes de señal; una pestaña de otra empresa NO recibe nada. Presence refleja conexiones en tiempo real.

### Fase 3: Motor WebRTC + credenciales TURN
**Objetivo**: `/api/llamadas/ice` (credenciales TURN temporales del proveedor gestionado Metered/Cloudflare, server-only) + `usePeerConnection` (offer/answer, ICE, addTrack **audio**, mute, cierre). `services/llamadas.ts` para fetch de ICE servers. _(El código se estructura para añadir pista de vídeo en v2 sin reescritura.)_
**Validación**: Llamada de **voz** establecida entre dos pestañas/dispositivos en redes distintas (P2P o relay TURN); audio bidireccional; colgar cierra limpio ambos extremos.

### Fase 4: UI de llamada (entrante/saliente/en curso)
**Objetivo**: `LlamadasProvider` (overlay global en layout autenticado), `LlamadaEntranteCard` (ringtone + aceptar/rechazar), `LlamadaEnCursoView` (**llamada de voz**: foto/nombre del otro extremo + controles mute/altavoz/colgar + temporizador), `LlamadasDrawer` + `DirectorioEmpleados` en la barra superior (escritorio). **Móvil**: insertar el icono **Llamar** (`Phone`) en `MobileBottomNav` a la izquierda de Fichar → orden Inicio · Llamar · Fichar · Chat · Más, visible para todos; abre el directorio/`LlamadasDrawer` en versión móvil. Store Zustand de la llamada activa.
**Validación**: Llamada entrante aparece en cualquier vista; voz funciona con controles; historial visible en "recientes".

### Fase 5: Background / PWA push + estados borde
**Objetivo**: `eventType: "llamada_entrante"` en `push-server.ts` + opt-in `push_llamadas`; SW abre la app en la llamada; timeouts de no-contesta (`perdida` + push), `ocupado`, `rechazada`, `cancelada`; reconexión ICE ante corte breve.
**Validación**: Con la PWA en background el destinatario recibe push y al tocarlo entra en la llamada; los estados borde quedan registrados correctamente.

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end, multi-tenant verificado.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright/manual: voz entre dos sesiones de la misma empresa
- [ ] Verificado que empleados de empresas distintas NO se ven ni se pueden llamar
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

### 2026-06-06: Fase 1 completada — datos + multi-tenant
- **Patrón opt-in push ya existe**: `profiles` ya tiene `push_comunicados`, `push_cronograma`, `push_solicitudes` (todas `boolean NOT NULL DEFAULT true`). `push_llamadas` se añadió igual. Reusar este patrón en Fase 5.
- **Directorio de llamables sin gate de admin**: el chat (`listEmpleadosEmpresa` en `comunicacion-actions.ts`) lista compañeros con cliente de usuario leyendo solo `profiles.empresa_id`. Para respetar el espejo multi-empresa, `listLlamables` usa admin client con `empresa_id ∪ user_empresas` (como `listEmpleados`), pero SIN `requireAdminUser`: añade una verificación de pertenencia del solicitante (lecturas self permitidas por RLS) antes de leer el roster.
- **Mutaciones con cliente de usuario, no admin**: `createLlamada`/`updateEstado` usan el cliente con sesión para que la RLS (`auth.uid()=caller`, empresa en `empresas_del_usuario()`) sea la garantía real.
- **Cómo testear RLS vía MCP**: en una sola `execute_sql` usar `set local role authenticated;` + `select set_config('request.jwt.claims', json_build_object('sub','<uid>','role','authenticated')::text, true);` + el SELECT/INSERT a probar. La conexión MCP es privilegiada (bypassea RLS) hasta que se hace `SET ROLE authenticated`.
- **Verificación E2E RLS (todos OK)**: participante ve su llamada; empresa ajena ve 0; mismo-empresa-no-participante ve 0; INSERT suplantando caller → rechazado (42501); INSERT en empresa ajena → rechazado (42501). Sin advisors de seguridad sobre la tabla.

### 2026-06-06: Fase 2 completada — señalización Realtime
- **Canales privados con Realtime Authorization** (no públicos): el resto del repo usa canales públicos + RLS de tabla, pero el Broadcast NO pasa por RLS de tabla. Para aislar la señalización SDP/ICE entre empresas se añadió RLS sobre `realtime.messages` (migración `20260606210000`). Topics: `llamadas:empresa:<uuid>` (señalización) y `llamadas:presencia:<uuid>` (presencia). `realtime.messages` ya tenía RLS activa con 0 políticas → privados denegados; las 2 políticas nuevas son aditivas y NO afectan a los canales públicos existentes.
- **`empresaActual.id` es el SLUG, no el UUID**: el cliente debe usar `empresaActual.dbId` (UUID) para construir el topic, que es lo que la RLS parsea y compara con `empresas_del_usuario()`. Trampa fácil de cometer.
- **Función helper `public.llamadas_topic_empresa_id(text)`**: parsea el UUID del topic de forma segura (plpgsql con `exception when others` → NULL si no es UUID), evitando que un cast `::uuid` inválido rompa la evaluación de la policy. Verificado: topics válidos → UUID, no-llamadas → NULL, uuid inválido → NULL.
- **Token de sesión en Realtime**: antes de suscribir a canal privado, `await supabase.realtime.setAuth(session.access_token)` (obtenido de `getSession()`), si no la autorización falla.
- **Señales dirigidas en canal compartido**: el canal es por-empresa (lo comparten todos los empleados), así que cada `SignalMessage` lleva `to`/`from` y el receptor filtra `msg.to === userId`. Presence usa `key: userId`.
- **Cliente activo**: `useEmpresa()` → `empresaActual.dbId`; `useAuth()` → `user.id` + `profile`. Browser client singleton de `@/lib/supabase/client`.
- **Pendiente de runtime**: la prueba E2E de dos sesiones reales intercambiando señales sobre el canal privado se hará en Fase 4 (requiere navegador con dos usuarios). En Fase 2 se validó: políticas creadas, parser correcto, typecheck limpio.

### 2026-06-06: Fase 3 completada — motor WebRTC (solo audio) + ICE
- **Decisión de conectividad: STUN-only, cero externo** (a petición del usuario). `/api/llamadas/ice` devuelve STUN público de Google por defecto; TURN es OPCIONAL y solo se añade si existen las env `TURN_URLS`/`TURN_USERNAME`/`TURN_CREDENTIAL`. Así no hay que dar de alta nada externo ahora y enchufar TURN luego = definir 3 variables (sin tocar código). Cubre ~85% de llamadas; el ~15% de redes con NAT simétrico necesitará TURN.
- **`usePeerConnection`** (`hooks/usePeerConnection.ts`): ciclo de vida RTCPeerConnection 1-a-1, solo audio. Métodos imperativos (`startCall`, `answerCall`, `handleAnswer`, `handleRemoteCandidate`, `toggleMute`, `hangup`) que el provider (Fase 4) orquesta. Reproduce el audio remoto en un `Audio()` interno (sin necesidad de `<audio>` en el DOM), con guarda SSR.
- **Buffering de ICE en ambos extremos**: candidatos que llegan antes de `setRemoteDescription` se encolan (`pendingCandidates`) y se drenan tras fijar la descripción remota. El callee bufferea con `pc` aún nulo (antes de aceptar); el caller bufferea entre enviar offer y recibir answer.
- **Endpoint con auth**: `/api/llamadas/ice` exige sesión (`getAppContext`, 401 si no) y `Cache-Control: no-store` (las credenciales TURN, cuando existan, serán temporales).
- **Artefacto stale de `.next`**: tras añadir la ruta, `tsc` reportó un error en `.next/types/validator.ts` sobre `(main)/comunicacion/page.js` (ruta inexistente en fuente; `.next` está gitignored). Es caché viejo de Next, ajeno a esta feature; se regenera en `next build`. El código nuevo tiene 0 errores de tipos.
- **Pendiente de runtime**: audio bidireccional real entre dos dispositivos → Fase 4/6 (requiere navegador + permisos de micro + gesto de usuario).

### 2026-06-06: Fase 4 completada — UI (entrante/saliente/en curso) + montaje
- **Provider global**: `LlamadasProvider` montado en `src/shared/providers.tsx` dentro de `EmpresaProvider`/`AuthProvider` → presente en escritorio Y móvil, en todas las rutas autenticadas. No-op si no hay usuario (rutas públicas/login). Resuelve la dependencia circular signaling↔peer con refs (`peerRef`, `sendSignalRef`) y lee/escribe el estado vía `useLlamadaStore.getState()` dentro de `handleSignal` para evitar closures obsoletos.
- **Identidad en la oferta**: `startCall` ahora adjunta `fromNombre`/`fromAvatar` al mensaje `offer`, para que la tarjeta de entrante muestre quién llama sin un mensaje "invite" aparte (evita problemas de orden de llegada).
- **Tono sin assets**: `lib/ringtone.ts` genera el tono con Web Audio API (no hay ficheros de audio en `public/`). Caveat conocido: algunos navegadores bloquean audio sin gesto previo → el respaldo será el push de Fase 5.
- **Overlays globales**: `LlamadaEntranteCard` (avatar+nombre+aceptar/rechazar) y `LlamadaEnCursoView` (cronómetro + mute + colgar), `fixed inset-0 z-[120]`, leen del store Zustand.
- **Directorio reutilizable**: `DirectorioEmpleados` (presencia en vivo, buscador, conectados primero) se usa en el `LlamadasDrawer` (Sheet de escritorio, botón `PhoneCall` indigo junto a Teléfono en `app-layout`) y en la ruta móvil `app/(mobile)/m/llamar/page.tsx`.
- **Barra móvil**: icono **Llamar** (`Phone`) insertado a la IZQUIERDA de Fichar en `MobileBottomNav` → Inicio · Llamar · Fichar · Chat · Más, para todos.
- **Estados de BD cableados**: conectada (al `connectionState=connected`), finalizada/cancelada (colgar según rol+fase), rechazada, ocupado (busy), fallida. `perdida`/timeout queda para Fase 5.
- **Validación**: typecheck 0 errores en código nuevo. `next build` completo bloqueado por WIP ajeno (`MeetDrawer.tsx`), no por esta feature. Prueba E2E de voz real entre 2 sesiones = manual (Fase 6 / usuario).

### 2026-06-06: Corrección de ubicación en escritorio (feedback del usuario)
- **NO crear un botón nuevo en la barra superior**: el Teléfono ya existe. El usuario exige que las llamadas internas vivan **dentro del `TelefonoDrawer`**, no en un botón aparte. Revertido el botón `PhoneCall` y eliminado `LlamadasDrawer.tsx`.
- Las llamadas internas son ahora la pestaña **"Equipo"** (icono `Users`) dentro del Teléfono, **pestaña por defecto** al abrir. El softphone externo (Marcador/Recientes/Ajustes) convive en las demás pestañas del mismo drawer. Esto invalida la decisión previa del PRP de "pieza separada del softphone" en la UI (el motor SÍ sigue separado; solo la UI vive dentro del Teléfono).
- Móvil sin cambios: icono Llamar en la barra → `/m/llamar`.

### 2026-06-06: Fase 5 completada — background/push + estados borde + reconexión
- **Push de llamada entrante**: `push-server.ts` ampliado con `eventType: "llamada_entrante"` y opt-in `push_llamadas` (columna ya creada en Fase 1, default true). `createLlamada` envía el push al callee tras insertar (título "Llamada entrante", body "<caller> te está llamando", `requireInteraction`, `vibrate`, `data.url=/m/llamar`). El push es respaldo: si falla, Realtime sigue valiendo.
- **SW**: `public/sw.js` ahora reenvía `requireInteraction`/`renotify`/`vibrate`/`actions` desde el payload; `notificationclick` ya abría `data.url`. Resultado: con app cerrada/móvil bloqueado, suena/vibra y al tocar abre la app.
- **Reenvío de oferta + apertura desde push (clave)**: cuando el callee tiene la app cerrada, el offer (Broadcast efímero) se pierde. Solución: el caller **reenvía la oferta cada 2,5 s** mientras `fase==="saliente"`; al abrir la app desde el push, el provider se suscribe a Realtime y recibe el siguiente reenvío → suena. Guarda anti-duplicado: si llega un offer con el `callId` ya activo, se ignora (no re-suena ni responde "busy").
- **No contesta → perdida**: timeout de 35 s en estado saliente → `cancel` al callee + DB `perdida` + toast. Timers se limpian con un efecto cuando `fase` deja de ser "saliente".
- **Reconexión ante microcorte**: `usePeerConnection` da 7 s de gracia en `connectionState==="disconnected"` antes de declarar `fallida` (un blip de red no tumba la llamada). ICE-restart con renegociación completa queda como mejora futura (requiere distinguir offer de renegociación vs. nueva llamada).
- **Límite honesto comunicado al usuario**: una PWA NO puede pintar pantalla de llamada full-screen sobre el bloqueo (CallKit/ConnectionService son nativos). Lo entregado = notificación que suena/vibra + abre la llamada al tocar (en Android muy cercano a WhatsApp; en iPhone requiere PWA instalada, iOS 16.4+).
- **Pendiente menor**: toggle de UI para `push_llamadas` en ajustes de notificaciones (hoy default true; funciona sin tocar nada).

### 2026-06-06: Fase 6 — validación final
- **Mejora detectada en revisión**: el SW ahora NO muestra la notificación de llamada si ya hay una ventana visible (el timbre in-app la gestiona) → evita doble aviso.
- **Verificación automática (toda OK)**:
  - typecheck: 0 errores en código de la feature (solo persisten los 5 de `MeetDrawer.tsx`, WIP ajeno).
  - BD: `llamadas_internas` (3 RLS), `realtime.messages` (2 RLS de canal privado), `profiles.push_llamadas` (default true), migraciones `llamadas_internas` + `llamadas_realtime_authz` aplicadas.
  - Revisión de flujo: offer/answer/ICE con buffering en ambos extremos; guarda anti-reenvío por callId; limpieza de timers por efecto de fase; estados borde (ocupado/rechazada/cancelada/perdida) y reconexión (7 s gracia) cableados.
- **14 archivos** de la feature + integración en `TelefonoDrawer` (pestaña Equipo), `MobileBottomNav` (icono Llamar), `providers.tsx` (provider global), `push-server.ts`/`sw.js` (push).

#### Guion de prueba manual (voz real — requiere 2 sesiones con micrófono)
1. **Misma empresa**: inicia sesión como empleado A (un dispositivo/navegador) y empleado B (otro). Ambos en la misma empresa activa.
2. **Directorio**: A abre Teléfono → pestaña Equipo (escritorio) o barra → Llamar (móvil). B aparece con punto verde (presencia).
3. **Llamada con app abierta**: A pulsa llamar a B → a B le salta la tarjeta entrante con tono → B acepta → hablar; probar silenciar y colgar; ver cronómetro.
4. **Rechazo / ocupado / sin respuesta**: repetir y B rechaza (A ve "rechazó"); con B ya en llamada, un tercero C llama a B → C ve "ocupado"; no contestar 35 s → "Sin respuesta" (perdida).
5. **Background (lo clave)**: B cierra la app / bloquea el móvil (PWA instalada). A llama → a B le llega la notificación que suena/vibra → B la toca → se abre la app y suena la llamada → acepta.
6. **Aislamiento multi-tenant**: empleado de OTRA empresa no aparece en el directorio ni puede recibir la llamada (ya verificado por RLS en Fase 1).
7. **Historial**: tras colgar, `listHistorialLlamadas` refleja la llamada con estado y duración.

> Nota: una prueba E2E automatizada de audio (Playwright con fake media `--use-fake-device-for-media-stream`) es posible como mejora futura; la validación de voz real es manual.

**Estado fases**: ✅ Fase 1 · ✅ Fase 2 · ✅ Fase 3 · ✅ Fase 4 · ✅ Fase 5 · ✅ Fase 6. **PRP-054 COMPLETO** (pendiente solo prueba de voz real manual del usuario).

---

## Gotchas

- [ ] **Supabase Realtime Broadcast** debe estar habilitado en el proyecto; Broadcast no requiere replicación de tablas pero sí que el cliente esté autenticado para canales privados. Considerar canales con autorización (RLS de Realtime) para impedir join a canal de empresa ajena.
- [ ] **TURN obligatorio**: redes corporativas de restaurantes (NAT simétrico, firewall) tumban WebRTC solo-STUN. Sin TURN, muchas llamadas fallarán. Las credenciales TURN deben ser **temporales** y servirse server-side; nunca el secret en el bundle.
- [ ] **HTTPS/WSS requerido**: `getUserMedia` y WebRTC solo en contextos seguros. Producción ya es HTTPS (`sistema.balleshosteleros.com`); en local usar https o `localhost`.
- [ ] **Permisos de micro/cámara**: iOS Safari/PWA exigen gesto de usuario y permisos explícitos; pedir `getUserMedia` solo al iniciar/aceptar, no al cargar.
- [ ] **Empresa activa**: usar SIEMPRE el `empresaId` de `getAppContext()` (cookie del selector). Un multiempresa solo llama dentro de la empresa activa.
- [ ] **Singleton del browser client** para Realtime: no crear instancias paralelas (ya cubierto en `client.ts`).
- [ ] **Glare** (ambos llaman a la vez): definir reglas de resolución de colisión de offers.
- [ ] **Push como respaldo, no como primario**: la señalización primaria es Realtime; el push solo cubre app en background y puede llegar con latencia.
- [ ] No reutilizar el `TelefonoDrawer` externo para esto: son piezas distintas (interno vs externo). Mantener separación (MEMORY telefonía).

## Anti-Patrones

- NO persistir SDP/ICE candidates en BD (efímeros → Realtime Broadcast).
- NO exponer credenciales/secret de TURN en el cliente.
- NO confiar solo en el nombre del canal para el aislamiento: la RLS de `llamadas_internas` con `empresas_del_usuario()` es la garantía final.
- NO usar SFU/servidor de medios para 1-a-1 (sobreingeniería; P2P basta).
- NO ignorar errores de TypeScript ni omitir Zod en inputs de las actions.
- NO filtrar el directorio solo por `profiles.empresa_id` (rompe multiempresa): usar profiles ∪ `user_empresas`.

---

*PRP pendiente aprobación. No se ha modificado código.*
