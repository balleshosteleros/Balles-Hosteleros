# Full-TASK-002.02 — Columna "Geo" en la tabla de FichajesView

## Estado

Pendiente.

## Objetivo

Añadir una nueva columna `Geo` a la tabla principal de `FichajesView.tsx` (entre las columnas existentes "Tipo" y "Horas") que muestre por cada fichaje un `<GeoBadge>` con estado y distancia. La columna debe ser **ordenable por distancia** y **filtrable por status geo** (4 opciones) reutilizando la API del `SubmoduleToolbar` y `TableColumnHeader` ya en uso.

## Estimación de complejidad

Baja (S). Aprox 2–3 horas:
- Definir `columnasDef.geo` y `columnDefs.geo`: 1 h.
- Implementar `acceso(f, "geo")`: 0.5 h.
- Filtros y ordenación: 0.5–1 h.
- Validación: 0.5 h.

## Criterio de corte

- `/rrhh/fichajes` muestra una columna nueva "Geo" en la tabla con badge correcto para cada fichaje.
- Click en el encabezado ordena por distancia asc/desc.
- Filtro de tipo `lista` con las 4 opciones (`En local`, `Teletrabajo`, `Fuera`, `Sin datos`) reduce la lista al subset correcto.
- Compatible con `IOActions` (export) — si el export incluye columnas, la nueva debe aparecer.
- `npm run typecheck` pasa.

## Modo operativo

- taskId: TASK-002.02
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-fichajes-geo-audit/TASK-002.02-columna-geo-tabla.md
- sourcePRP: .claude/PRPs/PRP-037-auditoria-geografica-fichajes.md

## Contexto previo obligatorio

- Leer la sección `Criterios de éxito` del PRP-037 que describe la columna Geo.
- Leer `src/features/rrhh/components/fichajes/FichajesView.tsx` completo para entender la estructura actual de `columnasDef`, `columnDefs`, `acceso()`, `fichajesFiltrados`.
- Leer `src/shared/components/SubmoduleToolbar.tsx` y `src/shared/components/TableColumnHeader.tsx` para confirmar la API de filtros de tipo `lista`.
- Confirmar que `GeoBadge` y `getFichajeGeoStatus` existen (creados en 002.01).

## Scope IN

- Editar `src/features/rrhh/components/fichajes/FichajesView.tsx`:
  - añadir `{ campo: "geo", label: "Geo" }` a `columnasDef` (entre `tipo` y `horas`),
  - implementar `columnDefs.geo` con `<TableColumnHeader>` (ordenable + filtroTipo lista + opciones de los 4 statuses) y `<td>` con `<GeoBadge>`,
  - añadir caso `if (campo === "geo")` en la función `acceso(f, campo)` que devuelva:
    - para orden: `distanciaEntradaMetros ?? Infinity` (los `sin-datos` van al final),
    - para filtro de lista: el label del status (`En local` / `Teletrabajo` / `Fuera` / `Sin datos`) calculado con `getFichajeGeoStatus`.
- Mantener el resto de columnas y tabs intactas.

## Scope OUT

- Mini-mapa en modal (es 002.03).
- Tab Mapa (es 002.04).
- Filtros tipo toggle "solo fuera del radio" (es 002.05 — son filtros de toolbar, no filtros de columna).
- Refactor del modal de detalle a componente reutilizable (es 002.04).
- Tocar `columnasDef` ni `columnDefs` de la tab "Historial" ni de la tab "Incidencias".

## Restricciones

**Heredadas del PRP (Anti-Patrones):**
- NO calcular distancias en cliente — usar `distanciaEntradaMetros` que ya viene precalculada.
- NO hardcodear colores; usar `<GeoBadge>` que ya encapsula el mapeo.

**Propias de la task:**
- Compatibilidad backward: orden por defecto sigue siendo el actual (fecha desc o lo que esté hoy); ordenar por geo solo si el usuario lo activa.
- El filtro de status no debe alterar el comportamiento de los otros filtros existentes.

## Validación requerida

- `npm run typecheck` pasa.
- Smoke manual:
  - cargar la tabla, columna Geo visible con badges correctos.
  - click en encabezado ordena por distancia (los `sin-datos` al final).
  - aplicar filtro de status `Fuera` reduce la tabla al subset esperado.
  - cambiar empresa activa HABANA ↔ BACANAL filtra correctamente (sin fuga de fichajes entre empresas).

