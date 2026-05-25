# Execution Plan - RRHH Fichajes Auditoría Geográfica

Fecha: 2026-05-25
Repo: `Balles-Hosteleros`
PRP origen: `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md`
Branch: `rrhh-sync-origin-c4da3ca`

## Propósito

Este directorio convierte PRP-037 (auditoría geográfica de fichajes RRHH) en contratos ejecutables. No es trabajo de consolidación — es **extensión visual** sobre la base ya consolidada en `TASK-002` (empleados y fichajes canónicos, cerrada el 2026-05-25). Por eso el sub-numerado `TASK-002.NN` señala parentesco semántico con el trabajo cerrado.

## Estado real de partida

- TASK-002 cerrada — la base de empleados/fichajes está alineada entre RRHH y mi-panel.
- BD ya tiene todos los campos geo persistidos (`fichajes.lat_entrada`, `lng_entrada`, etc., `locales.lat/lng/radio_metros`) desde la migración `20260514130000_rrhh_centros_y_geolocalizacion.sql`.
- La UI de `/rrhh/fichajes` no expone ningún dato geo todavía.
- Leaflet ya está usado en el repo en `src/features/ajustes/components/locales/MapPicker.tsx` — patrón de carga dinámica resuelto y reutilizable.

## TASKs

| Task | Full-TASK | Modo | Estado inicial | Corte |
| --- | --- | --- | --- | --- |
| `TASK-002.01-backend-extension-listfichajes.md` | `Full-TASK-002.01-backend-extension-listfichajes.md` | code | pendiente | Extender `listFichajes` server-side con coords, local y distancias precalculadas. Crear helper puro `getFichajeGeoStatus` y componente `GeoBadge`. |
| `TASK-002.02-columna-geo-tabla.md` | `Full-TASK-002.02-columna-geo-tabla.md` | code | pendiente | Añadir columna "Geo" a la tabla de FichajesView con badge + distancia, ordenable y filtrable por status. |
| `TASK-002.03-mini-mapa-modal-detalle.md` | `Full-TASK-002.03-mini-mapa-modal-detalle.md` | code | pendiente | Crear `FichajeUbicacionMiniMap` con Leaflet + dynamic import y embeberlo en el modal de detalle del fichaje. |
| `TASK-002.04-tab-mapa-clustering.md` | `Full-TASK-002.04-tab-mapa-clustering.md` | code | pendiente | Nueva tab "Mapa" con todos los fichajes filtrados como pines coloreados y clustering automático. Reutiliza el modal de detalle de 002.03. |
| `TASK-002.05-filtros-geo-toolbar.md` | `Full-TASK-002.05-filtros-geo-toolbar.md` | code | pendiente | Tres filtros nuevos en el toolbar: "solo fuera del radio", "solo teletrabajo", "por local". Aplican a tabla y a tab Mapa. |
| `TASK-002.06-validacion-final-e2e.md` | `Full-TASK-002.06-validacion-final-e2e.md` | ops | pendiente | Smoke E2E con dev server + browser. Validar typecheck, build, multi-tenant HABANA↔BACANAL, performance con > 100 fichajes. |

## DAG de dependencias

```
TASK-002.01  (backend + helpers + GeoBadge)
   ├──► TASK-002.02  (columna en tabla)
   │       ├──► TASK-002.05  (filtros — aplican a tabla y a mapa)
   │       │       └──► TASK-002.06 (validación final)
   │       └──► TASK-002.04  (tab Mapa)
   │
   └──► TASK-002.03  (mini-mapa en modal de detalle)
           └──► TASK-002.04  (tab Mapa reutiliza el modal extraído)
                   └──► TASK-002.05  (filtros aplican también al mapa)
```

Línea crítica más corta: `002.01 → 002.02 → 002.05 → 002.06`.
Línea crítica más larga: `002.01 → 002.03 → 002.04 → 002.05 → 002.06`.

## Orden operativo recomendado

1. Ejecutar `TASK-002.01` primero — desbloquea todo lo demás (backend + helper + badge son base).
2. Ejecutar `TASK-002.02` y `TASK-002.03` (orden libre o paralelo si se quiere).
3. Ejecutar `TASK-002.04` (depende de 002.03 para reutilizar el modal extraído).
4. Ejecutar `TASK-002.05` (filtros aplican a tabla y a mapa, requiere ambos vistas listas).
5. Cerrar con `TASK-002.06` (validación final E2E).

## Criterios globales de corte

- No se modifica la lógica de `ficharEntrada` / `ficharSalida` — el PRP es **read-only sobre fichajes existentes**.
- No se modifica `crearFichajeManual` — sigue sin geo por diseño.
- No se crea migración nueva — BD ya tiene todo.
- Multi-tenant estricto: filtro por `empresaId` en queries, RLS conservada.
- Sin dependencias nuevas — Leaflet ya en repo; `leaflet.markercluster` se carga dinámicamente igual que Leaflet base.
- Sin `any`; inputs validados con Zod si aplica.
- `npm run typecheck` y `npm run build` pasan en cada cierre de fase.

## Fuera de alcance (delegado a futuro)

Ver sección "Fuera de Alcance" en `PRP-037-auditoria-geografica-fichajes.md`:
- Heatmap / densidad
- Tracking realtime
- Notificaciones push por outliers
- Geo en `crearFichajeManual`
- Vista geo en ficha de empleado
- Detección automática de fraude
- Export evidencia PDF
- Geofencing dinámico

## Pilotaje del schema enriquecido

Esta descomposición pilota la propuesta `docs/PRP_SCHEMA_EVOLUCION.md` de la factory:
- Los Full-TASKs heredan **Gotchas** del PRP en su sección `Riesgos conocidos`.
- Los Full-TASKs heredan **Anti-Patrones** del PRP en `Restricciones`.
- Los Full-TASKs heredan **Referencias internas** del PRP en `Paths del proyecto`.
- La sección **Aprendizajes** vive en el PRP padre, no se duplica en TASKs.

Si el piloto funciona, se aplicará al schema canónico del factory.
