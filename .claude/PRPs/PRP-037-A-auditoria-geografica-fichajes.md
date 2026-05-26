# PRP-037-A: Auditoría Geográfica de Fichajes RRHH

> Nota: Renumerado de `PRP-037` a `PRP-037-A` el 2026-05-26 al detectar colisión con `PRP-037-logistica-importador-ia` que entró desde upstream. El trabajo está cerrado y mergeado a `main`; el rename solo evita ambigüedad documental.

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-25
> **Proyecto**: Balles-Hosteleros — Módulo RRHH → Fichajes (capa de auditoría geo)

---

## Objetivo

Añadir al módulo **RRHH → Fichajes** una **capa visual de auditoría geográfica** que muestre, por cada fichaje, dónde se realizó respecto al local asignado, y permita al supervisor RRHH/director auditar fichajes sospechosos. El sistema ya captura `lat/lng/precisión` de entrada y salida y persiste `modo_teletrabajo` y `local_id` (migraciones `20260514130000_rrhh_centros_y_geolocalizacion.sql` y `20260515100000_rename_centros_to_locales.sql`), pero la vista `/rrhh/fichajes` **no expone esos datos en ninguna parte**. Este PRP crea: (1) una **columna "Geo"** en la tabla con badge de estado y distancia, (2) un **mini-mapa Leaflet** en el modal de detalle con pin de entrada, pin de salida y círculo del radio del local, (3) un nuevo **tab "Mapa"** con todos los fichajes del filtro como pines coloreados por estado, y (4) **filtros adicionales** ("Solo fuera del radio", "Solo teletrabajo", "Por local"). No requiere migraciones nuevas — toda la data ya está en BD.

## Por Qué

| Problema | Solución |
|----------|----------|
| El supervisor RRHH no puede detectar fichajes sospechosos: empleados que fichan desde casa sin tener `permite_teletrabajo=true` ya son bloqueados por servidor, pero **no hay forma visual** de detectar fichajes "rozando el radio" (a 99m de un radio de 100m) ni de auditar patrones por local/empleado. | Columna "Geo" con badge (`✓ En local` / `📍 Teletrabajo` / `⚠ Fuera`) + distancia exacta + filtro "Solo fuera del radio". |
| En disputa laboral, hoy no hay forma sencilla de mostrar al empleado dónde se registró su fichaje. La data está en BD pero el supervisor tendría que consultar SQL. | Modal de detalle con mini-mapa Leaflet mostrando entrada, salida y radio del local — exportable como evidencia visual. |
| El director necesita una visión agregada por local/día/empleado para validar políticas de teletrabajo y cumplimiento de presencia. | Tab "Mapa" con todos los fichajes del filtro actual como pines coloreados, por encima del mapa base OpenStreetMap. |
| Hoy el `modo_teletrabajo` es un bool de auditoría que nadie ve en la UI de RRHH — se pierde el sentido de marcarlo. | Badge explícito `📍 Teletrabajo` en columna Geo + filtro dedicado para auditar uso de teletrabajo. |
| Riesgo legal: control horario (art. 8.3 ET) exige trazabilidad. Hoy la trazabilidad existe en BD pero no es accesible a quien la necesita. | Vista de auditoría con prueba visual + distancia exacta lista para incluir en informes. |

**Valor de negocio**: reducir tiempo de detección de fraude horario de horas (consulta SQL manual) a segundos (un vistazo a la tabla), y dar a RRHH/dirección una herramienta de auditoría sin coste extra de stack (Leaflet y OpenStreetMap ya están en `MapPicker.tsx`, sin nuevas dependencias). **No vendor lock-in**: si en el futuro se cambia el proveedor de tiles, basta sustituir la URL en una constante.

## Qué

### Criterios de Éxito

