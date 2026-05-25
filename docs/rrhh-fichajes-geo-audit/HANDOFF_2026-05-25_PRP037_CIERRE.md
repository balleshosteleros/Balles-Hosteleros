# Handoff PRP-037 cierre — 2026-05-25

## Estado de sesión

PRP-037 **cerrado funcionalmente** tras 6 tasks `code/ops` + 3 fixes posteriores + smoke UI ejecutado.

**Checks técnicos cerrados**:
- ✅ `npm run typecheck`: pasa limpio.
- ✅ `npm run build`: pasa. Rutas RRHH compilan sin warnings.
- ✅ **Smoke UI ejecutado**: login admin, navegación a `/rrhh/fichajes`, apertura de tab Mapa sin error de Leaflet/MarkerCluster.
- ✅ **Multi-tenant HABANA ↔ BACANAL** validado en navegador después de aplicar el fix de commit `8b0189d`.

**Fixes aplicados tras mi entrega inicial** (commit `8b0189d` — corregido por Fernando):
- Bug 1: fichajes no se recargaban al cambiar `empresaActual.id` (mi `useEffect` con deps `[loadFichajes]` no se re-disparaba). Fix: `useRef` de empresa activa + cancelación de setState si la empresa cambió durante la query.
- Bug 2: race condition en `inyectarScript` cuando el `<script>` de Leaflet ya estaba en curso (resolve inmediato sin esperar `window.L`). Fix: timeout + callback `isReady()` que verifica estado real.
- Bug 3: `localesFiltro` no se aplicaba a los círculos del mapa, solo a los fichajes. Fix: nuevo `useMemo` `localesMapa` que filtra antes de pasar al componente del mapa.

Estos 3 errores son míos y están documentados como entradas Self-Annealing en el PRP-037 con causa raíz y patrón de fix.

**Único elemento no versionado**: contraseña del usuario smoke (guardada en artefacto local no versionado en git, por seguridad).

Branch: `rrhh-sync-origin-c4da3ca`
Repo: `https://github.com/balleshosteleros/Balles-Hosteleros.git`

---

## Resumen de tasks cerradas

| Task | Commit | Cambios principales |
|------|--------|---------------------|
| TASK-002.01 | `aeb9808` | Backend: `listFichajes` con JOIN locales + distancias precalculadas server-side + admin client (mismo patrón que `listEmpleados` post-TASK-002). Tipos `LocalGeo`, `FichajeGeoStatus`. Helper `getFichajeGeoStatus`. Componente `GeoBadge`. |
| TASK-002.02 | `8e9cef1` | Columna "Geo" en tabla de FichajesView con `TableColumnHeader` (orden por distancia + filtro de lista por status). `mapDbToFichaje` extendido. |
| TASK-002.03 | `888c3e4` | Componente `FichajeUbicacionMiniMap` con Leaflet + dynamic import. 4 fallbacks (sin local, fichaje manual, sin entrada, error de carga). Sección "Ubicación" integrada en modal de detalle. |
| TASK-002.04 | `9f227bb` | Modal extraído a `FichajeDetalleDialog.tsx` (refactor sin regresión funcional). Componente `FichajesMapaView` con `leaflet.markercluster` + clustering automático. Nueva tab "Mapa". Carga lazy de `locales` por empresa activa. |
| TASK-002.05 | `0cf11f6` | Barra de filtros geo inline: toggles "Solo fuera del radio" + "Solo teletrabajo" + multi-select de Locales con Popover + Checkbox. Botón "Limpiar". Aplica simultáneamente a tabla y tab Mapa. |
| TASK-002.06 | (este handoff) | Validación final parcial: typecheck + build OK. Smoke UI queda para sesión con Chrome conectado. |

**Archivos nuevos creados** (5):
- `src/features/rrhh/utils/fichaje-geo-status.ts`
- `src/features/rrhh/components/fichajes/geo-badge.tsx`
- `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx`
- `src/features/rrhh/components/fichajes/FichajeDetalleDialog.tsx` (extraído)
- `src/features/rrhh/components/fichajes/FichajesMapaView.tsx`

