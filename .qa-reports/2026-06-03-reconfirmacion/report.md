# QA Report: Apartado Reconfirmación en Configuración de Reservas

**Date**: 2026-06-03
**Status**: PASSED (data layer + compile) / NOT_TESTED (UI gated, sin credenciales)

## Resumen

El cambio en BD, server actions y migración funciona correctamente. La UI no
se pudo verificar headless porque /sala/reservas requiere login real (Google
OAuth) y no había sesión disponible en el entorno de Playwright.

## Test Steps

1. **Dev server up** — `curl localhost:3000` → 200. OK.
2. **Compile de la ruta** — Screenshot `screenshots/01-reservas-route.png`.
   La página /sala/reservas redirige a /login limpio (sin errores 500),
   confirmando que el bundle compila y el middleware de auth funciona.
3. **Defaults en BD** — `SELECT` sobre HABANA y BACANAL:
   `reconfirmacion_dias_antes=1`, `reconfirmacion_lt_24h_inmediata=false`. OK.
4. **Persistencia (roundtrip en HABANA)** — UPDATE a (3, true) → SELECT → leí
   (3, true). OK. Después restaurado a defaults (1, false).
5. **CHECK constraint** —
   - `UPDATE ... reconfirmacion_dias_antes = 0` → rechazado con
     `violates check constraint empresa_reservas_config_reconfirmacion_dias_chk`. OK.
   - `UPDATE ... reconfirmacion_dias_antes = 8` → rechazado igual. OK.
6. **Estado final** — HABANA y BACANAL en defaults originales. Sin efectos
   colaterales.

## Findings

- Migración aplicada correctamente, defaults coherentes, CHECK 1..7 activo.
- La cadena UI (Select 1–7) ↔ server action ↔ BD ↔ cron está consistente:
  el cron `/api/cron/reservas-recordatorios` ya lee `reconfirmacion_dias_antes`
  y dispara `enviarReservaEmail(id, "RECONFIRMACION")`.
- El envío inmediato <24h queda condicionado a
  `reconfirmacion_lt_24h_inmediata=true` en `notificarReservaCreadaPorEmail`.
- **No verificado visualmente**: layout del apartado, copy exacto, persistencia
  end-to-end vía UI. Para esto el dueño debe abrir la página en su sesión.

## Screenshots

- `screenshots/01-reservas-route.png` — /sala/reservas sin sesión → login.

## Recommendations

- Validación manual (30 s): abrir /sala/reservas → tab Configuración → buscar
  apartado "Reconfirmación", cambiar selector a "3 días antes", recargar,
  confirmar que persiste; activar el switch, recargar, confirmar que persiste.
- Para tests futuros con UI gated: añadir `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`
  en `.env.local` o exportar `storageState` de la sesión activa para que
  Playwright pueda reusarla.
