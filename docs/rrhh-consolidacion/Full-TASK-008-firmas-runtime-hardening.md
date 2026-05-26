# Full-TASK-008 - Firmas runtime hardening

## Estado

Pendiente.

## Objetivo

Cerrar el flujo de firmas eIDAS como sistema operativo en producción. El módulo está implementado al ~95% (PRP-036 fases 1-7 presentes en código + BD + bucket) pero no usable hoy por env vars faltantes y 3 race conditions concretas. Esta task hace los 4 fixes mínimos, ejecuta smoke E2E controlado en BACANAL y formaliza el cierre del PRP-036.

## Estimación de complejidad

Media. Mucho trabajo está hecho; queda configurar entorno, 3 fixes acotados de código (~150 líneas en total) y un smoke E2E exhaustivo.

## Criterio de corte

Sistema usable end-to-end por admin + empleado real en BACANAL, con smoke S1-S12 documentado y hash chain verificable. PRP-036 cerrado.

## Modo operativo

- taskId: TASK-008
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-consolidacion/TASK-008-firmas-runtime-hardening.md
- sourceDiscovery: docs/rrhh-consolidacion/DISCOVERY_TASK004_2026-05-26.md

## Contexto previo obligatorio

- Leer `docs/rrhh-consolidacion/DISCOVERY_TASK004_2026-05-26.md` completo (las 4 secciones de gaps).
- Revisar `.claude/PRPs/PRP-036-firmas-electronicas-eidas.md` sección "Gotchas" y "Anti-Patrones" — están vivos y deben respetarse.
- Confirmar que las cuentas smoke RRHH siguen activas (`docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`).
- Acceso a Vercel project settings para configurar env vars en los 3 entornos.

## Scope IN

### Bloque 1 — Variables de entorno (~15 min)

| Variable | Origen del valor | Dónde configurar |
|----------|------------------|------------------|
| `FIRMA_TOKEN_PEPPER` | `openssl rand -base64 48` (≥32 chars) | `.env.local` + Vercel (Production, Preview, Development) |
| `FIRMA_OTP_PEPPER` | `openssl rand -base64 48` (distinto al anterior) | Igual |
| `RESEND_API_KEY` | Resend dashboard | Verificar primero el transport real de `src/lib/email/send.ts`; si usa Resend, configurar. Si tiene fallback, documentarlo |
| `RESEND_FROM_EMAIL` | Email con DKIM/SPF configurado en dominio empresa | Igual. Default sugerido: `firmas@balleshosteleros.com` |
| `NEXT_PUBLIC_APP_URL` | URL del deploy actual | Vercel: prod `https://app.balleshosteleros.com`, preview `https://...vercel.app` por entorno |

⚠️ Los peppers deben ser **idénticos** entre entornos que compartan BD (un token hasheado con un pepper es inválido con otro). Distintos entre prod y staging si las BDs son separadas.

### Bloque 2 — Race condition fixes (~2-3 h)

#### R1: Token consumido tardío en `firmarDocumento`

**Archivo**: `src/app/firmar/[token]/actions.ts:362-528`

**Cambio**: al principio de `firmarDocumento`, antes de cualquier otra acción, hacer compare-and-swap del token:

```ts
const { data: tokenUpdated, error } = await admin
  .from("firmas_tokens")
  .update({ consumido_en: new Date().toISOString() })
  .eq("id", res.tokenRow.id)
  .is("consumido_en", null)
  .select("id")
  .maybeSingle();

if (error || !tokenUpdated) {
  return { ok: false, error: "Este enlace ya se está usando para firmar. Recarga la página." };
}
```

Eliminar la marca de consumido_en al final (líneas 497-500), ya hecho al principio.

**Si falla algún paso posterior**: revertir con `UPDATE firmas_tokens SET consumido_en = NULL WHERE id = ?`. O dejar marcado (decisión: token consumido es destructivo; mejor recovery manual desde admin que rollback automático que pueda introducir otra race). Documentar en comentario.

#### R2: Hash chain por timestamp ambiguo

