# PRP-069 — Zona horaria por empresa en TODO el sistema

> **Estado:** Propuesto (pendiente de aprobación)
> **Fecha:** 2026-06-29
> **Tipo:** Saneamiento transversal + corrección de bug
> **Riesgo:** Medio (toca lógica de fichaje en vivo, además de presentación)

---

## 1. Objetivo

Que **toda hora que el sistema muestre o calcule** se rija por la zona horaria
configurada de cada empresa (Ajustes → Configuración regional,
`empresas.config_operativa.zonaHoraria`), y **nunca** por:

- `Europe/Madrid` escrito a mano, ni
- la zona del servidor (que en producción es **UTC**, lo que ya provoca horas
  desfasadas −1 h en invierno / −2 h en verano).

Una empresa puede estar en una zona distinta de otra (p. ej. Península vs.
Canarias). El registro en BD **sigue guardándose en UTC**; solo cambia cómo se
**formatea** y cómo se calcula el "ahora" local.

### Por qué es necesario (no es solo multi-empresa)

Hay dos defectos hoy:

1. **Horas mal mostradas (bug real):** ~40 llamadas a
   `toLocaleString/toLocaleDateString/toLocaleTimeString` **sin** `timeZone`.
   En el server (UTC) salen desfasadas respecto a España.
2. **Horas correctas pero no configurables:** sitios con `Europe/Madrid` fijo;
   funcionan para España pero ignoran el ajuste de empresa.

Este PRP corrige ambos con una **regla única**: *toda hora visible o calculada
usa la zona de la empresa del registro/usuario*.

---

## 2. Estado actual (lo que ya existe)

- Campo fuente de verdad: `empresas.config_operativa.zonaHoraria` (string IANA).
- Helper server: `getZonaHorariaEmpresa(supabase, empresaId)` →
  [`src/features/empresa/lib/empresa-server.ts`](../../src/features/empresa/lib/empresa-server.ts),
  con fallback `ZONA_HORARIA_DEFAULT = "Europe/Madrid"`.
- **Referencia ya migrada:** Reclutamiento
  ([`reclutamiento-actions.ts`](../../src/features/rrhh/actions/reclutamiento-actions.ts))
  usa `fmtFechaHora(iso, tz)` con `tz = await getZonaHorariaEmpresa(...)`. El
  modal de candidato muestra `fechaInscripcionFull`. **Este es el patrón a
  replicar.**

---

## 3. Inventario completo (auditoría exhaustiva realizada)

> **Escala real (mayor de lo previsto):** una segunda auditoría profunda encontró
> **~169 llamadas** a `toLocaleString/toLocaleDateString/toLocaleTimeString` **sin
> `timeZone`** (salen en UTC en el servidor) y **~20** con `Europe/Madrid` fijo,
> repartidas por **casi todos los módulos**. No es un retoque puntual: es un
> saneamiento transversal. Por eso la migración se organiza por **zonas
> funcionales**, no archivo a archivo (revisar 169 ediciones sueltas sería inviable).

### Magnitud por módulo (sin `timeZone`, muestran fechas)

| Módulo | Ejemplos de archivos | Aprox. |
|---|---|---|
| **Mi Panel** (web + móvil) | `MisFichajes*`, `CalendarioPersonal`, `MisComunicados*`, `FichajeBar`, `ClientClock`, `FicharCard`, `ResumenTiles`, `MisInspecciones*` | ~30 |
| **RRHH** | `fichajes/*`, `firmas/*`, `solicitudes/*`, `empleados/*`, `calendarios/*`, `reclutamiento/*` | ~20 |
| **Google Workspace** | `CalendarDrawer`, `ChatDrawer`, `TelefonoDrawer`, `CalendarSidebar` | ~10 |
| **Cocina** | `HistorialTab`, `CambiosCartaCalendario`, `MermasView`, `ComandaCard`, `ComunicadoRecetaDialog` | ~10 |
| **Calidad/Inspecciones** | `RealizadasView`, `Plantillas/Envios`, `Inspectores*`, `Puntos*` | ~8 |
| **Sala/POS/Reservas** | `TicketEnVivo`, `HistorialTickets`, `LinksReservaPanel`, `LimitesReglas` | ~6 |
| **Marketing/Web** | `CalendarioView`, `Campanas*`, `Paginas*`, `Autosave*` | ~6 |
| **Logística** | `DetalleAlbaran/Pedido/Inventario`, `MovimientosStock`, `AgoraSync` | ~7 |
| **Toques/Formación** | `MisLogros`, `MisCanjes`, `HallOfFame`, `Novedades`, `AdminFormacion` | ~8 |
| **Dirección/Gerencia** | `Cronogramas`, `Aperturas/slides`, `Comunicados`, `Biblioteca` | ~7 |
| **Firmas (servicio)** | `firmas/email.ts`, `firmas/pdf.ts`, `FirmaPublicaView` | ~4 |
| **API routes** | `gmail/messages`, `gmail/message`, `calendar/events`, `cron/*` | ~8 |
| **Otros** | Contabilidad, Gestoría, Jurídico, Admin, Ajustes/Usuarios, export/PDF | ~10 |

