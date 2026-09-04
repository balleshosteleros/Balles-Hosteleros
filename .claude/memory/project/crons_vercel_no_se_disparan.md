---
name: Los crons de Vercel — el problema de junio 2026 YA NO ESTÁ (verificado 5-sep-2026)
description: En jun-2026 los crons de Vercel se saltaban días (plan Hobby). Verificado el 5-sep-2026 con datos reales: ya corren de forma fiable (29 de 30 días). NO recomendar Vercel Pro ni montar workflows por este motivo sin volver a medirlo antes
type: project
---

> ⚠️ **Antes de repetir el diagnóstico de abajo, MÍDELO.** El 5-sep-2026 se dio por bueno sin comprobar y llevó a recomendarle al usuario Vercel Pro y 28 workflows que no hacían falta. La comprobación real está en el apartado siguiente.

## Estado VERIFICADO el 5-sep-2026 (datos reales, no supuestos)

Los crons **sí se ejecutan**:
- `agora-sync`: ejecución en su franja horaria **29 de los últimos 30 días**, a las 08:00-08:02 (el único día que faltó, el 27-ago, lo cubrió el disparador de GitHub Actions).
- `fichajes-autosalida` (SIN disparador propio): cierra jornadas **todos los días**.
- `reservas-provisionales` (SIN disparador propio): **cero** provisionales viejas sin limpiar.

O sea: el límite del plan Hobby ya no aplica, o el plan cambió. **La redundancia de GitHub Actions se mantiene a propósito** — el 27-ago demostró que sirve de red.

**Ojo al diagnosticar:** que un cron "no haga nada" no prueba que no se ejecute. La reconfirmación de reservas llevaba 31.160 reservas sin enviar un solo correo y NO era culpa de los crons, sino de un fallo del propio código (ventana de 1 h que no coincidía con ninguna reserva). Ver [[reconfirmacion_circuito_completo]].

**Al leer `agora_sync_log`:** solo la PRIMERA ejecución del día en la franja 05:00-09:00 es el cron. El resto son sincronizaciones manuales de gente usando la app (hoy salían 166 filas y solo 2 eran del cron).

---

## Histórico: el problema de junio 2026 (ya resuelto, se deja como contexto)

**Detectado 2026-06-23 (Claude, lado Fernando). Para el equipo / agente de Iván.**

Los **16 cron jobs** de `vercel.json` NO se ejecutan de forma fiable en producción:

- El cron `agora-sync` corrió bien del 18 al 21-jun y se **saltó el 22 y el 23** (sin registro en `agora_sync_log`, con 25 y 19 facturas reales sin ingerir esos días).
- Las ejecuciones que sí ocurren van a **horas dispersas** (08:04 / 08:33 / 08:48 UTC) en vez de la hora exacta → síntoma típico del **plan Hobby** de Vercel (límite de 2 cron jobs; en `vercel.json` hay **16**).
- Verificado que NO es el código ni Ágora: el servidor de Ágora responde `200` en **<2 s** todos los días (incl. los que el cron se saltó) y el route del cron no cambia desde el 18-jun (`762da5a`).

**Actualización 2026-09-05:** ya son **30 crons** en `vercel.json` (no 16). Se añadió un segundo disparador externo, `.github/workflows/reservas-recordatorios-cron.yml`, para `/api/cron/reservas-recordatorios` (reconfirmación y recordatorios de sala) — corre **cada hora** al minuto 12, porque cada empresa tiene su propia hora de envío en hora local y el endpoint decide a quién le toca. Quedan **28 crons** sin disparador fiable.

**Parche aplicado (Ágora, jun-2026):** workflow `.github/workflows/agora-sync-cron.yml` que llama a `/api/cron/agora-sync` cada día a las **09:37 UTC** con el `CRON_SECRET` (guardado en GitHub → Secrets → Actions). Es idempotente, así que convive con el cron de Vercel sin duplicar. Tiene `workflow_dispatch` con input `fecha` para reprocesar días concretos.

**~~PENDIENTE~~ (ya no aplica, ver arriba):** en junio los **otros crons** no tenían disparador fiable — `empresas-purga`, `cerrar-fichajes-huerfanos`, `points/devengo-diario`, `points/snapshot-periodos`, `psd2-sync`, `firmas-expirar`, `google-resenas-sync`, `visita-emails`, `google-rwg-*` (×3), `vencimientos-alertas`, `cronogramas-alertas`, `vacantes-archivar`. Dos caminos:
1. **Subir el proyecto a Vercel Pro** → los crons pasan a ser fiables y a hora exacta (arreglo más simple si se asume el coste).
2. **Ampliar el workflow de GitHub Actions a los 16 endpoints** (gratis) y **vaciar `crons` en `vercel.json`** para que no se dupliquen.

Mientras no se haga, esos 15 crons se ejecutan de forma errática (algunos días sí, otros no). Ver también `docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md`.