- [ ] La tabla de `/rrhh/fichajes` muestra una nueva **columna "Geo"** con:
  - badge `✓ En local` (verde) cuando `distancia_entrada ≤ local.radio_metros` y `modo_teletrabajo=false`,
  - badge `📍 Teletrabajo` (violeta) cuando `modo_teletrabajo=true`,
  - badge `⚠ Fuera` (rojo) cuando `distancia_entrada > local.radio_metros` y `modo_teletrabajo=false`,
  - badge `— Sin datos` (gris) cuando faltan coordenadas o el local no tiene `lat/lng` configurado.
  - Texto secundario: distancia en metros (ej. `87 m` / `>5 km` / `Madrid →`).
- [ ] La columna Geo es **ordenable** por distancia y **filtrable** por estado (en local / teletrabajo / fuera).
- [ ] El **modal de detalle** del fichaje (al click en fila) muestra una nueva sección "Ubicación" con:
  - mini-mapa Leaflet (`h-64`) centrado en el local,
  - pin azul = entrada (con popup: `HH:MM, ±N m precisión`),
  - pin morado = salida (si existe; con popup),
  - círculo violeta = radio del local,
  - leyenda con distancias exactas entrada y salida + `modo_teletrabajo`,
  - fallback `Sin ubicación configurada para este local` si `local.lat/lng IS NULL`.
- [ ] Nueva **tab "Mapa"** en `FichajesView.tsx` (al lado de Fichajes / Historial / Incidencias / Config) que muestra:
  - mapa Leaflet a pantalla completa de la card (`h-[600px]`),
  - todos los fichajes del filtro actual como pines coloreados (verde/violeta/rojo según estado),
  - todos los locales de la empresa con círculo de radio en color tenue,
  - click en pin → abre modal de detalle (reutilizar el existente),
  - clustering automático si hay > 100 pines (usar `markercluster` plugin de Leaflet).
- [ ] Tres **filtros nuevos** en el toolbar:
  - `Solo fichajes fuera del radio` (boolean, default off),
  - `Solo teletrabajo` (boolean, default off),
  - `Local` (multi-select de locales de la empresa activa).
- [ ] El **servidor** calcula las distancias y devuelve el local con sus datos geo — no se hace en cliente para evitar exponer coordenadas de locales innecesariamente.
- [ ] **Multi-tenant** estricto: cada empresa ve solo sus fichajes, sus locales y nada más. Reutilizar RLS existente.
- [ ] **Performance**: para una empresa con 50 empleados × 30 días = 1500 fichajes, la tab Mapa debe renderizar en `< 1 s` con clustering.
- [ ] `npm run typecheck` y `npm run build` pasan; sin `any`; inputs Zod cuando aplique.
- [ ] No se modifica la lógica de `ficharEntrada` / `ficharSalida` — el PRP es **solo lectura/visualización**.

### Comportamiento Esperado (Happy Path)

1. **Supervisor abre `/rrhh/fichajes`** → ve la tabla habitual con una columna nueva "Geo" entre "Tipo" y "Horas".
2. **Detecta un badge `⚠ Fuera 234 m`** en la fila de "Juan Pérez" → click en fila → modal de detalle.
3. **Modal de detalle** muestra:
   - datos habituales (empleado, fecha, entrada, salida, horas, tipo),
   - sección nueva "Ubicación": mini-mapa centrado en el local "HABANA" con un círculo violeta de 100m, un pin azul a 234m al norte mostrando la entrada, sin pin de salida porque aún no fichó.
   - leyenda: `Entrada: 234 m de HABANA (±15 m precisión)` `Modo: presencial`.
4. **Supervisor cierra modal** → vuelve a la tabla → click en filtro **"Solo fichajes fuera del radio"** → la tabla se filtra a 3 fichajes problemáticos.
5. **Supervisor hace click en la tab "Mapa"** → ve un mapa de Madrid con:
   - dos círculos violeta tenues (HABANA y BACANAL),
   - 47 pines verdes (en local),
   - 3 pines rojos (los fuera del radio),
   - 12 pines violetas (teletrabajo).
6. **Click en un pin rojo** → modal de detalle del fichaje correspondiente.
7. **Aplica filtro "Solo teletrabajo"** → solo quedan los 12 pines violetas → patrón visible: 10 son de la misma empleada → escalable a RRHH.

---

