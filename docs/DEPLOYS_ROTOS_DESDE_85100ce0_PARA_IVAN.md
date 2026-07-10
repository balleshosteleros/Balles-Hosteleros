# ⚠️ URGENTE: los deploys de producción llevan rotos desde el 10-jul

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
