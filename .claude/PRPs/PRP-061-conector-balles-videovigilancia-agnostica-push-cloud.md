# PRP-061: Conector Balles — videovigilancia agnóstica de marca (appliance push → relay cloud)

> **Estado**: EN CURSO — Fases 1-2 ✅ (2026-06-21)
> **Fecha**: 2026-06-20
> **Proyecto**: Balles-Hosteleros
>
> **Progreso**:
> - ✅ **Fase 1** — Migración `20260621100000_conectores_videovigilancia.sql` aplicada: tabla `conectores` (RLS `empresas_del_usuario()`, 4 políticas, trigger `updated_at`) + columnas en `camaras` (`conector_id`, `onvif_uid`, `rtsp_path`, `soporta_rebobinado`, `grabacion_cloud`) + tipos `types/conector.ts`. Typecheck OK.
> - ✅ **Fase 2** — `conectores-actions.ts` (CRUD + pairing code único con caducidad 15 min), endpoint `/api/conector/pair` (canje 1-solo-uso por service role, entrega `device_token` una vez, guarda solo hash), `lib/pairing.ts`, `ConectorPairingDialog.tsx` (gestor + QR + estado en vivo) cableado en `CamarasDrawer`. Lógica un-solo-uso validada en BD.
> - ⏳ **Fase 3+** — pendientes (heartbeat/descubrimiento, relay cloud, reproductor, rebobinado).

---

## Objetivo

Construir el **Conector Balles**: una cajita/appliance que el cliente enchufa al router, autodetecta sus cámaras por ONVIF/RTSP en LAN y **empuja** el vídeo hacia nuestra nube por una conexión de salida (sin IP pública ni abrir puertos). Un **relay cloud** (MediaMTX/go2rtc) convierte ese RTSP en WebRTC/HLS y lo sirve dentro del portal Balles (directo + rebobinado), reutilizando la feature existente `src/features/camaras`.

## Por Qué

| Problema | Solución |
|----------|----------|
| El directo/rebobinado en el portal exigía abrir el router o IP pública fija (bloqueado: el cliente esperaba a B2COM, y abrir puertos es un riesgo de seguridad) | El appliance abre una conexión **de salida** hacia nuestra nube; cero puertos entrantes, cero IP pública, cero config de red en el local |
| El P2P de Dahua es protocolo cerrado (solo apps de Dahua) y atado a una marca | El appliance habla **ONVIF/RTSP estándar**: agnóstico de marca, sirve a cualquier cliente futuro (Dahua, Hikvision, Reolink, Axis…) sin reescribir nada |
| Alta del conector compleja/manual por cliente | Asociación del conector a la empresa vía **código/QR** de un solo paso |
| Cada cliente con su grabador distinto | El grabador del cliente sigue siendo el almacén (DVR/NVR local); la nube solo retransmite. Grabación en nube = **extra de pago opcional** |

**Valor de negocio**: producto de videovigilancia vendible a **todo cliente** (no solo Habana/Bacanal), recurrente vía plan opcional de grabación cloud, sin coste de instalación de red y sin depender de operadores de internet. Desbloquea el visor que hoy muestra "Esperando grabador".

## Qué

### Criterios de Éxito
- [ ] Un appliance recién enchufado al router, sin configuración manual de red, descubre las cámaras de la LAN por ONVIF/RTSP y queda visible en el portal.
- [ ] La asociación conector→empresa se completa escaneando un QR / tecleando un código de 1 solo paso desde el portal (Ajustes → empresa o el propio drawer de Cámaras).
- [ ] El visor de `CamarasDrawer` reproduce **vídeo en directo** real (WebRTC o HLS) de al menos una cámara, en mosaico, dentro del portal — sustituyendo el placeholder "Esperando grabador".
- [ ] El cliente puede **rebobinar** (reproducir tramo pasado) desde el portal cuando el grabador lo soporta (RTSP playback Dahua o equivalente); degradación elegante si no.
- [ ] Toda la cadena va por conexión de salida del appliance: en el router del cliente **no se abre ningún puerto entrante** ni se exige IP pública.
- [ ] El grabador Dahua DH-XVR4116HS-I (16ch, RTSP 554, sin ONVIF Profile G) de Habana/Bacanal funciona vía el mismo appliance sin trato especial de marca.
- [ ] El plan de grabación en nube es un flag opcional por empresa/cámara; sin él, el almacén es el DVR/NVR del cliente.
- [ ] RLS multi-tenant: cada empresa solo ve sus conectores, cámaras y streams (`empresas_del_usuario()`).

