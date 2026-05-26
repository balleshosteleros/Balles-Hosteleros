# Full-TASK-002.04 — Tab "Mapa" con clustering de fichajes

## Estado

Cerrada — 2026-05-25. typecheck pasa. Smoke UI + medición de performance queda para TASK-002.06.

## Objetivo

Añadir una tab "Mapa" a `FichajesView.tsx` (entre "Fichajes" y "Historial") que muestre un mapa Leaflet a tamaño `h-[600px]` con: todos los locales de la empresa activa pintados como círculo de radio en color tenue del local, y todos los fichajes del filtro actual representados como pines coloreados según su status geo. Si hay > 100 pines aplicar **clustering automático** vía `leaflet.markercluster` (plugin cargado dinámicamente). Click en pin abre el modal de detalle del fichaje, **extraído ahora a componente reutilizable** (`FichajeDetalleDialog`).

## Estimación de complejidad

Alta (L). Aprox 8–10 horas:
- Extraer modal a componente reutilizable (refactor controlado): 2 h.
- Crear `FichajesMapaView` con esqueleto y carga dinámica de markercluster: 2 h.
- Pintar locales con círculos: 1.5 h.
- Pintar fichajes con marcadores coloreados + clustering: 2 h.
- fitBounds inteligente + integración tab: 1.5 h.
- Validación performance + smoke con dataset grande: 1 h.

## Criterio de corte

- Tab "Mapa" visible entre "Fichajes" y "Historial" con icono propio (sugerido: `Map` de lucide).
- Mapa a `h-[600px]` con tiles OpenStreetMap cargados.
- Locales de la empresa activa pintados con `L.circle` usando `radio_metros`, color con opacidad ~20% (derivado de `locales.color`).
- Fichajes pintados como `L.marker` coloreados:
  - verde para `en-local`,
  - violeta para `teletrabajo`,
  - rojo para `fuera`,
  - gris para `sin-datos`.
- Cuando hay > 100 fichajes, los pines se agrupan en clusters con número; click en cluster hace zoom y los expande.
- Click en pin individual abre el `<FichajeDetalleDialog>` extraído.
- `fitBounds` automático al primer render ajusta el mapa a los pines presentes.
- Cambiar de tab Fichajes ↔ Mapa preserva los filtros (el state `fichajesFiltrados` se comparte).
- Performance: render inicial con 100 fichajes en `< 1 s` (medido manualmente).
- `npm run typecheck` pasa.

## Modo operativo

- taskId: TASK-002.04
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-fichajes-geo-audit/TASK-002.04-tab-mapa-clustering.md
- sourcePRP: .claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md

## Contexto previo obligatorio

- Leer PRP-037 secciones `Criterios de éxito` (tab Mapa) y `Gotchas` (markercluster dinámico, performance, color del local vs color del pin).
- Releer `MapPicker.tsx` para confirmar patrón de carga dinámica de Leaflet — `leaflet.markercluster` se carga con el mismo enfoque pero usando otra URL CDN.
- Leer `FichajeUbicacionMiniMap.tsx` creado en 002.03 — el patrón se escala aquí.
- Leer el modal de detalle actual en `FichajesView.tsx` (líneas 442-538) — el bloque entero se extraerá a `FichajeDetalleDialog.tsx`.
- Leer `src/features/ajustes/actions/locales-actions.ts` para confirmar firma de `listLocales(empresaId)`.

## Scope IN

- **Refactor sin cambio funcional**: extraer el `<Dialog>` de detalle de fichaje desde `FichajesView.tsx` a un componente nuevo `FichajeDetalleDialog.tsx`. Props: `{ fichaje, open, onClose, onUpdate, onSaveSalida }` (las callbacks que hoy viven inline). El comportamiento debe ser idéntico al actual — esto es preparación para reutilizarlo desde la tab Mapa.
- Crear `src/features/rrhh/components/fichajes/FichajesMapaView.tsx`:
  - prop `{ fichajesFiltrados: FichajeConGeo[]; locales: LocalGeo[]; onFichajeClick: (f: FichajeConGeo) => void }`.
  - dynamic import de Leaflet + leaflet.markercluster (vía `<script>` con su CSS).
  - render del mapa con:
    - tile layer OSM,
    - círculo por cada local de la empresa (incluso si no aparece en filtros — el círculo es contexto),
    - marker por cada fichaje coloreado según `getFichajeGeoStatus`,
    - cluster group al que se añaden los markers.
  - `fitBounds(L.featureGroup(markers).getBounds().pad(0.1))` después de añadir markers.
  - cleanup al desmontar.
- Editar `FichajesView.tsx`:
  - cargar locales con `listLocales(empresaActual.id)` al inicializar.
  - añadir `<TabsTrigger value="mapa">` y `<TabsContent value="mapa">` invocando `<FichajesMapaView>`.
  - sustituir el `<Dialog>` inline por `<FichajeDetalleDialog>` extraído.
  - manejar `onFichajeClick` desde el mapa que también abre el `<FichajeDetalleDialog>`.

## Scope OUT

