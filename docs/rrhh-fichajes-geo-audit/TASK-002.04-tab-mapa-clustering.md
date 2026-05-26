# TASK-002.04 — Tab "Mapa" con clustering de fichajes

## Estado

Cerrada — 2026-05-25.

## Objetivo

Añadir una nueva tab "Mapa" a `FichajesView.tsx` (entre "Fichajes" y "Historial") que muestre un mapa Leaflet a tamaño completo de la card con todos los fichajes del filtro actual representados como pines coloreados por status geo, los locales de la empresa con círculo de radio en color tenue, y **clustering automático** vía `leaflet.markercluster` cuando hay > 100 pines. Click en un pin abre el modal de detalle (reutilizando el modal existente, extraído ahora a componente propio).

## Estimación de complejidad

Alta. Es la fase más compleja: incluye `leaflet.markercluster` (plugin externo cargado dinámicamente), refactor del modal de detalle a componente reutilizable, lógica de `fitBounds` automático, y manejo del estado compartido entre tab "Fichajes" y tab "Mapa" (los filtros deben aplicar a ambas vistas).

## Criterio de corte

Tab "Mapa" muestra:
- mapa con tiles OpenStreetMap a `h-[600px]`,
- todos los locales de la empresa activa con círculo de radio tenue,
- todos los fichajes del filtro actual como pines coloreados (verde/violeta/rojo/gris),
- clustering automático cuando hay > 100 pines (zoom expande clusters),
- click en pin abre el `<FichajeDetalleDialog>` extraído como componente reutilizable,
- `fitBounds` automático al renderizar para encajar todos los pines visibles,
- al cambiar de tab Fichajes ↔ Mapa los filtros se preservan,
- carga en `< 1 s` para 100 fichajes (medido manualmente en local).

## Modo operativo

- taskId: TASK-002.04
- taskMode: code
- reviewMode: standard
- sourcePRP: `.claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md`

## Scope IN

- Crear `src/features/rrhh/components/fichajes/FichajesMapaView.tsx` con la lógica del mapa principal.
- Crear `src/features/rrhh/components/fichajes/FichajeDetalleDialog.tsx` extrayendo el modal de detalle actual de `FichajesView.tsx` (refactor sin cambio funcional para que pueda invocarse desde la tabla y desde el mapa).
- Cargar `leaflet.markercluster` dinámicamente vía `<script>` (igual que Leaflet base en `MapPicker.tsx`).
- Pintar locales con `L.circle` usando `radio_metros` y color con opacidad reducida.
- Pintar fichajes con `L.marker` y color semántico (no usar `locales.color` para los pines de fichaje).
- Añadir nueva entrada `<TabsTrigger value="mapa">` y `<TabsContent value="mapa">` en la estructura de tabs existente.
- Sincronizar `fichajesFiltrados` entre tab Fichajes y tab Mapa (mismo state).

## Scope OUT

- Filtros geo en toolbar (los aplica esta vista, pero la implementación de filtros es 002.05).
- Heatmap o vista de densidad.
- Interacciones avanzadas tipo dibujar polígonos, capas custom o switch de tiles.
- Modificar el funcionamiento del modal de detalle (solo extraerlo a componente propio).

## Dependencias

- TASK-002.01 (necesita contrato extendido de `listFichajes`).
- TASK-002.03 (el modal de detalle se reutiliza; en esta task se extrae a componente reutilizable).

## Inputs

- PRP-037 secciones `Criterios de éxito` (tab Mapa), `Gotchas` (Leaflet SSR, markercluster dinámico, performance).
- `src/features/ajustes/components/locales/MapPicker.tsx` (patrón Leaflet).
- `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx` (creado en 002.03 — patrón similar pero a mayor escala).
- `src/features/rrhh/components/fichajes/FichajesView.tsx` (archivo a editar — añadir tab y extraer modal).
- `src/features/ajustes/actions/locales-actions.ts` (función `listLocales` ya existente para cargar los locales de la empresa).

## Outputs esperados

- 2 ficheros nuevos + 1 modificado.
- `npm run typecheck` pasa.
- Smoke manual con > 100 fichajes simulados (puede ser navegando un mes con muchos empleados) verificando clustering.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` para maquetación de la tab y leyenda.
- `performance-optimizer` si el render con > 1000 pines no cumple el `< 1 s` objetivo.

## PRP origen

`.claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md` — Fase 5 del Blueprint.
