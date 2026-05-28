# PRP-049: Reserve with Google End-to-End (Actions Center / Reservations Partner)

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-28
> **Proyecto**: Balles-Hosteleros (multi-tenant, mismo repo)

---

## Objetivo

Que un comensal pueda pulsar **"Reservar mesa"** en la ficha de Google Maps / Google Search de cualquier local Balles activado y completar la reserva **sin salir de Google**. La reserva entra atómicamente en `reservas` con `origen='GOOGLE'`, vinculada al `place_id` del local correcto, y cualquier cambio posterior (cancelación desde sala, modificación, no-show) se propaga a Google en tiempo real. Cubrimos el contrato completo del Actions Center: feeds (Merchant + Services + Availability), Booking Server (5 endpoints REST), webhook saliente Balles → Google, y un panel interno de salud requerido por las Platform Policies para no perder la certificación.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy el origen `GOOGLE` existe en el enum canónico (`src/features/sala/data/origenes.ts`) pero **nada lo escribe**: los clientes que ven el botón "Reservar" en Maps son redirigidos al sitio del restaurante, abandonan en el camino y la atribución se pierde como `OTROS`. | Integración nativa: Google llama directamente a nuestro Booking Server, la reserva nace ya con `origen='GOOGLE'` y `external_id` del partner, sin fricción de redirect. |
| Cada empresa multi-local (Habana, Bacanal, futuras) tiene su propio Google Business Profile con `google_place_id` ya guardado en `empresas` (lo usa `google-resenas-sync`), pero ese identificador no se reutiliza para reservas. Es duplicar trabajo no integrar canales con la misma clave. | Reutilizamos `empresas.google_place_id` como `merchant_id` del feed y como dispatcher del Booking Server. Un solo programa partner agrupa todas las empresas Balles. |
| Sin un Booking Server propio dependemos de plataformas terceras (OpenTable / TheFork / CoverManager) que cobran 1 €–3 € por cubierto y se quedan la ficha del cliente. Para un grupo con ~6 000 reservas Google/mes son 12 000 €/año en comisiones evitables. | Implementación nativa = 0 € por cubierto y la ficha cliente queda dentro de Balles (`clientes_sala` + `find_or_link_cliente_sala`). |
| Double-booking inminente: si el mismo slot lo cogen una reserva web (`/reservar/[slug]`), una llamada al teléfono (alta manual en sala) y Google a la vez, el modelo actual de cupos por turno no tiene locking. Con Google encima la frecuencia colisión sube ×10. | Locking optimista vía función Postgres `try_reservar_slot()` con `SELECT ... FOR UPDATE` sobre `reserva_slots_lock`. CreateBooking de Google se rechaza con `SLOT_UNAVAILABLE` si no obtiene el lock; resto de canales también pasan por la misma puerta. |
| Reserve with Google obliga a que el partner exponga `BatchAvailabilityLookup` con latencia P95 < 2 s y publique métricas; si fallamos, Google retira el botón sin aviso (Platform Policy 4.1). | Booking Server en Edge Functions de Supabase (cerca de la BD), monitorización propia con tabla `bsv_metricas` y panel `/ajustes/canales/google/salud` que muestra P95 y tasa éxito en vivo. |
| Los feeds JSON deben subirse a SFTP de Google **diariamente** + emitir delta incremental cuando cambia la disponibilidad. Hoy no hay infraestructura de feeds. | Cron `/api/cron/google-rwg-feeds` (force-dynamic) + cron incremental `/api/cron/google-rwg-availability-delta` cada 5 min; ambos suben con `ssh2-sftp-client` a la ruta del Actions Center; estado y errores se quedan en `google_rwg_feed_runs`. |