- Filtros geo en toolbar (es 002.05).
- Heatmap / densidad.
- Capas custom, dibujado de polígonos, switch de tiles.
- Modificar el contenido funcional del modal de detalle (solo extraerlo; cualquier cambio funcional sale a otra task).
- Cargar `leaflet.markercluster` como dependencia npm — se usa el CDN para mantener cero deps nuevas.

## Restricciones

**Heredadas del PRP (Anti-Patrones):**
- NO cachear coordenadas en `localStorage`.
- NO hardcodear coordenadas de Madrid como fallback central.
- NO usar Google Maps ni Mapbox.
- NO calcular distancias en cliente.

**Propias de la task:**
- El refactor del modal **no debe introducir cambios funcionales** — `FichajeDetalleDialog` debe comportarse exactamente igual que el modal inline actual.
- `leaflet.markercluster` se carga via CDN como `<script>`, no como npm package.
- El componente debe ser robusto ante `locales = []` (empresa sin locales todavía).

## Validación requerida

- `npm run typecheck` pasa.
- Smoke manual:
  - cargar la tab Mapa con dataset del día actual,
  - cambiar a mes con > 100 fichajes (simular cambiando rango) y verificar clustering,
  - click en cluster hace zoom,
  - click en pin individual abre el modal — los botones funcionan igual que antes,
  - cambiar entre tab Fichajes y tab Mapa preserva filtros y selección,
  - multi-tenant: cambiar HABANA ↔ BACANAL muestra solo los locales y fichajes correspondientes.
- Performance manual: con 100 fichajes, medir `performance.now()` antes y después del render. Debe ser `< 1000 ms`.

## Dependencias

- TASK-002.01 (contrato extendido + GeoBadge).
- TASK-002.03 (mini-mapa — esta task extrae además el modal a componente reutilizable que también usa 002.03).

## Inputs

- `.claude/PRPs/PRP-037-A-auditoria-geografica-fichajes.md` — PRP padre.
- `src/features/ajustes/components/locales/MapPicker.tsx` — patrón Leaflet.
- `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx` — patrón mini-mapa.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — vista a editar + modal a extraer.
- `src/features/ajustes/actions/locales-actions.ts` — `listLocales`.

## Outputs esperados

- `src/features/rrhh/components/fichajes/FichajesMapaView.tsx` — nuevo.
- `src/features/rrhh/components/fichajes/FichajeDetalleDialog.tsx` — nuevo (extracción).
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — modificado (tab nueva + modal sustituido).

## Riesgos conocidos

**Heredados del PRP (Gotchas):**
- **Leaflet SSR**: ya resuelto con dynamic import.
- **`leaflet.markercluster` también necesita inyectarse dinámicamente** — no añadir como `import` ES module. Cargar via `<script>` igual que Leaflet base.
- **Color del pin vs color del local**: los círculos de locales usan `locales.color` (Tailwind class como `bg-violet-500`); los pines de fichajes usan colores semánticos (verde/violeta/rojo/gris). Mantener un mapa Tailwind → hex en una constante para convertir el color del local a hex y aplicarlo al círculo Leaflet.
- **Coordenadas dispersas** (un empleado fichó en Barcelona, los demás en Madrid): `fitBounds` con `.pad(0.1)` lo contempla, pero el zoom-out puede ser molesto. Considerar zoom mínimo aceptable.
- **Performance con > 1000 fichajes**: ordenar por distancia en server (002.01) ya lo facilita. Para > 1000, el clustering es obligatorio. Si pasa de 2000, considerar reducir rango de fecha por defecto.

**Propios de la task:**
- El refactor del modal puede romper sutilmente algún callback (ej. `revalidatePath` después de guardar observaciones). Revisar prop drilling cuidadosamente.
- `markercluster` requiere CSS adicional (`MarkerCluster.css` y `MarkerCluster.Default.css`). Cargarlos también via CDN.

## Artefactos relacionados

- `Full-TASK-002.03` — predecesor.
- `Full-TASK-002.05` — sucesor (filtros que también aplican al mapa).

## Paths del proyecto

**Heredados del PRP (Referencias internas):**
- `src/features/ajustes/components/locales/MapPicker.tsx` — patrón Leaflet.
- `src/features/rrhh/components/fichajes/FichajesView.tsx` — vista a editar.
- `src/features/ajustes/actions/locales-actions.ts` — `listLocales`.

**Creado en 002.03:**
- `src/features/rrhh/components/fichajes/FichajeUbicacionMiniMap.tsx`.

**Nuevos a crear:**
- `src/features/rrhh/components/fichajes/FichajesMapaView.tsx`.
- `src/features/rrhh/components/fichajes/FichajeDetalleDialog.tsx`.

## Agentes recomendados

- `ejecutor` para coordinar.
- `ui-builder` para maquetación y leyenda del mapa.
- `performance-optimizer` si el render con > 1000 pines no cumple el `< 1 s` objetivo (probable que no haga falta gracias al clustering, pero tener en mente).

## Checklist de cierre