## Dependencias

- TASK-002.01 (tipo `Fichaje` extendido, `GeoBadge`, `getFichajeGeoStatus`).

## Inputs

- `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — PRP padre.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — archivo a editar.
- `src/features/rrhh/components/fichajes/geo-badge.tsx` — creado en 002.01.
- `src/features/rrhh/utils/fichaje-geo-status.ts` — creado en 002.01.

## Outputs esperados

- `FichajesView.tsx` con columna Geo funcional, ordenable y filtrable.
- `npm run typecheck` pasa.

## Riesgos conocidos

**Heredados del PRP (Gotchas):**
- **Precisión GPS móvil 50-200m**: un fichaje a 130m con precisión ±150m puede ser ruido. Mostrar `precision_entrada_metros` junto a la distancia ayuda al supervisor a juzgar. Si la columna queda muy llena, mover precisión al modal de detalle.
- **Fichajes manuales** tienen `lat_entrada IS NULL`. El badge debe mostrar `Sin datos` o `Teletrabajo` según `modo_teletrabajo`. El helper de 002.01 ya lo resuelve.

**Propios de la task:**
- Romper la ordenación cuando hay mezcla de `null` y `number` en distancia. Usar `?? Infinity` para que los `null` vayan al final consistentemente.
- Romper el filtro de lista si el label del status varía entre llamadas — usar constantes en lugar de strings ad hoc.

## Artefactos relacionados

- `Full-TASK-002.01-backend-extension-listfichajes.md` — predecesor.
- `docs/rrhh-fichajes-geo-audit/EXECUTION_PLAN.md` — índice.

## Paths del proyecto

**Heredados del PRP (Referencias internas):**
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — vista a extender.
- `src/shared/components/SubmoduleToolbar.tsx` — toolbar reutilizado.
- `src/shared/components/TableColumnHeader.tsx` — encabezado de columna reutilizado.

**Creados en 002.01:**
- `src/features/rrhh/components/fichajes/geo-badge.tsx`.
- `src/features/rrhh/utils/fichaje-geo-status.ts`.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` si la integración con `SubmoduleToolbar` requiere ajustes.

## Checklist de cierre

- [ ] Columna "Geo" añadida a `columnasDef` en la posición correcta.
- [ ] `columnDefs.geo` implementado con orden y filtro funcionales.
- [ ] `acceso(f, "geo")` cubre orden y filtro de lista.
- [ ] Filtro de status reduce correctamente la lista.
- [ ] Tabs "Historial" e "Incidencias" no se han tocado.
- [ ] `npm run typecheck` pasa.
- [ ] Smoke manual con HABANA y BACANAL OK.

## Modelo de datos propuesto

Sin cambios en BD ni en contratos. Reutiliza el tipo `FichajeConGeo` introducido en 002.01.

## Interfaces publicas propuestas

Sin cambios en interfaces públicas. La edición es interna a `FichajesView.tsx`.

## Flujo operativo esperado

1. Leer la estructura actual de `columnasDef`, `columnDefs` y `acceso()` en `FichajesView.tsx`.
2. Importar `GeoBadge` y `getFichajeGeoStatus`.
3. Añadir entrada en `columnasDef` y definición en `columnDefs.geo`.
4. Implementar caso en `acceso()` con la lógica diferenciada para orden vs filtro.
5. Probar la columna en local con dev server.
6. Ejecutar typecheck.

## Notas tecnicas

- Si `TableColumnHeader` soporta `filtroTipo: "lista"` con `opciones: string[]`, usar las 4 labels constantes definidas en un módulo compartido (`'En local'`, `'Teletrabajo'`, `'Fuera'`, `'Sin datos'`).
- El texto de distancia en el badge ya viene del `<GeoBadge>` — esta task solo monta el badge en la celda.
- Si la tabla ya tenía orden por defecto, no romperlo — solo añadir orden por geo como opción adicional.

## Siguiente paso sugerido

Cualquiera de los dos en paralelo:
- `Full-TASK-002.03` — mini-mapa en modal.
- `Full-TASK-002.04` — tab Mapa (depende también de 002.03).

## Resultado validado

_(Pendiente.)_

## Duracion real

_(Pendiente.)_

## Ruta canonica

docs/rrhh-fichajes-geo-audit/Full-TASK-002.02-columna-geo-tabla.md
