# Full-TASK-002.03 — Mini-mapa Leaflet en modal de detalle de fichaje

## Estado

Cerrada — 2026-05-25. typecheck pasa. Smoke UI queda para TASK-002.06.

## Objetivo

Crear el componente `FichajeUbicacionMiniMap` que renderiza un mapa Leaflet a tamaño compacto (`h-64`) con: pin azul en la posición de entrada, pin morado en la de salida (si existe), círculo violeta del radio del local, y leyenda con distancia entrada/salida y modo teletrabajo. Embeberlo dentro del `<Dialog>` de detalle de fichaje en `FichajesView.tsx` como nueva sección "Ubicación", con fallbacks limpios cuando faltan coords.

## Estimación de complejidad

Media (M). Aprox 4–5 horas:
- Patrón Leaflet con dynamic import (copia de MapPicker): 1.5 h.
- Lógica de 1-2 pines + círculo + fitBounds: 1.5 h.
- Integración con el modal existente: 1 h.
- Validación de los 5 casos fallback: 0.5–1 h.

## Criterio de corte

Click en una fila de la tabla abre el modal y dentro aparece la sección "Ubicación" con el mini-mapa. Los 5 casos del PRP cubiertos:

1. Fichaje con entrada + salida + local geolocalizado → 2 pines + círculo + leyenda con dos distancias.
2. Fichaje solo con entrada → 1 pin + círculo + leyenda con una distancia.
3. Fichaje con `modo_teletrabajo=true` → leyenda muestra `Modo: teletrabajo` (sin importar la distancia).
4. Local sin `lat/lng` → muestra texto `Sin ubicación configurada para este local`, no se renderiza mapa.
5. Fichaje manual con `lat_entrada IS NULL` → muestra texto `Entrada sin geolocalización (manual)`.

Cleanup correcto del mapa al cerrar el modal (no debe quedar instancia colgada al abrir otro fichaje).

## Modo operativo

- taskId: TASK-002.03
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-fichajes-geo-audit/TASK-002.03-mini-mapa-modal-detalle.md
- sourcePRP: .claude/PRPs/PRP-037-auditoria-geografica-fichajes.md

## Contexto previo obligatorio

- Leer PRP-037 secciones `Criterios de éxito` (modal) y `Gotchas` (Leaflet SSR, locales sin lat/lng).
- Leer `src/features/ajustes/components/locales/MapPicker.tsx` completo, en especial:
  - función `cargarLeaflet()` (líneas ~140-150) — patrón de carga dinámica.
  - declaración de interfaces `LeafletMap`, `LeafletMarker`, `LeafletCircle`.
  - manejo de `useEffect` con cleanup.
- Leer la estructura del `<Dialog>` de detalle en `FichajesView.tsx` (~líneas 442-538) para identificar dónde insertar la sección.

## Scope IN

- Crear `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx`:
  - prop `{ fichaje: FichajeConGeo }`.
  - `dynamic import` de Leaflet siguiendo `MapPicker.tsx`.
  - render del mapa con:
    - tile layer OpenStreetMap.
    - pin azul para entrada (popup con `HH:MM, ±N m precisión`).
    - pin morado para salida si existe (popup similar).
    - círculo violeta con `radius: local.radioMetros` en posición del local.
    - `fitBounds` automático de los pines + círculo para encajarlo todo.
  - leyenda debajo del mapa: `Entrada: 234 m de HABANA (±15 m)`, `Salida: 89 m de HABANA (±20 m)`, `Modo: presencial | teletrabajo`.
  - los 5 fallbacks descritos en el criterio de corte.
- Editar `src/features/rrhh/components/fichajes/FichajesView.tsx`:
  - importar `FichajeUbicacionMiniMap`.
  - dentro del `<Dialog>` de detalle, **debajo del bloque "Horas totales"** y **antes del bloque "Observaciones RRHH"**, añadir:
    ```tsx
    <div className="space-y-1.5">
      <Label className="text-xs">Ubicación</Label>
      <FichajeUbicacionMiniMap fichaje={fichajeModal} />
    </div>
    ```

