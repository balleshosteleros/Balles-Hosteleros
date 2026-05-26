# TASK-002.05 — Filtros geo en el toolbar de fichajes

## Estado

Cerrada — 2026-05-25.

## Objetivo

Añadir al `SubmoduleToolbar` de `FichajesView.tsx` tres filtros nuevos que actúen sobre el estado compartido `fichajesFiltrados` (afecta tabla y tab Mapa simultáneamente):
1. **Toggle "Solo fichajes fuera del radio"** — muestra solo fichajes con status `fuera`.
2. **Toggle "Solo teletrabajo"** — muestra solo fichajes con `modo_teletrabajo=true`.
3. **Multi-select "Local"** — filtra por uno o varios `local_id` de los locales de la empresa activa.

## Estimación de complejidad

Baja-media. Es lógica de filtrado sobre el state existente. Reutiliza patrones del toolbar.

## Criterio de corte

- Los tres filtros funcionan combinados (ej. "fuera del radio" + un local específico).
- Limpiar filtros desde el botón "Limpiar" del toolbar resetea los tres a la vez.
- Cambiar de tab Fichajes ↔ Mapa preserva los filtros (validado en TASK-002.04, esta task lo refuerza).
- El filtro "Local" carga las opciones de `listLocales(empresaId)` solo cuando se abre por primera vez (lazy).

## Modo operativo

- taskId: TASK-002.05
- taskMode: code
- reviewMode: standard
- sourcePRP: `.claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md`

## Scope IN

- Añadir tres entradas al state de filtros (`filtros: ToolbarFiltroActivo[]` existente o ampliar contrato si hace falta).
- Implementar la lógica de aplicar los tres filtros dentro del `useMemo` `fichajesFiltrados`.
- Asegurar que los filtros aplican igualmente a la tab Mapa porque ambas vistas leen `fichajesFiltrados`.
- Si el `SubmoduleToolbar` no soporta toggles y multi-select nativos, extender su API mínimamente (manteniendo compatibilidad).

## Scope OUT

- Crear vistas o componentes nuevos.
- Modificar la API del toolbar más allá de lo mínimo necesario.
- Persistir los filtros en URL (puede ser PRP futuro).
- Filtros por empleado o departamento (no son geo, fuera de scope del PRP).

## Dependencias

- TASK-002.02 (la columna Geo en tabla — los filtros aplican sobre la misma `fichajesFiltrados`).
- TASK-002.04 (la tab Mapa — los filtros aplican aquí también).

## Inputs

- PRP-037 secciones `Criterios de éxito` (tres filtros), `Comportamiento esperado paso 4-6`.
- `src/shared/components/SubmoduleToolbar.tsx` (toolbar existente).
- `src/features/ajustes/actions/locales-actions.ts` (`listLocales` para cargar opciones).
- `src/features/rrhh/components/fichajes/FichajesView.tsx` (archivo principal a editar).

## Outputs esperados

- Filtros funcionando combinados en tabla y mapa.
- `npm run typecheck` pasa.
- Smoke manual: cargar fichajes del mes, aplicar combinaciones de los 3 filtros, verificar que el resultado es correcto y que la tab Mapa refleja el filtro.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` solo si el toolbar requiere extensión de API.

## PRP origen

`.claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md` — Fase 6 del Blueprint.
