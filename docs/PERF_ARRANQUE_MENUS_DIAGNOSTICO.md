# Diagnóstico: menús vacíos 8-10 s al iniciar la app

> **Fecha:** 2026-07-09 · **Investigado por:** Claude (con Fernando)
> Método: 2 análisis independientes del código + **medición real con Playwright** (login demo,
> waterfall de red) contra **dev local** y contra **producción** (sistema.balleshosteleros.com).
> ⚠️ Zona compartida (layout/auth/proxy = territorio activo de Iván) → esto es DIAGNÓSTICO;
> los fixes se coordinan antes de tocar.

## Síntoma
Al iniciar la app, la pantalla se pinta pero los ítems de los menús tardan varios segundos
(8-10 s reportados en local) en aparecer.

## Mediciones (Playwright, usuario demo director de Bacanal)

| Escenario | Menú visible | POSTs (server actions) | Nota |
|---|---|---|---|
| **Local dev — primer login tras arrancar** | dentro de un total de ~34 s | 29 POSTs, 19,5 s acumulados | ~19 s son **compilación Turbopack** del layout la 1ª visita + tormenta de actions |
| **Prod — primer login (sin caché local)** | la página queda "cargando cosas" ~20 s | **22 POSTs serializados**, 21,3 s acumulados, **0,5-2,2 s CADA UNO** | sin compilación: es TODO red/middleware |
| **Prod/local — recarga con caché localStorage** | **0,03-0,1 s** ✅ | 0 | la caché de permisos funciona perfecta |
| **Prod/local — recarga sin caché (sesión ya abierta)** | **0,1 s** ✅ | 1-3 | con la app ya hidratada, el menú es instantáneo |

## Causas (confirmadas, por peso)

1. **Tormenta de server actions serializadas en el arranque.** Al montar el layout se disparan
   **16-23 POSTs** (EmpresaProvider: 5 actions de logos/empresas; `useDailyCounts`: 5 awaits EN SERIE
   que además se re-ejecutan 2-3 veces por cambios de deps; NotificacionBell; AuthProvider/permisos…).
   Next **serializa las server actions por cliente** (una en vuelo) → cola de ~20 s en prod medida.
   `useDailyCounts.ts:56-165`, `empresa-context.tsx:167-183`, `auth-context.tsx:200-237`.
2. **Peaje del middleware en CADA request.** `src/proxy.ts` + `src/lib/supabase/proxy.ts:91`:
   `auth.getUser()` (ida a GoTrue) + `usuarios` (guard) + `usuarios`+UPDATE `ultima_actividad` (Paso 2)
   + `empresa_roles` (+`usuario_empresas`) = **4-6 round-trips por request**, incluidos los POSTs de
   actions y los prefetches del sidebar. Con ~20 actions → **~15-20 llamadas a GoTrue y 60-120
   round-trips por arranque**. Cada action midió **0,5-2,2 s en PROD** → sospecha adicional:
   ¿región de Vercel ≠ región de Supabase? (verificar; si están cruzadas, cada RTT son ~100 ms).
3. **Sidebar "todo-o-nada" sin skeleton.** `app-sidebar.tsx:150-159`: si no hay caché y no es
   director, `sections = []` hasta que `getUserPermisos` sale de la cola; `auth-context.tsx:232-237`
   reintenta hasta 4× con backoff si la respuesta llega "vacía" (carrera post-login) → menú en blanco
   sin feedback. (Con caché localStorage el menú es instantáneo — medido.)
4. **Solo en local:** compilación Turbopack del layout gigante (~19 s la primera visita tras arrancar
   `npm run dev` en WSL con 3,8 GB de RAM). Esto explica que Fernando lo sufra "siempre" en local:
   cada arranque del dev server vuelve a compilar.

## Fixes propuestos (de menor a mayor invasividad)

1. **Paralelizar `useDailyCounts`** (5 awaits → `Promise.all`) y **diferirlo** (idle/2-3 s tras el
   mount) + estabilizar deps para que no se re-ejecute 2-3 veces. Bajo riesgo, gran ganancia.
2. **Batching de arranque:** una sola server action "bootstrap" que devuelva logos+empresas+contadores
   +notificaciones en 1 POST (1 peaje de middleware en vez de ~12).
