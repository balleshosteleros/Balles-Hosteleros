# HANDOFF — TASK-008 firmas runtime hardening + TASK-005 promoción

**Fecha**: 2026-05-31
**Cierra**: PRP-036 firmas electrónicas eIDAS, TASK-008, TASK-005 (residual de email)
**Entorno**: local-only (Next.js dev server en WSL), BD Supabase compartida (BACANAL)
**SMTP**: Gmail (`smtp.gmail.com:465`, App Password) como **placeholder temporal** hasta tener el dominio en SiteGround.

---

## Resumen

Cierre formal del módulo de firmas eIDAS y de la promoción candidato → empleado. Los hardenings de código (`fe01494`, `e94b897`, `ce7f0ea`, `f328cad`) ya estaban en `main` desde el 2026-05-29/30. Esta sesión cubre la validación runtime end-to-end con email REAL (Gmail) que estaba bloqueada por la falta de SMTP, completando los 12 sub-smokes de TASK-008 y el residual de magic-link de TASK-005.

## Cambios de configuración

- **`.env.local`** (no versionado, solo local):
  - `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=fmaroto001@gmail.com`, `SMTP_PASS=<App Password>`, `EMAIL_FROM=fmaroto001@gmail.com`. Gmail como SMTP temporal — App Password generada en la cuenta del desarrollador con 2FA.
  - `FIRMA_TOKEN_PEPPER` y `FIRMA_OTP_PEPPER` **sincronizados con los del colaborador**: discrepancia detectada antes del smoke (Fernando tenía un set distinto al usado el 2026-05-28 para crear la "Carta de baja voluntaria" real). Sin sincronizar, ese documento productivo no habría sido validable.
- **Pass del admin smoke** `rrhh-smoke-admin-no-borrar@example.com` reseteada a `SmokeForja2026!` (Service Role API, no versionada).
- **Empleado fixture TASK-005** `42ff5d65-d8c8-4d70-adee-648d2baa4cd4` (Smoke Promo Test): `email_personal` cambiado a alias Gmail (`fmaroto001+task008@gmail.com`) para poder recibir emails de smoke.

## Sub-smokes S1-S12 — TASK-008

Ejecutados con UI pública real `/firmar/<token>` (Playwright headless en WSL) + verificación en BD por Management API + verificación visual de Gmail por Fernando.

| Smoke | Resultado | Evidencia |
|---|---|---|
| **S1** crear firma + envío email invitación | ✅ PASA | Doc `f8e8b80e-…` "SMOKE T2 - Contrato prueba envio email" creado por UI; evento `enviado` con `emailOk=true`, `emailTransport=smtp`; email recibido en Gmail con plantilla `bienvenidaEmpleadoEmail` correcta, asunto, sender, botón "Firmar documento", caducidad 07/06 |
| **S2** abrir `/firmar/<token>` | ✅ PASA | Página de firma cargada, datos del envío visibles, sin "Enlace no válido" |
| **S3** solicitar OTP por email | ✅ PASA | Evento `otp_enviado` con `emailOk=true`, código real `706367` recibido en Gmail |
| **S4** OTP correcto | ✅ PASA | Evento `otp_validado` (seq 12), avanza a pantalla "Firmar ahora" |
| **S5** OTP incorrecto 3× → bloqueo | ✅ PASA (sesión 2026-05-30) | Doc B con `intentos=3`, `bloqueado_hasta` futuro |
| **S6** firmar + copia firmada email | ✅ PASA | Evento `firmado` (seq 13); `pdf_firmado_path` set, `sha256_acta`; email "Documento firmado" con signed URL TTL 7 días que devuelve `application/pdf` 4393 bytes con magic `%PDF-1.7` y `%%EOF` correcto |
| **S7** reusar token tras firmar | ✅ PASA | Token CAS R1 confirmado; reabrir el link devuelve "Enlace no válido" |
| **S8** rechazar doc | ✅ PASA (sesión 2026-05-30) | Doc C `estado=rechazado` + `motivo_rechazo` |
| **S9** reenviar pendiente | ✅ PASA | `reenviado_count` 0→1, token rotado (`c4aa…` → `9838fc41…`), tokens activos sigue siendo 1 (viejo borrado), evento `reenviado` con `emailOk=true`, 2º email a Gmail al inbox |
| **S10** cron expirar | ✅ PASA (sesión 2026-05-30) | Doc D → estado `expirado`; sin secret → 401 |
| **S11** hash chain (R2 `seq`) | ✅ PASA | 13 eventos del doc T2-T4 enlazan correctamente; recomputo con `ocurrido_en` en formato `toISOString()` (`…Z`) reproduce el hash almacenado |
| **S12** RLS multitenant | ✅ PASA (sesión 2026-05-30) | anon clave pública = 0 filas en las 4 tablas `firmas_*` |

**Resultado: 12/12 PASA.** Los 4 caminos de email del módulo (`enviarInvitacionFirma`, `enviarCodigoOTP`, `enviarCopiaFirmada`, reenvío) confirmados en runtime con SMTP real.