> Los `.toLocaleString()`/`Intl.NumberFormat` que formatean **números o euros**
> (no fechas) se **IGNORAN** — no son zona horaria.

### A. Lógica de fichaje en vivo (aprobado: "todo coherente")

| Archivo | Qué calcula |
|---|---|
| `rrhh/utils/horario-empleado.ts` → `ahoraEnMadrid()` | "Ahora" para ventana de horario válida (núcleo, lo usan crons y fichaje) |
| `mi-panel/mobile/components/MobileFichajeProvider.tsx` → `minutosAhoraMadrid()` | Cuándo salta el pop-up de fichar (líneas 80–169) |
| `mi-panel/utils/fichaje-multiempresa.ts` → `minutosMadridDe()` | Reparto de jornada multi-empresa (434–538) |
| `mi-panel/mobile/lib/mobile-inicio-data.ts`, `mobile-horario-data.ts` | "Hoy" para resolver horario del empleado |
| `mi-panel/actions/mi-panel-actions.ts` | `hoyMadrid`/minutos en server actions (512, 694, 849) |
| `rrhh/actions/empleados-actions.ts` | `ahoraEnMadrid()` (163) |
| **Crons:** `cron/fichajes-reavisos`, `fichajes-autosalida`, `cronogramas-alertas`, `vencimientos-alertas` | `ahoraEnMadrid()` → ⚠️ ver nota crons abajo |

### B. APIs Google (requieren `empresaId` en el flujo)

| Archivo | Notas |
|---|---|
| `app/api/google/calendar/create/route.ts` (38–39) | Recibir empresaId en body |
| `app/api/google/calendar/update/route.ts` (36–37) | Íd. |
| `app/api/google/rwg/v1/CreateBooking/route.ts` (16) | Ya resuelve `merchant.empresaId` (90) → usarlo |
| `app/api/google/rwg/v1/UpdateBooking/route.ts` (13) | Query reserva → empresa_id |
| `canales-google-rwg/lib/availability-resolver.ts` (7) | `lookupAvailability()` ya recibe empresaId (58) |
| `canales-google-rwg/lib/feed-builder.ts` (12) | Feed por empresa → su zona |

### C. Bug latente — ya resuelven zona pero conviene verificar el llamador

- `rrhh/actions/reclutamiento-actions.ts` y `candidato-ficha-actions.ts`:
  `fmtFecha(iso, tz)` ya **acepta** `tz` con fallback. Verificar que **todos**
  los llamadores pasen el `tz` real de la empresa (no que se quede en el default).

### D. NO TOCAR (defaults, opciones, helpers) ✋

- `ajustes/components/ConfigOperativaTab.tsx`, `ConfiguracionTab.tsx` → `<SelectItem>` (opción).
- `ajustes/components/CrearEmpresaModal.tsx:65` → default de empresa nueva.
- `ajustes/data/ajustes.ts:334`, `empresa/data/ajustes.ts:226` → seeds.
- `empresa/lib/empresa-server.ts:37` → `ZONA_HORARIA_DEFAULT` (fallback correcto).
- `google-workspace/lib/timezones.ts` → mapeos/etiquetas + selector secundario por usuario.
- `Intl.NumberFormat(...)` y `.toLocaleString()` de **números/euros**.
- `marketing/carta-digital/hooks/useDeviceId.ts` → zona del dispositivo (intencional).

### Nota crons ⚠️

Los crons (`fichajes-reavisos`, `autosalida`, `cronogramas/vencimientos-alertas`)
recorren **varias empresas**. No pueden usar un único "ahora": deben resolver el
"ahora" **por empresa** dentro del bucle (`ahoraEnZona(tzDeEsaEmpresa)`). Es el
punto más delicado del PRP.

---

## 4. Diseño

### 4.1 Helpers comunes (nuevos)

Crear `src/features/empresa/lib/zona-horaria.ts` (utilidades **puras**, sin
server-only, reutilizables en cliente y servidor):

```ts
/** Formatea un instante UTC (ISO) como "dd/mm/aaaa, hh:mm" en la zona dada. */
export function formatFechaHoraEnZona(iso: string | null, tz: string, opts?): string

/** Solo fecha "dd/mm/aaaa" en la zona dada. */
export function formatFechaEnZona(iso: string | null, tz: string): string

/** "Ahora" en la zona dada: { fecha: "YYYY-MM-DD", minutos: 0–1439 }. */
export function ahoraEnZona(tz: string): { fecha: string; minutos: number }

/** Minutos del día (0–1439) de un Date concreto, en la zona dada. */
export function minutosDiaEnZona(d: Date, tz: string): number
```