## Contexto

### Referencias internas

- **`src/features/rrhh/utils/geo.ts`** — `distanciaMetros(lat1, lng1, lat2, lng2)` (Haversine) + `obtenerPosicionActual()` (navigator.geolocation). **Reutilizar tal cual.**
- **`src/features/rrhh/actions/fichajes-actions.ts`** — `listFichajes(fecha?)` y `crearFichajeManual()`. **Extender** `listFichajes` para devolver coords + local + distancias precalculadas.
- **`src/features/rrhh/components/fichajes/FichajesView.tsx`** — vista a extender. Tiene tabs (Fichajes / Historial / Incidencias / Config), columna config, modal de detalle. **Añadir tab Mapa + columna Geo + filtros + sección Ubicación en modal.**
- **`src/features/ajustes/components/locales/MapPicker.tsx`** — patrón Leaflet con `dynamic import` (línea 147 `cargarLeaflet().then((L) => …)`), tiles OpenStreetMap, marker, circle. **Patrón a copiar para el mini-mapa y la tab Mapa.**
- **`src/features/mi-panel/components/FichajeBar.tsx`** — cómo se captura geo cliente y se pasa al server. No tocar.
- **`supabase/migrations/20260514130000_rrhh_centros_y_geolocalizacion.sql`** — schema completo de geo en BD. Confirma columnas:
  - `fichajes`: `lat_entrada double precision`, `lng_entrada double precision`, `precision_entrada_metros numeric`, `lat_salida`, `lng_salida`, `precision_salida_metros`, `modo_teletrabajo boolean`, `centro_id uuid`.
  - `locales` (rename de `centros` en `20260515100000`): `lat double precision`, `lng double precision`, `radio_metros integer CHECK (20-5000)`, `nombre text`, `color text`.

### Referencias externas

- **Leaflet docs**: https://leafletjs.com/reference.html — API estable, ya usada en el repo.
- **leaflet.markercluster**: https://github.com/Leaflet/Leaflet.markercluster — plugin oficial para clustering, añadir como `<script>` dinámico igual que Leaflet base en `MapPicker.tsx`.
- **OpenStreetMap tiles**: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png — ya en uso, sin API key.

### Arquitectura propuesta (Feature-First)

Sin nueva feature — se extienden archivos existentes en `src/features/rrhh/`:

```
src/features/rrhh/
├── actions/
│   └── fichajes-actions.ts          [EXTENDER] listFichajes devuelve coords + local + distancia
├── components/fichajes/
│   ├── FichajesView.tsx             [EXTENDER] columna Geo + tab Mapa + filtros + sección Ubicación
│   ├── FichajesMapaView.tsx         [NUEVO]    componente tab Mapa con clustering
│   ├── FichajeUbicacionMiniMap.tsx  [NUEVO]    mini-mapa para modal de detalle
│   └── geo-badge.tsx                [NUEVO]    badge `En local` / `Teletrabajo` / `Fuera`
├── utils/
│   ├── geo.ts                       [SIN CAMBIOS]
│   └── fichaje-geo-status.ts        [NUEVO]    helper puro: clasifica fichaje por status geo
└── data/
    └── fichajes.ts                  [EXTENDER] tipo Fichaje con campos geo opcionales
```

### Modelo de datos

**No requiere migraciones nuevas.** Todos los campos necesarios ya existen:

```sql
-- Ya existentes (migración 20260514130000):
-- fichajes.lat_entrada, lng_entrada, precision_entrada_metros
-- fichajes.lat_salida, lng_salida, precision_salida_metros
-- fichajes.modo_teletrabajo
-- fichajes.centro_id (FK a locales.id tras rename en 20260515100000)
-- locales.lat, lng, radio_metros, nombre, color
```

El server precalcula la distancia en el server action `listFichajes` para evitar:
1. Enviar coordenadas de locales al cliente más veces de lo necesario.
2. Re-hacer Haversine en cliente para cada fichaje.

