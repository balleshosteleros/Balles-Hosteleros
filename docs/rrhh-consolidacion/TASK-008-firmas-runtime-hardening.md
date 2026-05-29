# TASK-008 - Firmas runtime hardening

## Estado

En curso (2026-05-29). Código de hardening + migraciones en prod (`fe01494`); transporte de email migrado de Resend a SMTP nodemailer (`ce7f0ea`). Solo falta cargar credenciales SMTP de SiteGround para correr los smokes de email. Derivada de [DISCOVERY_TASK004_2026-05-26.md](./DISCOVERY_TASK004_2026-05-26.md).

## Estado de ejecución (2026-05-29)

### Hecho
- Race fixes **R1** (token CAS), **R2** (eventos `seq`), **R3** (`otp_id`) + UNIQUE en `firmas_tokens.token_hash` — commiteados (`fe01494`), migraciones aplicadas a prod.
- Env vars: 2 peppers + `NEXT_PUBLIC_APP_URL` en `.env.local`. **Se abandona Resend** para email transaccional: `RESEND_API_KEY`/`EMAIL_FROM` ya no se usan (el `resend-service.ts` de marketing es independiente y sigue en Resend).
- Transporte de email reescrito a **SMTP global (nodemailer)** en `src/lib/email/send.ts` (`ce7f0ea`). Conserva Reply-To por empresa (`empresas.email_contacto`) y override `replyTo`. Sin credenciales devuelve `{ ok:false, configured:false }` (no rompe). Detalle: [HALLAZGO_EMAIL_TRANSPORTE_2026-05-28.md](./HALLAZGO_EMAIL_TRANSPORTE_2026-05-28.md).
- `npm run typecheck` ✅ + `npm run build` ✅.

### Pendiente bloqueante
- **Credenciales SMTP de SiteGround** en `.env.local`: `SMTP_HOST`, `SMTP_PORT` (465 SSL / 587 STARTTLS), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (opcional). Placeholders vacíos ya añadidos. **Sin esto el email no se entrega.**

### Smokes S1-S12 — estado de bloqueo
| Smoke | ¿Email? | Estado sin credenciales |
|---|---|---|
| S1 crear firma + envío | Sí (recepción) | 🔶 Parcial: DB/bucket/eventos verificables; recepción de email BLOQUEADA |
| S2 abrir `/firmar/<token>` | No (token de BD) | ✅ Ejecutable |
| S3 solicitar OTP | Sí (código llega por email) | 🔶 Parcial: evento `otp_enviado` + `codigo_hash` verificables; código BLOQUEADO |
| S4 OTP correcto | Sí (necesita el código de S3) | ⛔ Bloqueado |
| S5 OTP incorrecto 3× (bloqueo 30 min) | No (se envían códigos falsos) | ✅ Ejecutable |
| S6 firmar (click_to_sign) | Sí (cadena OTP + email descarga) | ⛔ Bloqueado |
| S7 reusar token tras firmar | Sí (requiere S6 previo) | ⛔ Bloqueado |
| S8 rechazar doc | No | ✅ Ejecutable |
| S9 reenviar pendiente | Sí (confirmación por email) | 🔶 Parcial: rotación de tokens verificable; email BLOQUEADO |
| S10 cron expirar (curl + CRON_SECRET) | No | ✅ Ejecutable |
| S11 verificar hash chain (`audit.verificarCadena`) | No | ✅ Ejecutable |
| S12 multitenant RLS | No | ✅ Ejecutable |

- **Ejecutables ya (sin credenciales):** S2, S5, S8, S10, S11, S12 (+ partes verificables de S1/S3/S9 vía BD).
- **Bloqueados hasta credenciales SMTP:** S1 (recepción), S3 (código), S4, S6, S7, S9 (confirmación).

### Siguiente paso
Pegar credenciales SMTP de SiteGround → correr S1-S12 completos → escribir `HANDOFF_TASK008_FIRMAS_RUNTIME_<fecha>.md` → cerrar PRP-036.

## Objetivo

Llevar el módulo de firmas eIDAS de "implementado pero no usable" a runtime real validado en producción. El módulo está al ~95% (PRP-036 fases 1-7 todas presentes en código), pero hoy cualquier intento de crear o firmar arroja excepción por env vars faltantes. Cierre formal del PRP-036 tras smoke E2E.

## Modo operativo