3. **Aligerar el middleware:** saltar el "Paso 2" (queries de módulo + UPDATE ultima_actividad) para
   POSTs de server actions y prefetches (mirar header `next-action` / `Sec-Purpose: prefetch`);
   valorar cachear el resultado guard+rol unos segundos.
4. **Skeleton en el sidebar** en vez de `[]`, y pintar desde caché aunque la revalidación siga en curso
   (ya casi lo hace; falta el primer login).
5. **✅ VERIFICADO (2026-07-09): las regiones ESTÁN CRUZADAS — este es el fix nº 1.**
   - Vercel ejecuta las funciones en **`iad1` (Washington DC, EE. UU.)** — el default; `vercel.json`
     no fija región (verificado con `x-vercel-id: cdg1::iad1::…` en prod).
   - Supabase está en **`eu-west-1` (Dublín)** (verificado vía Management API).
   - **Cada round-trip función↔BD cruza el Atlántico (~90 ms)**; con 4-6 por request en el middleware
     y ~20 requests de arranque, explica los 0,5-2,2 s/action medidos.
   - **Fix de una línea**: añadir `"regions": ["dub1"]` a `vercel.json` (Dublín, mismo datacenter de
     AWS que eu-west-1) y redeploy. Impacto esperado: RTT ~90 ms → ~2-10 ms; la cola de arranque de
     ~20 s debería caer a ~2-4 s sin tocar código. Alternativa: cambiar la región en el dashboard
     de Vercel (cuenta del team balleshosteleros).
   - **✅ APLICADO Y MEDIDO (2026-07-10):** `"regions": ["dub1"]` en `vercel.json` (commit `e3dfe729`),
     deploy `success`, `x-vercel-id` confirmado `::dub1::`. **Re-medición en prod (mismo login):
     coste total de server actions 21,3 s → 6,5 s (−70 %); latencia por action 0,5-2,2 s → 0,08-0,4 s;
     cola de arranque ~20 s → ~7 s.** Sin tocar código de app. Quedan ~6,5 s de cola → objetivo de los
     fixes 1-4 de abajo.
6. (Local/DX) Trocear imports pesados del layout (`app-layout` importa grabadora, cámaras, Google,
   agenda, soporte…) con `next/dynamic` → menos compilación y menos hidratación.

## Fixes 1+2 aplicados y medidos (2026-07-10) — HALLAZGO IMPORTANTE

Commit `78274fb6`: (1) `useDailyCounts` — las 5 server actions en serie → `Promise.allSettled` +
1ª carga diferida 2 s y coalescida; (2) **skeleton** en el sidebar mientras cargan permisos.

**Medición post-deploy (prod, dub1): el tiempo NO se movió** (coste actions 6,5 s → 6,8 s = ruido).
**Por qué:** ⚠️ **Next.js SERIALIZA las server actions por cliente** (una en vuelo a la vez). Por tanto
`Promise.allSettled([action1..5])` **NO las paraleliza en la red** — React las encola igual, secuencial.
La paralelización a nivel JS quedó neutralizada. (El diferido/coalesce sí quita ruido del primer burst,
y el **skeleton sí mejora la percepción** — ya no hay "menú en blanco", sale esqueleto → menú — pero eso
no aparece en `totalPostMs`.)

**Conclusión estratégica:** el peso que queda (~6,5 s) son **~16 server actions serializadas por Next**
+ el peaje del middleware en cada una. La paralelización JS no puede con eso. **El único fix que mueve la
aguja es ESTRUCTURAL: colapsar las ~16 actions en UNA sola "bootstrap"** (1 POST serializado en vez de 16)
y/o aligerar el middleware. **Eso es zona de Iván** (providers + `src/proxy.ts`) → es el fix nº3/4, y es
el que hay que priorizar con él. Los fixes JS-side (1) ya no dan más.

## Auditoría profunda (skill nextjs-performance-expert, 2026-07-10) — REVISA LA ESTRATEGIA

Estudio independiente del código (agente auditor) + línea base estadística (4 muestras prod,
mismas condiciones: mediana **~6,2 s** de coste de actions, rango 5,8-6,8 s, **22 POSTs estables**).
Hallazgos NUEVOS que cambian la prioridad de los fixes:

