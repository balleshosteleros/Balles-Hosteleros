# TASK-002.03 — Mini-mapa Leaflet en modal de detalle de fichaje

## Estado

Cerrada — 2026-05-25.

## Objetivo

Crear el componente `FichajeUbicacionMiniMap` (Leaflet con `dynamic import`, patrón de `MapPicker.tsx`) y embeberlo en el `<Dialog>` de detalle de fichaje de `FichajesView.tsx`. El mini-mapa muestra pin entrada, pin salida (si existe), círculo del radio del local y leyenda con distancias y modo teletrabajo. Maneja fallbacks limpios cuando faltan coords o el local no está geolocalizado.

## Estimación de complejidad

Media. Patrón de Leaflet ya resuelto en `MapPicker.tsx` — sirve de copia. Lo nuevo es el manejo de dos pines (entrada y salida) y el círculo de radio.

## Criterio de corte

Click en una fila de la tabla abre el modal de detalle, y dentro del modal aparece una sección "Ubicación" con el mini-mapa renderizado correctamente. Casos cubiertos:
- fichaje con entrada + salida + local geolocalizado → 2 pines + círculo + leyenda con dos distancias,
- fichaje solo con entrada → 1 pin + círculo + leyenda con una distancia,
- fichaje con `modo_teletrabajo=true` → leyenda lo refleja,
- local sin `lat/lng` → muestra texto `Sin ubicación configurada para este local`,
- fichaje sin `lat_entrada` (manual) → muestra texto `Entrada sin geolocalización (manual)`.

## Modo operativo

- taskId: TASK-002.03
- taskMode: code
- reviewMode: standard
- sourcePRP: `.claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md`

## Scope IN

- Crear `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx`.
- Editar `FichajesView.tsx` para insertar la sección "Ubicación" dentro del `<Dialog>` de detalle existente (debajo del bloque "Horas totales", antes del bloque de "Observaciones RRHH").
- Manejar `dynamic import` de Leaflet siguiendo el patrón de `MapPicker.tsx` líneas 140-150.
- Cleanup correcto del mapa al desmontar (evitar memory leaks al abrir/cerrar el modal repetidamente).

## Scope OUT

- Tab Mapa (es 002.04).
- Extraer el modal de detalle a componente reutilizable (es 002.04 también).
- Modificar `MapPicker.tsx`.
- Añadir interacciones avanzadas tipo zoom-to-fit con animación, popups con html custom o controles extra.

## Dependencias

- TASK-002.01 (necesita el contrato extendido de `listFichajes` para leer coords del fichaje y del local).

## Inputs

- PRP-037 secciones `Criterios de éxito` (modal con mini-mapa), `Gotchas` (Leaflet SSR, locales sin lat/lng).
- `src/features/ajustes/components/locales/MapPicker.tsx` (patrón Leaflet a copiar).
- `src/features/rrhh/components/fichajes/FichajesView.tsx` (archivo a editar).

## Outputs esperados

- 1 fichero nuevo + 1 fichero modificado.
- `npm run typecheck` pasa.
- Smoke manual: abrir 3-4 fichajes distintos del día y verificar que el mini-mapa carga correctamente sin errores de hidratación.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` para la maquetación del modal.

## PRP origen

`.claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md` — Fase 4 del Blueprint.
