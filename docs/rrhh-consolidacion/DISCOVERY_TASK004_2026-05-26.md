# Discovery TASK-004 — Firmas hardening operativo

Fecha: 2026-05-26
Branch: `rrhh-sync-origin-c4da3ca` (mergeada a `main`)
Modo: `discovery` — no se ha tocado runtime.
PRP origen: [PRP-036-firmas-electronicas-eidas.md](../../.claude/PRPs/PRP-036-firmas-electronicas-eidas.md)

## Resumen ejecutivo

El módulo de firmas eIDAS **está mucho más avanzado de lo que el plan original sugería**: las 7 fases del PRP-036 están implementadas al **~95%** (schema, servicios, server actions admin y firmante, ruta pública `/firmar/[token]`, cron de expiración, middleware abierto). Sin embargo, **el flujo NO se puede usar hoy** por dos bloqueadores concretos en entorno de runtime:

1. **Faltan 2 variables de entorno críticas** (`FIRMA_TOKEN_PEPPER`, `FIRMA_OTP_PEPPER`). El código de `crypto.ts:getPepper` lanza error si no están o son <16 chars, así que cualquier intento de crear/firmar arroja una excepción inmediata.
2. **0 documentos en producción** confirma que el flujo nunca se ha ejecutado end-to-end. PRP-036 sigue marcado "PENDIENTE" en su header.

Junto a los bloqueadores hay **race conditions reales** en el flujo público y **gaps menores de robustez/legal** que conviene cerrar antes de declarar runtime. Pero la arquitectura base es sólida: hash chain inmutable (con triggers append-only), HMAC+pepper, timing-safe compare, bucket privado, RLS multi-tenant, OTP con bloqueo a 3 intentos.

**Decisión**: pasar a runtime es posible con **una task pequeña** (TASK-008) que: (a) configura las env vars en `.env.local` + Vercel, (b) arregla 3 race conditions concretas, (c) hace smoke E2E controlado en BACANAL. No requiere reescritura ni nuevo PRP.

---

## Matriz por fase del PRP-036

| Fase | Estado | Detalle |
|------|--------|---------|
| **1. Migración BD + bucket** | ✅ **Aplicada en prod** | 4 tablas (`firmas_documentos`, `_tokens`, `_otps`, `_eventos`), bucket `firmas` privado, RLS con `profiles ∪ user_empresas`. Verificado via Management API. |
| **2. Services core (crypto/audit/pdf/email)** | ✅ Implementado | `crypto.ts` con HMAC+pepper y `timingSafeEqual`. `audit.ts` con hash chain `prev_hash`+verificación. `pdf.ts` con acta (eIDAS + audit trail) + concatenación + embebido de trazo PNG. `email.ts` con 3 templates (invitación, OTP, copia firmada). |
| **3. Server actions admin** | ✅ Implementado | `listFirmas`, `listFirmasPorEmpleado`, `crearFirma`, `reenviarFirma`, `ampliarPlazoFirma`, `cancelarFirma`, `getAuditTrail`, `getDescargaFirmadoUrl`, `getVisorOriginalUrl`. `requireAdmin` valida `user_roles.role ∈ ('admin','director')`. |
| **4. Ruta pública `/firmar/[token]`** | ✅ Implementado | `src/app/firmar/[token]/{page.tsx, actions.ts, FirmaPublicaView.tsx, VisorPdfInteractivo.tsx, VisorPdfLimpio.tsx}`. Middleware `PUBLIC_PREFIXES` lo incluye. Actions: `abrirDocumento`, `solicitarOTP`, `validarOTP`, `firmarDocumento`, `getEstadoFirma`, `rechazarDocumento`. |
| **5. Refactor FirmasView a datos reales** | ✅ Implementado | `FirmasView.tsx` 905 líneas — pendiente smoke real pero llama a las actions reales. |
| **6. Cron expiración + cleanup** | ✅ Implementado | `/api/cron/firmas-expirar/route.ts` con Bearer `CRON_SECRET`, 503 si no configurado, 401 si auth falla. Marca pendientes vencidos + retención (tokens 30d / OTPs 7d). Schedule `0 3 * * *` en `vercel.json`. |
| **7. Validación final E2E** | ❌ **NO ejecutada** | 0 documentos en prod. Sin smoke real reportado. |

## Estado en producción (verificado 2026-05-26)

```
firmas_documentos:  0 filas
firmas_tokens:      0 filas
firmas_otps:        0 filas
firmas_eventos:     0 filas
bucket "firmas":    existe, public=false ✓
empleados activos:  24 (estado="Activo") ✓ — coincide con check `emp.estado !== "Activo"`
user_roles:         existe, columna `role` USER-DEFINED enum
```

