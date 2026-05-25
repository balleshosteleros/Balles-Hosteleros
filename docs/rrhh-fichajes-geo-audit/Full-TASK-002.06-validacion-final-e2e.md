# Full-TASK-002.06 — Validación final E2E del PRP-037

## Estado

Pendiente.

## Objetivo

Cerrar PRP-037 con una validación end-to-end ejecutada en local con dev server + navegador real, dejando handoff de cierre y rellenando la sección **Aprendizajes (Self-Annealing)** del PRP-037 con todos los errores encontrados y resueltos durante el ciclo completo 002.01 → 002.05. Estado de blindaje explícito.

## Estimación de complejidad

Baja (S). Aprox 2–3 horas:
- Typecheck + build: 0.5 h.
- Smoke UI completo: 1 h.
- Multi-tenant + performance: 0.5 h.
- Handoff + actualización de Aprendizajes: 0.5–1 h.

## Criterio de corte

Los 5 checks pasan:

- [ ] `npm run typecheck` (vía WSL): pasa limpio.
- [ ] `npm run build` (vía WSL): pasa.
- [ ] **Smoke UI** ejecutado paso a paso en local con dev server + browser:
  - tabla muestra columna Geo con badges + distancia correctos,
  - filtro de status reduce la lista,
  - click en fila abre modal con mini-mapa funcional (5 casos del PRP),
  - tab Mapa visible y operativa con clustering > 100 pines,
  - filtros del toolbar aplican a ambas vistas,
  - botón "Limpiar" resetea filtros.
- [ ] **Multi-tenant**: cambiar empresa activa HABANA ↔ BACANAL muestra solo los fichajes y locales correspondientes. No hay fuga.
- [ ] **Performance**: medir con `performance.now()` el render inicial de la tab Mapa con un mes de fichajes (≥ 100 pines). Debe ser `< 1000 ms`.

Handoff escrito en `docs/rrhh-fichajes-geo-audit/HANDOFF_YYYY-MM-DD_PRP037_CIERRE.md` con resultado de los 5 checks.

Sección **Aprendizajes** del PRP-037 actualizada:
- si surgieron errores durante el ciclo, cada uno con su entrada (formato Self-Annealing: error / causa raíz / fix / aplicar en / promovido a).
- si no surgió ninguno, anotar explícitamente `Ningún aprendizaje surgido en este ciclo`.

Estado de blindaje explícito en el handoff:
- `documentado` — si hubo bugfix con causa raíz reusable y se documentó en `errors/` del factory.
- `no aplica` — si no hubo bugfix.
- `pendiente` — bloquea el cierre.

## Modo operativo

- taskId: TASK-002.06
- taskMode: ops
- reviewMode: standard
- sourceTask: docs/rrhh-fichajes-geo-audit/TASK-002.06-validacion-final-e2e.md
- sourcePRP: .claude/PRPs/PRP-037-auditoria-geografica-fichajes.md

## Contexto previo obligatorio

- Las 5 tasks anteriores (002.01 → 002.05) cerradas con `npm run typecheck` pasando en cada una.
- Revisar los commits del ciclo en la branch `rrhh-sync-origin-c4da3ca` para identificar cualquier ajuste no documentado.
- Leer la sección `Criterios de éxito` completa del PRP-037 (9 checks) para guiar el smoke.
- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md` para credenciales del admin smoke `rrhh-smoke-admin-no-borrar@example.com` (puede requerir reset de password).

## Scope IN

- Ejecutar `npm run typecheck` y `npm run build` vía WSL.
- Arrancar dev server (`npm run dev`) y hacer login como admin smoke.
- Ejecutar smoke manual paso a paso desde `/rrhh/fichajes`:
  - tabla: verificar columna Geo, ordenar por distancia, filtrar por status.
  - modal: abrir 3-4 fichajes distintos verificando los 5 casos del mini-mapa.
  - tab Mapa: visualizar pines, hacer zoom para expandir clusters, click en pin abre modal.
  - filtros: aplicar las 3 combinaciones del toolbar.
  - multi-tenant: cambiar empresa activa.
- Medir performance con `performance.now()` en consola del browser.
- Escribir handoff de cierre.
- Actualizar PRP-037 sección `Aprendizajes` con entradas del ciclo o anotación explícita.
- Declarar estado de blindaje.

## Scope OUT

- Implementar features nuevas.
- Tocar código (si los smoke fallan, abrir sub-bugfix dentro de la TASK correspondiente y volver a esta task después).
- Smoke automatizado con Playwright (puede salir como nueva task si interesa).
- Crear nuevos usuarios de smoke.

## Restricciones

**Heredadas del PRP (Anti-Patrones):**
- NO declarar completado nada con blindaje `pendiente`.

**Propias de la task:**
- Si algún check técnico (typecheck / build) falla, parar y abrir bugfix dentro de la TASK responsable. No "ajustar y seguir" sin documentar.
- Si el smoke UI detecta un fallo, igual: documentar el fallo, abrir o ampliar la TASK responsable, no parchear desde 002.06.

## Validación requerida

- 5 checks listados en `Criterio de corte`.
- Handoff escrito.
- Aprendizajes del PRP actualizada.
- Blindaje declarado.

## Dependencias

- TASK-002.01, .02, .03, .04, .05 cerradas con `Resultado validado` rellenado.

## Inputs

- Handoffs y commits previos de las 5 tasks anteriores.
- PRP-037.
- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`.