- [ ] Modal extraído a `FichajeDetalleDialog.tsx` sin cambio funcional verificable.
- [ ] Tab "Mapa" añadida con icono y orden correcto.
- [ ] Locales pintados con círculo de radio tenue.
- [ ] Fichajes pintados como pines coloreados con clustering > 100.
- [ ] Click en pin abre el modal extraído.
- [ ] Filtros se preservan al cambiar de tab.
- [ ] Multi-tenant HABANA ↔ BACANAL OK.
- [ ] Performance < 1 s con 100 fichajes.
- [ ] `npm run typecheck` pasa.
- [ ] Smoke manual completo OK.

## Modelo de datos propuesto

Sin cambios. Reutiliza `FichajeConGeo` y `LocalGeo` de 002.01.

## Interfaces publicas propuestas

```typescript
// src/features/rrhh/components/fichajes/FichajeDetalleDialog.tsx
export function FichajeDetalleDialog(props: {
  fichaje: FichajeConGeo | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void; // trigger refetch
}): JSX.Element;

// src/features/rrhh/components/fichajes/FichajesMapaView.tsx
export function FichajesMapaView(props: {
  fichajes: FichajeConGeo[];
  locales: LocalGeo[];
  onFichajeClick: (f: FichajeConGeo) => void;
}): JSX.Element;
```

## Flujo operativo esperado

1. Extraer el modal de detalle a `FichajeDetalleDialog.tsx` sin tocar nada más. Verificar que la tab "Fichajes" sigue funcionando idéntica.
2. Crear esqueleto de `FichajesMapaView.tsx` con dynamic import de Leaflet (patrón ya conocido).
3. Añadir carga dinámica de `leaflet.markercluster` (script + CSS).
4. Pintar locales con círculo.
5. Pintar fichajes con marker + cluster.
6. Implementar `onFichajeClick` que abre el modal extraído.
7. Integrar la nueva tab en `FichajesView.tsx`.
8. Smoke manual exhaustivo.
9. Medir performance.

## Notas tecnicas

- URLs CDN sugeridas (verificar versión estable):
  - JS: `https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js`
  - CSS: `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css` y `MarkerCluster.Default.css`.
- Tras cargar el plugin, `window.L.markerClusterGroup()` está disponible.
- Para los iconos coloreados de los pines, usar `L.divIcon` con html inline (un círculo CSS coloreado) — evita tener que servir imágenes adicionales.
- Si el rendimiento se degrada con > 2000 fichajes, ofrecer un selector de rango de fecha en la tab Mapa por defecto al mes actual.

## Siguiente paso sugerido

`Full-TASK-002.05` — filtros geo en toolbar (aplican a tabla y a mapa).

## Resultado validado

- `npm run typecheck`: ✅ pasa.
- **Refactor sin regresión funcional**: modal de detalle extraído a `FichajeDetalleDialog.tsx`. Comportamiento idéntico al inline anterior (guardar observaciones, resolver incidencia, fichar salida). State `detalleNotas` y `savingDetalle` ahora viven dentro del componente; `intentarGeo` y `obtenerPosicionActual` movidos también allí.
- `loadFichajes` actualizado para sincronizar `fichajeModal` con la lista refrescada (preserva el comportamiento del inline original de mostrar datos frescos sin cerrar el modal).
- **Nuevo componente `FichajesMapaView.tsx`** con:
  - dynamic import de Leaflet base y `leaflet.markercluster` (CDN unpkg, sin nuevas deps npm).
  - Tile OSM + clustering automático con `markerClusterGroup` (`maxClusterRadius: 50`).
  - Locales pintados con círculo violeta tenue usando `radio_metros`.
  - Pines coloreados por status: verde `en-local`, violeta `teletrabajo`, rojo `fuera`, gris `sin-datos`.
  - `fitBounds` automático sobre todos los puntos (fichajes + locales) con padding del 15%.
  - Click en pin → callback `onFichajeClick` que abre el modal extraído.
  - Cleanup correcto en useEffect return.
  - Leyenda con count de fichajes y locales en la barra inferior.
- Carga lazy de `listLocales(empresaActual.id)` con reaccion a cambio de empresa activa (multi-tenant).
- Nueva tab "Mapa" entre "Fichajes" e "Historial" con icono `Map` de lucide.
- Reuso completo del state `fichajesFiltrados` y `fichajeModal` — filtros y modal funcionan idénticos en tabla y mapa.

## Aprendizaje (Self-Annealing — TASK-002.04)

- **Carga dinámica del plugin markercluster**: requiere que Leaflet base esté en `window.L` ANTES de cargar el plugin (que extiende `L.markerClusterGroup`). El loader debe ser secuencial: primero `cargarLeaflet` (que termina cuando `window.L` existe), luego `cargarMarkerCluster` (que comprueba `typeof L.markerClusterGroup === "function"` después del inyect). Si se intentan en paralelo, fallaría sin error claro.

## Duracion real

~2.5 h (incluye refactor del modal + componente mapa + integración tab + validación).

## Ruta canonica

docs/rrhh-fichajes-geo-audit/Full-TASK-002.04-tab-mapa-clustering.md
