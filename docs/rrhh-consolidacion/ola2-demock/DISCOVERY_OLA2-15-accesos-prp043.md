# DISCOVERY OLA2-15 - Accesos (PRP-043): versionar migracion + cerrar deuda de seguridad

- **taskId**: OLA2-15
- **Fecha discovery**: 2026-06-01
- **taskMode**: discovery+code
- **Complejidad**: Alta
- **Depende de**: ninguna (RESERVADO a Fernando)
- **reviewMode**: standard
- **sourcePlan**: docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md
- **Estado de la feature**: MIXTO + disonancia doc/codigo. Modelo nuevo (PRP-043) committeado y LIVE en `/accesos`, pero **schema no reproducible** y **RLS de revelado sin verificar**.

> **RESERVADO A FERNANDO** (decision tomada en Ola 1): es informativo/contractual, NO lo implementa un agente.
> Se documenta entero porque arrastra una **DEUDA DE SEGURIDAD URGENTE** (RLS de revelado sin `.sql` que la declare) que no debe quedar invisible. La parte de seguridad es urgente aunque la feature no se amplie.

---

## 1. Resumen del estado real

Coexisten **tres** conceptos distintos bajo el nombre "accesos", lo que genera la disonancia doc/codigo:

| # | Concepto | Ubicacion | Estado real | Tabla(s) |
|---|----------|-----------|-------------|----------|
| 1 | **Accesos a apps (LEGACY)** | `src/features/rrhh/` (`accesos-apps-actions.ts`, `AccesosView.tsx`, `accesos-apps.ts`, `accesos.io.ts`) | REAL, con RLS tenant. El PRP-043 dice que lo sustituye y lo marca `@deprecated`, pero **el codigo NO tiene marca `@deprecated`** (grep vacio). | `accesos_apps` (1 credencial/app, `roles_autorizados` como array TEXT, `contrasena` en plano). Migracion real: `060_accesos_apps.sql` + `20260517110000_accesos_apps_rls_tenant.sql`. |
| 2 | **Accesos a apps (MODELO NUEVO, PRP-043)** | `src/features/accesos/` (8 componentes + 3 actions + crypto + tipos) | REAL y **LIVE** en la ruta `/accesos`. Committeado en `0dabc84`. | `apps_externas`, `app_credenciales`, `app_credencial_roles` (3 tablas, cifrado AES-256-GCM, M:N obligatoria app_credencial -> rol). **SIN NINGUNA migracion `.sql`** (ver P0-1). |
| 3 | **Acceso al portal del empleado** | `src/features/rrhh/data/accesos-portal.ts` + `perfilSections.tsx` (`AccesosSection`) | **MOCK**. Botones "Activar/Desactivar acceso" solo cambian estado local (`useState`) + toast; **no persisten** nada. UX enganosa. | Ninguna (datos `HABANA_ACCESOS`/`BACANAL_ACCESOS` hardcoded). |

La ruta `/accesos` (`src/app/(main)/accesos/page.tsx`) importa el **modelo nuevo** (`@/features/accesos/components/AccesosView`).

---

## 2. Hallazgos P0 (bloqueantes / urgentes)

### P0-1 — SCHEMA NO REPRODUCIBLE (las 3 tablas nuevas no tienen migracion)

Comando de verificacion (ejecutado hoy):

```bash
wsl -d Ubuntu bash -c "grep -rl 'apps_externas\|app_credenciales' /home/fernandomp/dev/Balles-Hosteleros/supabase/migrations"
```

**Resultado: 0 archivos.** El DDL de `apps_externas`, `app_credenciales` y `app_credencial_roles` **solo vive dentro del PRP-043** (`.claude/PRPs/PRP-043-...md`, seccion "Modelo de Datos") y se aplico a mano sobre PROD.

Consecuencia: un entorno limpio (CI, nuevo dev, empresa nueva, recreacion de BD) **NO tiene estas tablas** y `/accesos` falla. El schema de PROD diverge de las migraciones versionadas.

### P0-2 — SEGURIDAD: RLS de revelado de credenciales SIN VERIFICAR

`src/features/accesos/actions/revelar-action.ts` descifra la contrasena confiando **100%** en la RLS de `app_credenciales`. El comentario del propio archivo lo declara explicitamente:

```ts
// La verificacion se delega al cliente Supabase del usuario: si la RLS
// `app_credenciales_tenant_role_read` rechaza la lectura, este action devuelve
// "no autorizado" sin tocar nada.
```

El action lee con el **cliente del usuario** (`getAppContext().supabase`, NO admin) y, si la fila vuelve, descifra y devuelve el plano:

```ts
const { data, error } = await supabase
  .from("app_credenciales")
  .select("password_cifrado")
  .eq("id", id)
  .maybeSingle();
// ... decrypt(data.password_cifrado)
```

**Problema**: como NO hay `.sql` que declare la RLS `app_credenciales_tenant_role_read` (consecuencia de P0-1), **no se puede confirmar que exista** ni que filtre por interseccion de roles. Si esa policy falta o solo filtra por `empresa_id`, **cualquier usuario autenticado de la empresa puede revelar cualquier credencial** pese al cifrado en reposo (el cifrado no protege: la clave esta en el server y el action descifra para quien pase la RLS). El cifrado seria seguridad teatral.

> Esta es la **deuda urgente**. Verificar/crear la RLS de interseccion de roles sobre `app_credenciales` es lo primero, por encima de cualquier ampliacion de la feature.

---

## 3. Hallazgos P1 / P2

### P1-1 — Escrituras con service role (bypass RLS), tenant/rol validado solo en codigo