### Comportamiento Esperado
**Happy path (alta + directo):**
1. Dirección crea un "Conector" en el portal → el sistema genera un **código/QR de emparejamiento** (token de un solo uso, caducidad corta).
2. El cliente enchufa la cajita al router; arranca, abre un túnel/registro de salida contra nuestro endpoint cloud y se identifica con el código → queda **emparejado** a la empresa.
3. El appliance escanea la LAN (ONVIF WS-Discovery + sondeo RTSP), reporta las cámaras encontradas (canal, nombre, capacidades) → aparecen en `camaras` asociadas al conector.
4. La dirección abre `CamarasDrawer`, selecciona cámaras y layout → el appliance publica los streams RTSP hacia el relay cloud, que los transmuxea a **WebRTC/HLS**; los tiles reproducen el directo.
5. Para **rebobinar**, el usuario elige fecha/hora → si el grabador soporta RTSP playback, el appliance tira ese stream histórico y el relay lo sirve igual; si no, el tile muestra aviso de "rebobinado no disponible en este grabador".

**Estados del conector**: `pendiente` (creado, sin emparejar) → `emparejado` → `online` (heartbeat reciente) / `offline` (sin heartbeat) → `error`.

---

## Contexto

### Referencias
- `src/features/camaras/` — feature a reutilizar/extender:
  - `actions/camaras-actions.ts` — CRUD de `camaras` (RLS por `empresa_id`, patrón `{ ok, data, error }`).
  - `components/CamarasDrawer.tsx` — visor mosaico (layouts 1/2×2/2×3/3×3/1+5); el `Tile` hoy es placeholder "Esperando grabador" — aquí va el reproductor real.
  - `lib/supabase-context.ts` — `getCamarasContext()` (supabase server + empresa activa).
- Tabla `camaras` existente: `id, empresa_id, local_id, nombre, ubicacion, canal, stream_subtipo, orden, activo, created_at, updated_at, created_by`. RLS vía `empresas_del_usuario()`.
- Wiring en `src/features/layout/components/app-layout.tsx` (icono `Cctv` → `CamarasDrawer`), permiso `puedeVer("CÁMARAS")`.
- Memoria `project_videovigilancia_camaras` — DVR Dahua DH-XVR4116HS-I confirmado: 16ch, RTSP `rtsp://user:pass@IP:554/cam/realmonitor?channel=N&subtype=1`, playback `/cam/playback?channel=N&starttime=...&endtime=...`, **sin ONVIF Profile G**. Credenciales en Drive (riesgo → mover a Accesos cifrado y rotar). El navegador NO reproduce RTSP → relay cloud obligatorio.
- Memorias de plataforma a respetar: RLS multi-tenant `empresas_del_usuario()`; versionar migraciones como `.sql` idempotente en `supabase/migrations/`; gestor de credenciales cifrado (PRP-043) para guardar usuario/clave de cámaras y grabadores; visibilidad por rol; sin `confirm()` nativo (usar `useConfirmDelete`); estado Activo/Inactivo donde aplique.
- Crons en `vercel.json` (Hobby = solo diarios): cualquier housekeeping de streams/heartbeats debe respetar esa limitación o resolverse en el propio relay, no en cron de minuto.
- Software (relay): **MediaMTX** o **go2rtc** (RTSP→WebRTC/HLS). En appliance: cliente ONVIF/RTSP + publicador hacia el relay (push) sobre conexión de salida.

### Arquitectura Propuesta

**Tres planos:** (a) appliance en el local, (b) relay cloud, (c) portal/BD.

```
src/features/camaras/                      # extender feature existente
├── actions/
│   ├── camaras-actions.ts                 # (existe) CRUD cámaras
│   ├── conectores-actions.ts              # crear conector, generar código/QR, listar, estado
│   └── streams-actions.ts                 # obtener URL firmada WebRTC/HLS por cámara + token rebobinado
├── components/
│   ├── CamarasDrawer.tsx                  # (existe) visor — Tile pasa a reproductor real
│   ├── CamaraTilePlayer.tsx               # <video> WebRTC/HLS con fallback y overlay estado
│   ├── RebobinadoBar.tsx                  # selector fecha/hora + play histórico
│   └── ConectorPairingDialog.tsx          # alta conector + QR/código + estado online/offline
├── hooks/
│   └── use-stream-url.ts                  # pide URL firmada al relay, refresca token
├── lib/
│   ├── supabase-context.ts               # (existe)
│   └── relay-client.ts                    # firma/solicita endpoints del relay (server-side)
└── types/
    └── conector.ts

src/app/api/conector/                      # plano cloud: endpoints que habla el appliance (auth por token de conector)
├── pair/route.ts                          # canjea código de emparejamiento → credenciales del conector
├── heartbeat/route.ts                     # latido + estado online/offline
└── cameras/route.ts                       # el appliance reporta cámaras descubiertas (ONVIF)

(infra/relay)                              # MediaMTX/go2rtc + publicador del appliance — fuera del repo Next.js
```