**Migración nueva**: `supabase/migrations/2026MMDDHHMMSS_firmas_eventos_add_seq.sql`

```sql
-- Añade columna seq para orden determinista sin depender de ocurrido_en
alter table public.firmas_eventos
  add column if not exists seq integer;

-- Backfill: asigna seq basado en ocurrido_en para eventos existentes
update public.firmas_eventos t
set seq = sub.row_num
from (
  select id, row_number() over (partition by documento_id order by ocurrido_en, id) as row_num
  from public.firmas_eventos
) sub
where t.id = sub.id and t.seq is null;

alter table public.firmas_eventos
  alter column seq set not null;

create unique index if not exists uniq_firmas_eventos_doc_seq
  on public.firmas_eventos(documento_id, seq);
```

**Archivo**: `src/features/rrhh/services/firmas/audit.ts:32-78`

Cambiar `registrarEvento` para obtener `seq = max(seq) + 1` en el mismo INSERT, o usar advisory lock por documento. Patrón recomendado:

```ts
// Dentro de la función, antes del INSERT:
const { data: maxSeqRow } = await admin
  .from("firmas_eventos")
  .select("seq")
  .eq("documento_id", input.documentoId)
  .order("seq", { ascending: false })
  .limit(1)
  .maybeSingle();
const nextSeq = (maxSeqRow?.seq ?? 0) + 1;

// El INSERT añade seq: nextSeq
// El UNIQUE INDEX detectará colisión → reintento o error
```

Si colisiona el UNIQUE, retornar error claro o reintentar (decisión del implementador; el reintento es seguro porque el INSERT es idempotente sobre el documento si los inputs son los mismos).

**Verificación de chain**: `audit.verificarCadena` no requiere cambios; el orden cambia de `ocurrido_en` a `seq` en `listarEventos` (línea 99 — cambiar `order by ocurrido_en` a `order by seq`).

#### R3: OTP por created_at ambiguo

**Archivo**: `src/app/firmar/[token]/actions.ts`

Cambiar `solicitarOTP` para devolver el `otp_id` en su resultado:

```ts
return {
  ok: true,
  otpId: insertedOtpId, // nuevo campo
  destinoEnmascarado: ...,
  expiraMin: OTP_TTL_MIN,
};
```

`validarOTP` acepta `otp_id` opcional. Si presente, lo usa en el WHERE en vez de `order created_at desc limit 1`. Si ausente (compatibilidad temporal), usa el orden actual.

El cliente (FirmaPublicaView) guarda el `otp_id` en estado y lo pasa al validar.

### Bloque 3 — Robustez (opcional, mismo PR si cabe)

- **3a**: Reordenar upload→INSERT en `crearFirma` y `crearFirmaInterno`. Path temporal: `${empresa_id}/temp/${nanoid()}.pdf` → INSERT doc → MOVE storage a `${empresa_id}/${doc_id}/original.pdf` → UPDATE path. Si falla cualquier paso, rollback de los anteriores.
- **3b**: `reenviarFirma` antes del INSERT del nuevo token, calcular:

  ```ts
  const minExpira = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expira = new Date(doc.expira_en as string);
  const expiraEfectiva = expira > minExpira ? expira : minExpira;
  // si extendemos, también UPDATE firmas_documentos.expira_en
  ```

- **3c**: Migración correctiva `UNIQUE INDEX` en `firmas_tokens.token_hash`.

### Bloque 4 — Smoke E2E S1-S12 (~1-2 h)

Ejecutar con dev server local o preview Vercel. Crear empleado smoke si no existe:

```sql
-- en Supabase SQL editor o vía Management API
-- 1. Crear usuario en auth.users
-- 2. Asignar empresa (HABANA, BACANAL)
-- 3. Crear empleado vinculado a user_id
-- ID sugerido: firma-smoke-empleado-no-borrar@example.com
```

Cada smoke comprobar en BD vía Management API o dashboard:

