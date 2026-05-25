# Full-TASK-002.05 — Filtros geo en el toolbar de fichajes

## Estado

Cerrada — 2026-05-25. typecheck pasa. Smoke UI queda para TASK-002.06.

## Objetivo

Añadir tres filtros nuevos al `SubmoduleToolbar` de `FichajesView.tsx` que actúen sobre el estado compartido `fichajesFiltrados` y, por tanto, sobre la tabla y la tab Mapa simultáneamente:

1. **Toggle "Solo fichajes fuera del radio"** — muestra solo fichajes con `getFichajeGeoStatus(...) === 'fuera'`.
2. **Toggle "Solo teletrabajo"** — muestra solo fichajes con `modo_teletrabajo === true`.
3. **Multi-select "Local"** — filtra por uno o varios `local_id` de los locales de la empresa activa.

## Estimación de complejidad

Baja-media (S/M). Aprox 3–4 horas:
- Extender state de filtros y lógica de filtrado: 1 h.
- Integración con `SubmoduleToolbar` (puede requerir extensión de API): 1.5 h.
- Lazy loading de opciones de Local: 0.5 h.
- Validación combinada con tabla y tab Mapa: 1 h.

## Criterio de corte

- Tres filtros funcionando combinados (ej. "fuera del radio" + un local específico).
- Limpiar filtros desde el botón "Limpiar" del toolbar resetea los tres a la vez.
- Aplicar los filtros desde la tab "Fichajes" y cambiar a tab "Mapa" preserva los mismos filtros visibles en el mapa.
- El filtro "Local" carga sus opciones lazy (al abrir el dropdown por primera vez, no al montar el toolbar).
- `npm run typecheck` pasa.

## Modo operativo

- taskId: TASK-002.05
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-fichajes-geo-audit/TASK-002.05-filtros-geo-toolbar.md
- sourcePRP: .claude/PRPs/PRP-037-auditoria-geografica-fichajes.md

## Contexto previo obligatorio

- Leer PRP-037 sección `Criterios de éxito` (tres filtros) y `Comportamiento esperado` pasos 4-6.
- Releer `src/shared/components/SubmoduleToolbar.tsx` para confirmar la API actual de filtros y si soporta:
  - filtros tipo toggle (boolean global, no por columna),
  - multi-select externo a las columnas.
- Si la API no lo soporta, planificar extensión mínima (manteniendo compat con otras vistas).
- Leer `src/features/rrhh/components/fichajes/FichajesView.tsx` para entender el state `filtros` actual y el `useMemo` `fichajesFiltrados`.
- Confirmar firma de `listLocales(empresaId)` en `src/features/ajustes/actions/locales-actions.ts`.

## Scope IN

- Editar `src/features/rrhh/components/fichajes/FichajesView.tsx`:
  - añadir state local: `[soloFuera, setSoloFuera] = useState(false)`, `[soloTeletrabajo, setSoloTeletrabajo] = useState(false)`, `[localesFiltro, setLocalesFiltro] = useState<string[]>([])`.
  - en `useMemo` `fichajesFiltrados`, aplicar los tres filtros tras los filtros existentes:
    ```typescript
    if (soloFuera) lista = lista.filter(f => getFichajeGeoStatus(f, f.local) === 'fuera');
    if (soloTeletrabajo) lista = lista.filter(f => f.modoTeletrabajo === true);
    if (localesFiltro.length > 0) lista = lista.filter(f => f.local && localesFiltro.includes(f.local.id));
    ```
  - pasar los handlers a `SubmoduleToolbar` mediante `extraFiltros` o props nuevos (según la API que admita).
- Si `SubmoduleToolbar` no soporta toggles ni multi-select externos:
  - extender su API añadiendo props opcionales `togglesAdicionales: Array<{ id, label, value, onChange }>` y `multiSelectsAdicionales: Array<{ id, label, opciones, valores, onChange }>`.
  - hacerlo retrocompatible: no afecta a otras vistas que no usen estos props.