> El **firmware/agente del appliance** y el **relay** son artefactos de infraestructura (no Next.js). El PRP cubre su contrato (endpoints, tokens, formato de descubrimiento) y la integración en el portal; la imagen del appliance se entrega como spec + script de provisión, no como código de la app.

### Modelo de Datos

```sql
-- Appliance físico asociado a una empresa (1 local típico, pero local_id opcional)
CREATE TABLE conectores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  local_id      UUID REFERENCES locales(id),
  nombre        TEXT NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','emparejado','online','offline','error')),
  -- emparejamiento de un solo uso
  pairing_code  TEXT UNIQUE,
  pairing_expira TIMESTAMPTZ,
  -- credencial del appliance tras emparejar (hash, nunca el secreto en claro)
  device_token_hash TEXT,
  last_seen_at  TIMESTAMPTZ,
  fw_version    TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID
);

-- Extender la tabla camaras existente con el vínculo al conector y datos de stream
ALTER TABLE camaras ADD COLUMN conector_id UUID REFERENCES conectores(id) ON DELETE SET NULL;
ALTER TABLE camaras ADD COLUMN onvif_uid   TEXT;     -- id estable reportado por ONVIF/discovery
ALTER TABLE camaras ADD COLUMN rtsp_path   TEXT;     -- ruta RTSP relativa (sin credenciales)
ALTER TABLE camaras ADD COLUMN soporta_rebobinado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE camaras ADD COLUMN grabacion_cloud    BOOLEAN NOT NULL DEFAULT false;  -- extra de pago
-- credenciales de cámara/grabador NO van aquí: se guardan cifradas vía gestor de credenciales (PRP-043)

-- RLS multi-tenant (patrón obligatorio del proyecto)
ALTER TABLE conectores ENABLE ROW LEVEL SECURITY;
CREATE POLICY conectores_rw ON conectores
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));
-- Nota: los endpoints /api/conector/* autentican por device_token del appliance
-- (service role), NO por sesión de usuario → RLS no aplica a esa ruta.
```

> Decisión de seguridad: las credenciales de acceso a cámaras/grabador (usuario/clave RTSP) **no se almacenan en `camaras`**; viven cifradas en el gestor de credenciales (PRP-043) y solo el appliance/relay las usa, nunca el navegador. La migración se versiona como `.sql` idempotente.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Modelo de datos y dominio del conector
**Objetivo**: Tabla `conectores` + columnas nuevas en `camaras` + RLS + tipos + migración versionada idempotente. Sin UI todavía.
**Validación**: migración aplicada y reflejada en `supabase/migrations/`; `list_tables` muestra `conectores` con RLS; `npm run typecheck` pasa con los nuevos tipos.

### Fase 2: Emparejamiento conector ↔ empresa (código/QR)
**Objetivo**: Acciones `conectores-actions.ts` (crear conector, generar `pairing_code`+QR de un solo uso con caducidad, listar, estado) y endpoint `/api/conector/pair` que canjea el código por `device_token`. Diálogo `ConectorPairingDialog` con QR.
**Validación**: crear conector genera QR; canjear el código vía endpoint (curl/test) devuelve token y marca `emparejado`; segundo canje falla (un solo uso); RLS impide ver conectores de otra empresa.

### Fase 3: Heartbeat y descubrimiento de cámaras (contrato appliance)
**Objetivo**: Endpoints `/api/conector/heartbeat` (online/offline + `last_seen_at` + `fw_version`) y `/api/conector/cameras` (el appliance reporta cámaras ONVIF/RTSP descubiertas → upsert en `camaras` por `onvif_uid`, vinculadas al conector). Spec del agente del appliance (ONVIF WS-Discovery + sondeo RTSP) como documento de contrato.
**Validación**: heartbeat actualiza estado; un POST de descubrimiento de prueba crea/actualiza cámaras con `conector_id`, `rtsp_path`, `soporta_rebobinado`; estado pasa a `online` con heartbeat reciente y a `offline` sin él.

