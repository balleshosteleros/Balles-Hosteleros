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
6. (Local/DX) Trocear imports pesados del layout (`app-layout` importa grabadora, cámaras, Google,
   agenda, soporte…) con `next/dynamic` → menos compilación y menos hidratación.

## Reproducir la medición
- Usuario demo: `scripts/agora/create-dev-user.mjs` (ya actualizado al esquema actual: rol en
  `usuarios.rol_id/rol_label`, `estado_acceso`, `password_set`; la tabla `usuario_roles` ya no existe).
- Script de medición (Playwright, 3 fases): `~/_perf_measure.cjs` en el WSL de Fernando
  (`BASE_URL=https://sistema.balleshosteleros.com node _perf_measure.cjs` para prod).