## Gaps por categoría

### 🚨 Bloqueadores — runtime fallaría hoy

| # | Gap | Síntoma | Fix |
|---|-----|---------|-----|
| 1 | **`FIRMA_TOKEN_PEPPER` ausente en `.env.local`** | `crypto.ts:getPepper` lanza `Error: Falta env FIRMA_TOKEN_PEPPER (mínimo 16 caracteres)` en cualquier creación/validación de token | Añadir variable de ≥32 chars random a `.env.local` y a Vercel env vars (todos los entornos). |
| 2 | **`FIRMA_OTP_PEPPER` ausente en `.env.local`** | Mismo error en cualquier generación/validación de OTP | Igual. **DEBE ser distinto** al de tokens para que un fallo de pepper no exponga ambos. |
| 3 | **`RESEND_API_KEY` ausente** (probable, no confirmado) | Emails de invitación + OTP + copia no se envían | Verificar config de `@/lib/email/send`. Si usa Resend, añadir keys. Si tiene fallback a otro transport (Supabase email?), documentarlo. |
| 4 | **`NEXT_PUBLIC_APP_URL` ausente** | `email.ts` default a `https://sistema.balleshosteleros.com/firmar/...` — si ese dominio no apunta al deploy actual, los enlaces se rompen | Configurar en Vercel por entorno (preview vs prod). |

### ⚠️ Race conditions reales

| # | Lugar | Escenario | Impacto | Fix sugerido |
|---|-------|-----------|---------|--------------|
| 5 | `firmarDocumento` en `app/firmar/[token]/actions.ts:362-528` | El token no se marca `consumido_en` hasta el final (línea 497-500). Dos requests paralelas con el mismo token pasan todas las validaciones antes de que ninguna marque consumido → ambas firman, sobreescribiendo `firmas_documentos.estado` | Doble firma del mismo documento, eventos duplicados, posible split en la hash chain | Marcar `consumido_en` con UPDATE...WHERE consumido_en IS NULL al principio y abortar si rowCount=0. Compare-and-swap atómico. |
| 6 | `audit.ts:registrarEvento` línea 37-44 | `prev_hash` = último evento ordenado por `ocurrido_en`. Si dos eventos concurrentes obtienen `now()` idéntico al microsegundo, ambos leen el mismo `prevHash` → chain bifurcada | Hash chain rota, `verificarCadena` retorna `{ok:false}` | Añadir lock optimista: usar `documentoId+seq` o `ocurrido_en` con `WHERE NOT EXISTS (SELECT 1 FROM firmas_eventos WHERE documento_id=$1 AND ocurrido_en=$2)` antes del INSERT. Alternativa simple: añadir columna `seq SERIAL` con uniqueness por `(documento_id, seq)`. |
| 7 | `validarOTP` en `actions.ts:284-300` | Lee el OTP más reciente por `created_at desc`. Si entre solicitarOTP y validarOTP otra request pide un OTP nuevo, el validar lee el NUEVO, no el que se envió por email al usuario | Confusión UX o bypass de OTP en escenarios concurrentes | Pasar el OTP-id explícito desde solicitarOTP (devolverlo en el resultado) o aceptar solo si `validado_en IS NULL AND expira_en > now()` — el filter ya está, pero falta atomicidad. |

### 📋 Robustez y consistencia

| # | Lugar | Problema | Impacto | Fix |
|---|-------|----------|---------|-----|
| 8 | `firmas-actions.ts:255-277` y `crear-firma.ts:111-152` | INSERT con `pdf_original_path: "pending"` → UPLOAD storage → UPDATE path. Si el server muere entre INSERT y UPLOAD, queda doc con path "pending" inválido | Documentos huérfanos sin PDF | Subir PRIMERO el PDF a un path determinista (`temp/{uuid}.pdf`), luego INSERT con path correcto, luego MOVE si quieres ruta final. O usar transacción RPC. |
| 9 | `reenviarFirma` línea 391-401 | Usa el `expira_en` original del documento, sin extender. Si el doc se reenvía cuando ya está casi expirado, el nuevo token nace con muy poco tiempo | UX confusa, empleado no llega a firmar | Garantizar mínimo `now() + 24h` al regenerar token. |
| 10 | `ampliarPlazoFirma` línea 515-522 | El evento se registra como `"reenviado"` con `metadata: { motivo: "ampliar_plazo" }`. No hay tipo `"plazo_ampliado"` en el CHECK | Búsquedas por tipo de evento confunden | O bien aceptar la convención con metadata, o ampliar el CHECK del enum `tipo` y usar `plazo_ampliado`. Documental, no bloqueante. |
| 11 | `crear-firma.ts:34` (comentario) | `crearFirmaInterno` confía en que el caller pase un `enviadoPorUserId` válido. No valida que coincida con `auth.uid()` | Si el callsite de baja_contrato pasa el user_id incorrecto, el `enviado_por` queda mal. Si fuera explotable, un user podría suplantar a otro como remitente | Verificar el callsite en `mi-panel-actions.ts:aprobarSolicitud`. Idealmente derivar `enviadoPorUserId` del `auth.uid()` dentro de la función, no aceptarlo como input. |
| 12 | `firmas_tokens.token_hash` | Index btree pero **no UNIQUE** | Probabilidad de colisión 2⁻²⁵⁶ — despreciable, pero faltan garantías | Cambiar a `CREATE UNIQUE INDEX` en una migración correctiva. |

