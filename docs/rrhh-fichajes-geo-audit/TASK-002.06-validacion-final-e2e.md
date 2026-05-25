# TASK-002.06 — Validación final E2E del PRP-037

## Estado

Parcialmente cerrada — 2026-05-25. typecheck + build OK; smoke UI pendiente (requiere browser).

## Objetivo

Cerrar PRP-037 con una validación end-to-end ejecutada en local con dev server + navegador real:
- `npm run typecheck` y `npm run build` pasan limpios.
- Multi-tenant verificado: cambiar empresa activa HABANA ↔ BACANAL filtra correctamente fichajes y locales.
- Performance verificada: tab Mapa con > 100 fichajes carga en `< 1 s`.
- Documentar handoff de cierre + actualizar la sección **Aprendizajes** del PRP-037 con cualquier error encontrado durante el ciclo completo.

## Estimación de complejidad

Baja. Es validación, no implementación. Asume que 002.01 a 002.05 están cerradas.

## Criterio de corte

- 5 checks técnicos pasan:
  - [ ] `npm run typecheck`
  - [ ] `npm run build`
  - [ ] Smoke UI: tabla con columna Geo, modal con mini-mapa, tab Mapa funcional, 3 filtros operativos.
  - [ ] Multi-tenant: HABANA muestra fichajes/locales de HABANA, BACANAL los suyos. No hay fuga entre empresas.
  - [ ] Performance: render de tab Mapa con > 100 fichajes en `< 1 s` (medido en consola con `performance.now()`).
- Handoff escrito en `docs/rrhh-fichajes-geo-audit/HANDOFF_YYYY-MM-DD_PRP037_CIERRE.md`.
- Sección **Aprendizajes** del PRP-037 actualizada si surgió cualquier error.

## Modo operativo

- taskId: TASK-002.06
- taskMode: ops
- reviewMode: standard
- sourcePRP: `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md`

## Scope IN

- Ejecutar typecheck y build vía WSL.
- Arrancar dev server, login como admin smoke, ejecutar smoke manual de cada vista.
- Validar multi-tenant con los smoke users existentes.
- Medir performance de la tab Mapa con dataset realista.
- Escribir handoff de cierre.
- Actualizar Aprendizajes del PRP-037 (sección Self-Annealing) con todo error encontrado y resuelto durante el ciclo 002.01 → 002.05.

## Scope OUT

- Implementar features nuevas.
- Tocar código si los smoke fallan: si fallan, abrir un sub-bugfix dentro de la TASK correspondiente y volver a esta task después.
- Smoke automatizado con Playwright (puede salir como nueva task si interesa).

## Dependencias

- TASK-002.01, .02, .03, .04, .05 cerradas.

## Inputs

- Handoffs y commits previos de las 5 tasks anteriores.
- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md` (admin smoke + empleado smoke).
- PRP-037 sección `Criterios de Éxito` (lista completa de 9 checks).

## Outputs esperados

- Handoff `HANDOFF_YYYY-MM-DD_PRP037_CIERRE.md` con resultado de los 5 checks.
- PRP-037 sección `Aprendizajes` actualizada (con entradas o explícitamente "ningún aprendizaje").
- Estado de blindaje explícito si hubo bugfix: `documentado` / `no aplica` / `pendiente`.

## Agentes recomendados

- `qa-gate` para coordinar la validación técnica.
- `usuario-fantasma` opcional para smoke desde perspectiva de usuario real.
- `blindaje` si surge un error con causa raíz reusable.

## PRP origen

`.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — Fase 7 del Blueprint.