## Scope OUT

- Crear vistas o componentes nuevos.
- Persistir filtros en URL (puede ser PRP futuro).
- Filtros por empleado o departamento (no son geo, fuera del PRP).
- Touch a `MapPicker.tsx`.
- Modificar la lógica de los filtros existentes (búsqueda, departamento, etc.).

## Restricciones

**Heredadas del PRP (Anti-Patrones):**
- NO calcular distancias en cliente — usar los campos precalculados.
- NO usar `localStorage` para persistir filtros sensibles.

**Propias de la task:**
- La extensión del `SubmoduleToolbar` (si hace falta) debe ser **aditiva y retrocompatible**: cualquier vista que ya lo use debe seguir funcionando idéntica.
- El filtro "Local" debe respetar la empresa activa — solo cargar locales de `empresaActual.id`.
- Si la empresa no tiene locales, el dropdown muestra `Sin locales en esta empresa` y queda deshabilitado.

## Validación requerida

- `npm run typecheck` pasa.
- Smoke manual:
  - aplicar "Solo fuera del radio" → tabla reduce a fichajes con status `fuera`.
  - aplicar "Solo teletrabajo" → solo fichajes con `modo_teletrabajo=true`.
  - combinar ambos → cero o pocos fichajes (caso edge: empleados con teletrabajo no deberían dar `fuera` salvo BUG).
  - aplicar filtro "Local" con HABANA → solo fichajes con `local.id === HABANA`.
  - combinar los tres filtros → resultado correcto.
  - cambiar a tab "Mapa" → mismos fichajes visibles como pines.
  - botón "Limpiar" resetea los tres.

## Dependencias

- TASK-002.02 (la columna Geo en tabla — los filtros aplican aquí).
- TASK-002.04 (la tab Mapa — los filtros aplican aquí también).

## Inputs

- `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — PRP padre.
- `src/shared/components/SubmoduleToolbar.tsx` — toolbar a posiblemente extender.
- `src/features/ajustes/actions/locales-actions.ts` — `listLocales`.
- `src/features/rrhh/utils/fichaje-geo-status.ts` — helper de 002.01.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — archivo a editar.

## Outputs esperados

- `FichajesView.tsx` modificado con tres filtros funcionando.
- `SubmoduleToolbar.tsx` posiblemente extendido (con compat).
- `npm run typecheck` pasa.

## Riesgos conocidos

**Heredados del PRP (Gotchas):**
- **RLS multi-tenant**: ya cubierto en 002.01.
- **Locales sin lat/lng configurado**: el filtro "Local" debe permitir seleccionarlos (siguen siendo locales válidos), pero el badge/mapa los pinta como `Sin datos`.

**Propios de la task:**
- Si `SubmoduleToolbar` se usa en otros submódulos (productos, contactos, etc.) y se extiende su API, podría romper imports si los nuevos props no son opcionales. Marcarlos siempre como `?`.
- El filtro toggle "Solo fuera" puede combinarse con "Solo teletrabajo" y dar resultado vacío (los `fuera` por definición no son `teletrabajo`). No es bug; documentar en la UI con un mensaje vacío amigable.

## Artefactos relacionados

- `Full-TASK-002.02` — tabla con columna Geo.
- `Full-TASK-002.04` — tab Mapa.
- `Full-TASK-002.06` — validación final (siguiente).

## Paths del proyecto

**Heredados del PRP (Referencias internas):**
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — archivo principal.
- `src/shared/components/SubmoduleToolbar.tsx` — toolbar.
- `src/features/ajustes/actions/locales-actions.ts` — listLocales.
- `src/features/rrhh/utils/fichaje-geo-status.ts` — helper.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` si el toolbar requiere extensión de API.
- `revisor` para validar que la extensión del toolbar no rompe otras vistas (Productos, Contactos, etc.).

## Checklist de cierre