## Scope OUT

- Tab Mapa (es 002.04).
- Extraer el modal a componente reutilizable (es 002.04).
- Modificar `MapPicker.tsx`.
- Cargar `leaflet.markercluster` (es 002.04).
- Animaciones de transición del mapa, controles custom, switch de tiles.
- Modificar el server action `listFichajes`.

## Restricciones

**Heredadas del PRP (Anti-Patrones):**
- NO cachear coordenadas en `localStorage`.
- NO hardcodear coordenadas de Madrid como fallback central. Usar `fitBounds` sobre los pines existentes; si no hay, mostrar mensaje vacío.
- NO usar Google Maps ni Mapbox — OpenStreetMap.

**Propias de la task:**
- El componente no debe romper SSR — todo el código que toca `window.L` va dentro de `useEffect`.
- Cleanup correcto: al desmontar (cerrar modal) debe llamar `map.remove()`.
- No tocar la lógica funcional del modal (botones Resolver incidencia, Fichar salida, Guardar observaciones, Cerrar).

## Validación requerida

- `npm run typecheck` pasa.
- Smoke manual: abrir 3-4 fichajes distintos (entrada+salida, solo entrada, manual sin lat, fichaje con teletrabajo) y verificar que cada caso se renderiza correctamente.
- Smoke manual: abrir y cerrar el mismo modal 5 veces seguidas sin recargar — no debe haber errores en consola ni memory leak visible (DevTools Memory profile).

## Dependencias

- TASK-002.01 (necesita `FichajeConGeo` y el contrato extendido de `listFichajes`).

## Inputs

- `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — PRP padre.
- `src/features/ajustes/components/locales/MapPicker.tsx` — patrón Leaflet.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — modal a extender.

## Outputs esperados

- `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx` — nuevo.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — modificado con la sección Ubicación.

## Riesgos conocidos

**Heredados del PRP (Gotchas):**
- **Leaflet requiere dynamic import**: SSR de Next.js falla con `window is not defined` si se importa Leaflet a nivel módulo. Patrón resuelto en `MapPicker.tsx` líneas 140-150 con función `cargarLeaflet()` que inyecta `<script>`. Copiar tal cual.
- **Locales sin `lat/lng`**: graceful fallback `Sin ubicación configurada para este local`. No crashear el modal.
- **Fichajes manuales** con `lat_entrada IS NULL`: fallback `Entrada sin geolocalización (manual)`.
- **Precisión GPS**: mostrar `precision_entrada_metros` junto a la distancia. Móvil puede dar 50-200m.

**Propios de la task:**
- Múltiples instancias de Leaflet activas al cambiar entre fichajes: si no se hace cleanup correcto, se acumulan memory leaks. Verificar con DevTools.
- `fitBounds` con un solo punto produce zoom máximo molesto. Si solo hay un pin + círculo, hacer `setView` al pin con zoom fijo (17) en lugar de fitBounds.

## Artefactos relacionados

- `Full-TASK-002.01` — predecesor (contrato extendido).
- `Full-TASK-002.04` — sucesor (extracción del modal a componente reutilizable).

## Paths del proyecto

**Heredados del PRP (Referencias internas):**
- `src/features/ajustes/components/locales/MapPicker.tsx` — patrón a copiar, especialmente líneas 140-150 (`cargarLeaflet`).
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — modal a extender.

**Nuevo a crear:**
- `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx`.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` para maquetación del modal y leyenda.

## Checklist de cierre

- [ ] `FichajeUbicacionMiniMap` creado con los 5 casos cubiertos.
- [ ] Modal de detalle muestra la sección "Ubicación" entre Horas y Observaciones.
- [ ] Leaflet se carga dinámicamente, sin error de SSR.
- [ ] Cleanup al desmontar funciona — no memory leak al abrir/cerrar repetidamente.
- [ ] Botones existentes del modal (Resolver, Fichar salida, Guardar, Cerrar) siguen funcionando igual.
- [ ] `npm run typecheck` pasa.

