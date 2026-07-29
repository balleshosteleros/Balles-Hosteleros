# Auditoría de CI

## Estado general

Estado: DEGRADED

Repositorio: `balleshosteleros/Balles-Hosteleros`
Rama principal: `main`
Rama analizada: `main`
Periodo: 90 días
Runs inspeccionados: 20 GitHub Actions + 30 commits recientes con status Vercel
Workflows inspeccionados: 1
Firmas de fallo: 3
Checks externos: Vercel
Fecha de auditoría: 2026-07-11

## Limitaciones

- Permisos insuficientes: `gh auth status` indica token local inválido para GitHub; se usó API pública sin token. Los logs de Actions no se pudieron descargar: GitHub devolvió `403 Must have admin rights to Repository`.
- Logs expirados: no confirmado; el bloqueo principal es permiso de logs.
- Historial incompleto: la API pública expone 20 runs de Actions y statuses Vercel recientes; no hay acceso al dashboard/logs internos de Vercel.
- Servicios externos no accesibles: no hay acceso al dashboard del team Vercel ni a logs de build completos.
- Otros límites: no se auditó configuración remota de secretos ni variables; solo nombres inferidos desde workflows/docs.

## Resumen ejecutivo

- Qué está bloqueado: actualmente no hay bloqueo activo de deploy; `66ce9d37` y `573d32e0` tienen status Vercel `success`.
- Qué afecta a producción: hubo una racha real de deploys Vercel fallidos desde `85100ce0` hasta `49f25b57`; producción quedó congelada en `78274fb6` hasta el fix `66ce9d37`.
- Qué afecta a merges: no se han detectado checks requeridos de GitHub Actions que bloqueen merges. El único workflow de Actions es programado/manual y no se ejecuta en `push`/PR.
- Fallos recurrentes: el fallo recurrente era Vercel `Deployment failed` por configuración de cron no admitida en el plan: `0 * * * *` en `vercel.json`.
- Posible intermitencia: un run programado de Actions (`29017819715`, 2026-07-09) aparece como workflow `failure`, pero su job real `disparar` terminó `cancelled` tras 15 min y sin steps visibles; sin logs admin no se puede concluir causa.
- Posible ruido: commits con status `pending` sin status Vercel pueden ser despliegues superseded/no ejecutados, no fallos primarios.
- Prioridad: mantener el fix de cron diario, añadir guardrail para que no vuelva a entrar ningún cron subdiario en `vercel.json`, y decidir qué hacer con los crons Vercel no cubiertos por GitHub Actions.

## Tabla de diagnóstico

| ID | Prioridad | Workflow / check | Rama / evento | Job / step | Fallos consecutivos | Último OK | Último fallo | Tipo | Confianza | Estado operativo |
|---|---|---|---|---|---:|---|---|---|---|---|
| CI-001 | P0 | Vercel | main / push | Config validation / deployment | 14 visibles | `78274fb6` antes, `66ce9d37` después | `49f25b57` | CONFIG | ALTA | LISTO_PARA_IMPLEMENTAR |
| CI-002 | P2 | Cron Ágora (ventas) — disparador externo | main / schedule | `disparar` | 0 activo | `29149801361` | `29017819715` | UNKNOWN | BAJA | REQUIERE_INVESTIGACION |
| CI-003 | P2 | Vercel crons / GitHub Actions coverage | main / schedule | crons no cubiertos | n/a | n/a | n/a | CONFIG | MEDIA | REQUIERE_ACCION_HUMANA |

## Diagnósticos

### CI-001 - Vercel fallaba por cron horario no admitido

- Prioridad: P0
- Tipo de causa: CONFIG
- Confianza: ALTA
- Estado operativo: LISTO_PARA_IMPLEMENTAR
- Agente recomendado: implementador -> revisor -> qa-gate
- Workflow: Vercel external check
- Evento: push
- Rama: main
- Job: Deployment
- Step: Validación de configuración Vercel
- Comando: no accesible desde GitHub público
- Primera aparición detectada: `85100ce0`
- Último fallo: `49f25b57`
- Último éxito conocido: `78274fb6`; después del fix, `66ce9d37` y `573d32e0`
- Fallos consecutivos: 14 statuses `failure` visibles en los últimos 30 commits, con varios `pending` intermedios superseded/no ejecutados
- Ocurrencias: racha de Vercel `Deployment failed` entre 2026-07-10 y 2026-07-11
- Runs de evidencia:
  - `78274fb6` Vercel `success`
  - `85100ce0` Vercel `failure`
  - `49f25b57` Vercel `failure`
  - `66ce9d37` Vercel `success`
  - `573d32e0` Vercel `success`