1. **La llamada que desbloquea el menú entra la ÚLTIMA en la cola.** `getUserPermisos` la dispara
   `AuthProvider`, el provider MÁS EXTERNO (`src/shared/providers.tsx:23`); por orden de efectos de
   React (hijos antes que padres) + `setTimeout(...,0)` (`auth-context.tsx:283`), entra detrás de
   campana, accesos, empresa, logos… → **el menú espera a TODA la cola serializada** (9-14 POSTs).
   Por eso la caché localStorage (que salta la cola) lo hace instantáneo.
2. **Tormenta de prefetch oculta:** al pintarse el menú del director, ~11 `NavLink` sin
   `prefetch={false}` emiten prefetches que pagan middleware completo con Paso 2 (~5-6 viajes cada
   uno) ≈ **60-66 round-trips extra** que saturan GoTrue/PG justo en el arranque.
3. **Doble/triple validación:** el middleware calcula `empresa_roles.permisos` en el Paso 2
   (`proxy.ts:165`) **y los descarta**; cada action re-resuelve sesión+rol (`getAppContext`,
   `getRolContext`). Los permisos se leen hasta 3× por request de módulo.
4. **Aritmética total del bootstrap** (director, sin caché, sin Google): ≈ **145-155 round-trips**
   en los primeros segundos; ~77 en UNA cola secuencial → 5,6-7 s ≈ lo medido.
5. Perlas: `getEmpresaActivaId` es una server action que **solo lee una cookie** (paga 2 viajes de
   peaje para 0 queries); `usePresencia` se re-suscribe 2-3× por deps inestables; en 2 de 3 recargas
   prod aparece `[empresa-context] hidratación falló: TypeError: Failed to fetch` en consola.

**Prioridad de fixes REVISADA** (la "megaacción bootstrap" deja de ser el camino recomendado):

| Orden | Fix | Impacto | Riesgo | Zona |
|---|---|---|---|---|
| **d** | **Diferir/gatear lo secundario**: `listAccesosApps`×2, precarga Gmail/Calendar/Meet y `loadUserPref`×2 → gated en `open`; campana/EmpresaProvider tras `permisosLoaded`. El menú pasa de "último de 14" a "primero de 1-2" → **~80 % del beneficio** | Alto | Bajo | UI periférica (NO caliente) |
| **a** | **Permisos del menú en SSR**: `(main)/layout.tsx` (ya tiene sesión) llama `getRolContext` y pasa `initialAuth` opcional a `AuthProvider` → menú en el primer paint SIEMPRE, con o sin localStorage | Alto | Bajo-medio | auth/providers = **Iván** (hacerlo aditivo) |
| **c** | **Aligerar middleware**: saltar Paso 2 + UPDATE actividad en POSTs de actions (header `next-action`) y prefetches (`next-router-prefetch`) — redundante porque cada action re-valida; y/o `prefetch={false}` en NavLink | Medio (carga) | Medio | `proxy.ts` = **Iván** |
| ~~b~~ | Megaacción/Route Handler bootstrap completo: **descartada en su forma total** (acopla invalidaciones dispares: contadores/min vs permisos/casi-nunca; megapayload; punto único lento). Solo tendría sentido parcial (permisos+empresas+logos) y (a) lo supera para el menú | — | — | — |

## Fix (d) MEDIDO en prod (2026-07-11) — funciona

Commit `c3890d5f` (diferir secundarias: accesos ×2, campana, logos, drawers Google al abrir).
Desplegado con `66ce9d37` (que además arregló el deploy roto: el cron horario de `6ef08e69`
tumbaba TODOS los deploys — ver `docs/DEPLOYS_ROTOS_DESDE_85100ce0_PARA_IVAN.md`).

**Medición (3 pasadas idénticas, primer login prod, mismo protocolo que la línea base):**

| Métrica | ANTES (mediana, 4 muestras) | DESPUÉS (mediana, 3 muestras) | Δ |
|---|---:|---:|---:|
| Coste total server actions (fase 1) | 6,2 s (5,8–6,8) | **2,9 s (2,4–3,7)** | **−53 %** |
| POSTs | 22 | 21 | — |
| Menú con caché / recarga | 0,0–0,1 s | 0,0–0,1 s | = |