## Modelo de datos propuesto

Sin cambios en BD ni en contratos. Reutiliza `FichajeConGeo` de 002.01.

## Interfaces publicas propuestas

```typescript
// src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx
export function FichajeUbicacionMiniMap(props: { fichaje: FichajeConGeo }): JSX.Element;
```

## Flujo operativo esperado

1. Leer `MapPicker.tsx` completo para internalizar el patrón.
2. Crear `FichajeUbicacionMiniMap.tsx` con esqueleto + dynamic import.
3. Implementar los 5 casos uno a uno verificando en local con dev server.
4. Integrar en el modal de `FichajesView.tsx` en la posición indicada.
5. Smoke manual de los 5 casos.
6. Verificar cleanup con DevTools Memory.
7. Typecheck.

## Notas tecnicas

- Color del pin entrada: `blue`. Color del pin salida: `purple`. Color del círculo del local: `#7c3aed` (violeta) con `fillOpacity: 0.2`, como en `MapPicker.tsx`.
- Si entrada y salida están a < 5m de distancia (mismo punto), renderizar solo el pin de entrada para evitar superposición visual.
- La leyenda debe ser legible en mobile (mapa puede quedar pequeño en pantallas < 400px). Usar grid responsive.

## Siguiente paso sugerido

`Full-TASK-002.04` — tab Mapa con clustering (reutiliza el componente modal extraído).

## Resultado validado

- `npm run typecheck`: ✅ pasa.
- Creado `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx` con patrón `cargarLeaflet` idéntico al de `MapPicker` pero con interfaces extendidas (`divIcon`, `latLngBounds`, `bindPopup`, `fitBounds`).
- 4 estados fallback cubiertos:
  - sin coords del local → `MapPinOff` + "Sin ubicación configurada para este local"
  - fichaje manual sin lat_entrada → `MapPinOff` + "Entrada sin geolocalización (manual)"
  - sin lat_entrada sin razón clara → "Sin datos de geolocalización del fichaje"
  - error de carga de Leaflet → mensaje de error en placeholder
- Render normal:
  - tile OSM,
  - círculo violeta con `radio_metros` del local,
  - pin azul entrada con `divIcon` + popup `HH:MM ±Xm`,
  - pin morado salida (si existe) con popup similar,
  - `fitBounds` con padding adaptativo según haya 1 o 2 pines.
- Leyenda debajo del mapa: distancias entrada/salida + nombre del local + modo (presencial/teletrabajo).
- Cleanup correcto en `useEffect` return: remueve layers y llama `map.remove()` para evitar memory leak al abrir/cerrar el modal repetidamente.
- Sección "Ubicación" insertada en el modal de detalle de `FichajesView` entre "Horas totales" y "Observaciones RRHH".

## Aprendizaje (Self-Annealing — TASK-002.03)

- **Error encontrado**: TypeScript falló con `TS2717` (`Subsequent property declarations must have the same type`) y `TS2739` al hacer `declare global { Window.L }` en mi nuevo componente, porque MapPicker.tsx ya declara `Window.L` con su propia interfaz local de Leaflet — dos interfaces locales `LeafletGlobal` con propiedades distintas generan conflicto.
- **Fix**: eliminar `declare global` en el componente nuevo y acceder a `window.L` vía cast local (`(window as unknown as { L?: LeafletGlobal }).L`). El módulo queda autocontenido.
- **Aplicar en**: cualquier futuro componente Leaflet en este repo. No declarar `Window.L` global más de una vez. Promovido a entrada del PRP-037 (Aprendizajes) — pendiente de promoción a `errors/` del factory si se confirma como patrón.

## Duracion real

~1 h (incluye debugging del conflicto de declaración global).

## Ruta canonica

docs/rrhh-fichajes-geo-audit/Full-TASK-002.03-mini-mapa-modal-detalle.md