## Cierre del residual de TASK-005

Ejecutado además el sub-smoke que quedó pendiente al cerrar TASK-005 el 30-05:

- **Candidato sembrado** `9809ff25-…` "Magic Link Test T5" en BACANAL, fase=`seleccionado`, estado=`prueba`.
- **Promovido por UI real** (Playwright) → admin BACANAL → reclutamiento → tab Candidatos → "Crear en sistema" → "Confirmar y crear".
- **BD verificada al 100%** sobre el nuevo empleado `467a943e-…`: cascada `auth.user → profile (rol_label=EMPLEADO, es_empleado=true) → user_roles[empleado] → user_empresas[BACANAL] → empleado (user_id, local_id, dni_nie, estado=Activo, email_confirmado)`. Los 7 gaps cerrados en `e94b897` validados con SMTP activo.
- **Magic link de Supabase Auth recibido en Gmail** con `redirect_to=http://localhost:3000/primer-acceso`. Confirma además que el chip `NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_APP_URL` (`f328cad`) construye el `redirect_to` correctamente — sin ese fix el `redirect_to` habría salido como `undefined/primer-acceso` y el primer acceso del empleado habría fallado.

## Decisiones

- **Gmail como SMTP temporal**: válido para todo el tráfico de smoke. Cuando llegue el dominio en SiteGround, basta con sustituir las 5 variables SMTP en `.env.local`; sin cambios de código (`src/lib/email/send.ts` es agnóstico al proveedor).
- **No** se ha tocado el `From:` para que apunte a un dominio Balles: Gmail rechaza spoofing del `From:` distinto al `SMTP_USER`. Con SiteGround sí se podrá enviar como `firmas@dominio…`.
- **No** se reabrió la decisión de usar Resend para email transaccional: la migración a SMTP (`ce7f0ea`) sigue siendo definitiva. `marketing/services/resend-service.ts` continúa en Resend (servicio independiente, fuera de scope).

## Datos restantes en BACANAL

Documentación de qué queda en BD por si se decide purgar más adelante:

- **Carta de baja voluntaria** `04d2db61-…` (Iván Ballesteros, pendiente, caduca 07-jun): documento REAL preexistente del colaborador. **NO TOCAR.**
- **SMOKE T2 - Contrato prueba envio email** `f8e8b80e-…`: firmado por el smoke T4. `tipo='smoke'`. Storage tiene `original.pdf` + `firmado.pdf`. **Eliminable** cuando se quiera (transacción atómica con DISABLE/DELETE/ENABLE del trigger `firmas_eventos_no_delete`, como en sesión 2026-05-30).
- **Empleado Smoke Promo Test** `42ff5d65-…`: queda con `email_personal=fmaroto001+task008@gmail.com`. Útil como fixture para futuros smokes de firma a este empleado (su empresa principal es BACANAL, local Restaurante Bacanal). Si se quiere revertir, basta UPDATE del email.
- **Empleado Magic Link Test T5** `467a943e-…`: nuevo, queda con `email_personal=fmaroto001+task005@gmail.com`. Su candidato `9809ff25-…` queda en `estado='empleado'`. Útil como fixture para smokes de "empleado recién promovido". Eliminable con la cascada habitual (`auth.users` DELETE → CASCADE limpia profile/user_empresas/user_roles + manualmente el empleado y candidato).

## Aprendizajes operativos

1. **Sincronización de secretos críticos entre desarrolladores**: si hay BD compartida, los peppers HMAC deben estar idénticos. No están en git (correcto), pero pasar por canal seguro **antes** de generar producción evita que un colaborador no pueda validar lo que otro creó.
2. **`/tmp/` no es persistente**: scripts de Playwright, helpers de queries, archivos `code.txt` se borran entre sesiones del agente o reinicios de WSL. No depender de ellos para fixtures.
3. **`firmas_eventos` append-only**: el trigger `firmas_eventos_no_delete` aplica incluso con service role. Para purgar datos de smoke, requiere DISABLE/DELETE/ENABLE en una transacción atómica. **Nunca** desactivar este trigger para borrar firmas reales.
4. **Gmail App Password vs Pass normal**: con 2FA activada, Gmail rechaza la pass del usuario para SMTP externo. Necesita App Password de 16 letras (en `.env.local` se pegan sin espacios).
5. **`From:` con Gmail**: bloqueado a `SMTP_USER`. Para enviar como `firmas@<dominio>` hay que tener el dominio propio y el SMTP del dominio (SiteGround u otros).

## Siguiente paso del proyecto

- **TASK-005**: cerrada definitivamente.
- **TASK-008**: cerrada definitivamente. PRP-036 marcado CERRADO.
- **TASK-006** (accesos apps): siguiente candidato cuando se quiera retomar la ola RRHH.
- **Cambiar SMTP a SiteGround**: sustituir 5 variables en `.env.local` cuando esté el dominio. No requiere otro cambio.