| # | Smoke | Verificación |
|---|-------|--------------|
| S1 | Admin crea firma + envío | Email recibido, doc estado='pendiente', eventos `creado` + `enviado` en `firmas_eventos`, PDF en bucket `firmas/{empresa_id}/{doc_id}/original.pdf` |
| S2 | Empleado abre `/firmar/<token>` | Evento `abierto`, visor carga, HTML no expone token plain (inspect) |
| S3 | Empleado solicita OTP | Email con código, evento `otp_enviado` con `destinoEnmascarado`, registro en `firmas_otps` con `codigo_hash` (no plain) |
| S4 | OTP correcto | Evento `otp_validado`, `firmas_otps.validado_en` seteado |
| S5 | OTP incorrecto 3 veces | 2× `otp_fallido` + 1× `otp_bloqueado`, `bloqueado_hasta=now+30min`. 4º intento bloqueado |
| S6 | Firmar (click_to_sign) | Evento `firmado`, doc.estado='firmado', sha256_acta presente, `pdf_firmado_path` apunta a archivo, token `consumido_en` seteado. Email con descarga llega |
| S7 | Reusar token tras firmar | `/firmar/<mismo_token>` muestra "Enlace ya utilizado", razón `consumed` |
| S8 | Rechazar otro doc | doc.estado='rechazado', motivo persistido, evento `rechazado` |
| S9 | Reenviar doc pendiente | Tokens viejos eliminados (SELECT count → 0 del doc), nuevo token, email recibido, evento `reenviado` |
| S10 | Cron expirar manual | `curl -H "Authorization: Bearer $CRON_SECRET" https://<deploy>/api/cron/firmas-expirar` → docs vencidos pasan a expirado, eventos registrados |
| S11 | Verificar hash chain | Llamar `audit.verificarCadena(docId, eventos)` desde server action de prueba → `{ok: true}` |
| S12 | Multitenant | Con sesión HABANA, `listFirmas()` no devuelve docs BACANAL (RLS rechaza) |

### Bloque 5 — Cierre PRP-036

- Actualizar header de `PRP-036-firmas-electronicas-eidas.md`: `Estado: PENDIENTE → CERRADO 2026-MM-DD`.
- Añadir entradas en la sección "Aprendizajes (Self-Annealing)" si los fixes/smoke revelaron algo no documentado.
- Escribir handoff `docs/rrhh-consolidacion/HANDOFF_TASK008_FIRMAS_RUNTIME_<fecha>.md` con: commits, env vars configuradas (sin valores), resultados de S1-S12, links a artefactos del smoke (capturas DB, logs Vercel relevantes).

## Scope OUT

- No reescribir crypto, audit, pdf ni email salvo los fixes específicos.
- No subir a eIDAS Avanzada / Cualificada.
- No integrar SMS provider.
- No tocar la UI más allá de exponer `otp_id` en R3.
- No añadir métricas/dashboards.
- No tocar otros módulos.

## Restricciones

- **No revelar peppers en commits, handoff ni logs**. Solo en `.env.local` (no versionado) y Vercel env vars (cifradas).
- **No comer downtime** durante el smoke en prod: usar la cuenta `no-borrar` que ya tiene scope acotado.
- **Hash chain debe seguir verificable** tras la migración R2: si los eventos existentes pierden orden válido por backfill mal hecho, deshacer migración antes de aplicar.
- **PDFs reales**: usar un PDF de prueba (no datos sensibles reales) para los smokes.
- **No skip hooks** (`--no-verify`).
- **Commits terminan con `_FernandoClaude`** (hook automático).

## Validación requerida

- `npm run typecheck` ✅
- `npm run build` ✅
- 12 smokes ✅
- Verificación manual hash chain ✅
- Push directo a main tras validación ([feedback-balles-push-main-tras-validacion]).

## Dependencias

- TASK-004 (discovery) cerrada ✅
- BD prod con tablas firmas existentes y vacías ✅
- Cuenta admin no-borrar disponible ✅
- Acceso a Vercel project settings (usuario humano lo gestiona)
- Resend account configurada o transport alternativo definido

## Inputs

