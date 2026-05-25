# TASK-002.02 — Columna "Geo" en tabla de FichajesView

## Estado

Pendiente.

## Objetivo

Añadir una nueva columna `Geo` a la tabla principal de `FichajesView.tsx` que muestre, por cada fichaje, un `GeoBadge` (`✓ En local` / `📍 Teletrabajo` / `⚠ Fuera` / `— Sin datos`) más la distancia de entrada en metros. La columna debe ser ordenable por distancia y filtrable por status geo, reutilizando el toolbar existente.

## Estimación de complejidad

Baja-media. Es solo edición de `FichajesView.tsx` consumiendo lo construido en TASK-002.01.

## Criterio de corte

`/rrhh/fichajes` muestra la columna Geo en la tabla "Fichajes" con badge y distancia correctos para los fichajes del día. Click en encabezado ordena por distancia asc/desc. Aplicar filtro por status geo desde el toolbar reduce correctamente la lista.

## Modo operativo

- taskId: TASK-002.02
- taskMode: code
- reviewMode: standard
- sourcePRP: `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md`

## Scope IN

- Añadir entrada `{ campo: "geo", label: "Geo" }` a `columnasDef` de `FichajesView.tsx`.
- Implementar `columnDefs.geo` con `<TableColumnHeader>` (ordenable + filtroTipo lista con 4 opciones) y `<td>` con `<GeoBadge>` + distancia.
- Añadir caso `if (campo === "geo")` en la función `acceso()` para devolver status o distancia según contexto de orden/filtro.
- No tocar las otras tabs ni el modal de detalle (eso es 002.03).

## Scope OUT

- Mini-mapa en modal (es 002.03).
- Tab Mapa (es 002.04).
- Filtros adicionales como "solo fuera del radio" en el toolbar (es 002.05).
- Refactor del modal de detalle (es parte de 002.04).

## Dependencias

- TASK-002.01 (necesita el tipo `Fichaje` extendido y el componente `GeoBadge`).

## Inputs

- PRP-037 secciones `Criterios de éxito` (columna Geo), `Comportamiento esperado paso 1`.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` (archivo a editar).
- `geo-badge.tsx` y `fichaje-geo-status.ts` creados en 002.01.

## Outputs esperados

- Tabla con columna Geo visible y funcional.
- `npm run typecheck` pasa.
- Smoke manual: cambiar entre empresa HABANA/BACANAL sigue mostrando datos coherentes.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` si la integración con `SubmoduleToolbar` necesita ajustes.

## PRP origen

`.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — Fase 3 del Blueprint.
