# TASK-002.01 — Backend extension `listFichajes` + helpers + GeoBadge

## Estado

Pendiente.

## Objetivo

Extender `listFichajes` server-side para que devuelva, además de los campos actuales del fichaje, las coordenadas de entrada/salida con precisión, el modo teletrabajo, los datos del local asignado (lat/lng/radio/nombre/color) y las **distancias precalculadas** entre fichaje y local. Crear un helper puro `getFichajeGeoStatus` y el componente `GeoBadge` reutilizables.

## Estimación de complejidad

Media. Toca un server action existente sin breaking change y añade tres ficheros nuevos pequeños.

## Criterio de corte

`listFichajes` devuelve por cada fila los campos geo extendidos, las distancias calculadas en servidor (no en cliente) y un local resuelto. El helper `getFichajeGeoStatus` clasifica correctamente los 4 casos (en local / teletrabajo / fuera / sin datos). `GeoBadge` renderiza los 4 estados con color y distancia.

## Modo operativo

- taskId: TASK-002.01
- taskMode: code
- reviewMode: standard
- sourcePRP: `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md`

## Scope IN

- Extender el tipo de retorno de `listFichajes` (sin romper consumidores actuales).
- Calcular distancias server-side usando `distanciaMetros()` ya existente.
- Resolver `local` desde `locales` por `centro_id` o `local_id` del fichaje.
- Crear `src/features/rrhh/utils/fichaje-geo-status.ts` (función pura).
- Crear `src/features/rrhh/components/fichajes/geo-badge.tsx` (componente UI).
- Extender el tipo `Fichaje` en `src/features/rrhh/data/fichajes.ts` con campos geo opcionales.

## Scope OUT

- Modificar `ficharEntrada`, `ficharSalida` o `crearFichajeManual`.
- Tocar el form `/rrhh/empleados/nuevo`.
- Crear migraciones nuevas.
- Modificar `MapPicker.tsx` ni la configuración de locales.

## Dependencias

- TASK-002 cerrada (`docs/rrhh-consolidacion/TASK-002-empleados-y-fichajes-canonicos.md`).
- BD con campos geo persistidos (migración `20260514130000` y rename `20260515100000`).

## Inputs

- PRP-037 secciones `Criterios de éxito`, `Modelo de datos`, `Referencias internas`.
- `src/features/rrhh/utils/geo.ts` (helper `distanciaMetros` existente).
- `src/features/rrhh/actions/fichajes-actions.ts` (función a extender).
- `src/features/rrhh/data/fichajes.ts` (tipo a extender).

## Outputs esperados

- `listFichajes` devuelve el contrato extendido sin romper FichajesView.
- 3 ficheros nuevos creados.
- `npm run typecheck` pasa.

## Agentes recomendados

- `ejecutor` para coordinar.
- `db-admin` solo si aparece duda sobre RLS del JOIN con `locales`.

## PRP origen

`.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — Fase 1 + Fase 2 del Blueprint.