- `docs/rrhh-consolidacion/DISCOVERY_TASK004_2026-05-26.md` (este es el plano)
- `.claude/PRPs/PRP-036-firmas-electronicas-eidas.md`
- `src/features/rrhh/services/firmas/*` (audit.ts, crypto.ts, pdf.ts, email.ts, crear-firma.ts, baja-voluntaria-pdf.ts)
- `src/features/rrhh/actions/firmas-actions.ts`
- `src/app/firmar/[token]/{page.tsx,actions.ts,FirmaPublicaView.tsx,VisorPdfInteractivo.tsx,VisorPdfLimpio.tsx}`
- `src/app/api/cron/firmas-expirar/route.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/email/send.ts` (verificar transport)
- `vercel.json`
- `scripts/supabase-mgmt-query.sh` (para smokes y backfill)

## Outputs esperados

- Migración nueva: `supabase/migrations/2026MMDDHHMMSS_firmas_eventos_add_seq.sql` (R2)
- Migración opcional: `supabase/migrations/2026MMDDHHMMSS_firmas_tokens_unique_token_hash.sql` (3c)
- Código modificado en `actions.ts` (R1, R3), `audit.ts` (R2), `firmas-actions.ts` y `crear-firma.ts` (3a, 3b)
- `.env.local` con 4 vars nuevas (NO versionado, solo local)
- Vercel env vars en 3 entornos
- Handoff: `docs/rrhh-consolidacion/HANDOFF_TASK008_FIRMAS_RUNTIME_<fecha>.md`
- PRP-036 con header actualizado a CERRADO
- Aprendizajes Self-Annealing añadidos a PRP-036 si aplican

## Riesgos conocidos

- **Backfill de `seq` en `firmas_eventos`**: la BD prod tiene 0 eventos hoy, así que el backfill es no-op. Si entre la decisión de esta task y su ejecución alguien crea firmas, el backfill debe correrse con cuidado de no romper la chain existente. **Mitigación**: aplicar la migración temprano si no hay datos.
- **Compare-and-swap de token (R1)**: si el UPDATE retorna 0 filas pero el flujo continúa por bug, podríamos firmar sin haber marcado consumido. **Mitigación**: `if (!tokenUpdated) return error` estricto, sin fallback.
- **Resend rate limit**: 100 req/min en plan free. Smoke S1+S3+S6 generan 3 emails. Smokes S5+S9 generan otro extra. Total ~10 emails — sin riesgo. Documentar para escalado.
- **Cron en preview**: el cron de Vercel solo corre en Production según docs. Para smoke S10, llamar manualmente con curl autenticado.
- **Empleado smoke sin user_id**: si se crea solo en `empleados` sin alta en `auth.users`, RLS de `firmas_documentos.fd_select_empleado` falla (lee `empleados.user_id`). **Mitigación**: hacer alta completa del empleado smoke con sign-up real.

## Artefactos relacionados