```typescript
// Estructura devuelta por listFichajes (extendida):
type FichajeConGeo = Fichaje & {
  latEntrada: number | null;
  lngEntrada: number | null;
  precisionEntradaMetros: number | null;
  latSalida: number | null;
  lngSalida: number | null;
  precisionSalidaMetros: number | null;
  modoTeletrabajo: boolean;
  local: {
    id: string;
    nombre: string;
    lat: number | null;
    lng: number | null;
    radioMetros: number;
    color: string;
  } | null;
  distanciaEntradaMetros: number | null; // null si faltan coords
  distanciaSalidaMetros: number | null;
};
```

---

## Blueprint (Assembly Line)

> Solo definir FASES. Subtareas se generan en cada fase con bucle agéntico.

### Fase 1: Backend — extender `listFichajes` con datos geo

**Objetivo**: Que `listFichajes` devuelva por cada fichaje: coords entrada/salida, precisión, modo teletrabajo, datos del local asignado y distancias calculadas server-side.

**Validación**:
- `npm run typecheck` pasa.
- Query manual desde el dashboard de Supabase muestra los campos esperados.
- Smoke: llamar `listFichajes()` desde una server action de prueba y verificar la forma del payload.

### Fase 2: Helpers y badges

**Objetivo**: Crear:
- `src/features/rrhh/utils/fichaje-geo-status.ts` — función pura `getFichajeGeoStatus(fichaje, local): 'en-local' | 'teletrabajo' | 'fuera' | 'sin-datos'`.
- `src/features/rrhh/components/fichajes/geo-badge.tsx` — componente que renderiza el badge según status + distancia.

**Validación**:
- `npm run typecheck` pasa.
- Test mental: 4 casos cubiertos (`en-local`, `teletrabajo`, `fuera`, `sin-datos`).

### Fase 3: Columna "Geo" en la tabla principal

**Objetivo**: Añadir columna a `columnasDef` en `FichajesView.tsx`. Ordenable por distancia, filtrable por status geo. Reutilizar `<GeoBadge>` de Fase 2.

**Validación**:
- `/rrhh/fichajes` muestra columna "Geo" con badges correctos para los fichajes de hoy.
- Click en encabezado ordena por distancia ascendente/descendente.
- Filtro "Solo fichajes fuera del radio" reduce la lista correctamente.

### Fase 4: Mini-mapa en modal de detalle

**Objetivo**: Crear `FichajeUbicacionMiniMap.tsx` (Leaflet con dynamic import, patrón de `MapPicker.tsx`) y embeberlo en el `<Dialog>` de detalle del fichaje. Mostrar pin entrada, pin salida (si existe), círculo radio del local, leyenda.

**Validación**:
- Abrir un fichaje real → modal muestra mini-mapa con pin azul y círculo violeta.
- Si el local no tiene `lat/lng`: muestra texto `Sin ubicación configurada para este local`.
- Si el fichaje no tiene `lat_entrada`: muestra `Entrada sin geolocalización (manual)`.

### Fase 5: Tab "Mapa" con clustering

**Objetivo**: Crear `FichajesMapaView.tsx`:
- Mapa Leaflet a pantalla completa de la card.
- Carga `leaflet.markercluster` dinámicamente.
- Pinta todos los locales de la empresa con círculo de radio (color del local con opacidad 20%).
- Pinta todos los fichajes filtrados como pines coloreados por status.
- Click en pin → abre `<FichajeDetalleDialog>` (extraer el modal de la Fase 4 a componente reutilizable).

**Validación**:
- Tab "Mapa" se ve y carga sin errores de hidratación.
- 100+ fichajes se agrupan en clusters; al hacer zoom se expanden.
- Click en pin abre el modal correcto.
- Cambiar de tab Fichajes ↔ Mapa preserva los filtros aplicados.

### Fase 6: Filtros geo en toolbar

**Objetivo**: Añadir al `SubmoduleToolbar` tres filtros:
- Toggle "Solo fichajes fuera del radio".
- Toggle "Solo teletrabajo".
- Multi-select "Local" (carga desde `listLocales(empresaId)`).

Los filtros aplican tanto a la tabla como a la tab Mapa.