### ⚖️ Validez legal eIDAS

| # | Aspecto | Estado actual | Observación |
|---|---------|---------------|-------------|
| 13 | Doble factor real | OTP por email (mismo canal que el enlace) | eIDAS Avanzada exige factores **independientes**. La validez actual es **Simple** según art. 25 — sigue siendo legalmente vinculante (PRP-036 lo asume), pero no permite reclamar "Avanzada" en el acta. El acta dice `eidas_simple` por defecto, coherente. |
| 14 | Identidad del firmante | Confianza en `email_empresa ∪ email_personal` del empleado en BD | Cumple. Si el empleado niega ser dueño del email, la empresa debe poder probarlo (contrato firma, alta empleado). Mejora futura: añadir verificación de DNI/NIE al firmar para reforzar prueba. |
| 15 | Sello de tiempo cualificado (TSA) | NO — usa `Date.now()` del servidor | Cumple Simple. Avanzada exigiría TSA acreditado tipo TimestampingAuthority. Out of scope per PRP. |
| 16 | Conservación auditable | ✅ Hash chain + triggers `BEFORE UPDATE/DELETE` que lanzan exception | Inmutabilidad real a nivel BD. Bueno. |

### 🔧 Operacional / observabilidad

| # | Gap | Impacto | Fix |
|---|-----|---------|-----|
| 17 | Sin alerta al admin si un documento expira | RRHH no se entera de firmas no completadas | Email post-cron por cada `expirado` con motivo `plazo_vencido` (no presente hoy). |
| 18 | Sin rate-limit en `crearFirma` ni `reenviarFirma` | Un admin malicioso/curioso podría spammear emails | Soft cap por `reenviado_count` o ratelimit por empresa/hora. |
| 19 | Sin métricas | No hay dashboard de tasa de firma, tiempos, OTP fallidos | Out of scope. Mencionar para PRP futuro. |

## Cadenas verificadas

