# Mantenimiento de dependencias

Salud del árbol de dependencias y notas de build. Revisar periódicamente
(territorio de dependency-guardian / tech-oracle). No bloquea el desarrollo
actual, pero conviene resolverlo antes de exponer a producción.

## npm audit — 5 vulnerabilidades (snapshot 2026-05-29)

3 moderate + 2 high. Detectadas tras `npm install` (sync con los commits del colaborador).

| Paquete | Severidad | Problema | Fix |
|---|---|---|---|
| `next` (≤ 16.3.0-canary; instalado 16.2.3) | **high** | Múltiples advisories: DoS en Server Components, bypass de middleware/proxy en App Router, cache poisoning, XSS con CSP nonces, SSRF en upgrades WebSocket, DoS en Image Optimization | `npm audit fix` (bump dentro de 16.x — validar typecheck+build, posible breaking) |
| `xlsx` (`*`) | **high** | Prototype Pollution + ReDoS (SheetJS) | **SIN fix en npm.** Decidir: migrar a fork mantenido o instalar la versión del CDN oficial de SheetJS |
| `brace-expansion` 5.0.2–5.0.5 | moderate | ReDoS (rango numérico grande vence la protección `max`). Transitiva vía `@typescript-eslint` | `npm audit fix` |
| `postcss` < 8.5.10 | moderate | XSS vía `</style>` sin escapar en el stringify de CSS. Transitiva vía `next` | `npm audit fix` |
| `ws` 8.0.0–8.20.0 | moderate | Uninitialized memory disclosure | `npm audit fix` |

**Recomendación:** `npm audit fix` resuelve 4 de 5 (`brace-expansion`, `postcss`, `ws` y el bump de `next` — validar build después). `xlsx` requiere decisión aparte porque no hay fix publicado en npm. Hacerlo en una tarea de mantenimiento dedicada, no mezclado con features.

## Build / Turbopack — notas

- **Módulos nativos**: `ssh2` (arrastrado por `ssh2-sftp-client`, cron `canales-google-rwg`) NO se puede empaquetar con Turbopack (`non-ecmascript placeable asset`). Está declarado en `next.config.ts` → `serverExternalPackages: ['ssh2','ssh2-sftp-client']`. Cualquier dep con bindings `.node` que sea server-only debe ir ahí.
- **Tras `git pull`**: las deps pueden estar declaradas en `package.json` pero NO instaladas → correr `npm install` antes de `typecheck`/`build`. (Ocurrió 2026-05-29 con `ssh2-sftp-client` y `web-push`, que rompían el build de `main`.)
- **WSL**: correr `npm`/`build` con `bash -c` (NO `bash -lc`). El login-shell mete el npm de Windows en el PATH y su caché en `C:` puede estar llena (ENOSPC). La caché de npm en WSL (`npm config get cache`) apunta a `/home/...`, con disco de sobra.