### Fase 4: Relay cloud RTSP→WebRTC/HLS (infra) + URLs firmadas
**Objetivo**: Desplegar MediaMTX/go2rtc en cloud; el appliance publica (push, salida) los RTSP hacia el relay; `streams-actions.ts` + `relay-client.ts` emiten URLs WebRTC/HLS **firmadas y de vida corta** por cámara, validando pertenencia a la empresa.
**Validación**: una cámara de prueba (o el DVR Dahua si hay acceso) se ve en directo desde una URL firmada; la URL caduca; sin sesión válida no se obtiene URL.

### Fase 5: Reproductor en el portal (directo)
**Objetivo**: `CamaraTilePlayer` (WebRTC con fallback HLS) reemplaza el placeholder del `Tile` en `CamarasDrawer`; overlay de estado (online/offline/reconectando), respeta layouts y selección actuales.
**Validación**: el mosaico reproduce directo real de ≥1 cámara; estados online/offline reflejan heartbeat; degradación elegante si el stream cae; permiso `puedeVer("CÁMARAS")` sigue gobernando acceso.

### Fase 6: Rebobinado y grabación cloud opcional
**Objetivo**: `RebobinadoBar` (selector fecha/hora) tira de RTSP playback del grabador cuando `soporta_rebobinado` (Dahua `/cam/playback`); flag `grabacion_cloud` por cámara/empresa (extra de pago) que, si está activo, hace que el relay grabe en almacenamiento cloud y permita rebobinar aunque el grabador no soporte playback.
**Validación**: rebobinado funciona contra un grabador con playback; con `soporta_rebobinado=false` y sin grabación cloud el tile avisa "no disponible"; con `grabacion_cloud=true` el rebobinado funciona desde la nube.

### Fase 7: Validación Final
**Objetivo**: Sistema end-to-end: enchufar → emparejar por QR → descubrir → ver directo → rebobinar, sin abrir puertos.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot del visor con directo real (o stub de relay) en mosaico
- [ ] Migración versionada en `supabase/migrations/` e idempotente
- [ ] Criterios de éxito cumplidos (incl. cero puertos entrantes en el router del cliente)

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

### (pendiente)
- **Error**: —
- **Fix**: —
- **Aplicar en**: —

---

## Gotchas

- [ ] El navegador **no** reproduce RTSP: el relay cloud (WebRTC/HLS) es obligatorio, no opcional.
- [ ] El DVR Dahua XVR4000 **no tiene ONVIF Profile G** → el rebobinado por ONVIF está descartado; usar RTSP playback de Dahua (`/cam/playback`) o, si el Cooper no lo honra, NetSDK/HTTP-CGI; si nada, depender de grabación cloud.
- [ ] Todo el tráfico del appliance es **de salida** (registro/túnel hacia nuestra nube). Nunca diseñar nada que requiera un puerto entrante o IP pública en el local (ese era el bloqueo que esta arquitectura elimina).
- [ ] Credenciales de cámara/grabador (RTSP user/pass) **cifradas** en el gestor de credenciales (PRP-043), nunca en `camaras` ni en el cliente. Rotar las credenciales actuales de Dahua que hoy están en un Excel de Drive.
- [ ] URLs de stream **firmadas y de vida corta**, validadas contra `empresas_del_usuario()`; un link de vídeo no puede ser permanente ni compartible entre empresas.
- [ ] Los endpoints `/api/conector/*` autentican por **device_token del appliance** (service role), no por sesión de usuario; aislar bien esa superficie y no exponerla a RLS de usuario.
- [ ] `pairing_code` de **un solo uso** y caducidad corta; tras canjear, invalidar.
- [ ] Vercel Hobby solo admite crons **diarios**: el housekeeping de heartbeats/offline debe resolverse en el relay o con marca de tiempo + lectura, no con cron de minuto.
- [ ] ONVIF WS-Discovery es multicast en LAN: corre en el **appliance**, jamás desde la nube ni el navegador.
- [ ] Reutilizar `camaras` y `CamarasDrawer` existentes (no crear feature paralela); `Tile` ya está aislado para sustituir por el reproductor.

## Anti-Patrones

- NO crear una feature `videovigilancia` nueva: extender `src/features/camaras`.
- NO pedir al cliente abrir puertos / contratar IP pública (toda la premisa es evitarlo).
- NO guardar credenciales de cámara en `camaras` ni mandarlas al navegador.
- NO atar la lógica a Dahua/P2P: el contrato es ONVIF/RTSP agnóstico de marca.
- NO usar `any`; SIEMPRE Zod en inputs (pairing, descubrimiento, rebobinado); SIEMPRE RLS multi-tenant.
- NO `confirm()`/`alert()` nativos (usar `useConfirmDelete`).
- NO aplicar cambios de esquema sin versionar el `.sql` idempotente.

---

*PRP pendiente aprobación. No se ha modificado código.*