#### Error relevante

```text
Vercel status: Deployment failed
Target URL común en failures: https://vercel.link/3Fpeeb1
```

#### Síntoma

Los deploys de Vercel fallaban para commits posteriores a `78274fb6`, aunque el código local pudiera verse bien o pasar typecheck. Producción no recibía los commits posteriores.

#### Causa directa

`vercel.json` pasó a declarar un cron horario:

```json
{
  "path": "/api/cron/nominas-gestoria-envio",
  "schedule": "0 * * * *"
}
```

Ese schedule fue introducido por `6ef08e69` y los deploys empezaron a fallar cuando Vercel intentó validar/desplegar la configuración acumulada.

#### Causa raíz

El plan actual de Vercel no admite crons con frecuencia menor que diaria. La necesidad funcional era disparar `nominas-gestoria-envio` alrededor de medianoche local; se intentó resolver con un cron horario, pero eso convirtió la configuración en inválida para producción.

#### Evidencia

- `git show 6ef08e69 -- vercel.json` cambia `0 8 * * *` por `0 * * * *`.
- `git show 66ce9d37 -- vercel.json` reemplaza el cron horario por dos crons diarios: `0 22 * * *` y `0 23 * * *`.
- API pública de GitHub status:
  - `78274fb6`: Vercel `success`.
  - `85100ce0` y siguientes: Vercel `failure`.
  - `66ce9d37`: Vercel `success`.
  - `573d32e0`: Vercel `success`.
- `docs/DEPLOYS_ROTOS_DESDE_85100ce0_PARA_IVAN.md` documenta la confirmación empírica: rama con solo esa línea revertida desplegaba correctamente.

#### Solución propuesta

Mantener el fix actual y añadir una validación versionada que impida volver a introducir schedules subdiarios en `vercel.json`.

#### Archivos afectados

- `vercel.json`
- Recomendado: script o test nuevo, por ejemplo `scripts/verify-vercel-crons.mjs`
- Recomendado: integrar el test en validación local/CI si se añade workflow de calidad.

#### Ejemplo de cambio

```diff
  {
    "path": "/api/cron/nominas-gestoria-envio",
-   "schedule": "0 * * * *"
+   "schedule": "0 22 * * *"
+ },
+ {
+   "path": "/api/cron/nominas-gestoria-envio",
+   "schedule": "0 23 * * *"
  }
```

Guardrail recomendado:

```diff
+ // scripts/verify-vercel-crons.mjs
+ // Leer vercel.json y fallar si alguna schedule tiene "*" en minutos/horas
+ // o frecuencia menor que diaria sin una excepción explícita documentada.
```

#### Validación local

```bash
npm run typecheck
npm run build
node scripts/verify-vercel-crons.mjs
```

#### Validación en CI

- Check esperado: Vercel.
- Resultado que confirmaría la solución: `Deployment has completed`.
- Evidencia actual: `66ce9d37` y `573d32e0` ya están en `success`.

#### Riesgo del cambio

BAJO

Explicación: el fix ya está aplicado y desplegado. El guardrail solo evita regresión.

#### Riesgo de no corregirlo

Un futuro cron subdiario volvería a romper todos los deploys de producción y dejaría la app congelada en el último commit verde.

#### Requiere intervención humana

No para el guardrail. Sí para decidir si se sube plan Vercel si se necesita frecuencia horaria real.

### CI-002 - Run aislado de GitHub Actions cancelado

