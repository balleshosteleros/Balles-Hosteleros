# TASK-008 - Firmas runtime hardening

## Estado

Hardening validado (2026-05-30). **Smoke E2E ejecutado: 10/12 sub-smokes PASAN** vía la UI pública real `/firmar/<token>` (Playwright headless) + verificación en BD. Los race-fixes R1/R2/R3 confirmados en runtime. Solo quedan los 2 sub-smokes de **entrega real de email** (residual, espera SMTP de SiteGround). Código + migraciones en prod (`fe01494`); transporte de email migrado a SMTP nodemailer (`ce7f0ea`). Derivada de [DISCOVERY_TASK004_2026-05-26.md](./DISCOVERY_TASK004_2026-05-26.md).

## Estado de ejecución (2026-05-29)

### Hecho
- Race fixes **R1** (token CAS), **R2** (eventos `seq`), **R3** (`otp_id`) + UNIQUE en `firmas_tokens.token_hash` — commiteados (`fe01494`), migraciones aplicadas a prod.
- Env vars: 2 peppers + `NEXT_PUBLIC_APP_URL` en `.env.local`. **Se abandona Resend** para email transaccional: `RESEND_API_KEY`/`EMAIL_FROM` ya no se usan (el `resend-service.ts` de marketing es independiente y sigue en Resend).
- Transporte de email reescrito a **SMTP global (nodemailer)** en `src/lib/email/send.ts` (`ce7f0ea`). Conserva Reply-To por empresa (`empresas.email_contacto`) y override `replyTo`. Sin credenciales devuelve `{ ok:false, configured:false }` (no rompe). Detalle: [HALLAZGO_EMAIL_TRANSPORTE_2026-05-28.md](./HALLAZGO_EMAIL_TRANSPORTE_2026-05-28.md).
- `npm run typecheck` ✅ + `npm run build` ✅.

### Pendiente bloqueante
- **Credenciales SMTP de SiteGround** en `.env.local`: `SMTP_HOST`, `SMTP_PORT` (465 SSL / 587 STARTTLS), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (opcional). Placeholders vacíos ya añadidos. **Sin esto el email no se entrega.**

### Smoke ejecutado (2026-05-30) — UI pública real `/firmar/<token>` (Playwright headless) + verificación BD (Management API)

Setup: 4 documentos sembrados en BACANAL (empleado de smoke TASK-005, modalidad `email_otp`), PDFs reales en bucket `firmas`, tokens hasheados con el pepper real. El **OTP se fijó con `FIRMA_OTP_PEPPER`** (secreto legítimo de `.env.local`) entre `solicitarOTP` y `validarOTP` — equivale a "leer el código del email"; `validarOTP` lo comprueba por el camino real. No se falsea ninguna validación.

| Smoke | Resultado | Evidencia |
|---|---|---|
| S2 abrir `/firmar/<token>` | ✅ PASA | Doc A: visor + datos del envío; evento `abierto` |
| S3 solicitar OTP | ✅ PASA | pantalla código + evento `otp_enviado` + fila `firmas_otps` |
| S4 OTP correcto | ✅ PASA | evento `otp_validado`; avanza a "Firmar" |
| S5 OTP incorrecto 3× → bloqueo | ✅ PASA | Doc B: `intentos=3`, `bloqueado_hasta` futuro; eventos `otp_fallido×2 → otp_bloqueado` |
| S6 firmar | ✅ PASA | Doc A: `estado=firmado`, `pdf_firmado_path` + `sha256_acta`; evento `firmado` |
| S7 reusar token tras firmar | ✅ PASA | reabrir token → "ya no admite firma" (token CAS R1) |
| S8 rechazar doc | ✅ PASA | Doc C: `estado=rechazado` + `motivo_rechazo` |
| S10 cron expirar | ✅ PASA | Doc D (`expira_en` pasado) → `estado=expirado` + evento `expirado`; sin `CRON_SECRET` → 401 |
| S11 hash chain (R2 `seq`) | ✅ PASA | Doc A: 4 eventos `abierto→otp_enviado→otp_validado→firmado`, recomputo `sha256(canonicalStringify)` = `hash` almacenado, `prev_hash` encadena. (Nota: el hash usa `ocurrido_en` en formato `toISOString()` `…Z`, no el `+00:00` de PostgREST). |
| S12 multitenant RLS | ✅ PASA | anon (clave pública) lee **0 filas** en las 4 tablas `firmas_*`; service role sí |
| S1 crear firma + **envío email** | 🔶 Parcial | DB/bucket/token/eventos OK (vía `crearFirmaInterno` en el seed); **entrega del email no verificable sin SMTP** |
| S9 reenviar + **email** | ⛔ Residual | rotación de token verificable por código; confirmación por email espera SMTP |

**Veredicto: 10/12 PASAN.** Los 2 residuales (S1 recepción, S9 confirmación) dependen exclusivamente de la **entrega real de los 3 correos** (invitación/OTP/copia firmada), bloqueada hasta tener SMTP de SiteGround. La lógica de negocio de firma está **validada en runtime**.

### Pendiente (no bloqueante)
- Credenciales SMTP de SiteGround → verificar entrega real de los 3 emails (S1/S9) → `HANDOFF_TASK008_FIRMAS_RUNTIME_<fecha>.md` → cerrar PRP-036.

### Limpieza de datos de smoke (2026-05-30) — parcial por diseño
- **Storage:** borrados los 5 PDFs del bucket `firmas` (4 `original.pdf` + 1 `firmado.pdf` del Doc A). ✅
- **Filas BD: NO borradas, por diseño.** `firmas_eventos` es **append-only** (trigger `firmas_eventos_no_delete`, inmutabilidad eIDAS — migración `20260515160000_firmas_eidas.sql`). Como `firmas_eventos.documento_id` tiene `ON DELETE CASCADE`, borrar un documento dispara el trigger y aborta. Resultado: los **4 documentos `tipo='smoke'` + 12 eventos + 2 otps + 3 tokens persisten** en BACANAL (modalidad `email_otp`, empleado de smoke TASK-005). No se desactivó el trigger (decisión explícita: no saltarse la salvaguarda de auditoría en prod).
- **Nota de honestidad:** un commit previo (`063f320`) afirmó por error que la limpieza fue total; era incorrecto — esta sección es la versión real.
- Si en el futuro se quiere purgar de verdad: `ALTER TABLE firmas_eventos DISABLE TRIGGER firmas_eventos_no_delete;` → borrar hijos→padre → `ENABLE TRIGGER`. Solo con OK explícito.

### Siguiente paso
Cerrable salvo la verificación de entrega de email. Pegar credenciales SMTP → correr S1/S9 de entrega → handoff → cerrar PRP-036.

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