**Archivos modificados** (3):
- `src/features/rrhh/data/fichajes.ts` — tipo `Fichaje` extendido con campos geo opcionales.
- `src/features/rrhh/actions/fichajes-actions.ts` — `listFichajes` con admin client + JOIN locales + distancias.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — columna Geo + tab Mapa + filtros + sección Ubicación en modal.

**Sin migraciones** — BD ya tenía todo desde `20260514130000_rrhh_centros_y_geolocalizacion.sql`.

**Sin dependencias nuevas** — Leaflet + markercluster via CDN unpkg, igual que el `MapPicker` de Locales.

---

## Aprendizajes promovidos al PRP-037 (Self-Annealing)

Ver `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` sección **Aprendizajes**. Total: **5 entradas**.

Durante la ejecución de las 6 tasks (capturados por typecheck):
1. **TASK-002.03**: Conflicto de `declare global { Window.L }` con MapPicker.
2. **TASK-002.04**: Carga secuencial obligatoria de Leaflet + markercluster.

Tras la entrega inicial, encontrados en smoke real (commit `8b0189d`):
3. **Post-cierre**: Fichajes no recargaban al cambiar empresa activa — patrón de `useEffect([empresaId, ...])` + `useRef` de empresa activa para cancelar setState stale.
4. **Post-cierre**: Race condition en `inyectarScript` cuando el script ya existía — patrón con `isReady()` callback + timeout.
5. **Post-cierre**: Filtro de Locales no propagaba a los círculos del mapa — `useMemo` separado para `localesMapa`.

**Promoción al factory**: los aprendizajes 1+2+4 forman un patrón completo "carga dinámica de Leaflet en Next.js" que merece archivo propio en `patterns/leaflet-loading.md`. El aprendizaje 3 es candidato a `patterns/multitenant-data-loading.md` (cancelación de queries en cambio de empresa activa). El 5 es local al PRP-037.

---

## Estado de blindaje

**`documentado`**.

Los 5 aprendizajes están capturados en la sección Self-Annealing del PRP-037 con causa raíz, fix concreto y dónde más aplica. Especialmente importante: las 3 entradas post-cierre vienen de bugs reales encontrados en smoke UI ejecutado por humano y deberían propagarse al factory como patrones reusables (ver "Promoción al factory" arriba).

---

## Riesgos conocidos para el smoke UI pendiente

Cuando se ejecute el smoke con Chrome, vigilar especialmente:

1. **Multi-tenant en listFichajes**: el patrón de `createAdminClient + requireAdminFichajes` se replicó del fix de TASK-002. Si la query a `locales` con JOIN diera problemas (RLS o ambigüedad de FK), el síntoma sería `local: null` en todos los fichajes y los badges aparecerían en gris ("Sin datos") aunque la BD tenga los datos.
2. **Carga de markercluster en producción**: el plugin se carga vía CDN unpkg. Si la red del cliente bloquea unpkg, el mapa fallaría con `MarkerCluster plugin no inicializado`. Mitigación futura: self-host del plugin si se ve este problema en producción.
3. **Performance con > 1000 fichajes**: el clustering maneja bien hasta ~1000 markers. Más allá hay que reducir el rango de fecha por defecto (hoy: día actual).
4. **Locales sin lat/lng configurados**: aparecen como pin "Sin datos" en la tabla y sin círculo en el mapa. Comportamiento esperado, pero el supervisor RRHH puede pensar que es un bug. Recordatorio para el smoke: validar que los locales activos de HABANA y BACANAL tienen lat/lng configurados en Ajustes → Locales.

---

## Smoke UI pendiente — script ejecutable

### Prerequisitos
- Dev server: `npm run dev` en `/home/fernandomp/dev/Balles-Hosteleros`
- Login: `rrhh-smoke-admin-no-borrar@example.com` (ver `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`)
- Chrome con extensión Claude in Chrome conectada, o navegador manual.