- Prioridad: P2
- Tipo de causa: UNKNOWN
- Confianza: BAJA
- Estado operativo: REQUIERE_INVESTIGACION
- Agente recomendado: detective
- Workflow: Cron Ágora (ventas) — disparador externo
- Evento: schedule
- Rama: main
- Job: `disparar`
- Step: no disponible
- Comando: llamada `curl` al endpoint `/api/cron/agora-sync`
- Primera aparición detectada: 2026-07-09
- Último fallo: run `29017819715`
- Último éxito conocido: run `28938993526` anterior y `29091928206` posterior
- Fallos consecutivos: 0 activo
- Ocurrencias: 1 failure en 20 runs
- Runs de evidencia:
  - Failure: `https://github.com/balleshosteleros/Balles-Hosteleros/actions/runs/29017819715`
  - Success posterior: `https://github.com/balleshosteleros/Balles-Hosteleros/actions/runs/29091928206`
  - Success más reciente: `https://github.com/balleshosteleros/Balles-Hosteleros/actions/runs/29149801361`

#### Error relevante

```text
Run conclusion: failure
Job conclusion: cancelled
Started: 2026-07-09T12:20:32Z
Completed: 2026-07-09T12:35:34Z
Steps: []
Logs: 403 Must have admin rights to Repository
```

#### Síntoma

El run programado de Ágora aparece como `failure`, pero el job interno aparece `cancelled` tras aproximadamente 15 minutos.

#### Causa directa

No demostrada. La evidencia pública solo permite afirmar que el job fue cancelado/terminado sin steps visibles.

#### Causa raíz

UNKNOWN. Hipótesis razonables: timeout externo, cancelación manual, problema temporal de runner/API o ejecución que quedó sin logs públicos. No hay evidencia suficiente para clasificarlo como fallo de código, secreto o endpoint.

#### Evidencia

- API pública de Actions: 20 runs totales.
- `schedule/main`: 18 runs, 17 success, 1 failure.
- `workflow_dispatch/main`: 2 runs, 2 success.
- Job `86117104626`: `conclusion=cancelled`, duración ~15 min, sin steps expuestos.
- Logs no accesibles sin permisos admin.

#### Solución propuesta

No cambiar código todavía. Obtener logs con una cuenta con permisos admin o esperar a una recurrencia. Si vuelve a ocurrir, revisar si el endpoint tarda cerca del límite y añadir timeout explícito más corto con diagnóstico claro.

#### Archivos afectados

- `.github/workflows/agora-sync-cron.yml`

#### Ejemplo de cambio

No recomendado sin logs. Solo si se confirma timeout del endpoint:

```diff
- CODE=$(curl -sS -o /tmp/resp.json -w "%{http_code}" --max-time 290 \
+ CODE=$(curl -sS -o /tmp/resp.json -w "%{http_code}" --connect-timeout 20 --max-time 240 \
```

#### Validación local

```bash
curl -sS -o /tmp/resp.json -w "%{http_code}" --max-time 240 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://sistema.balleshosteleros.com/api/cron/agora-sync"
```

#### Validación en CI

- Check esperado: `Cron Ágora (ventas) — disparador externo`.
- Resultado esperado: `success` en el siguiente schedule o `workflow_dispatch`.

#### Riesgo del cambio

MEDIO

Explicación: tocar timeouts sin logs puede convertir un proceso lento pero correcto en falso negativo.

#### Riesgo de no corregirlo

Bajo mientras no se repita: hay éxito anterior y posterior. Si se repite, puede ocultar una degradación del endpoint Ágora o de red.

#### Requiere intervención humana

Sí, para descargar logs completos desde GitHub o confirmar si hubo cancelación manual.

### CI-003 - Cobertura incompleta de crons fiables fuera de Vercel

- Prioridad: P2
- Tipo de causa: CONFIG
- Confianza: MEDIA
- Estado operativo: REQUIERE_ACCION_HUMANA
- Agente recomendado: capataz -> usuario
- Workflow: Vercel crons + GitHub Actions
- Evento: schedule
- Rama: main
- Job: n/a
- Step: n/a
- Comando: n/a
- Primera aparición detectada: documentado el 2026-06-23
- Último fallo: no es un failure de CI activo; es riesgo operativo documentado
- Último éxito conocido: Ágora cubierto por Actions; otros crons no auditados
- Fallos consecutivos: n/a
- Ocurrencias: `vercel.json` contiene 22 entradas de cron; GitHub Actions solo cubre Ágora
- Runs de evidencia:
  - `.github/workflows/agora-sync-cron.yml`
  - `vercel.json`

#### Error relevante