**Validación**:
- Filtros funcionan combinados (fuera del radio + un local específico).
- Limpiar filtros resetea ambas vistas.

### Fase 7: Validación final

**Objetivo**: Sistema funcionando end-to-end con multi-tenant.

**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` pasa.
- [ ] Smoke manual: login como `rrhh-smoke-admin-no-borrar@example.com`, navegar a `/rrhh/fichajes`, verificar columna Geo, abrir modal con mini-mapa, abrir tab Mapa, aplicar los 3 filtros.
- [ ] Cambiar empresa activa HABANA ↔ BACANAL: la vista filtra correctamente y no muestra fichajes/locales de la otra empresa.
- [ ] Mide tiempo de carga inicial de tab Mapa con > 100 fichajes (debe ser < 1 s).

---

## ⛔ Fuera de Alcance (con justificación para retomar en el futuro)

Esta sección es **deliberadamente explícita** para que un agente futuro pueda decidir si ampliar este PRP o crear uno nuevo.

### 1. **Heatmap / densidad de fichajes**
- **Por qué fuera**: requiere `leaflet.heat` (plugin adicional) y aporta valor real solo con > 500 fichajes por vista. Con clustering ya se ve dónde hay densidad.
- **Cuándo retomar**: cuando una empresa tenga > 5 locales y > 200 empleados activos. Crear `PRP-NNN-heatmap-fichajes.md`.
- **Esfuerzo estimado**: 1-2 días.

### 2. **Tracking en tiempo real (live position de empleados)**
- **Por qué fuera**: privacy issue grave (GDPR art. 9, datos sensibles), requiere consentimiento explícito documentado + base legal sólida, y técnicamente complejo (WebSockets, batería móvil, fallbacks offline).
- **Cuándo retomar**: solo si se justifica por compliance (sectores especiales tipo seguridad/sanidad). Requiere PRP legal previo + revisión jurídica.
- **Esfuerzo estimado**: 5-10 días.

### 3. **Notificaciones push por fichajes fuera del radio**
- **Por qué fuera**: depende de tener PWA + push notifications operativas (skill `add-mobile` aplicado), que no es el caso aún. Sin canal push no hay diferencia con un email diferido.
- **Cuándo retomar**: cuando se ejecute `add-mobile`. Crear `PRP-NNN-alertas-fichajes-anomalos.md` que tendrá email + push.
- **Esfuerzo estimado**: 2-3 días una vez PWA esté en marcha.

### 4. **Validación geo en `crearFichajeManual` (fichaje manual RRHH)**
- **Por qué fuera**: por diseño, el fichaje manual lo hace el supervisor en nombre del empleado para corregir/registrar a posteriori. Pedir geo no tiene sentido porque el supervisor puede no estar en el local. Hoy se marca como `modo_teletrabajo=true` y `tipo='MAN'` para distinguirlo.
- **Cuándo retomar**: si el negocio decide que el fichaje manual debe registrar la posición del supervisor (no del empleado) como audit trail extra. Cambio menor en `crearFichajeManual()` + UI del dialog.
- **Esfuerzo estimado**: 0.5 días.

### 5. **Vista geo en la ficha del empleado (`/rrhh/empleados/[id]`)**
- **Por qué fuera**: este PRP cubre la vista agregada por empresa. La ficha del empleado merece su propio espacio con histórico geográfico per-empleado, ranking de distancia media, patrón de fichaje, etc.
- **Cuándo retomar**: tras este PRP, como complemento natural. Crear `PRP-NNN-ficha-empleado-historico-geo.md`.
- **Esfuerzo estimado**: 2 días.

### 6. **Detección automática de fraude (mismo lugar dos empleados, distancia imposible entre fichajes consecutivos del mismo empleado)**
- **Por qué fuera**: requiere lógica de pattern matching no trivial (ventanas temporales, tolerancias de GPS, falsos positivos por familia compartiendo dispositivo). Riesgo alto de molestar a empleados con alarmas falsas.
- **Cuándo retomar**: cuando haya datos suficientes para validar heurísticas (mínimo 6 meses de fichajes reales). Crear `PRP-NNN-deteccion-fraude-fichajes.md` con análisis estadístico previo.
- **Esfuerzo estimado**: 3-5 días (incluyendo validación con datos reales).

### 7. **Export de evidencia PDF (mapa + datos del fichaje)**
- **Por qué fuera**: hace falta un generador PDF (`@react-pdf/renderer` o similar), maquetación legal + firma con timestamp. Es funcionalidad de "informes legales" que merece su propio PRP — y debería alinearse con PRP-036 (firmas eIDAS) por similitud técnica.
- **Cuándo retomar**: tras cerrar PRP-036 (firmas eIDAS) para reutilizar el generador PDF y la cadena de hash. Crear `PRP-NNN-exportacion-evidencia-fichajes.md`.
- **Esfuerzo estimado**: 2-3 días (apoyándose en infraestructura PRP-036).

### 8. **Geofencing dinámico (cambio de radio según horario o evento)**
- **Por qué fuera**: hoy `locales.radio_metros` es estático. Cambiarlo dinámicamente (ej. eventos con catering, jornadas reducidas) requiere modelar `local_radios_por_horario` y complica fichar.
- **Cuándo retomar**: cuando un cliente lo pida explícitamente. No es un need general.
- **Esfuerzo estimado**: 2 días + migración BD.

---

## 🧠 Aprendizajes (Self-Annealing)

> Esta sección crece con cada error encontrado durante la implementación.

### 2026-05-25 (post-cierre, commit `8b0189d`): Fichajes no se recargaban al cambiar empresa activa
- **Error**: tras cerrar el PRP, al cambiar de empresa activa en el selector el listado de fichajes mantenía los datos de la empresa anterior. Pasaba lo mismo con el modal abierto (apuntaba a un fichaje de la empresa anterior). Solo `locales` se recargaba (porque su useEffect tenía `[empresaActual.id]` como dependencia).
- **Causa raíz**: el `useEffect` de `loadFichajes` tenía `[loadFichajes]` como dependencia, pero `loadFichajes` está memoizado con `useCallback([])` — nunca cambia. Resultado: solo se ejecutaba en mount. El patrón correcto ya estaba en `EmpleadosView`: `useEffect(() => { cargar() }, [cargar, empresaActual.id])`. **No lo seguí**.
- **Causa secundaria detectada en el fix**: incluso añadiendo `empresaActual.id` a deps, sigue habiendo race condition si el usuario cambia de empresa dos veces rápido — la query lenta resuelve después y sobrescribe los datos correctos. El fix introduce `empresaActivaRef` y comprueba `if (empresaId !== empresaActivaRef.current) return` antes de cada `setState`.
- **Fix aplicado** (commit `8b0189d`):
  - `empresaActivaRef = useRef(empresaActual.id)` actualizado al inicio del useEffect.
  - `useEffect` con deps `[empresaActual.id, loadFichajes]` que limpia state previo (`setFichajes([])`, `setLocales([])`, `setLocalesFiltro([])`, `setFichajeModal(null)`) antes de re-cargar.
  - Dentro de `loadFichajes`, lee `empresaActivaRef.current` y descarta cualquier `setState` si la empresa cambió durante la query.
- **Aplicar en**: cualquier server action que use `getAppContext()` o `getEmpresaActivaId()` y se llame desde un componente con empresa activa contextual. Patrón obligatorio.
- **Promovido a**: pendiente — candidato fuerte para `patterns/multitenant-data-loading.md` del factory.

### 2026-05-25 (post-cierre, commit `8b0189d`): Race condition en `inyectarScript` cuando el `<script>` ya existía
- **Error**: en `FichajesMapaView.cargarLeafletConCluster()`, si Leaflet ya estaba siendo cargado por otro componente (p.ej. `FichajeUbicacionMiniMap` se abrió primero y todavía no había terminado), mi `inyectarScript` hacía `resolve()` inmediatamente al detectar el `<script>` existente, sin esperar a que `window.L` estuviera realmente disponible. Resultado intermitente: `Leaflet no inicializado` al abrir la tab Mapa después del modal.
- **Causa raíz**: mi código tenía la lógica:
  ```typescript
  if (existing) {
    existing.addEventListener("load", () => resolve(), { once: true });
    resolve();  // ← BUG: resuelve antes de que load dispare
    return;
  }
  ```
- **Fix aplicado** (commit `8b0189d`): refactor de `inyectarScript` con timeout de 10s, callback `isReady()` que verifica el estado real (`window.L` existe / `L.markerClusterGroup` es función) antes de resolver, y manejo de error con `addEventListener("error", ...)`. Ver `FichajesMapaView.tsx` líneas 74-118.
- **Aplicar en**: cualquier inyección dinámica de script en el repo. El patrón con `isReady()` es estricto y debería ser el default.
- **Promovido a**: pendiente — junto al aprendizaje del `declare global` forma un patrón completo "carga dinámica de Leaflet" que merece archivo propio en el factory.

### 2026-05-25 (post-cierre, commit `8b0189d`): Filtro de Locales no se aplicaba a los círculos del mapa
- **Error**: al filtrar por un local específico en la barra de filtros geo, los **fichajes** se filtraban correctamente, pero los **círculos del radio** de los otros locales seguían apareciendo en el mapa. Inconsistencia visual: el usuario veía una flota de círculos sin pines.
- **Causa raíz**: en `FichajesView`, `localesFiltro` solo se aplicaba al `useMemo` `fichajesFiltrados`. El array `locales` (completo, sin filtrar) se pasaba como prop a `<FichajesMapaView>` que los pintaba todos.
- **Fix aplicado** (commit `8b0189d`): nuevo `useMemo` `localesMapa` que filtra `locales` por `localesFiltro` (o devuelve todos si el filtro está vacío) y se pasa al componente del mapa en lugar de `locales`.
  ```typescript
  const localesMapa = useMemo(() => {
    if (localesFiltro.length === 0) return locales;
    const seleccionados = new Set(localesFiltro);
    return locales.filter((local) => seleccionados.has(local.id));
  }, [locales, localesFiltro]);
  ```
- **Aplicar en**: cualquier filtro UI debe propagarse a todas las visualizaciones de los datos filtrados, no solo a la principal. Revisar futuras vistas con filtros + multi-render.
- **Promovido a**: solo local (es un detalle de scope, no un patrón reusable a nivel factory).

### 2026-05-25 (TASK-002.04): Carga secuencial de Leaflet + markercluster
- **Error potencial**: cargar `leaflet.markercluster` antes de que Leaflet base esté en `window.L` provoca `L.markerClusterGroup is not a function`. El plugin **extiende** la global `L`, no es independiente.
- **Fix**: loader secuencial en `cargarLeafletConCluster()` — primero `inyectarScript(LEAFLET_JS)` y esperar `window.L`, luego `inyectarScript(MARKERCLUSTER_JS)` y verificar `typeof L.markerClusterGroup === "function"`. NO usar `Promise.all`.
- **Aplicar en**: cualquier plugin Leaflet futuro (heatmap, draw, etc.). Patrón: el plugin se carga después de la lib base que extiende.
- **Promovido a**: pendiente. Si se introduce otro plugin Leaflet, promover a `patterns/leaflet-plugin-loading.md` en el factory.

### 2026-05-25 (TASK-002.03): Conflicto de `declare global { Window.L }` con MapPicker
- **Error**: typecheck falló con `TS2717` y `TS2739` al añadir `declare global { interface Window { L?: LeafletGlobal } }` en `FichajeUbicacionMiniMap.tsx`. Causa: `MapPicker.tsx` ya declara `Window.L` con su propia interfaz local `LeafletGlobal` que tiene menos métodos. Dos `declare global` con interfaces locales distintas para la misma propiedad colisionan a nivel TypeScript.
- **Causa raíz**: el patrón Leaflet con `cargarLeaflet` se introdujo en `MapPicker.tsx` con `declare global` y nadie pensó que se replicaría. Cuando un segundo componente lo replica, la declaración global se duplica.
- **Fix**: en el componente nuevo, eliminar el `declare global` y acceder a `window.L` vía cast local: `(window as unknown as { L?: LeafletGlobal }).L`. Ver `FichajeUbicacionMiniMap.tsx` función `getWindowL()`. Cero impacto en MapPicker.
- **Aplicar en**: cualquier futuro componente Leaflet (`FichajesMapaView` de TASK-002.04 lo replicará). No declarar `Window.L` global más de una vez en el proyecto.
- **Promovido a**: pendiente — si se confirma como patrón recurrente al cerrar TASK-002.04, promover a `errors/` o `patterns/` de La Forja de SaaS.

---

## Gotchas

- [ ] **Leaflet requiere `dynamic import`** en Next.js (SSR no soporta `window`). Patrón ya resuelto en `MapPicker.tsx` líneas 140-150 (`cargarLeaflet()` que inyecta `<script>` y devuelve `window.L`). Copiar tal cual.
- [ ] **`leaflet.markercluster` también necesita inyectarse dinámicamente** — no añadir como `import` ES module. Cargar via `<script>` igual que Leaflet base.
- [ ] **Locales sin `lat/lng` configurado**: graceful fallback `Sin ubicación configurada para este local`. NO crashear el modal ni el mapa.
- [ ] **Fichajes manuales (`tipo='MAN'`)**: tienen `lat_entrada IS NULL` por diseño. El badge debe ser `📍 Teletrabajo` o `— Sin datos` (criterio: `modo_teletrabajo` decide). Ver `crearFichajeManual` en `fichajes-actions.ts` línea 358 — se setea `modo_teletrabajo: true` siempre.
- [ ] **Precisión GPS**: en móvil puede ser 50-200m. Mostrar `precision_entrada_metros` junto a la distancia para que el supervisor decida si un "Fuera 130m" es real o ruido GPS. **No filtrar automáticamente por precisión** — deja la decisión al humano.
- [ ] **RLS multi-tenant**: `listFichajes` ya filtra por empresa. Verificar que el JOIN con `locales` también respeta RLS. Si no, usar `createAdminClient()` con scope explícito (mismo patrón aplicado en `listEmpleados` durante el smoke de TASK-002 — ver `HANDOFF_2026-05-25_TASK002_SMOKE_EXTENSION.md`).
- [ ] **Performance con > 1000 fichajes**: ordenar por distancia en server (con `sort` JS sobre el resultado) en lugar de en cliente. Limitar la consulta inicial a rango de fecha (default último mes), no devolver todo el histórico.
- [ ] **Coordenadas de empleado fuera del centro del mapa**: si todos los pines están en Madrid pero uno fichó en Barcelona, el `fitBounds` debe contemplarlo. Usar `L.featureGroup(markers).getBounds().pad(0.1)`.
- [ ] **Color del pin vs color del local**: cuidado — `locales.color` es Tailwind (`bg-violet-500`). Los pines de fichajes usan colores semánticos (verde/violeta/rojo). El círculo del local sí usa `locales.color` (convertir Tailwind class a hex con un mapa).

## Anti-Patrones

- NO calcular distancias en cliente. Hacer en server una vez y devolver el resultado.
- NO modificar `ficharEntrada` / `ficharSalida` — este PRP es **read-only**.
- NO añadir validación geo a `crearFichajeManual` — es por diseño sin geo (ver Fuera de Alcance #4).
- NO cachear coordenadas de locales en `localStorage` — son sensibles y cambian poco; mejor consulta directa.
- NO hardcodear coordenadas de Madrid como fallback central del mapa — usar `fitBounds` sobre los pines presentes; si no hay, mostrar mensaje vacío `Sin fichajes para mostrar`.
- NO crear nueva migración — todo lo necesario ya está en BD desde 2026-05-14.
- NO usar Google Maps ni Mapbox — OpenStreetMap es libre, sin API key, ya en uso.

---

*PRP pendiente aprobación. No se ha modificado código.*