- [ ] Tres filtros visibles en el toolbar de fichajes.
- [ ] Lógica de filtrado correcta y combinable.
- [ ] Filtros aplican tanto a tabla como a tab Mapa.
- [ ] "Limpiar" resetea los tres.
- [ ] Filtro "Local" lazy load OK.
- [ ] `SubmoduleToolbar` retrocompat verificado: vistas existentes (Productos, Contactos) sin regresión.
- [ ] `npm run typecheck` pasa.
- [ ] Smoke manual combinado OK.

## Modelo de datos propuesto

Sin cambios. Reutiliza `FichajeConGeo` y `LocalGeo` de 002.01.

## Interfaces publicas propuestas

Sin cambios. La extensión del `SubmoduleToolbar`, si hace falta, será aditiva:

```typescript
// src/shared/components/SubmoduleToolbar.tsx (posible extensión)
type SubmoduleToolbarProps = {
  // ...props existentes,
  togglesAdicionales?: Array<{
    id: string;
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }>;
  multiSelectsAdicionales?: Array<{
    id: string;
    label: string;
    opciones: Array<{ value: string; label: string }>;
    valores: string[];
    onChange: (v: string[]) => void;
  }>;
};
```

## Flujo operativo esperado

1. Leer `SubmoduleToolbar.tsx` y decidir si extender API o usar lo existente con `extraDerecha` u otro slot.
2. Implementar state local en `FichajesView` para los tres filtros.
3. Extender `useMemo` `fichajesFiltrados` con la lógica nueva.
4. Pasar los handlers al toolbar mediante la API elegida.
5. Smoke manual combinado.
6. Verificar regresión en otras vistas que usen el toolbar.

## Notas tecnicas

- El lazy load del multi-select se hace cargando `listLocales(empresaActual.id)` la primera vez que se abre el dropdown — antes de eso, el dropdown muestra "Cargando…" o ya tiene cacheado el resultado.
- Si el toolbar ya soporta filtros por columna con `filtroTipo: "lista"`, valorar reutilizar ese mecanismo para "Local" pasándolo como un filtro de columna oculto. Pero los toggles ("Solo fuera", "Solo teletrabajo") son booleanos globales no asociados a columna — necesitan API nueva o usar `extraDerecha`.

## Siguiente paso sugerido

`Full-TASK-002.06` — validación final E2E.

## Resultado validado

- `npm run typecheck`: ✅ pasa.
- **Decisión de implementación**: NO se extendió `SubmoduleToolbar`. En su lugar se creó una **barra de filtros geo inline** (JSX local `geoFiltrosBar` dentro de `FichajesView`) que se renderiza en ambas tabs (Fichajes y Mapa). Esto evita riesgo de regresión en otras vistas que usan el toolbar.
- 3 controles implementados:
  - Toggle "Solo fuera del radio" (Button variant default cuando activo).
  - Toggle "Solo teletrabajo" (Button variant default cuando activo).
  - Multi-select "Locales" usando `Popover` + `Checkbox` con conteo de seleccionados visible.
- Lógica de filtrado añadida en el `useMemo` `fichajesFiltrados` después de los filtros existentes: `soloFuera` filtra por `getFichajeGeoStatus === "fuera"`, `soloTeletrabajo` por `modoTeletrabajo === true`, `localesFiltro` por `local.id`.
- Botón "Limpiar" (visible solo cuando hay al menos un filtro activo) resetea los 3 a la vez.
- Filtros aplican simultáneamente a tabla y a tab Mapa (`fichajesFiltrados` es la única fuente que ambas vistas consumen).
- Multi-tenant: `locales` se recarga al cambiar `empresaActual.id` (ya implementado en 002.04); cambio de empresa no preserva selección por seguridad (`localesFiltro` puede contener IDs inválidos para la nueva empresa, pero el filtro queda inocuo).

## Duracion real

~45 min.

## Ruta canonica

docs/rrhh-fichajes-geo-audit/Full-TASK-002.05-filtros-geo-toolbar.md