- `getZonaHorariaEmpresa` se mantiene como la vía **server** para obtener `tz`.
- Para el **cliente**, la `zonaHoraria` se entrega ya resuelta desde el server
  (en el payload del action/loader correspondiente), nunca se lee BD en cliente.

### 4.2 Compatibilidad legacy

`ahoraEnMadrid()` se reescribe como wrapper:
`export const ahoraEnMadrid = () => ahoraEnZona("Europe/Madrid")`, para no
romper llamadas existentes mientras se migran. Se marca `@deprecated`.

---

## 5. Fases

> Dado el volumen (~169 sitios), Fase 2 se hace **por módulos** (un commit por
> módulo) para que cada lote sea revisable y reversible, no un único cambio masivo.

### Fase 1 — Fundación (sin cambio de comportamiento)
- Crear `src/features/empresa/lib/zona-horaria.ts` con los 4 helpers
  (`formatFechaHoraEnZona`, `formatFechaEnZona`, `ahoraEnZona`, `minutosDiaEnZona`)
  + tests (UTC→Madrid y UTC→Atlantic/Canary para verificar desfase y DST).
- Reescribir `ahoraEnMadrid()` como wrapper `@deprecated` de `ahoraEnZona("Europe/Madrid")`.
- **Verificación:** salida idéntica al código actual para Madrid (nada cambia aún).

### Fase 2 — Presentación, por módulos (corrige el bug visible)
Cada vista recibe `zonaHoraria` ya resuelta desde su server action/loader y usa
los helpers. Orden por impacto:
- **2a.** Fichajes y Mi Panel (lo que más se mira: fichajes, comunicados, calendario).
- **2b.** RRHH (firmas, solicitudes, empleados, reclutamiento — cerrar grupo C del §3).
- **2c.** Calidad/Inspecciones + Sala/POS/Reservas.
- **2d.** Cocina + Logística + Google Workspace (drawers).
- **2e.** Resto: Marketing, Dirección/Gerencia, Toques/Formación, Contabilidad,
  Gestoría/Jurídico, Admin, exports/PDF, API Gmail.
- **Verificación QA por lote:** abrir cada vista y comparar la hora mostrada con
  la real del registro. Antes salía −1/−2 h donde faltaba `timeZone`; ahora coincide.

### Fase 3 — Lógica de fichaje (riesgo medio)
- Migrar grupo A del §3: `ahoraEnMadrid`→zona empresa, pop-up timing, reparto
  multi-empresa, mobile data. **Crons:** resolver "ahora" **por empresa** en el bucle.
- **Verificación QA:** simular fichaje dentro/fuera de ventana; confirmar pop-up y
  reparto. Probar una empresa con `zonaHoraria` ≠ Madrid (p. ej. Atlantic/Canary)
  para ver que el comportamiento cambia correctamente con la config.

### Fase 4 — APIs Google
- Migrar grupo B del §3: `empresaId` en el flujo, zona empresa a Calendar/RWG.
- **Verificación:** crear/editar evento y reserva por Google; confirmar hora.

### Fase 5 — Cierre
- Memoria persistente con la **regla**: "Toda hora mostrada o calculada usa la
  zona de la empresa; nunca `toLocaleString` sin `timeZone`, nunca `Europe/Madrid`
  fijo salvo defaults/seeds/Select".
- (Opcional) regla de lint que detecte `toLocale*` de fecha sin `timeZone`.

---

## 6. Criterios de aceptación

1. Ningún registro mostrado al usuario sale en UTC: la hora coincide con la real
   del evento en la zona de su empresa.
2. Cambiar `zonaHoraria` de una empresa en Ajustes cambia de inmediato (tras
   recarga) todas sus horas mostradas, sin afectar a otra empresa.
3. El pop-up de fichaje y el reparto de jornada respetan la zona de la empresa.
4. La BD sigue almacenando UTC (no se migra ningún dato).
5. Defaults, seeds y selectores de configuración intactos.

---

## 7. Fuera de alcance

- Migración de datos en BD (no se toca; UTC se conserva).
- Selección automática de zona por geolocalización.
- Zonas a nivel de **local** (por ahora la zona es por **empresa**).

---

## 8. Notas de implementación

- `getZonaHorariaEmpresa` hace una query por llamada; en bucles que formatean
  muchas filas, resolver `tz` **una vez** y pasarlo (como ya hace reclutamiento).
- Regla de oro para cliente: **nunca** leer BD desde el cliente; el server manda
  `zonaHoraria` resuelta en el mismo payload donde van las fechas.