`apps-actions.ts` y `credenciales-actions.ts` usan `createAdminClient()` (service role, **bypassa RLS**) para todo INSERT/UPDATE/DELETE. El aislamiento tenant y la validacion de roles se hacen **solo en TypeScript** (`.eq("empresa_id", empresaId)`, comprobacion de que la app y los roles pertenecen a la empresa). Es funcional pero significa que la unica barrera real a nivel BD para LECTURA sensible es la RLS de P0-2; si esa policy es laxa, no hay segunda linea de defensa.

### P1-2 — Disonancia `roles` vs `empresa_roles` en el DDL del PRP

El DDL del PRP-043 (linea 133) define:

```sql
rol_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
```

Pero **`public.roles` no es la tabla canonica de roles por empresa**: el codigo LIVE (`credenciales-actions.ts`, `listRolesEmpresa` en `apps-actions.ts`) usa **`empresa_roles`** (migracion `088_empresa_roles_unique_nombre.sql`), y el join real es `app_credencial_roles -> empresa_roles`. Quien ejecute el SQL del PRP **literal** crearia una FK contra `roles(id)` que no corresponde al modelo real -> fallaria o quedaria inconsistente. La migracion a versionar debe usar `empresa_roles(id)`.

### P1-3 — Acceso al portal del empleado es MOCK (UX enganosa)

`AccesosSection` (`perfilSections.tsx`, l.185+): `activar`/`desactivar` hacen `setEstado(...)` + `toast.success(...)` y **nada mas**. No hay action, no hay tabla, no persiste. El usuario cree que activo/desactivo el acceso de un empleado al portal y no ocurrio nada.

### P1-4 — Clave de cifrado sin provision documentada ni rotacion

`src/features/accesos/lib/crypto.ts` exige `process.env.CREDENCIALES_ENCRYPTION_KEY` (64 chars hex = 32 bytes). Sin ella, `encrypt`/`decrypt` lanzan error y crear/revelar fallan. **No aparece en `.env.example`** (grep vacio) y **no hay procedimiento de rotacion**: si la clave cambia, todas las credenciales cifradas se vuelven ilegibles (el PRP lo menciona como "Fase 7 opcional" pero no esta resuelto).

### P2-1 — Documentos desactualizados

- **PRP-043**: cabecera dice `Estado: PENDIENTE` y pie "PRP pendiente aprobacion. No se ha modificado codigo." — falso: esta implementado y live (commit `0dabc84`).
- **`docs/rrhh-consolidacion/TASK-006-accesos-apps-exclusion-y-remediacion.md`**: `Estado: Pendiente fuera de ola`; describe el escenario **legacy** (`060_accesos_apps.sql`) sin implementar la remediacion; `sourcePlan` apunta al `EXECUTION_PLAN.md` viejo. No refleja que el modelo nuevo ya existe.

---

## 4. Cifrado (verificado en `src/features/accesos/lib/crypto.ts`)

- Algoritmo: **AES-256-GCM**.
- Clave: `CREDENCIALES_ENCRYPTION_KEY` (debe ser 64 chars hex; se valida la longitud).
- IV: 12 bytes aleatorios por cifrado.
- Formato almacenado: `${iv_base64}:${authTag_base64}:${cipher_base64}` (3 partes separadas por `:`).
- `import "server-only"` arriba (impide bundling cliente). Correcto.
- API: `encrypt(plain): string` / `decrypt(stored): string`.

El cifrado en si esta bien implementado. **El riesgo no es el cifrado, es quien puede pedir el descifrado** (P0-2).

---

## 5. Evidencia de codigo (paths verificados)

- `src/features/accesos/actions/revelar-action.ts` — endpoint de revelado (P0-2).
- `src/features/accesos/actions/credenciales-actions.ts` — CRUD credenciales; usa `empresa_roles` (P1-2), `createAdminClient` (P1-1).
- `src/features/accesos/actions/apps-actions.ts` — CRUD apps + `listRolesEmpresa` (lee `empresa_roles`).
- `src/features/accesos/lib/crypto.ts` — AES-256-GCM.
- `src/features/accesos/data/tipos.ts` — schemas Zod (`credencialSchema` exige `roles_ids.min(1)`).
- `src/app/(main)/accesos/page.tsx` — monta el modelo nuevo.
- `src/features/rrhh/actions/accesos-apps-actions.ts` + `.../data/accesos-apps.ts` — LEGACY (sin marca `@deprecated`).
- `src/features/rrhh/data/accesos-portal.ts` + `.../components/empleados/perfilSections.tsx` (`AccesosSection`) — portal MOCK (P1-3).
- `supabase/migrations/20260517110000_accesos_apps_rls_tenant.sql` — patron RLS tenant (UNION `user_empresas` U `profiles.empresa_id`) a replicar en las 3 tablas nuevas.
- `supabase/migrations/088_empresa_roles_unique_nombre.sql` — tabla canonica de roles (`empresa_roles`).
- `.claude/PRPs/PRP-043-gestor-credenciales-apps-permisos-por-rol.md` — unica fuente del DDL (sin versionar).

---

## 6. Conclusion del discovery

La feature **funciona en PROD** pero descansa sobre dos cimientos sin verificar:

1. Un **schema fantasma** (3 tablas sin `.sql`) que rompe cualquier entorno limpio.
2. Una **RLS de revelado que nadie puede auditar** porque no esta versionada, y de la que depende la confidencialidad de todas las credenciales.

El contrato ejecutable (RESERVADO a Fernando) esta en `Full-TASK-OLA2-15-accesos-prp043-reservado-fernando.md`. Su **primer paso obligatorio** es verificar el schema y la RLS reales de PROD via Management API antes de escribir ninguna migracion.