Caveat honesto: el deploy soltó a la vez ~15 commits retenidos de Iván (features, no tocan
el bootstrap), así que no es un A/B químicamente puro del fix (d), pero la magnitud y
estabilidad (3/3 fuera del rango previo) lo atribuyen al fix. Quedan ~2,9 s: los fixes
(a) permisos en SSR y (c) middleware/prefetch — autorizados por Iván — son el siguiente paso.

## Fix (a) MEDIDO en prod (2026-07-11) — OBJETIVO CUMPLIDO

Commit `99860d82`: el layout de `(main)` resuelve permisos en SSR (`getUserPermisos()`
server-side, misma región que la BD) y los siembra al `AuthProvider` vía `AuthServerSeed`
**antes del primer paint** (useLayoutEffect). Aditivo: con caché o SWR ya resuelto es un
no-op que solo persiste la caché; la autorización real sigue en servidor.

**De paso se cazó el artefacto del script de medición**: no era `waitForURL` sino el
`textContent()` del selector de error de login, cuyo auto-wait de Playwright metía 30 s
fijos cuando no había error. Con `{ timeout: 500 }` el script ya mide el tiempo real.

**Medición limpia (3 pasadas, PRIMER login sin caché, prod):**

| Métrica | Antes de la campaña | Ahora (mediana) | Presupuesto skill |
|---|---:|---:|---:|
| **Submit → menú visible (28 ítems)** | ~8-20 s percibidos | **1,7 s (1,4–1,8)** | < 1,5-2 s ✅ |
| Cola de server actions de fondo | 21,3 s | ~1-3 s y ya NO bloquea el menú | — |

Nota honesta: los `nPosts: 4-5` de estas pasadas son artefacto de ventana (el recorder se
cierra al pintarse el menú, ~1,7 s; las diferidas de 2,5-3 s caen fuera). Los POSTs de
fondo siguen existiendo — el punto es que el menú ya no los espera.

**Campaña completa: ~21 s → 1,7 s hasta menú en primer login** (regiones −70 %, diferir
secundarias −53 % de cola, permisos en SSR = menú independiente de la cola).
Pendiente opcional: fix (c) middleware/prefetch (reduce carga de GoTrue/PG, no latencia
visible del menú).

## Post-fix (a): dos bugs de PRIMER LOGIN cazados y cerrados (2026-07-11)

El seed SSR destapó (no creó) dos bugs preexistentes del primer login, ambos derivados
del mismo estado: la página de login deja el AuthProvider en `permisosLoaded=true` con
`roles=[]` (deslogueado), y ese estado **sobrevive a la navegación cliente post-login**
(el provider no se remonta).

1. **Menú de empleado transitorio para un director** (Fernando lo sufrió: menú "Perfil",
   clic → rebote). Fix `ff13249a`: el seed sincroniza también el **modo de vista** por rol
   (localStorage+cookie `bh_view_mode`) antes de que `ViewModeProvider` lo lea.
2. **Director aterrizaba en `/mi-panel`** en vez de `/mis-departamentos` (intermitente,
   medido 1 de 2): el guard de `MisDepartamentosView` corría con el closure del primer
   commit (roles=[]) y rebotaba antes de que el seed re-renderizara. Fixes `a26f1073`
   (el seed también aplica con roles vacíos) + `e6152d88` (**el guard no rebota con
   roles=[]** — con cero roles no se puede afirmar "no eres dirección").

**Verificado en prod 3/3**: login director → `/mis-departamentos`, menú en 1,7-2,3 s.

## Reproducir la medición
- Usuario demo: `scripts/agora/create-dev-user.mjs` (ya actualizado al esquema actual: rol en
  `usuarios.rol_id/rol_label`, `estado_acceso`, `password_set`; la tabla `usuario_roles` ya no existe).
- Script de medición (Playwright, 3 fases): `~/_perf_measure.cjs` en el WSL de Fernando
  (`BASE_URL=https://sistema.balleshosteleros.com node _perf_measure.cjs` para prod).