**Valor de negocio**:
- Activar el canal **Reserve with Google** sin pagar a intermediarios → ahorro estimado 12 000 €/año (grupo) por reservas que ya habríamos perdido a OpenTable.
- Atribución cerrada: en `/sala/reservas` la columna "Origen" mostrará GOOGLE con su badge verde (#22c55e ya definido), y `v_analitica_origen` reflejará el peso real del canal.
- Diferenciador comercial para vender Balles a nuevos clientes: "el único SaaS español que mete tu reserva nativa en Google sin comisión por cubierto".
- Cumplimiento de las Platform Policies → permite postularnos como partner certificado (paralelo, fuera del scope técnico).

---

## Qué

### Criterios de Éxito

- [ ] El cron `/api/cron/google-rwg-feeds` corre a diario, genera 3 ficheros JSON válidos (Merchant Feed, Services Feed, Availability Feed) con el esquema `food-ordering-actions` v2 del Actions Center y los sube por SFTP. Cada run deja una fila en `google_rwg_feed_runs` con `estado IN ('ok','fallido')`, `bytes`, `errores_json`.
- [ ] El cron incremental `/api/cron/google-rwg-availability-delta` (cada 5 min, configurable) detecta cambios en `reservas`/`empresa_reservas_excepciones`/`empresa_reservas_config` y publica solo el delta de disponibilidad afectado, marcado como `feed_type='availability_delta'`.
- [ ] El Booking Server expone los 5 endpoints REST en `/api/google/rwg/*` (Edge Functions, runtime `edge`) con el contrato exacto del Actions Center (proto JSON):
  - `POST /api/google/rwg/v1/HealthCheck` — responde 200 con `{ "operation_succeeded": true }`.
  - `POST /api/google/rwg/v1/BatchAvailabilityLookup` — recibe lista de `slot_time`, devuelve `slots[]` con `spots_open` calculado desde `empresa_reservas_config` + `reservas` actuales. P95 < 2 s medido en `bsv_metricas`.
  - `POST /api/google/rwg/v1/CreateBooking` — crea reserva con lock optimista (`try_reservar_slot` RPC), responde `booking` con `booking_id=<uuid de reservas.id>`. Idempotente por `idempotency_token`.
  - `POST /api/google/rwg/v1/UpdateBooking` — soporta cambio de estado `CANCELED_BY_USER` y `CONFIRMED`. Para cancelaciones aplica `politicas_cancelacion` (fee/penalización ya modeladas).
  - `POST /api/google/rwg/v1/SetMarketingPreference` — persiste opt-in marketing en `clientes_sala.marketing_optin` (alta booleana nueva o reutilización de campo existente).
- [ ] Autenticación: todas las llamadas entrantes traen header `Authorization: Basic <base64(google:SECRET)>` validado contra `GOOGLE_RWG_AUTH_TOKEN` env var. Cualquier 401 se loguea en `bsv_metricas` con `estado='401'`.
- [ ] Idempotencia: si Google reenvía un `CreateBooking` con el mismo `idempotency_token` (campo nuevo `external_idempotency_token` en `reservas`), se devuelve la reserva existente sin duplicar (200 OK con el booking original). Verificado con test e2e.
- [ ] Lock optimista: dos `CreateBooking` simultáneos sobre el mismo slot con cupo=1 → uno gana, el otro recibe `SLOT_UNAVAILABLE` (Google error code 7). Verificado con script de carga paralela contra entorno de staging.
- [ ] Tabla `reservas` extendida con: `external_id text` (booking_id de Google), `external_origen text` (GOOGLE_RWG / OPENTABLE / etc., reserva-friendly para futuros partners), `external_idempotency_token text`, `politica_cancelacion_snapshot jsonb` (snapshot inmutable de la política aplicada en CreateBooking).
- [ ] Mapeo `empresa.google_place_id` → `merchant_id` del feed verificado: el `BatchAvailabilityLookup` resuelve la empresa por `merchant_id` y solo devuelve disponibilidad de esa empresa. Sin match → 200 con `slots=[]` (no 404, según Platform Policy).
- [ ] **Webhook saliente** (`google-rwg-notify-actions.ts`): al cambiar `reservas.estado` desde sala (CANCELADA, NO_SHOW, modificación de fecha/personas) **y** `reservas.external_origen='GOOGLE_RWG'`, se llama a la Partner Notification API de Google con reintentos exponenciales (3 intentos, backoff 1s/4s/16s) y se registra en `google_rwg_notificaciones`.
- [ ] Trigger Postgres `trg_notify_google_on_reserva_update` enfila la notificación en `google_rwg_notificaciones` con `estado='pendiente'` (no llama HTTP desde el trigger; lo hace el cron `/api/cron/google-rwg-notify-pending` cada 60 s).
- [ ] Panel interno `/ajustes/canales/google/salud` (sub-vista en Ajustes → Canales) muestra: estado del último run de cada feed, P95 de cada endpoint en últimas 24 h, tasa de éxito (200 / total) por endpoint, cola de `google_rwg_notificaciones` pendientes/fallidas, botón "Reintentar fallidas".
- [ ] El enum/string `origen='GOOGLE'` ya existe en `ORIGENES_RESERVA` (no se modifica). El campo nuevo `external_origen='GOOGLE_RWG'` distingue Reserve with Google de otras integraciones futuras (RWG vs. simple click-through a `/reservar/[slug]?o=GOOGLE`).
- [ ] RLS de todas las tablas nuevas (`google_rwg_feed_runs`, `bsv_metricas`, `google_rwg_notificaciones`, `reserva_slots_lock`) usa `empresas_del_usuario()` para SELECT desde UI. Los endpoints del Booking Server usan `service_role` (`createAdminClient`) — están autenticados por `GOOGLE_RWG_AUTH_TOKEN`, no por sesión de usuario.
- [ ] `npm run typecheck` y `npm run build` pasan limpios. `mcp__supabase__get_advisors` sin nuevos warnings.
- [ ] Multi-tenant: dos empresas con `google_place_id` distinto activadas en paralelo no se contaminan. Test: BACANAL recibe `CreateBooking` y NO aparece nada en HABANA.

### Comportamiento Esperado

**Happy path comensal (reserva nativa desde Google Maps):**
1. Lucía busca "Habana Madrid" en Google Maps en su móvil. Aparece el botón **"Reservar mesa"** (provisto por el Actions Center).
2. Lucía selecciona 4 personas, sábado 21:30. Google llama `POST /api/google/rwg/v1/BatchAvailabilityLookup` con `merchant_id=ChIJxxxxx` (place_id de Habana) y un rango de slots.
3. Balles resuelve `empresa_id` desde `empresas.google_place_id=ChIJxxxxx`, lee `empresa_reservas_config` + `reservas` confirmadas del día y devuelve los slots con `spots_open` correcto. Latencia 240 ms.
4. Lucía elige 21:30. Google muestra formulario nativo con nombre, teléfono, opcional email/notas. Acepta términos.
5. Google llama `POST /api/google/rwg/v1/CreateBooking` con `idempotency_token=abc123`, datos cliente, slot, opcional `marketing_opt_in=true`.
6. Balles llama RPC `try_reservar_slot(empresa_id, fecha, turno, personas)`. Devuelve `granted=true`. Luego `findOrLinkClienteSala` (helper existente) vincula la ficha. INSERT en `reservas` con `origen='GOOGLE'`, `external_origen='GOOGLE_RWG'`, `external_id=<google_booking_id>`, `external_idempotency_token=abc123`, snapshot de `politicas_cancelacion` activa.
7. Devuelve 200 con `booking.booking_id=<uuid>` y `confirmation_message="Reserva confirmada en Habana Madrid. Te esperamos el sábado a las 21:30."`. Latencia 380 ms.
8. María (jefe de sala) entra a `/sala/reservas`. Ve la fila con badge verde **GOOGLE** en la columna Origen y badge informativo "Reserve with Google" en el detalle de la reserva (al lado del badge "Tarjeta no introducida" existente).

**Happy path sala (cancelación se propaga a Google):**
9. Pedro, propietario, llama 2 h antes para cancelar. María cambia el estado a `CANCELADA` desde la fila.
10. `updateReserva` aplica el UPDATE → trigger `trg_notify_google_on_reserva_update` enfila fila en `google_rwg_notificaciones` con `tipo='UPDATE_BOOKING'`, `payload_json={booking_id, status:"CANCELED_BY_MERCHANT"}`, `estado='pendiente'`.
11. Cron `/api/cron/google-rwg-notify-pending` (cada 60 s) toma la fila, llama Partner Notification API. 200 OK → `estado='enviado'`, `enviado_en=now()`.
12. Google quita el cubierto del calendario nativo del usuario. Si Lucía vuelve a Maps ve "Tu reserva ha sido cancelada por el restaurante".

**Edge cases**:
- `CreateBooking` con `idempotency_token` ya visto → devuelve la reserva existente sin INSERT nuevo (200 OK).
- `CreateBooking` con slot lleno (lock fail) → 200 con `error_message` + `booking_failure.reason=SLOT_UNAVAILABLE`. Google retira el slot del cache.
- `CreateBooking` con `merchant_id` desconocido → 200 con `slots=[]` en availability previa, error semántico en create. Loguear en `bsv_metricas` con `causa='merchant_unknown'`.
- Cambio de hora desde sala (`updateReserva` cambia `fecha`/`hora`/`personas`) → trigger enfila `tipo='UPDATE_BOOKING'`, Google recibe el nuevo slot; si Google rechaza (slot ocupado en su lado), el partner debe avisar al usuario por su lado (no requiere acción nuestra).
- Feed SFTP cae → `google_rwg_feed_runs` `estado='fallido'`, panel muestra alerta roja, botón "Reintentar". Tras 3 fallos consecutivos en 24 h, log de aviso a admin (notificación push existente o email).
- Empresa con `google_place_id=NULL` → no aparece en el feed (filtro `WHERE google_place_id IS NOT NULL` en el generador). Panel `/ajustes/canales/google` la muestra como "No activada" con CTA "Configurar Place ID".
- Booking Server P95 > 2 s sostenido 15 min → banner rojo en el panel de salud. (No retiramos auto-canal: lo hace Google con su propio monitor.)

---

## Contexto

### Referencias del codebase

- `src/features/sala/data/origenes.ts` — `ORIGENES_RESERVA` ya incluye `GOOGLE`; color `#22c55e`. **No tocar** — solo se escribirá por la integración.
- `src/features/sala/actions/reservas-actions.ts` — `createReserva` y `updateReserva` actuales; el Booking Server **no** los reutiliza (requiere service role + lock + idempotencia), pero deben respetar el mismo shape de `reservas` y disparar `findOrLinkClienteSala`.
- `src/features/sala/lib/cliente-link.ts` (referenciado en `reservas-actions.ts`) — `findOrLinkClienteSala` reutilizable desde el Edge Function (compatible con cliente admin).
- `src/features/reservar-publica/actions/crear-reserva-publica.ts` — patrón de inserción con `createAdminClient` + Zod estricto + `registrar_visita_cliente_sala`. **Plantilla mental** para los handlers RWG.
- `src/features/sala/data/reservas.ts` — `EstadoReserva` (17 estados), `EmpresaReservasConfig` (cupos/maxpax por turno × día), `EmpresaReservasExcepcion`, `PoliticaCancelacion`. El Booking Server **solo** crea reservas en estado `CONFIRMADA` (estado por defecto cuando Google la crea).
- `src/features/sala/actions/reservas-config-actions.ts` — cómo se leen los cupos efectivos (función `cupoEfectivo` exportada desde `hooks/useReservasMes.ts`). El handler `BatchAvailabilityLookup` reutiliza esta lógica adaptada a Edge.
- `src/features/sala/hooks/useReservasMes.ts` — `cupoEfectivo(config, excepciones, fecha, turno)` y `personasReservadasDelDia` — la fuente de la verdad para `spots_open`.
- `src/features/sala/actions/politicas-cancelacion-actions.ts` — lectura de políticas activas para snapshot.
- `src/features/calidad/actions/resenas-actions.ts` (líneas 34, 43, 57, 69) — `empresas.google_place_id` ya gestionado, **reutilizar** como `merchant_id` del Actions Center.
- `src/app/api/cron/google-resenas-sync/route.ts` — patrón existente de cron + force-dynamic + iteración por empresa con `google_place_id`. Replicar la estructura para `google-rwg-feeds`.
- `src/lib/supabase/admin.ts` — `createAdminClient()` con `service_role`. Obligatorio en endpoints RWG (sin sesión de usuario).
- `src/features/empresa/lib/empresa-server.ts` — `getEmpresaActivaForUser` (para el panel de salud que sí es server action con sesión).
- `src/features/ajustes/components/locales/LocalesEmpresaTab.tsx` — patrón visual de Ajustes → sub-tab. Replicar para "Canales de reserva".
- `src/shared/components/SubmoduleToolbar.tsx`, `src/shared/components/ResizableColumns.tsx`, `src/shared/components/TableColumnHeader.tsx` — configuración base universal de submódulo (memoria `feedback_configuracion_base_submodulo`).
- `src/features/sala/components/ReservasView.tsx` — añadir badge "Reserve with Google" en el detalle (junto a `ReservaFlagsChips`).
- PRP-046 (`PRP-046-campanas-marketing-y-links-reserva.md`) — patrón de tracking de origen + view `v_campanas_atribucion`. El enum `origen='GOOGLE'` ya está pensado para coexistir con palabras-clave libres.
- PRP-047 (`PRP-047-calendario-reservas-covermanager-configuracion.md`) — flags de reserva (`tarjeta_introducida`, `garantia_importe`, `politica_cancelacion_id`). Reutilizamos `garantia_importe` para depósitos opcionales pedidos por Google.

### Decisiones de arquitectura

1. **Booking Server en Edge Functions de Supabase**, no en Next.js. Razón: latencia P95 < 2 s exigida; las Edge Functions corren en el mismo Postgres y permiten que `BatchAvailabilityLookup` lea con < 50 ms el cupo. Las rutas Next.js (`/api/google/rwg/*`) actúan como **proxy delgado** que reenvía al Edge Function (mismo dominio para certificación Google + autenticación centralizada). Alternativa rechazada: solo Next.js → cold start de Vercel + RTT a Supabase = ~700 ms baseline, demasiado cerca del límite.
2. **Reutilizamos `empresas.google_place_id`** como `merchant_id`. **No** creamos una nueva tabla de mapeo. Razón: ya tiene RLS, ya está probado con `google-resenas-sync`, y simplifica la activación (configurar Place ID en Ajustes ya activa Reviews + RWG con un solo paso).
3. **Tabla `reserva_slots_lock` (locking optimista)** con clave `(empresa_id, fecha, turno)` y columna `personas_acumuladas int`. Función `try_reservar_slot(empresa_id, fecha, turno, personas)` con `SELECT ... FOR UPDATE` + comparación contra `cupoEfectivo`. Devuelve `granted boolean`. **Todos** los canales (Google, web pública, alta manual sala) pasan por la misma función → coherencia. Migración futura: trigger `BEFORE INSERT ON reservas` que llame a la función automáticamente.
4. **Idempotencia por `external_idempotency_token`** (nullable en `reservas`, UNIQUE parcial `WHERE external_idempotency_token IS NOT NULL`). El INSERT del Booking Server hace `ON CONFLICT (external_idempotency_token) DO NOTHING RETURNING id`; si no devuelve fila, hace SELECT por token y devuelve esa. **No** usar Redis ni KV externo en v1.
5. **Webhook saliente vía cron + tabla cola** (`google_rwg_notificaciones`), no llamada síncrona desde el trigger Postgres. Razón: `pg_net` requiere extensión + secret + 5-10 s timeout; un cron Next.js cada 60 s tiene mejor observabilidad y reintentos controlados. El trigger solo enfila.
6. **Snapshot de política de cancelación** (`politica_cancelacion_snapshot jsonb`) congela la política aplicada en el momento de CreateBooking. Razón: el dueño puede cambiar la política mañana; la reserva de Google debe respetar lo que se le mostró al usuario.
7. **El campo nuevo `external_origen`** (vs sobrecargar `origen`): mantiene `origen` como bucket canónico para analítica (GOOGLE / WEB / WALKIN / …) y permite distinguir `GOOGLE_RWG` (Reserve with Google nativo) de un futuro `GOOGLE_LOCAL_SERVICES` o `GOOGLE_MAPS_LINK_CLICK`. La columna `Origen` de `ReservasView` sigue mostrando `origen`; el detalle muestra ambos.
8. **Feeds JSON generados como ficheros temporales y subidos por SFTP**, no servidos en HTTP. Razón: Actions Center recomienda SFTP para feeds > 10 MB y nuestro Availability Feed lo será (cientos de slots × 30 días × N locales). HTTP push solo se usaría para el delta. Decisión: **SFTP para los 3 feeds, HTTP push solo cuando RWG lo pida en un release futuro**.
9. **Panel de salud en Ajustes**, no en una página propia. Razón: el panel es operativo (no diario), debe vivir junto a la configuración de Place ID. Ruta: `/ajustes/canales/google/salud`.
10. **Sin UI para activar/desactivar el canal por empresa en v1**: tener `google_place_id` ya implica activación. El admin de Balles decide globalmente con la env var `GOOGLE_RWG_ENABLED=true`. v2 puede añadir un toggle `empresas.google_rwg_enabled` si se necesita.

### Modelo de datos

```sql
-- ============================================================
-- 1. RESERVAS — extender con campos del Booking Server
-- ============================================================
alter table public.reservas
  add column if not exists external_id text,                     -- booking_id de Google
  add column if not exists external_origen text,                 -- GOOGLE_RWG | OPENTABLE | …
  add column if not exists external_idempotency_token text,
  add column if not exists politica_cancelacion_snapshot jsonb,
  add column if not exists marketing_optin boolean default false;

-- Idempotencia: si Google reenvía el mismo token, no duplicamos.
create unique index if not exists ux_reservas_idempotency
  on public.reservas (external_idempotency_token)
  where external_idempotency_token is not null;

create index if not exists idx_reservas_external_origen
  on public.reservas (empresa_id, external_origen) where external_origen is not null;

-- ============================================================
-- 2. CLIENTES_SALA — opt-in marketing
-- ============================================================
alter table public.clientes_sala
  add column if not exists marketing_optin boolean default false,
  add column if not exists marketing_optin_origen text,         -- 'GOOGLE_RWG' | 'WEB' | …
  add column if not exists marketing_optin_at timestamptz;

-- ============================================================
-- 3. RESERVA SLOTS LOCK (locking optimista)
-- ============================================================
create table if not exists public.reserva_slots_lock (
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  fecha             date not null,
  turno             text not null check (turno in ('COMIDA','CENA','DIA_COMPLETO')),
  personas_total    int not null default 0,
  reservas_total    int not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (empresa_id, fecha, turno)
);

alter table public.reserva_slots_lock enable row level security;
create policy slot_lock_select on public.reserva_slots_lock
  for select using (empresa_id in (select empresas_del_usuario()));

-- Función Postgres: intenta reservar un slot con lock.
-- Devuelve true si se concedió, false si no había cupo.
create or replace function public.try_reservar_slot(
  p_empresa_id uuid,
  p_fecha date,
  p_turno text,
  p_personas int
) returns boolean
language plpgsql
as $$
declare
  v_cupo int;
  v_maxpax int;
  v_personas_actuales int;
  v_reservas_actuales int;
begin
  -- 1. Cupo efectivo (excepción del día > config semanal > general)
  select coalesce(
    (select coalesce(
       case when p_turno='COMIDA' then exc.cupo_comida else exc.cupo_cena end,
       null) from public.empresa_reservas_excepciones exc
     where exc.empresa_id=p_empresa_id and exc.fecha=p_fecha),
    -- TODO: aquí va la lógica de cupoEfectivo replicada (día semana × turno)
    999  -- sin límite por defecto
  ) into v_cupo;

  -- 2. Lock + acumulador (upsert atómico)
  insert into public.reserva_slots_lock(empresa_id, fecha, turno)
    values (p_empresa_id, p_fecha, p_turno)
  on conflict (empresa_id, fecha, turno) do nothing;

  select personas_total, reservas_total
    into v_personas_actuales, v_reservas_actuales
    from public.reserva_slots_lock
    where empresa_id=p_empresa_id and fecha=p_fecha and turno=p_turno
    for update;  -- LOCK

  -- 3. ¿Cabe?
  if v_personas_actuales + p_personas > v_cupo then
    return false;
  end if;

  -- 4. Confirmar
  update public.reserva_slots_lock
     set personas_total = v_personas_actuales + p_personas,
         reservas_total = v_reservas_actuales + 1,
         updated_at = now()
   where empresa_id=p_empresa_id and fecha=p_fecha and turno=p_turno;

  return true;
end;
$$;

-- Trigger: liberar slot al CANCELAR / NO_SHOW.
create or replace function public.liberar_slot_on_cancel() returns trigger
language plpgsql as $$
begin
  if new.estado in ('CANCELADA','NO_SHOW') and old.estado not in ('CANCELADA','NO_SHOW') then
    update public.reserva_slots_lock
       set personas_total = greatest(0, personas_total - new.personas),
           reservas_total = greatest(0, reservas_total - 1),
           updated_at = now()
     where empresa_id = new.empresa_id and fecha = new.fecha and turno = new.turno;
  end if;
  return new;
end;
$$;
create trigger trg_liberar_slot_on_cancel
  after update of estado on public.reservas
  for each row execute function public.liberar_slot_on_cancel();

-- ============================================================
-- 4. GOOGLE RWG FEED RUNS (auditoría de subidas SFTP)
-- ============================================================
create table if not exists public.google_rwg_feed_runs (
  id              uuid primary key default gen_random_uuid(),
  feed_type       text not null check (feed_type in ('merchant','services','availability','availability_delta')),
  iniciado_en     timestamptz not null default now(),
  finalizado_en   timestamptz,
  estado          text not null default 'corriendo' check (estado in ('corriendo','ok','fallido')),
  bytes           bigint,
  empresas_count  int,
  slots_count     int,
  errores_json    jsonb,
  sftp_remote     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_feed_runs_feed_type_fecha
  on public.google_rwg_feed_runs (feed_type, iniciado_en desc);

alter table public.google_rwg_feed_runs enable row level security;
-- Lectura desde el panel de salud (multi-tenant: solo admins/director).
create policy feed_runs_select on public.google_rwg_feed_runs
  for select using (
    exists (select 1 from public.profiles p
             where p.user_id = auth.uid() and p.role in ('admin','director'))
  );

-- ============================================================
-- 5. BOOKING SERVER MÉTRICAS (latencia + tasa éxito)
-- ============================================================
create table if not exists public.bsv_metricas (
  id              uuid primary key default gen_random_uuid(),
  endpoint        text not null,                                 -- 'HealthCheck' | 'BatchAvailabilityLookup' | …
  empresa_id      uuid references public.empresas(id) on delete set null,
  duracion_ms     int not null,
  status_http     int not null,
  causa           text,                                          -- 'ok' | 'slot_unavailable' | 'merchant_unknown' | …
  request_id      text,
  ts              timestamptz not null default now()
);

create index if not exists idx_bsv_endpoint_ts on public.bsv_metricas (endpoint, ts desc);
create index if not exists idx_bsv_empresa_ts on public.bsv_metricas (empresa_id, ts desc);

alter table public.bsv_metricas enable row level security;
create policy bsv_select on public.bsv_metricas
  for select using (
    empresa_id is null
    or empresa_id in (select empresas_del_usuario())
  );

-- ============================================================
-- 6. GOOGLE RWG NOTIFICACIONES SALIENTES (cola)
-- ============================================================
create table if not exists public.google_rwg_notificaciones (
  id              uuid primary key default gen_random_uuid(),
  reserva_id      uuid not null references public.reservas(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null check (tipo in ('UPDATE_BOOKING','CANCEL_BOOKING')),
  payload_json    jsonb not null,
  estado          text not null default 'pendiente'
                   check (estado in ('pendiente','enviado','fallido','descartado')),
  intentos        int not null default 0,
  proximo_intento_en timestamptz,
  enviado_en      timestamptz,
  ultimo_error    text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_notif_pendientes
  on public.google_rwg_notificaciones (estado, proximo_intento_en)
  where estado = 'pendiente';

alter table public.google_rwg_notificaciones enable row level security;
create policy notif_select on public.google_rwg_notificaciones
  for select using (empresa_id in (select empresas_del_usuario()));

-- Trigger: enfilar notificación cuando una reserva GOOGLE_RWG cambia estado / datos.
create or replace function public.enfilar_google_notif() returns trigger
language plpgsql as $$
begin
  if new.external_origen <> 'GOOGLE_RWG' or new.external_id is null then
    return new;
  end if;
  if old.estado is distinct from new.estado
     or old.fecha is distinct from new.fecha
     or old.hora  is distinct from new.hora
     or old.personas is distinct from new.personas then
    insert into public.google_rwg_notificaciones (
      reserva_id, empresa_id, tipo, payload_json
    ) values (
      new.id, new.empresa_id,
      case when new.estado in ('CANCELADA','NO_SHOW') then 'CANCEL_BOOKING' else 'UPDATE_BOOKING' end,
      jsonb_build_object(
        'booking_id', new.external_id,
        'status', case
          when new.estado = 'CANCELADA' then 'CANCELED_BY_MERCHANT'
          when new.estado = 'NO_SHOW'   then 'NO_SHOW'
          else 'CONFIRMED'
        end,
        'slot_time', (new.fecha::text || 'T' || new.hora::text),
        'personas', new.personas
      )
    );
  end if;
  return new;
end;
$$;
create trigger trg_notify_google_on_reserva_update
  after update on public.reservas
  for each row execute function public.enfilar_google_notif();

-- ============================================================
-- 7. VISTA DE SALUD (lo que pinta el panel)
-- ============================================================
create or replace view public.v_google_rwg_salud as
select
  endpoint,
  count(*) filter (where ts > now() - interval '24 hours') as llamadas_24h,
  count(*) filter (where ts > now() - interval '24 hours' and status_http = 200) as ok_24h,
  percentile_cont(0.95) within group (order by duracion_ms) filter (where ts > now() - interval '24 hours') as p95_ms,
  count(*) filter (where ts > now() - interval '24 hours' and status_http >= 500) as errores_5xx_24h
from public.bsv_metricas
group by endpoint;
alter view public.v_google_rwg_salud set (security_invoker = on);

notify pgrst, 'reload schema';
```

### Arquitectura propuesta (Feature-First)

```
src/
├── app/
│   ├── api/
│   │   ├── google/rwg/v1/
│   │   │   ├── HealthCheck/route.ts
│   │   │   ├── BatchAvailabilityLookup/route.ts
│   │   │   ├── CreateBooking/route.ts
│   │   │   ├── UpdateBooking/route.ts
│   │   │   └── SetMarketingPreference/route.ts
│   │   └── cron/
│   │       ├── google-rwg-feeds/route.ts                 # diario, full feeds + SFTP
│   │       ├── google-rwg-availability-delta/route.ts    # cada 5 min, delta
│   │       └── google-rwg-notify-pending/route.ts        # cada 60s, dispatcher cola
│   │
│   └── (main)/ajustes/canales/google/
│       ├── page.tsx                                      # config Place ID por empresa
│       └── salud/page.tsx                                # panel salud feeds + booking server
│
├── features/
│   └── canales-google-rwg/                               # NUEVA feature
│       ├── components/
│       │   ├── CanalGoogleConfigView.tsx                 # config + estado por empresa
│       │   └── SaludRwgView.tsx                          # panel salud (feeds, P95, cola)
│       ├── actions/
│       │   ├── salud-actions.ts                          # lee v_google_rwg_salud, feed_runs
│       │   ├── notificaciones-actions.ts                 # reintentar fallidas (admin)
│       │   └── activacion-actions.ts                     # set/clear google_place_id
│       ├── lib/
│       │   ├── feed-builder.ts                           # genera Merchant/Services/Availability JSON
│       │   ├── sftp-uploader.ts                          # ssh2-sftp-client wrapper
│       │   ├── booking-server-auth.ts                    # valida GOOGLE_RWG_AUTH_TOKEN
│       │   ├── booking-server-resolver.ts                # place_id → empresa_id, slot → cupo
│       │   ├── notif-dispatcher.ts                       # fetch a Partner Notification API
│       │   ├── proto-types.ts                            # tipos del contrato Actions Center
│       │   └── instrumentacion.ts                        # wrap handler con bsv_metricas.insert
│       └── data/
│           └── rwg-config.ts                             # tipos UI
│
└── features/sala/
    ├── components/reservas/
    │   └── ReservaExternalBadge.tsx                      # badge "Reserve with Google" detalle
    └── data/
        └── reservas.ts                                   # extender Reserva con externalOrigen/externalId
```

### Variables de entorno

```bash
# Activación global del canal (kill switch instantáneo)
GOOGLE_RWG_ENABLED=true

# Auth del Booking Server (Google → Balles)
GOOGLE_RWG_AUTH_TOKEN=<random_long_secret>

# Partner Notification API (Balles → Google)
GOOGLE_RWG_PARTNER_API_URL=https://mapsbooking.googleapis.com/v1alpha/notifications
GOOGLE_RWG_PARTNER_OAUTH_KEY=<service_account_json_base64>

# SFTP feeds
GOOGLE_RWG_SFTP_HOST=partnerupload.google.com
GOOGLE_RWG_SFTP_PORT=22
GOOGLE_RWG_SFTP_USER=<asignado por Google>
GOOGLE_RWG_SFTP_PRIVATE_KEY=<base64 PEM>
GOOGLE_RWG_SFTP_REMOTE_DIR=/<partner_id>/feeds
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar a cada fase siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar). El orden está optimizado para que cada fase compile/typecheck por sí sola y permita testear contra el simulador de Google (sandbox) antes de pasar a producción.

### Fase 1: Migración BD y locking

**Objetivo**: Esquema completo, función `try_reservar_slot`, triggers de liberación y enfilado, vista de salud. Tipos TS regenerados.

**Alcance**:
- Migración SQL con todo el bloque del modelo de datos (1–7).
- Verificar que `cupoEfectivo` lógica replicada en SQL respeta excepciones + config semanal + general (extraer la lógica de `useReservasMes.ts` a Postgres).
- Regenerar `src/lib/supabase/types.ts`.
- Extender `Reserva` en `src/features/sala/data/reservas.ts` con `externalId`, `externalOrigen`, `externalIdempotencyToken`, `politicaCancelacionSnapshot`, `marketingOptin`.
- Smoke test: insertar 3 reservas que compitan por el último cupo de un turno con cupo=2 personas → solo 1 sale OK.

**Validación**:
- `mcp__supabase__list_tables` muestra las 4 tablas nuevas + columnas en `reservas`.
- `mcp__supabase__execute_sql` con `select public.try_reservar_slot(...)` devuelve boolean.
- `mcp__supabase__get_advisors` sin warnings de RLS.
- `npm run typecheck` pasa.

### Fase 2: Booking Server — esqueleto y autenticación

**Objetivo**: 5 endpoints REST creados, todos validan auth y devuelven shape correcto del Actions Center. Sin lógica de negocio aún (mocks).

**Alcance**:
- Crear `src/app/api/google/rwg/v1/{HealthCheck,BatchAvailabilityLookup,CreateBooking,UpdateBooking,SetMarketingPreference}/route.ts`.
- `booking-server-auth.ts`: Basic Auth contra `GOOGLE_RWG_AUTH_TOKEN`.
- `proto-types.ts`: tipos TS de Request/Response según [Actions Center reservations end-to-end docs](https://developers.google.com/actions-center/reservations-end-to-end/reference/reservation-api).
- `instrumentacion.ts`: helper `withMetricas(endpoint, handler)` que mide ms, inserta fila en `bsv_metricas`.
- HealthCheck devuelve `{ operation_succeeded: true }` real. Resto devuelven 200 con respuesta vacía válida.

**Validación**:
- `curl -X POST -H "Authorization: Basic …" /api/google/rwg/v1/HealthCheck` → 200.
- `curl` sin auth → 401 + fila en `bsv_metricas` con `status_http=401`.
- `npm run typecheck` + `npm run build` pasan.

### Fase 3: BatchAvailabilityLookup real

**Objetivo**: Endpoint devuelve `spots_open` correcto reusando la lógica de cupos existente.

**Alcance**:
- `booking-server-resolver.ts`: `resolveEmpresaByPlaceId(place_id)` → `{ empresa_id, slug }`.
- `availability-resolver.ts`: dado `(empresa_id, slot_time)` calcula `spots_open = cupoEfectivo - personas_acumuladas`. Reusa `reserva_slots_lock.personas_total` para velocidad.
- Caché HTTP `Cache-Control: max-age=10` para que Google pueda golpear sin recalcular todo.
- Llenar `bsv_metricas` con duración real.

**Validación**:
- Llamar con un slot conocido lleno → `spots_open=0`.
- Llamar con un slot libre → `spots_open=cupo`.
- P95 medido < 500 ms en local con 50 slots por request.

### Fase 4: CreateBooking + idempotencia + lock

**Objetivo**: Reservas creadas vía Google nacen con todos los campos correctos, no se duplican, no causan double-book.

**Alcance**:
- `CreateBooking/route.ts`: parse Zod del payload Actions Center.
- Llamar `try_reservar_slot` → si false, responder con `booking_failure_reason: SLOT_UNAVAILABLE`.
- Si true: `findOrLinkClienteSala` (admin client), INSERT en `reservas` con `origen='GOOGLE'`, `external_origen='GOOGLE_RWG'`, `external_id`, `external_idempotency_token`, snapshot de `politicas_cancelacion` activa.
- Manejar idempotencia: `ON CONFLICT (external_idempotency_token)` → SELECT existente y devolverla.
- Llamar `registrar_visita_cliente_sala` igual que el flujo público.

**Validación**:
- 2 CreateBooking paralelos con cupo=1 → uno OK, uno SLOT_UNAVAILABLE (script de carga).
- CreateBooking duplicado con mismo token → mismo `booking_id`, sin INSERT extra.
- Fila visible en `/sala/reservas` con badge GOOGLE.

### Fase 5: UpdateBooking + SetMarketingPreference

**Objetivo**: Google puede cancelar o confirmar reservas; preferencias de marketing persisten en cliente.

**Alcance**:
- `UpdateBooking/route.ts`: localiza reserva por `external_id`, aplica nuevo estado (mapeo Google → Balles: `CANCELED_BY_USER`→`CANCELADA`, `CONFIRMED`→`CONFIRMADA`). Aplicar fee si la política dice (lectura del snapshot, no de la política actual).
- `SetMarketingPreference/route.ts`: UPDATE `clientes_sala.marketing_optin` + `marketing_optin_origen='GOOGLE_RWG'` + `marketing_optin_at=now()`.
- El trigger `enfilar_google_notif` NO se dispara aquí (la llamada viene de Google; no queremos eco).
- Solución eco: el trigger detecta si la actualización tiene `external_origen='GOOGLE_RWG'` Y `auth.uid() IS NULL` (caller = service role) → no enfila. Implementar con guarda de sesión Postgres (`SET LOCAL skip_google_notify=true` desde el handler).

**Validación**:
- Cancelación desde Google → reserva CANCELADA, **NO** se enfila notificación saliente (no hacer eco).
- Cancelación desde sala (sesión usuario) → SÍ se enfila notificación.

### Fase 6: Feeds — generación JSON

**Objetivo**: Generar Merchant Feed, Services Feed, Availability Feed válidos según el schema del Actions Center.

**Alcance**:
- `feed-builder.ts`: 3 funciones puras (`buildMerchantFeed`, `buildServicesFeed`, `buildAvailabilityFeed`) que dado el snapshot de `empresas` + `empresa_reservas_config` + `reservas` generan JSON.
- Merchant Feed: una entry por empresa con `google_place_id` configurado. Campos: name, telephone, url, geo, category.
- Services Feed: una entry por (empresa, turno) con políticas y precios opcionales (depósito ya en `garantia_importe`).
- Availability Feed: 30 días forward, slots por turno, `spots_open` calculado.
- Filtrar `WHERE google_place_id IS NOT NULL`.
- Validar con un JSON Schema (zod o ajv) antes de devolver.

**Validación**:
- Tests unitarios: dado un snapshot conocido, los 3 feeds tienen la forma exacta del schema (snapshot test).
- Tamaño del Availability Feed proporcional a empresas × 30 × turnos.

### Fase 7: Feeds — subida SFTP + cron diario

**Objetivo**: Cron diario sube los 3 feeds al SFTP del Actions Center; cada run queda registrado.

**Alcance**:
- `sftp-uploader.ts`: wrapper de `ssh2-sftp-client` con conexión configurable (env vars).
- **Pedir permiso** antes de `npm install ssh2-sftp-client` (regla CLAUDE.md).
- `/api/cron/google-rwg-feeds/route.ts`: orquesta `buildXFeed` → upload → `google_rwg_feed_runs` insert.
- Configurar en `vercel.json` cron `0 4 * * *` (4 AM UTC).
- Retries 3 con backoff exponencial.

**Validación**:
- Run manual local apuntando a sandbox SFTP → 3 ficheros en remoto.
- Fila en `google_rwg_feed_runs` con `estado='ok'`.
- Simulación error SFTP → `estado='fallido'` con error legible.

### Fase 8: Feeds — delta de disponibilidad (incremental)

**Objetivo**: Cuando cambia un cupo o se crea/cancela una reserva, en < 5 min el cambio llega a Google.

**Alcance**:
- `/api/cron/google-rwg-availability-delta/route.ts`: cron `*/5 * * * *`.
- Detecta cambios desde el último run (filtrar `reservas.updated_at > last_run` y `reserva_slots_lock.updated_at > last_run`).
- Genera solo el delta (slots tocados) y sube como `availability_delta_<timestamp>.json`.
- Fila en `google_rwg_feed_runs` con `feed_type='availability_delta'`.

**Validación**:
- Crear reserva manual → en < 5 min hay un delta subido con ese slot.
- Sin cambios → cron termina sin subir nada y deja log "no changes".

### Fase 9: Webhook saliente — dispatcher de cola

**Objetivo**: Cancelaciones/cambios desde sala llegan a Google en < 60 s.

**Alcance**:
- `notif-dispatcher.ts`: OAuth2 service account → fetch a `GOOGLE_RWG_PARTNER_API_URL`.
- `/api/cron/google-rwg-notify-pending/route.ts`: lee `google_rwg_notificaciones WHERE estado='pendiente' AND (proximo_intento_en IS NULL OR proximo_intento_en < now())`, llama API, actualiza estado.
- Reintentos: 1s / 4s / 16s. Tras 3 fallos → `estado='fallido'`.
- Cron en `vercel.json` `* * * * *` (cada minuto).

**Validación**:
- Cancelar reserva desde sala (UI) → fila en cola → en < 60 s estado='enviado'.
- Simulación 500 de Google → reintento, log de error.

### Fase 10: UI — Ajustes → Canales → Google

**Objetivo**: Tab en Ajustes que muestra estado por empresa, permite configurar Place ID y abre el panel de salud.

**Alcance**:
- `CanalGoogleConfigView.tsx`: tabla con empresas del usuario. Columnas: nombre, Place ID, estado (Activo / No configurado), último delta enviado, "Editar".
- Reutilizar `setEmpresaPlaceId` de `resenas-actions.ts`.
- Botón "Ver salud del canal" → navega a `/ajustes/canales/google/salud`.
- Aplicar BARRA HORIZONTAL 1 y configuración base universal de submódulo (memorias).

**Validación**:
- Configurar Place ID en empresa sin él → fila pasa a "Activo".
- En 5 min aparece en el feed (Fase 7/8 ya operativas).

### Fase 11: UI — Panel de salud `/ajustes/canales/google/salud`

**Objetivo**: El operador ve de un vistazo si Google va a retirarnos el botón.

**Alcance**:
- `SaludRwgView.tsx`: 3 paneles:
  1. **Feeds**: últimos 7 runs por tipo (Merchant/Services/Availability/Delta), estado, bytes, tiempo. Botón "Reintentar último fallido".
  2. **Booking Server**: tabla con endpoint, llamadas 24h, ok 24h, P95 ms, errores 5xx 24h, semáforo (verde/amarillo/rojo).
  3. **Notificaciones salientes**: cola pendiente, fallidas, botón "Reintentar fallidas".
- Server actions: `getSaludRwg()` lee `v_google_rwg_salud` + últimos `google_rwg_feed_runs` + count de `google_rwg_notificaciones`.

**Validación**:
- Tras Fase 9: el panel pinta números reales.
- Forzar fallido manual → semáforo en rojo.

### Fase 12: UI — Badge "Reserve with Google" en sala

**Objetivo**: Jefe de sala distingue al instante una reserva nacida en Google.

**Alcance**:
- `ReservaExternalBadge.tsx`: badge inline al lado de `ReservaFlagsChips` que muestra el origen externo cuando `external_origen` está poblado. Texto "Reserve with Google" + icono Google + tooltip con `external_id`.
- Integrarlo en el detalle de reserva de `ReservasView`.
- La columna "Origen" ya muestra GOOGLE — no se duplica.

**Validación**:
- Reserva creada por CreateBooking → badge visible.
- Reserva manual con `origen='GOOGLE'` (canal viejo redirect) sin `external_origen` → SOLO el badge de la columna, sin badge "Reserve with Google".

### Fase 13: Test E2E + QA + activación staging

**Objetivo**: Validar el flujo completo contra el simulador de Google (Actions Center provee una sandbox).

**Alcance**:
- Script de test E2E (`playwright-cli` o `vitest` + supertest):
  1. Subir feeds a sandbox SFTP.
  2. Llamar BatchAvailabilityLookup con curl autenticado.
  3. CreateBooking → verificar fila en `reservas` con todos los campos.
  4. Cancelar desde UI → verificar cola y entrega.
- Documentar en `.claude/memory/project_canal_google_rwg.md` el estado actual: variables de entorno requeridas, dominios autorizados, instrucciones de activación por empresa.
- Activación en una sola empresa de staging (BACANAL probablemente, por estar más limpia tras la migración del 21/05).

**Validación**:
- Test E2E pasa.
- `mcp__supabase__get_advisors` sin nuevos warnings.
- `npm run typecheck` + `npm run build` limpios.
- Screenshot Playwright del panel de salud y de la columna Origen con badge GOOGLE.
- Memoria del proyecto actualizada.

---

## Gotchas

- [ ] **NO instalar `ssh2-sftp-client` sin permiso** (regla CLAUDE.md sobre nuevas dependencias). Pedir confirmación en Fase 7 antes de tocar `package.json`.
- [ ] **`alter type ... add value`** no es necesario aquí (`origen='GOOGLE'` ya existe; `external_origen` es text libre). Si en el futuro se enumera, ojo con la transacción.
- [ ] **Eco de notificaciones**: si cancelamos desde Google y el trigger también enfila notificación, generamos un loop. Solución: guarda Postgres `SET LOCAL balles.skip_google_notify=true` antes del UPDATE en los handlers RWG, y el trigger comprueba `current_setting('balles.skip_google_notify', true)`.
- [ ] **`empresas.google_place_id`** ya está en uso por Reviews — la migración solo CONSUME ese valor, no lo escribe. No tocar el cron `google-resenas-sync`.
- [ ] **RLS en Booking Server**: los handlers RWG usan `createAdminClient` (service role). NO añadir `auth.getUser()` ahí; la auth viene del Basic Auth de Google.
- [ ] **Idempotency token UNIQUE parcial**: el índice solo funciona si Postgres es 11+ (sí, Supabase está en 15+). Verificar con `mcp__supabase__execute_sql`.
- [ ] **`try_reservar_slot` debe correr en una transacción**: si el INSERT en `reservas` falla después de incrementar el slot, queda inconsistente. Envolver el handler en una transacción explícita (Supabase RPC en una sola call) o usar SAVEPOINT.
- [ ] **Lógica `cupoEfectivo` duplicada**: vive en TS (`useReservasMes.ts`) y ahora en SQL (`try_reservar_slot`). Mantener ambas sincronizadas. Considerar mover toda a SQL en una iteración futura. Documentar en aprendizajes.
- [ ] **Snapshot de política inmutable**: al UPDATE de reserva (estado→CANCELADA) NO recalcular fee con la política actual; leer del snapshot. Si el snapshot está NULL (reservas antiguas), aplicar política activa actual con WARN log.
- [ ] **Vercel cron**: las cron en `vercel.json` solo corren en producción. En staging hay que llamarlas manualmente con curl + secret. Documentar.
- [ ] **OAuth2 a Google Partner API**: service account JSON debe estar en una env var. Generar token con `google-auth-library` (ya probablemente está si `google-resenas-sync` la usa — verificar).
- [ ] **Multi-tenant en panel de salud**: `v_google_rwg_salud` agrega global. Para no leak entre empresas, el panel filtra por `empresa_id IN empresas_del_usuario()`. Verificar en Fase 11.
- [ ] **`reservas.empresa_id`**: confirmar tipo (UUID con FK vs TEXT en `_DEMO_BUNDLE`). El PRP-046 menciona ambigüedad — replicar el approach que se acabe usando ahí.
- [ ] **Reservas WALK_IN**: el `liberar_slot_on_cancel` no debe contar walk-ins en `reserva_slots_lock` (no se reservaron contra cupo). Filtrar en la función `try_reservar_slot` y en el trigger: ignorar WALK_IN.
- [ ] **`marketing_optin` en `clientes_sala`** debe respetar la columna ya existente si la hay (posible duplicado en distintas memorias). Verificar antes de añadir.
- [ ] **Datos completos obligatorio (memoria)**: el feed Services declara fields obligatorios (precio, descripción). Si falta info, ese servicio NO entra en el feed → no se rompe la subida, pero se loguea.

## Anti-Patrones

- NO escribir reservas Google con `createReserva` server action (es client-auth based). Usar handler propio con `createAdminClient`.
- NO devolver 4xx/5xx desde los endpoints RWG cuando el error es de negocio (slot lleno, merchant unknown). Devolver 200 con el campo `booking_failure_reason` o `slots=[]`. Google penaliza 5xx en su monitor.
- NO meter HTTP fetch directo desde un trigger Postgres con `pg_net`. Enfilar en `google_rwg_notificaciones` y procesar con cron.
- NO usar `origen='GOOGLE_RWG'` (rompe el bucket canónico). Usar `origen='GOOGLE'` + `external_origen='GOOGLE_RWG'`.
- NO programar el cron diario de feeds en hora local española (los SFTP del Actions Center procesan en UTC; usar UTC en `vercel.json`).
- NO confiar en el `place_id` del payload de Google sin verificar contra `empresas.google_place_id`. Un payload malicioso podría redirigir reservas a la empresa equivocada.
- NO subir feeds si `bytes < 100` (probable error de generación). Abortar con `estado='fallido'`.
- NO hardcodear el cupo en `try_reservar_slot`: leer siempre de `empresa_reservas_config` + excepciones.
- NO duplicar `find_or_link_cliente_sala`: reutilizar el helper existente (es compatible con admin client).
- NO procesar notificaciones de Google de forma sincrona en el cron diario (lentitud). Cron dedicado cada 60s.
- NO meter datos de Google en `notas` de reserva (el campo es para el operador). Usar columnas dedicadas.

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección crece con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

_(vacío — se rellenará al ejecutar con /bucle-agentico)_

---

*PRP pendiente de aprobación. No se ha modificado código.*