### Paso 1 — Columna Geo en tabla
1. Navegar a `/rrhh/fichajes`.
2. Verificar columna "Geo" entre "Tipo" y la cabecera del orden.
3. Cada fila debe tener un badge (verde/violeta/rojo/gris) + distancia (`87 m`, `>5 km`, etc.).
4. Click en cabecera "Geo" → ordena por distancia asc/desc.
5. Click en cabecera "Geo" → dropdown de filtro con 4 opciones (En local / Teletrabajo / Fuera / Sin datos).
6. Aplicar filtro "Fuera" → la tabla reduce a los fichajes con badge rojo.

### Paso 2 — Modal de detalle con mini-mapa
1. Click en una fila → modal de detalle.
2. Verificar sección nueva "Ubicación" entre incidencia y observaciones.
3. Casos a cubrir (abrir varios fichajes):
   - Fichaje con entrada + salida → mini-mapa con 2 pines + círculo violeta del local + leyenda con 2 distancias.
   - Fichaje solo con entrada → 1 pin + círculo + leyenda con 1 distancia.
   - Fichaje manual → "Entrada sin geolocalización (manual)".
   - Local sin lat/lng → "Sin ubicación configurada para este local".
4. Cerrar y reabrir el mismo modal 5 veces seguidas — no debe haber leaks ni errores en consola DevTools.

### Paso 3 — Tab Mapa con clustering
1. Click en tab "Mapa".
2. Verificar mapa Leaflet a `h-[600px]` con tiles OSM.
3. Locales pintados como círculo violeta tenue.
4. Fichajes pintados como pines coloreados (verde/violeta/rojo/gris).
5. Si hay > 50 fichajes en pantalla → clusters numerados aparecen.
6. Click en cluster → zoom + expansión.
7. Click en pin individual → abre `FichajeDetalleDialog` (el mismo modal que la tabla).
8. Leyenda visible debajo del mapa con conteo `N fichajes • M locales`.

### Paso 4 — Filtros geo
1. En tab "Fichajes" o "Mapa", aplicar:
   - Toggle "Solo fuera del radio" → reduce a los fuera del radio.
   - Toggle "Solo teletrabajo" → reduce a los con `modo_teletrabajo=true`.
   - Combinar ambos → probablemente cero (los `fuera` no son `teletrabajo` por definición).
   - Popover "Locales" → checkboxes con los locales de la empresa activa.
   - Selección de un local → solo fichajes de ese local.
2. Cambiar de tab Fichajes ↔ Mapa → filtros se mantienen.
3. Botón "Limpiar" → resetea los 3.

### Paso 5 — Multi-tenant
1. Cambiar empresa activa HABANA → BACANAL en el selector superior.
2. Verificar que la lista de fichajes se renueva con los de BACANAL.
3. Tab "Mapa" muestra solo los locales y fichajes de BACANAL.
4. `localesFiltro` queda inocuo (puede tener IDs de HABANA, pero el filter ignora los que no aparecen).

### Paso 6 — Performance
1. Cambiar el rango (cuando se implemente filtro por fecha) o navegar a un día con > 100 fichajes.
2. En DevTools consola: `performance.now()` antes y después del render de la tab Mapa.
3. Debe ser `< 1000 ms`.

---

## Dónde retomar

1. Ejecutar smoke UI siguiendo el script anterior cuando Chrome esté disponible.
2. Si el smoke pasa los 6 pasos → cerrar TASK-002.06 actualizando `Resultado validado` y marcar PRP-037 como completo.
3. Si surge cualquier bug durante el smoke → abrir sub-bugfix dentro de la TASK responsable y volver a TASK-002.06.

**Próximos PRPs sugeridos** tras cerrar PRP-037:
- Heatmap / densidad (Fuera de Alcance #1 del PRP-037).
- Vista geo en ficha de empleado (Fuera de Alcance #5).
- Export evidencia PDF (Fuera de Alcance #7 — alinear con PRP-036 firmas eIDAS).

**Frentes pendientes del plan original de consolidación RRHH:**
- TASK-003 horarios discovery (requiere decidir modelado `rrhh_turnos/cuadrantes/descansos`).
- TASK-004 firmas hardening (PRP-036 sin aprobar).
- TASK-005 reclutamiento (depende de TASK-004).
