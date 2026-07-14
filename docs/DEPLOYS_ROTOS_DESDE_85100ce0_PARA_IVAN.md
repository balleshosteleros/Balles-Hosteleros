# ⚠️ URGENTE: los deploys de producción llevan rotos desde el 10-jul

## ✅ RESUELTO (11-jul, Fernando) — causa encontrada y arreglada

**Culpable: el cron horario `0 * * * *` de `nominas-gestoria-envio`** (introducido en
`6ef08e69`). El plan de Vercel solo admite crons **diarios**; desde ese commit TODOS los
deploys fallaban en la validación de configuración (por eso el typecheck local pasaba).

- **Confirmación empírica:** rama `test/diag-cron-horario` (= main con solo esa línea
  revertida) → deploy **success**, mientras main fallaba.
- **Fix aplicado en main SIN romper tu feature PRP-069:** en vez de volver a un cron
  diario cualquiera (habría dejado de cumplir la ventana 00:00–00:59 hora empresa que
  exige tu route), quedan **DOS crons diarios al mismo path**: `0 22 * * *` y
  `0 23 * * *` (UTC). Uno de los dos cae siempre en la medianoche de Madrid
  (CEST/CET); tu check de idempotencia (`nominas_gestoria_ultimo_envio`) evita el
  doble envío. **Si algún día una empresa opera en una zona horaria lejos de
  UTC+1/+2, habrá que añadir otro cron diario a la hora UTC correspondiente.**
- Con esto prod vuelve a desplegar y entran de golpe todos tus commits pendientes
  (nóminas, festivos, cámaras, telefonía, sanciones, relay FTP) + nuestro fix de perf.
- Nota: **cualquier cron con frecuencia menor que diaria volverá a romper TODOS los
  deploys.** Si necesitas frecuencia horaria de verdad: Vercel Pro o el patrón del
  workflow de GitHub Actions (`agora-sync-cron.yml`).

### Confirmaciones posteriores (12-jul, Ivan+Claude)

- **El código nunca estuvo roto.** `npm run build` local en el HEAD del rango (mismo
  bundler que Vercel, Turbopack) → **exit 0** + typecheck limpio. Esto descarta del
  todo las "sospechas típicas" del histórico de abajo (prerender, import server-only,
  env var de R2/telefonía): eran callejones sin salida. El único fallo era la
  validación de `vercel.json` por el cron, que `next build` no comprueba.
- **El fix (d) `c3890d5f` ya está desplegado y medido en prod:** coste de server
  actions **6,2s → 2,9s (−53%)** (ver `573d32e`). La re-medición que quedó en cola
  está hecha; no queda nada pendiente de este hilo.
- **El "primer failure = `85100ce0`" del histórico despistaba:** Vercel no buildea
  todos los commits de un push, así que el primer *build* fallido no señala al commit
  culpable. El culpable real (`6ef08e69`, el cron) es **anterior** a `85100ce0`.

---

## (Histórico — YA RESUELTO, no accionar) El aviso original:

> ⚠️ **Todo lo que sigue quedó OBSOLETO tras el fix del cron (ver arriba).** Se conserva
> solo como registro. En particular, el diagnóstico "producción congelada", las "pistas
> no confirmadas" y el apartado "qué necesitamos de ti" **ya no aplican**: la causa era el
> cron, no el código, y prod despliega con normalidad desde el 11-jul.

> **De:** Fernando (11-jul-2026) · **Para:** Iván
> Detectado al intentar desplegar un fix de rendimiento. **No es teoría: está verificado
> contra la API de GitHub commit a commit.**

## Qué pasa

**Producción está congelada en `78274fb6` (10-jul).** Todos los deploys de Vercel
posteriores **fallan**, así que NINGUNA feature pusheada desde entonces está en prod:

- nóminas (validación de mes, revisión con incidencias, histórico, rechazo de archivo)
- festivos oficiales por CCAA + cron
- cámaras/videovigilancia R2
- telefonía (empresa_telefonia cifrada + JsSIP, correo SIP B2COM)
- sanciones disciplinarias con firma
- baja médica → aviso gestoría, calendario fiscal…
- (nuestros) fix de perf del arranque `c3890d5f`

## Dónde se rompió

Estado de deploy por commit (API GitHub, `.../commits/<sha>/status`):

| Commit | Estado Vercel |
|---|---|
| `78274fb6` perf layout (Fernando) | ✅ success — **último verde** |
| `e4bcdb94` calendario fiscal | pending (supersedido, nunca se buildeó) |
| `bc433a84` baja médica avisos | pending |
| `6ef08e69` correo día 1 (**cambia cron a `0 * * * *`**) | pending |
| `7aea8a05` sanción disciplinaria | pending |
| `85100ce0` badge agenda | ❌ **primer failure** |
| todo lo posterior (hasta hoy) | ❌ failure |

Como los 4 "pending" nunca se buildearon, **la rotura está en el rango
`e4bcdb94..85100ce0` (5 commits)** — no necesariamente en `85100ce0` en sí.

## Pistas (no confirmadas — hace falta el log de Vercel)

- El **typecheck local pasa** en HEAD → no es un error de tipos.
- Sospechas típicas: fallo de prerender/collecting page data de una ruta nueva,
  import server-only en cliente, **env var nueva que falta en Vercel** (cámaras R2 y
  telefonía añaden secretos), o el **cron horario `0 * * * *`** de `6ef08e69` si el
  plan de Vercel no admite esa frecuencia (los planes no-Pro solo permiten crons diarios).
- Intenté reproducir el build en local y no pude (la VM WSL de Fernando se queda sin
  RAM con `next build` de esta app).

## Qué necesitamos de ti

1. Abre el **dashboard de Vercel** (cuenta del team) → deployment fallido más reciente →
   **copia el error del build log** (nosotros no tenemos acceso al team).
2. Con el error a la vista, el fix suele ser de minutos. Si es una env var, añadirla
   en Vercel y redeploy; si es el cron, revertir el schedule; si es código, lo vemos.
3. Hasta entonces, **cualquier cosa que pushees seguirá sin llegar a prod**.

## Contexto del fix de perf que quedó en cola

`c3890d5f` difiere las cargas secundarias del arranque (accesos, campana, logos,
precargas Gmail/Calendar/Meet) para que el menú no espere la cola de server actions.
Diagnóstico completo con mediciones en `docs/PERF_ARRANQUE_MENUS_DIAGNOSTICO.md`.
Cuando el deploy vuelva a verde lo re-medimos.