### Admin envía → empleado firma → admin descarga
1. Admin pulsa "+ Nuevo" en `/rrhh/firmas` → `crearFirma(formData)` ✓
2. Validación: tipo MIME, tamaño 10MB, empleado activo de la empresa, email destino ✓
3. INSERT documento → UPLOAD bucket → UPDATE path → INSERT token + token email ✓ (gap #8 abierto)
4. Evento `creado` + `enviado` ✓
5. Empleado abre `/firmar/<token>` → `abrirDocumento(token)` ✓
6. Backend: `resolverToken` (hash+compare), valida `consumido_en IS NULL`, valida expira_en, registra `abierto` ✓
7. Empleado pulsa "Firmar" → `solicitarOTP` → genera OTP 6 dígitos, hash con HMAC+pepper+docId, INSERT, email ✓
8. Empleado introduce código → `validarOTP` → compara timing-safe, max 3 intentos, bloqueo 30 min ✓
9. Modal final → `firmarDocumento` → genera acta + concatena + sube + UPDATE doc + marca token consumido + email copia ✓ (gap #5 abierto)
10. Admin recarga `/rrhh/firmas` → ve estado firmado, puede descargar via `getDescargaFirmadoUrl` (signed URL 7 días) ✓

### Empleado rechaza
1. `rechazarDocumento(token, motivo)` → valida token, UPDATE estado='rechazado', motivo_rechazo, marca token consumido, registra evento `rechazado` ✓

### Cron expira pendientes
1. `vercel.json` schedule `0 3 * * *` → GET `/api/cron/firmas-expirar` con Bearer CRON_SECRET ✓
2. SELECT `estado='pendiente' AND expira_en < now()` → para cada uno: UPDATE estado='expirado' (con WHERE estado='pendiente' para evitar carrera), registra evento `expirado`, borra tokens del doc ✓
3. DELETE tokens con `consumido_en < now-30d OR expira_en < now-30d`, DELETE otps `created_at < now-7d` ✓

### Hash chain
1. `audit.registrarEvento` calcula prevHash (último evento del doc), hash = sha256(canonicalStringify({...payload, prevHash, ocurridoEn})) ✓
2. `audit.verificarCadena` re-itera y recomputa, detecta cualquier alteración ✓
3. Triggers `firmas_eventos_block_mutation` lanzan exception en UPDATE/DELETE — incluyen `set search_path=''` (linter-compliant) ✓

## Riesgos multiempresa / RLS

| Tabla | RLS | Notas |
|-------|-----|-------|
| `firmas_documentos` | ✅ `fd_select_empresa` (profiles ∪ user_empresas), `fd_select_empleado`, `fd_manage_admin` (verifica user_roles role ∈ admin/director) | Modelo correcto. |
| `firmas_tokens` | ✅ `ft_deny_select` (false) — acceso solo service_role | Patrón sano (deny-by-default). |
| `firmas_otps` | ✅ `fo_deny_select` (false) | Igual. |
| `firmas_eventos` | ✅ `fe_select_empresa`, `fe_select_empleado`. INSERT/UPDATE/DELETE solo service_role. Triggers bloquean UPDATE/DELETE incluso a service_role | Inmutabilidad real. |
| Bucket Storage `firmas` | ✅ privado, acceso solo via signed URL emitida por server action con service_role | Path multitenant `{empresa_id}/{doc_id}/...`. |

## Smokes requeridos para declarar runtime

Sub-tarea propuesta (TASK-008). Cada smoke debe ejecutarse con BACANAL en prod y validar artefactos.

| # | Smoke | Variables a observar |
|---|-------|----------------------|
| S1 | Admin crea firma + envío | Email recibido, doc en BD estado='pendiente', evento `creado` y `enviado`, hash chain válida, PDF en bucket en path correcto, token persistido como hash |
| S2 | Empleado abre `/firmar/<token>` | Evento `abierto`, visor PDF carga, no se ve el token plain en ninguna parte del HTML |
| S3 | Empleado solicita OTP | Email con código recibido, evento `otp_enviado` con `destinoEnmascarado`, OTP en BD como hash |
| S4 | Empleado introduce OTP correcto | Evento `otp_validado`, otp.validado_en seteado |
| S5 | Empleado introduce OTP incorrecto 3 veces | Evento `otp_fallido` × 2 + `otp_bloqueado` × 1, bloqueado_hasta = now+30min, intento 4 da error "bloqueado" |
| S6 | Empleado firma (click_to_sign) | Evento `firmado`, doc.estado='firmado', sha256_acta presente, pdf_firmado_path apunta a archivo en bucket, token marcado consumido_en. Email con descarga recibido |
| S7 | Empleado intenta reusar el mismo token tras firmar | Página muestra "Enlace ya utilizado", razón `consumed` |
| S8 | Empleado rechaza otro doc | doc.estado='rechazado', motivo persistido, evento `rechazado` |
| S9 | Admin reenvía un doc pendiente | Tokens viejos eliminados, nuevo token generado, email recibido, evento `reenviado` |
| S10 | Cron expirar manual con curl + CRON_SECRET | Docs con `expira_en < now()` pasan a expirado, eventos registrados, tokens borrados |
| S11 | Verificar hash chain end-to-end con `verificarCadena` desde audit trail UI | Resultado `{ok: true}` para cualquier doc |
| S12 | Multitenant: admin HABANA NO ve docs BACANAL (intentar leer firmas con sesión HABANA) | RLS rechaza, lista vacía |

## Variables de entorno necesarias

| Variable | Estado actual | Requerido para | Valor sugerido |
|----------|--------------|----------------|----------------|
| `CRON_SECRET` | ✅ Presente | Cron firmas-expirar | (ya existe) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Presente | Cliente Supabase admin en cron | (ya existe) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Presente | Cliente Supabase admin | (ya existe) |
| **`FIRMA_TOKEN_PEPPER`** | ❌ **Falta** | Hash de tokens (`crypto.ts`) | `openssl rand -base64 48` |
| **`FIRMA_OTP_PEPPER`** | ❌ **Falta** | Hash de OTPs (`crypto.ts`) | `openssl rand -base64 48` (distinto al de tokens) |
| **`RESEND_API_KEY`** | ❌ Falta (probable) | Envío de emails (verificar transport real de `@/lib/email/send`) | Desde Resend dashboard |
| **`RESEND_FROM_EMAIL`** | ❌ Falta | `from` de los emails (default `firmas@balleshosteleros.com`) | Email DKIM/SPF configurado |
| **`NEXT_PUBLIC_APP_URL`** | ❌ Falta | Link en email `/firmar/<token>` (default hardcoded) | URL del deploy actual (Vercel prod o preview según entorno) |

⚠️ **Configurar en los 3 entornos Vercel** (Production, Preview, Development). Los peppers deben ser **idénticos entre entornos que comparten BD** (tokens hashe ados con un pepper son inválidos con otro) y **distintos entre prod y staging** si tienen BDs distintas.

## Decisión

**Pasar a runtime ES posible con una task pequeña.** El módulo está casi al 100% implementado y bien arquitectado. Solo faltan:

- 4 env vars configuradas (~10 min)
- 3 race conditions arregladas (~2-3 h código + tests)
- Smoke E2E controlado en BACANAL con cuenta no-borrar (~1-2 h)

**No hace falta un nuevo PRP.** TASK-004 puede derivar TASK-008 (runtime hardening) con scope acotado.

## Próxima task propuesta — TASK-008 firmas runtime hardening

Scope:
1. **Env vars**: generar peppers + configurar Resend + APP_URL en `.env.local` y en Vercel (los 3 entornos).
2. **Fixes de race condition** (3 micro-PRs, cada uno con commit propio):
   - 2a. `firmarDocumento`: marcar token `consumido_en` con compare-and-swap al inicio.
   - 2b. `audit.registrarEvento`: añadir columna `seq` autoincremental con uniqueness por `(documento_id, seq)`, eliminar dependencia de `ocurrido_en` para el orden.
   - 2c. `validarOTP`: pasar `otp_id` explícito desde `solicitarOTP` o usar SELECT con FOR UPDATE.
3. **Robustez** (opcional, mismo PR):
   - 3a. Reordenar upload → INSERT en `crearFirma` y `crearFirmaInterno`.
   - 3b. `reenviarFirma` extiende `expira_en` mínimo 24 h.
   - 3c. UNIQUE INDEX en `firmas_tokens.token_hash`.
4. **Smoke E2E** (S1–S12) con cuenta admin no-borrar y un empleado smoke (crear cuenta `firma-smoke-empleado-no-borrar@example.com` análoga al patrón de smoke users RRHH).
5. **Cierre**: PRP-036 pasa de "PENDIENTE" a "CERRADO" en su header, handoff con todos los smokes documentados.

Estimación: **media** (1 sesión densa o 2 cortas). Dependencias: TASK-004 cerrada.

## Frentes desbloqueados

- TASK-005 reclutamiento → empleado: ya no bloqueado por TASK-004 una vez cerrada. La integración con firmas (envío automático de contrato al alta) puede planearse.
- Email automático de baja_contrato vía `aprobarSolicitud` ya está cableado en `mi-panel-actions.ts` — funcionará tras TASK-008.

## Checklist de cierre (Full-TASK-004)

- [x] `firmas-actions.ts` revisado.
- [x] Servicios `services/firmas/*` revisados (audit, crypto, email, pdf, crear-firma, baja-voluntaria-pdf).
- [x] Cron `firmas-expirar/route.ts` revisado.
- [x] Verificados contratos de storage, PDF, hash, token, OTP, eventos, expiración y permisos por empresa.
- [x] Checklist de smoke S1-S12 propuesto con variables a observar.
- [x] Variables de entorno requeridas enumeradas con propósito y valor sugerido.

## Inputs auditados

- `supabase/migrations/20260515160000_firmas_eidas.sql`
- `src/features/rrhh/actions/firmas-actions.ts` (656 líneas)
- `src/features/rrhh/services/firmas/crypto.ts`
- `src/features/rrhh/services/firmas/audit.ts`
- `src/features/rrhh/services/firmas/pdf.ts`
- `src/features/rrhh/services/firmas/email.ts`
- `src/features/rrhh/services/firmas/crear-firma.ts` (nuevo del bundle colaborador)
- `src/features/rrhh/services/firmas/baja-voluntaria-pdf.ts` (nuevo del bundle colaborador)
- `src/app/firmar/[token]/page.tsx`
- `src/app/firmar/[token]/actions.ts` (618 líneas)
- `src/app/api/cron/firmas-expirar/route.ts`
- `src/lib/supabase/proxy.ts` (PUBLIC_PREFIXES)
- `vercel.json` (cron schedule)
- `.env.local` (inventario de keys, valores ocultos)
- Management API queries: tablas, RLS, counts, bucket, empleados.estado, user_roles schema
- `.claude/PRPs/PRP-036-firmas-electronicas-eidas.md`