```text
Comentario en workflow:
"Los cron jobs de Vercel (vercel.json) NO se disparan de forma fiable en el plan actual..."
"esto SOLO cubre el cron de Ágora. Los otros 15 crons siguen sin disparador fiable."
```

#### Síntoma

La app puede desplegar correctamente, pero parte de la automatización programada puede no ejecutarse de forma fiable en el plan actual de Vercel. Esto encaja con la observación de que la app "se ve bien", pero existen errores operativos desde el principio.

#### Causa directa

Solo un cron crítico (`/api/cron/agora-sync`) tiene disparador alternativo en GitHub Actions. El resto depende de Vercel crons.

#### Causa raíz

La plataforma de ejecución programada no está alineada con el volumen y la criticidad de crons del producto. El repo usa muchos crons en `vercel.json`, pero el mecanismo alternativo solo cubre Ágora.

#### Evidencia

- `vercel.json` contiene 22 entradas de cron.
- `.github/workflows/agora-sync-cron.yml` llama solo a `/api/cron/agora-sync`.
- El propio workflow documenta que los otros crons siguen sin disparador fiable y propone Vercel Pro o ampliar el workflow.

#### Solución propuesta

Decisión humana entre:

1. Subir a un plan Vercel que cubra de forma fiable los crons requeridos.
2. Extender GitHub Actions a un scheduler externo para los crons críticos, vaciando o reduciendo `vercel.json` para no duplicar.
3. Mantener Vercel crons para tareas no críticas y mover solo las P0/P1 a un disparador controlado.

#### Archivos afectados

- `.github/workflows/agora-sync-cron.yml`
- `vercel.json`
- Posible nuevo workflow reusable para cron fan-out.

#### Ejemplo de cambio

No aplicar automáticamente. Patrón posible:

```diff
+ # .github/workflows/critical-crons.yml
+ # schedule diario por franjas, llamando endpoints críticos con CRON_SECRET
```

#### Validación local

```bash
# Validar cada endpoint crítico con CRON_SECRET en entorno seguro.
```

#### Validación en CI

- Check esperado: workflows programados verdes.
- Resultado esperado: logs por endpoint con HTTP `200` o `207`, y métricas funcionales en BD/app.

#### Riesgo del cambio

MEDIO

Explicación: duplicar disparadores puede ejecutar tareas dos veces si la idempotencia no está garantizada.

#### Riesgo de no corregirlo

Procesos de negocio programados pueden no ejecutarse o hacerlo tarde: avisos, expiraciones, purgas, vencimientos, retención y sincronizaciones.

#### Requiere intervención humana

Sí. Es decisión de plataforma/coste y puede requerir acceso al team Vercel.

## Fallos derivados

| Workflow | Job / step | Depende de | Motivo |
| -------- | ---------- | ---------- | ------ |
| Vercel | Deployments entre `85100ce0` y `49f25b57` | Configuración inválida introducida por `6ef08e69` | Repetían el mismo fallo de validación/deploy hasta que el cron horario fue sustituido |
| Vercel | Commits `pending` intermedios | Superseded/no ejecutados | No tienen status Vercel fallido propio; quedaron pendientes mientras la cola avanzaba |

## Fallos descartados o secundarios

- GitHub Actions no muestra fallo recurrente: 19/20 runs OK.
- El run Actions `29017819715` no se clasifica como causa raíz por falta de logs y porque hubo éxito antes y después.
- Los checks de Vercel en `66ce9d37` y `573d32e0` están verdes.
- La lentitud de la app no es fallo de CI. Está documentada en `docs/PERF_ARRANQUE_MENUS_DIAGNOSTICO.md`: el coste de server actions bajó de 6,2 s a 2,9 s tras diferir cargas secundarias; quedan pendientes permisos SSR y aligerar middleware/prefetch.

## Posibles fallos intermitentes

| ID | Firma | Evidencia | Confianza |
| -- | ----- | --------- | --------- |
| FLK-001 | `Cron Ágora | schedule | disparar | cancelled ~15min` | Un único run cancelado, éxito anterior y posterior, logs no accesibles | BAJA |

## Workflows obsoletos o duplicados

| Workflow | Evidencia | Riesgo de desactivación | Requiere decisión humana |
| -------- | --------- | ----------------------- | ------------------------ |
| Ninguno | El único workflow Actions cubre una brecha real de Vercel crons para Ágora | n/a | n/a |

