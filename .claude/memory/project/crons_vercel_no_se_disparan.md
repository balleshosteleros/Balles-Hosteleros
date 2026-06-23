---
name: Los crons de Vercel no se disparan de forma fiable — pendiente arreglar
description: Vercel no ejecuta los 16 cron jobs de vercel.json con fiabilidad (se saltó el 22-23 jun 2026); solo el de Ágora tiene ya un disparador externo en GitHub Actions. Los otros 15 siguen pendientes de arreglo
type: project
---

**Detectado 2026-06-23 (Claude, lado Fernando). Para el equipo / agente de Iván.**

Los **16 cron jobs** de `vercel.json` NO se ejecutan de forma fiable en producción:

- El cron `agora-sync` corrió bien del 18 al 21-jun y se **saltó el 22 y el 23** (sin registro en `agora_sync_log`, con 25 y 19 facturas reales sin ingerir esos días).
- Las ejecuciones que sí ocurren van a **horas dispersas** (08:04 / 08:33 / 08:48 UTC) en vez de la hora exacta → síntoma típico del **plan Hobby** de Vercel (límite de 2 cron jobs; en `vercel.json` hay **16**).
- Verificado que NO es el código ni Ágora: el servidor de Ágora responde `200` en **<2 s** todos los días (incl. los que el cron se saltó) y el route del cron no cambia desde el 18-jun (`762da5a`).

**Parche aplicado (SOLO Ágora):** workflow `.github/workflows/agora-sync-cron.yml` que llama a `/api/cron/agora-sync` cada día a las **09:37 UTC** con el `CRON_SECRET` (guardado en GitHub → Secrets → Actions). Es idempotente, así que convive con el cron de Vercel sin duplicar. Tiene `workflow_dispatch` con input `fecha` para reprocesar días concretos.

**PENDIENTE (decisión + acceso a Vercel = del equipo):** los **otros 15 crons** siguen sin disparador fiable — `empresas-purga`, `cerrar-fichajes-huerfanos`, `points/devengo-diario`, `points/snapshot-periodos`, `psd2-sync`, `firmas-expirar`, `google-resenas-sync`, `visita-emails`, `google-rwg-*` (×3), `reservas-recordatorios`, `vencimientos-alertas`, `cronogramas-alertas`, `vacantes-archivar`. Dos caminos:
1. **Subir el proyecto a Vercel Pro** → los crons pasan a ser fiables y a hora exacta (arreglo más simple si se asume el coste).
2. **Ampliar el workflow de GitHub Actions a los 16 endpoints** (gratis) y **vaciar `crons` en `vercel.json`** para que no se dupliquen.

Mientras no se haga, esos 15 crons se ejecutan de forma errática (algunos días sí, otros no). Ver también `docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md`.