- `docs/rrhh-consolidacion/DISCOVERY_TASK004_2026-05-26.md`
- `.claude/PRPs/PRP-036-firmas-electronicas-eidas.md`
- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`

## Paths del proyecto

- `src/features/rrhh/services/firmas/audit.ts`
- `src/features/rrhh/services/firmas/crypto.ts`
- `src/features/rrhh/services/firmas/crear-firma.ts`
- `src/features/rrhh/actions/firmas-actions.ts`
- `src/app/firmar/[token]/actions.ts`
- `src/app/firmar/[token]/FirmaPublicaView.tsx`
- `src/app/api/cron/firmas-expirar/route.ts`
- `src/lib/email/send.ts`
- `supabase/migrations/` (2 migrations nuevas)
- `.env.local` (NO versionado)

## Agentes recomendados

- `ejecutor` para los fixes de código.
- `detective` si surgen errores opacos en el smoke.
- `planificador` no aplica (ya descompuesto).

## Checklist de cierre

- [ ] 4 env vars añadidas a `.env.local` y a Vercel (3 entornos).
- [ ] Migración `firmas_eventos_add_seq` aplicada en prod via `scripts/supabase-mgmt-query.sh`.
- [ ] Migración opcional `firmas_tokens_unique_token_hash` aplicada (si se incluye).
- [ ] R1 (token consumido tardío) implementado, tested manualmente con dos requests simultáneos.
- [ ] R2 (hash chain seq) implementado, `audit.verificarCadena` sigue verde en chain existente y nueva.
- [ ] R3 (otp_id explícito) implementado, validado con cliente.
- [ ] Smokes S1-S12 documentados con resultado.
- [ ] `npm run typecheck` ✅
- [ ] `npm run build` ✅
- [ ] Cuenta empleado smoke creada (vinculada a auth.users + empleados + user_empresas).
- [ ] Hash chain del documento del smoke verificada explícitamente.
- [ ] PRP-036 header marcado CERRADO con fecha.
- [ ] Self-Annealing del PRP-036 actualizado con cualquier aprendizaje.
- [ ] Handoff escrito y commiteado.
- [ ] Push a main empujado.

## Modelo de datos

Sin cambios en tablas existentes salvo la columna `seq` añadida a `firmas_eventos` (R2). UNIQUE en `firmas_tokens.token_hash` (3c, opcional).

## Interfaces públicas que cambian

- `solicitarOTP` retorna ahora `{ ok, otpId, destinoEnmascarado, expiraMin }` en lugar de `{ ok, destinoEnmascarado, expiraMin }`.
- `validarOTP` acepta nuevo parámetro opcional `otpId`. Backward compatible.
- `audit.registrarEvento` interface externa sin cambios. Interno: nuevo campo `seq` en INSERT.
- `audit.listarEventos` ahora ordena por `seq` (semánticamente equivalente al orden cronológico existente).

## Flujo operativo esperado

1. **Setup env vars** (humano + Claude):
   - Generar peppers con `openssl rand -base64 48` × 2.
   - Añadir a `.env.local`.
   - Añadir a Vercel project settings (3 entornos).
   - Verificar transport email + añadir Resend keys si aplica.
   - Confirmar `NEXT_PUBLIC_APP_URL` por entorno.

2. **Aplicar migración R2 + opcional 3c** (Claude vía Management API):
   - Sanity check: count de `firmas_eventos` (debe ser 0 en prod).
   - Aplicar migración seq.
   - Sanity check: columna seq existe y UNIQUE creado.
   - Si incluye 3c: aplicar UNIQUE sobre token_hash, verificar sin colisiones.

3. **Implementar R1+R2+R3** (Claude):
   - Editar archivos según patrón documentado.
   - Validar `npm run typecheck` y `npm run build`.
   - Commit por bloque o uno solo.

4. **Crear empleado smoke** (Claude vía Management API + sign-up):
   - Sign-up `firma-smoke-empleado-no-borrar@example.com`.
   - Asignar empresa BACANAL en `user_empresas`.
   - Crear fila `empleados` vinculada con email y nombre.
   - Documentar en `SMOKE_USERS_RRHH.md`.

5. **Smoke E2E S1-S12** (humano + Claude):
   - Para cada smoke: ejecutar acción + verificar BD + screenshot/snapshot del resultado.
   - Documentar cualquier fricción en handoff.

6. **Cierre** (Claude):
   - Actualizar PRP-036 header.
   - Escribir handoff con resultados.
   - Commit + push.

## Notas técnicas

- Esta task se beneficia del helper `scripts/supabase-mgmt-query.sh` creado en TASK-007 para aplicar las migraciones y para los smokes.
- El humano debe confirmar las 4 env vars al inicio antes de que Claude empiece (especialmente Resend account y APP_URL exactas).
- Si un smoke falla por motivos no contemplados, retomar este Full-TASK añadiendo al final una sección "Aprendizajes" antes de pasar a otra task.

## Resultado validado

(Se rellena al cerrar.)

## Duración real

(Se rellena al cerrar.)

## Ruta canónica

docs/rrhh-consolidacion/Full-TASK-008-firmas-runtime-hardening.md