## Outputs esperados

- `docs/rrhh-fichajes-geo-audit/HANDOFF_YYYY-MM-DD_PRP037_CIERRE.md` — handoff con los 5 checks.
- `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — sección Aprendizajes actualizada (o anotada como vacía).
- Estado de blindaje explícito.

## Riesgos conocidos

**Heredados del PRP (Gotchas):**
- **Performance con dataset grande**: si el smoke con > 100 fichajes da > 1 s, hay que revisar clustering y posiblemente reducir rango por defecto. Anotarlo como Aprendizaje y abrir nueva task si requiere refactor.
- **Multi-tenant**: vigilar especialmente que ningún pin / círculo de empresa B aparezca con empresa activa A.

**Propios de la task:**
- Olvidar declarar blindaje. Aplicar la regla: si hubo bugfix → "documentado" o "no aplica" con justificación. "Pendiente" bloquea.
- Confundir issues conocidos del PRP-037 (limitaciones de diseño) con bugs nuevos.

## Artefactos relacionados

- Todos los Full-TASKs anteriores (002.01–002.05).
- `docs/rrhh-fichajes-geo-audit/EXECUTION_PLAN.md`.
- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`.

## Paths del proyecto

- `.claude/PRPs/PRP-037-auditoria-geografica-fichajes.md` — actualizar sección Aprendizajes.
- `docs/rrhh-fichajes-geo-audit/HANDOFF_YYYY-MM-DD_PRP037_CIERRE.md` — crear.

## Agentes recomendados

- `qa-gate` para coordinar la validación técnica (typecheck, build, smoke).
- `usuario-fantasma` opcional para smoke desde perspectiva de usuario real.
- `blindaje` si surge un error con causa raíz reusable que merece promoción a `errors/` del factory.

## Checklist de cierre

- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` pasa.
- [ ] Smoke UI completo OK (tabla, modal, tab Mapa, filtros).
- [ ] Multi-tenant HABANA ↔ BACANAL OK.
- [ ] Performance < 1 s con 100 fichajes.
- [ ] Handoff de cierre escrito.
- [ ] Aprendizajes del PRP-037 actualizada.
- [ ] Estado de blindaje declarado (`documentado` / `no aplica`).

## Modelo de datos propuesto

No aplica — es validación.

## Interfaces publicas propuestas

No aplica.

## Flujo operativo esperado

1. Verificar que las 5 tasks anteriores tienen `Resultado validado` rellenado.
2. Ejecutar typecheck y build vía WSL.
3. Arrancar dev server.
4. Smoke manual paso a paso siguiendo el orden:
   - tabla con columna Geo,
   - modal con mini-mapa,
   - tab Mapa con clustering,
   - filtros del toolbar.
5. Multi-tenant: cambiar empresa activa.
6. Performance: medir tab Mapa con dataset realista.
7. Recoger todo lo aprendido durante el ciclo en el PRP.
8. Escribir handoff de cierre.
9. Declarar blindaje.

## Notas tecnicas

- Si el dev server requiere reinicio entre cambios (ya hay 5 tasks que tocan código), partir limpio: `pkill -f 'next dev'` en WSL antes de arrancar.
- Para medir performance, usar `performance.now()` antes y después del render de la tab Mapa, observando en consola del browser.
- Aprendizajes del PRP pueden incluir:
  - errores resueltos con su causa raíz,
  - patrones de Leaflet/markercluster reutilizables que conviene promover,
  - decisiones de diseño tomadas durante ejecución que no estaban en el PRP original,
  - cambios en gotchas (alguno se confirmó como real, otro resultó ser falso).

## Siguiente paso sugerido

PRP-037 cerrado. Posibles continuaciones (cada una abre su propio PRP / TASK):
- PRP futuro: heatmap / densidad (ver Fuera de Alcance #1 del PRP-037).
- PRP futuro: vista geo en ficha de empleado (ver Fuera de Alcance #5).
- TASK-003 horarios discovery del plan de consolidación RRHH.
- TASK-004 firmas hardening (PRP-036 eIDAS).

## Resultado validado

_(Pendiente.)_

## Duracion real

_(Pendiente.)_

## Ruta canonica

docs/rrhh-fichajes-geo-audit/Full-TASK-002.06-validacion-final-e2e.md