## Plan de implementación

### CI-001

Estado: LISTO_PARA_IMPLEMENTAR

Agente recomendado: implementador -> revisor -> qa-gate

Archivos probables:

- `vercel.json`
- `scripts/verify-vercel-crons.mjs`
- `package.json` si se añade script de validación

Cambios:

- Mantener los dos schedules diarios `0 22 * * *` y `0 23 * * *`.
- Añadir guardrail para rechazar crons subdiarios en `vercel.json`.
- Documentar excepción si algún cron subdiario se permite solo con Vercel Pro.

No cambiar:

- No volver a `0 * * * *`.
- No desactivar crons como solución rápida.
- No tocar secretos ni settings remotos desde la auditoría.

Validación local:

```bash
node scripts/verify-vercel-crons.mjs
npm run typecheck
```

Validación CI:

- Vercel `Deployment has completed`.

Riesgo: BAJO

Dependencias: ninguna para guardrail; Vercel Pro si se quiere frecuencia real subdiaria.

Intervención humana: solo para decisión de plan/plataforma.

Criterio de finalización: ningún schedule subdiario entra en `main` sin excepción explícita y Vercel sigue verde.

### CI-002

Estado: REQUIERE_INVESTIGACION

Agente recomendado: detective

Archivos probables:

- `.github/workflows/agora-sync-cron.yml`

Cambios:

- Ninguno hasta obtener logs o repetición.
- Si se confirma timeout, ajustar timeout y logging del workflow.

No cambiar:

- No modificar `CRON_SECRET`.
- No relanzar/cancelar runs desde la auditoría.

Validación local:

```bash
curl -sS -o /tmp/resp.json -w "%{http_code}" --max-time 240 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://sistema.balleshosteleros.com/api/cron/agora-sync"
```

Validación CI:

- Siguiente schedule o dispatch manual con status `success`.

Riesgo: MEDIO

Dependencias: permisos admin para logs o acceso a GitHub Actions UI.

Intervención humana: sí.

Criterio de finalización: logs obtenidos o 3 ejecuciones posteriores verdes sin recurrencia.

### CI-003

Estado: REQUIERE_ACCION_HUMANA

Agente recomendado: capataz

Archivos probables:

- `vercel.json`
- `.github/workflows/agora-sync-cron.yml`
- nuevo workflow si se decide externalizar más crons

Cambios:

- Decidir plataforma de scheduling.
- Priorizar crons críticos y moverlos a un mecanismo fiable o subir plan.

No cambiar:

- No duplicar disparadores sin idempotencia confirmada.
- No vaciar `vercel.json` sin alternativa.

Validación local:

```bash
# Smoke endpoint por endpoint en entorno seguro.
```

Validación CI:

- Workflows programados verdes.
- Evidencia funcional de cada cron crítico.

Riesgo: MEDIO

Dependencias: acceso Vercel y decisión de coste.

Intervención humana: sí.

Criterio de finalización: cada cron P0/P1 tiene disparador fiable, logs y evidencia funcional.

## Orden recomendado

1. Mantener y blindar CI-001: impedir crons subdiarios que rompan deploy.
2. Resolver CI-003 a nivel plataforma: Vercel Pro o scheduler externo para crons críticos.
3. Investigar CI-002 solo si se repite o si una persona puede aportar logs.
4. Seguir el trabajo de rendimiento fuera de CI: permisos SSR y middleware/prefetch según `docs/PERF_ARRANQUE_MENUS_DIAGNOSTICO.md`.

## Conclusión

El problema principal no era que la app no compilara localmente ni que GitHub Actions estuviera roto: era un check externo de Vercel fallando por configuración de cron incompatible con el plan. La causa concreta fue el schedule horario `0 * * * *` introducido en `6ef08e69`; el fix `66ce9d37` lo reemplazó por dos crons diarios y Vercel volvió a verde.

Queda una degradación operativa: hay muchos crons en `vercel.json` y solo Ágora tiene disparador alternativo en GitHub Actions. Además, la lentitud de la app es un problema separado de runtime/bootstrap, ya parcialmente mitigado y documentado, no un fallo de CI activo.
