# HALLAZGO — Transporte de email para firmas (TASK-008)

**Fecha:** 2026-05-28
**Estado:** BLOQUEADO pendiente de coordinación Fernando ↔ colaborador
**Afecta:** cierre de TASK-008 (firmas runtime hardening), y a nivel plataforma a todos los envíos transaccionales.

---

## 1. Decisión recibida (del colaborador, vía Fernando)

> No integrar Resend. Refactorizar `src/lib/email/send.ts` (y los callers de firmas)
> para usar el helper SMTP de SiteGround "existente" (cascada depto→empresa),
> mismo patrón que Inspectores. Cero variables nuevas.

Valores que sí se confirman para `.env.local` / Vercel:
- `FIRMA_TOKEN_PEPPER` (ya en `.env.local`)
- `FIRMA_OTP_PEPPER` (ya en `.env.local`)
- `NEXT_PUBLIC_APP_URL` (dev: `http://localhost:3000`; prod: dominio del deploy)
- **NO** usar `RESEND_API_KEY` ni `EMAIL_FROM`.

## 2. Lo que dice el CÓDIGO REAL (verificado 2026-05-28, no inferido)

La premisa "helper SiteGround SMTP existente" **es falsa en el código actual**:

| Hecho | Evidencia |
|---|---|
| El sistema SMTP SiteGround (cascada depto→empresa) **se borró el 26-may** | Migration `20260526180000_simplify_email_config_to_empresas_email_contacto.sql`: `drop table public.departamento_email_config` + `empresa_email_config` ("estaban vacías, 0 filas en prod") |
| Hoy **todo el SaaS envía por Resend** (inspectores incluido) | `src/lib/email/send.ts` → `fetch("https://api.resend.com/emails")`, gated por `RESEND_API_KEY` + `EMAIL_FROM` |
| **Firmas YA enruta por el `sendEmail` central** — no llama a Resend directamente | `src/features/rrhh/services/firmas/email.ts:1` → `import { sendEmail } from "@/lib/email/send"`, pasa `empresaId`. Idéntico patrón a `inspectores/email-sender.ts` |
| `nodemailer@8` sigue en `package.json` (residuo de la era SMTP) | `package.json` deps |
| **No hay rama remota** del colaborador con un nuevo sistema SMTP | `git branch -a` → solo `main`, `rrhh-sync-origin-c4da3ca`, `-v2` |

## 3. Implicación

- **No hay nada "Resend-específico" que refactorizar en los callers de firmas.** Ya pasan por el helper central. La parte de email de TASK-008 está, de facto, correcta.
- Lo único atado a Resend está **dentro** de `send.ts`.
- Para usar SiteGround SMTP hay que **reescribir `send.ts`** (nodemailer + credenciales SiteGround + posiblemente resucitar las 2 tablas de config dropeadas). Esto:
  - Es cambio **de plataforma**, afecta a los **7 callers**: firmas, inspectores, mi-panel, promoción, contrataciones, `src/actions/admin.ts`, cron `visita-emails`.
  - **Revierte una decisión deliberada de hace 2 días** (la "simplificación radical" a Resend).
  - Necesita credenciales SiteGround que **no están** en `.env.local`.

## 4. Lo que hay que decidir (Fernando ↔ colaborador)

1. **¿Quién posee el rewrite de `send.ts` → SMTP?** (es tarea de plataforma, no de firmas).
2. **¿De dónde salen las credenciales SiteGround?** (host / puerto / user / pass) y dónde viven (env vars vs DB).
3. **¿Cascada por-departamento (resucitar `empresa_email_config` + `departamento_email_config`) o un SMTP único global?**
4. Confirmar que se abandona Resend de forma definitiva (entonces se puede borrar la rama de código Resend de `send.ts` y limpiar `RESEND_API_KEY`/`EMAIL_FROM` del checklist de despliegue).

## 5. Impacto en el cierre de TASK-008

- **Código de firmas:** hecho. Race fixes (R1 token CAS, R2 eventos `seq`, R3 `otp_id`) + UNIQUE en `firmas_tokens.token_hash` ya commiteados (`fe01494`) y migraciones aplicadas a prod.
- **Env vars TASK-008:** se reducen a 2 peppers + `NEXT_PUBLIC_APP_URL`. Se quitan `RESEND_API_KEY` y `EMAIL_FROM`.
- **Smokes que SÍ se pueden correr ya** (no dependen de transporte de email): token de un solo uso (CAS), lógica OTP (validación / bloqueo / `otp_id`), hash chain append-only, expiración.
- **Smokes que están BLOQUEADOS** hasta que exista un transporte vivo: entrega real de email de invitación, OTP por email, copia firmada por email.

## 6. Recuperación del sistema SMTP viejo (referencia técnica)

El sistema SMTP completo se borró en el commit `0dabc84` ("bundle WIP", 2026-05-26, mismo día que la migration de simplificación). Es **recuperable desde el padre `0dabc84^`**:

```bash
# Sender SMTP/nodemailer (cascada) — 201 líneas, vs ~94 de la versión Resend actual
git show 0dabc84^:src/lib/email/send.ts

# Gestión de config SMTP por empresa/departamento (server actions) — 276 líneas
git show 0dabc84^:src/features/ajustes/actions/email-config-actions.ts

# UI donde la empresa configuraba SMTP por depto/empresa — 412 líneas
git show 0dabc84^:src/features/ajustes/components/EmailConfigCard.tsx
```

- `nodemailer@8` + `@types/nodemailer@8` **siguen en `package.json`** pero **sin uso en `src/` hoy** (residuo) → no hay que reinstalar nada.
- Las tablas `empresa_email_config` + `departamento_email_config` se dropearon en `20260526180000`. Su `CREATE TABLE` original está en una migration anterior (localizar con `grep -rl empresa_email_config supabase/migrations/`). Estaban **vacías en prod** (0 filas).

## 7. Acción tomada

Ninguna sobre el código (decisión de Fernando: "paro y coordinas tú"). Solo se deja este hallazgo apuntado.