- taskId: TASK-008
- taskMode: code
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/EXECUTION_PLAN.md (frente firmas)
- sourceDiscovery: docs/rrhh-consolidacion/DISCOVERY_TASK004_2026-05-26.md
- sourcePRP: .claude/PRPs/PRP-036-firmas-electronicas-eidas.md

## Scope IN

1. **Variables de entorno**:
   - Generar `FIRMA_TOKEN_PEPPER` (≥32 chars random, distinto al de OTP) y añadir a `.env.local` + Vercel (Production, Preview, Development).
   - Generar `FIRMA_OTP_PEPPER` (≥32 chars random, distinto al de tokens) e igual.
   - Verificar/configurar `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (o documentar transport alternativo de `@/lib/email/send`).
   - Configurar `NEXT_PUBLIC_APP_URL` por entorno (preview vs prod).

2. **Fixes de race condition** (3 PRs lógicos, pueden ir en un solo commit por simplicidad):
   - **R1 — Token consumido tardío**: en `src/app/firmar/[token]/actions.ts:firmarDocumento`, marcar `firmas_tokens.consumido_en` con compare-and-swap (`UPDATE...WHERE consumido_en IS NULL`) al inicio de la firma; abortar si `rowCount=0`. Evita doble firma concurrente del mismo documento.
   - **R2 — Hash chain por timestamp ambiguo**: en `firmas_eventos`, añadir columna `seq integer NOT NULL` con `UNIQUE (documento_id, seq)`. Modificar `audit.registrarEvento` para incrementar el seq atómicamente. Migración nueva + sin cambiar el hash content (mantiene retrocompatibilidad de chain).
   - **R3 — OTP por created_at ambiguo**: en `solicitarOTP`, devolver el `otp_id` y pasarlo explícito a `validarOTP`. O alternativa: usar `SELECT FOR UPDATE` en `validarOTP` con la query existente.

3. **Robustez (opcional, mismo commit si entra)**:
   - Reordenar `crearFirma` y `crearFirmaInterno`: UPLOAD a un path determinista → INSERT con path correcto. Evita docs huérfanos con `pdf_original_path='pending'`.
   - `reenviarFirma`: garantizar `expira_en >= now() + 24h` al regenerar token.
   - `UNIQUE INDEX` sobre `firmas_tokens.token_hash` (migración correctiva).

4. **Smoke E2E S1-S12** ejecutado en BACANAL con cuenta `firma-smoke-admin-no-borrar@example.com` (puede reusar `rrhh-smoke-admin-no-borrar`) + crear empleado `firma-smoke-empleado-no-borrar@example.com` análogo al patrón de SMOKE_USERS_RRHH.md. Documentar resultados en handoff.

5. **Cierre PRP-036**: actualizar header `Estado: PENDIENTE → CERRADO`, añadir entrada Self-Annealing si surgen aprendizajes durante los fixes/smoke.

## Scope OUT

- No reescribir la arquitectura: solo fixes incrementales.
- No subir a eIDAS Avanzada (requiere TSP/TSA acreditado, fuera del PRP).
- No integrar SMS (Twilio/Vonage) — sigue siendo email-only.
- No rehacer la UI: FirmasView y FirmaPublicaView se mantienen.
- No tocar el cron salvo que el smoke S10 detecte regresión.

## Criterio de corte

- Las 4 env vars configuradas en los 3 entornos Vercel + `.env.local`.
- Las 3 race conditions arregladas con commits separados y mensajes claros.
- Smokes S1-S12 ejecutados, todos pasan, y se documentan en handoff.
- `npm run typecheck` y `npm run build` pasan.
- PRP-036 marcado como cerrado con fecha de validación.
- Handoff escrito con commits, env vars (sin valores), smokes y siguiente paso.

## Dependencias

- TASK-004 (discovery) cerrada ✅
- PRP-036 implementado al ~95% ✅
- BD/bucket/cron en prod ✅
- Cuenta smoke admin disponible (`rrhh-smoke-admin-no-borrar@example.com`) ✅
- Crear cuenta empleado smoke nueva (parte del scope)

## Validación esperada por ejecutor

- Test unitario opcional para `registrarEvento` con concurrencia simulada (no bloqueante).
- Smoke manual exhaustivo S1-S12.
- Verificación de la hash chain con `audit.verificarCadena` sobre el documento firmado del smoke.
- Confirmar que un segundo POST a `/firmar/<token>` tras firmar devuelve "consumed".
- Confirmar que con 3 OTPs incorrectos el cuarto intento da bloqueado 30 min.
