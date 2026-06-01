# Full-TASK-OLA2-15 - Accesos (PRP-043) RESERVADO FERNANDO

## Estado
PLANIFICADO (Ola 2 de-mock, 2026-06-01). **RESERVADO A FERNANDO** (humano): es informativo/contractual, **NO lo implementa un agente**. Discovery en `DISCOVERY_OLA2-15-accesos-prp043.md`.

> **DEUDA DE SEGURIDAD URGENTE.** El modelo nuevo (PRP-043) esta committeado y LIVE en `/accesos`, pero arrastra dos hallazgos P0 que no deben quedar invisibles: (P0-1) las 3 tablas nuevas no tienen NINGUNA migracion `.sql` (schema no reproducible) y (P0-2) el revelado de contrasenas confia en una RLS de interseccion de roles que **no esta versionada y no se puede confirmar que exista**. Si esa RLS falta o es laxa, cualquier usuario autenticado de la empresa puede revelar cualquier credencial pese al cifrado. **Verificar/crear esa RLS es lo urgente, aunque la feature no se amplie.**

## Objetivo
Convertir la feature de accesos a apps de "funciona en PROD pero no es reproducible ni auditable" a "reproducible, segura y documentada", **sin ampliar funcionalidad de producto**. En concreto: (1) versionar en `.sql` el schema real de las 3 tablas (`apps_externas`, `app_credenciales`, `app_credencial_roles`) y, sobre todo, (2) verificar/crear y versionar la **RLS de interseccion de roles** de la que depende el revelado seguro de credenciales. Secundariamente: provisionar/documentar la clave de cifrado y su rotacion, retirar el modelo legacy de forma controlada, persistir (o retirar) el mock de "acceso al portal" del empleado, y sincronizar la documentacion (PRP-043 / TASK-006) con la realidad.

## Estimacion de complejidad
Alta. No por volumen (las actions y la UI ya existen), sino por: (a) trabajar sobre una feature **viva en PROD** cuyo schema diverge de las migraciones; (b) la pieza critica es **seguridad** (RLS de revelado) y un error deja credenciales sensibles expuestas o, al reves, rompe el acceso legitimo; (c) verificacion obligatoria del schema/RLS reales via Management API antes de escribir nada (no inferir del codigo); (d) coordinacion con el modelo de roles (`empresa_roles`) y con la relacion usuario->rol para la subquery RLS; (e) retirada de legacy sin perder datos; (f) decisiones de negocio abiertas (auditoria de revelados, momento de retirar legacy). Riesgo alto por ser PROD + datos sensibles.

## Criterio de corte
- Existe migracion `.sql` versionada que crea `apps_externas`, `app_credenciales` y `app_credencial_roles` con FKs (contra `empresa_roles`, NO `roles`), indices y RLS, **idempotente** (`IF NOT EXISTS` / `CREATE POLICY` con guardas) y aplicable sobre un entorno limpio sin romper el PROD ya migrado.
- `grep -rl 'apps_externas\|app_credenciales' supabase/migrations` -> **al menos 1 archivo** (hoy: 0).
- La RLS de SELECT sobre `app_credenciales` esta versionada y **exige interseccion de roles** del usuario en la empresa activa (no solo `empresa_id`). Verificado en BD: un usuario sin rol autorizado **no** lee la fila ni siquiera via query directa con su token.
- `revelar-action.ts` sigue devolviendo el plano **solo** cuando la RLS lo permite; smoke con dos roles confirma que un usuario sin rol autorizado recibe "No autorizado" (no leak).
- `CREDENCIALES_ENCRYPTION_KEY` documentada (generacion + dónde vive + presencia en PROD/Vercel) y con procedimiento de rotacion escrito; nunca versionada.
- Decision tomada y aplicada sobre el legacy (`accesos_apps` + `src/features/rrhh/...accesos*`): retirar o marcar `@deprecated` de verdad en el codigo.
- Decision tomada sobre el mock de "acceso al portal" del empleado (`AccesosSection`): persistir contra tabla real o retirar el control enganoso.
- Docs sincronizados: PRP-043 cabecera/pie -> `IMPLEMENTADO`; `TASK-006` cerrada o redirigida al estado real.
- Donde haya cambios de codigo: `npm run typecheck` y `npm run build` verdes (WSL NON-login).

## Modo operativo
(taskId: OLA2-15 / taskMode: discovery+code / reviewMode: standard / sourcePlan: docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md)

## Contexto previo obligatorio
1. Leer `DISCOVERY_OLA2-15-accesos-prp043.md` (estado real: 3 conceptos "accesos", los 2 P0, disonancia `roles`/`empresa_roles`, mock del portal).
2. Leer `.claude/PRPs/PRP-043-gestor-credenciales-apps-permisos-por-rol.md` (unica fuente del DDL; **OJO**: su DDL usa `roles(id)`, que es incorrecto — el real es `empresa_roles(id)`).
3. Leer `src/features/accesos/actions/revelar-action.ts` y `lib/crypto.ts`: entender que el revelado lee con el **cliente del usuario** y confia en la RLS `app_credenciales_tenant_role_read`.
4. Leer `src/features/accesos/actions/credenciales-actions.ts` y `apps-actions.ts`: confirmar el uso de `createAdminClient` (escrituras) y de `empresa_roles` (lectura de roles).
5. Leer `supabase/migrations/20260517110000_accesos_apps_rls_tenant.sql`: patron RLS tenant multiempresa (UNION `user_empresas` U `profiles.empresa_id`) a replicar en las 3 tablas.
6. Leer `supabase/migrations/088_empresa_roles_unique_nombre.sql` (tabla canonica de roles) y localizar la relacion usuario->rol en la empresa activa (revisar `src/features/ajustes/actions/roles-actions.ts` — usa `.eq('user_id', ...)`) para construir la subquery de interseccion.
7. Criterios globales Ola 2: RLS multi-tenant real, UUID no slug, **verificar schema PROD via Management API antes de migrar** (regla de memoria del proyecto: inferir del codigo rompe datos), placeholder honesto donde falte backend.

## Scope IN
- **Verificar** via Management API el DDL y TODAS las policies reales de PROD de `apps_externas`, `app_credenciales`, `app_credencial_roles` (PASO 1, antes de escribir nada).
- **Versionar** una migracion `.sql` que reproduzca exactamente el schema real verificado (tablas + FKs a `empresa_roles` + indices + RLS), idempotente.
- **Cerrar la deuda de seguridad de revelado**: confirmar que existe (o crear) la RLS de SELECT sobre `app_credenciales` que filtra por **tenant + interseccion de roles**; versionarla. Si falta, es un fix de seguridad, no una mejora.
- **Provisionar/documentar** `CREDENCIALES_ENCRYPTION_KEY` (generacion `openssl rand -hex 32`, presencia en `.env.local` + Vercel preview/prod) y escribir el procedimiento de **rotacion**.
- **Retirar legacy** de forma controlada: decidir y aplicar la retirada o el `@deprecated` real de `accesos_apps` y `src/features/rrhh/...accesos*` (hoy NO esta marcado en codigo); plan de borrado tras confirmar que no quedan consumidores.
- **Acceso al portal del empleado**: persistir el control de `AccesosSection` contra una tabla/estado real, o retirar los botones enganosos.
- **Sincronizar docs**: PRP-043 (Estado/pie) y TASK-006 al estado real.

## Scope OUT
- NO ampliar la funcionalidad de producto del modelo nuevo (la UI, el grid, el drawer y el CRUD ya existen y funcionan): esto NO es construir features, es **reproducibilidad + seguridad + documentacion**.
- NO reescribir el cifrado (`crypto.ts` esta correcto).
- NO migrar de nuevo los datos legacy si ya se migraron en su dia (verificar primero); el scope es retirar/deprecar, no re-migrar.
- NO crear sistema de auditoria de revelados en esta task salvo decision explicita (DN-2); el PRP lo deja fuera de scope.
- NO tocar `roles`/`empresa_roles` mas alla de la FK correcta; el modelo de roles es de OLA2-10.
- NO versionar la clave de cifrado, peppers ni service-role.

## Restricciones
- **RESERVADO A FERNANDO**: ningun agente ejecuta esta task. Si un agente la encuentra, solo puede actualizar este contrato/discovery, nunca tocar `src/features/accesos`, las migraciones ni PROD.
- **Verificar schema real en PROD via Management API antes de migrar** (no inferir del codigo: la regla de memoria del proyecto es explicita; inferir rompe datos). Marcar todo lo no verificado como VERIFICAR-SCHEMA-REAL.
- La migracion debe ser **idempotente** y no destructiva sobre el PROD ya migrado (`CREATE TABLE IF NOT EXISTS`, policies con `DROP POLICY IF EXISTS` previo o `DO $$`).
- FK de `app_credencial_roles.rol_id` contra **`empresa_roles(id)`**, NUNCA `roles(id)`.
- RLS multi-tenant real (UNION `user_empresas` U `profiles.empresa_id`); para `app_credenciales` ademas interseccion de roles. Nada de `using(true)`.
- Mantener `revelar-action.ts` leyendo con el **cliente del usuario** (no admin) para que la RLS siga siendo la barrera; si se cambia a admin habria que reimplementar la verificacion de roles en codigo.
- Si se toca codigo: commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes (pero esto lo decide/ejecuta Fernando).
- No versionar `CREDENCIALES_ENCRYPTION_KEY`; vive en `.env.local` y Vercel.

## Validacion requerida
- **Verificacion PROD (Management API)** ANTES de migrar: dump del DDL real y de `pg_policies` para las 3 tablas; confirmar si existe la policy de interseccion de roles sobre `app_credenciales`.
- `grep -rl 'apps_externas\|app_credenciales' supabase/migrations` -> deja de ser vacio.
- **Smoke de seguridad (lo critico)**: con dos usuarios de la misma empresa y distinto rol, query directa a `app_credenciales` con el token de cada uno via MCP/REST -> el usuario sin rol autorizado **no** recupera la fila; `revelarCredencial(id)` con ese usuario devuelve `{ ok:false, error:"No autorizado" }` y el que si tiene rol obtiene el plano correcto.
- Smoke tenant: usuario de otra empresa no ve nada de la primera.
- Tras aplicar la migracion en un entorno limpio: `/accesos` carga, se puede crear app + credencial (con rol obligatorio) y revelar.
- Si hay cambios de codigo: `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run typecheck"` y `... && npm run build"` -> verdes.
- `review-rls-multi-tenant` sobre las 3 tablas (aislamiento por `empresa_id` + interseccion de roles en `app_credenciales`).

## Dependencias
- Entrantes (bloquean): **ninguna** dura — la task esta RESERVADA y puede arrancar cuando Fernando quiera. La parte de seguridad (RLS de revelado) es urgente con independencia del resto.
- Coordinacion (no bloqueo): **OLA2-10** (roles) define `empresa_roles` y la relacion usuario->rol; la subquery RLS de interseccion debe alinearse con ese modelo. **OLA2-09** (ficha de empleado) solo **lee** accesos; no bloquea.
- Salientes: ninguna task depende de OLA2-15.

## Inputs
- `DISCOVERY_OLA2-15-accesos-prp043.md` (estado real + P0/P1).
- `.claude/PRPs/PRP-043-gestor-credenciales-apps-permisos-por-rol.md` (DDL fuente — corregir `roles` -> `empresa_roles`).
- `src/features/accesos/actions/{revelar-action,credenciales-actions,apps-actions}.ts`.
- `src/features/accesos/lib/crypto.ts`, `src/features/accesos/data/tipos.ts`.
- `src/app/(main)/accesos/page.tsx`.
- `supabase/migrations/20260517110000_accesos_apps_rls_tenant.sql` (patron RLS tenant), `060_accesos_apps.sql` (legacy), `088_empresa_roles_unique_nombre.sql` (roles canonicos).
- `src/features/rrhh/{actions/accesos-apps-actions.ts,data/accesos-apps.ts,components/AccesosView.tsx,io/accesos.io.ts}` (legacy a retirar/deprecar).
- `src/features/rrhh/data/accesos-portal.ts` + `src/features/rrhh/components/empleados/perfilSections.tsx` (`AccesosSection`, mock del portal).
- Dump real de schema/RLS de PROD (a obtener via Management API en el PASO 1).

## Outputs esperados
- Migracion `.sql` nueva (p.ej. `supabase/migrations/<TS>_accesos_prp043_schema_y_rls.sql`) que versiona las 3 tablas + indices + FKs (`empresa_roles`) + RLS tenant + **RLS interseccion de roles** en `app_credenciales`, idempotente.
- (Si faltaba) la policy de seguridad de revelado creada y versionada.
- Documentacion de `CREDENCIALES_ENCRYPTION_KEY` (generacion, ubicacion, rotacion) — en notas internas/env example sin el valor.
- Legacy `accesos_apps` / `src/features/rrhh/...accesos*` retirado o marcado `@deprecated` real en codigo, con plan de borrado.
- `AccesosSection` del portal persistido o retirado (sin botones enganosos).
- PRP-043 y TASK-006 actualizados al estado real.

## Riesgos conocidos
> Encabezan los **dos P0** (lo urgente):

- **[P0-1] Schema no reproducible**: `apps_externas`/`app_credenciales`/`app_credencial_roles` no tienen `.sql` (grep = 0). Un entorno limpio o empresa nueva no las tiene y `/accesos` rompe; el PROD diverge de las migraciones. Mitigacion: versionar el schema **real verificado** (no el del PRP, que tiene la FK mal).
- **[P0-2] RLS de revelado sin verificar (exposicion de credenciales)**: `revelar-action.ts` descifra confiando en la RLS `app_credenciales_tenant_role_read`, que no esta versionada -> no se puede confirmar que exista ni que filtre por interseccion de roles. Si falta/es laxa, cualquier autenticado de la empresa revela cualquier credencial pese al cifrado. Mitigacion: verificar `pg_policies` en PROD y, si falta, crear+versionar la policy de interseccion ANTES de cualquier otra cosa.
- **[P1] FK incorrecta en el PRP**: el DDL del PRP usa `roles(id)`; el real es `empresa_roles(id)`. Ejecutar el SQL del PRP literal romperia. Mitigacion: versionar contra `empresa_roles`.
- **[P1] Escrituras con service role**: el CRUD usa `createAdminClient` (bypassa RLS) validando tenant/rol solo en codigo; la unica barrera BD para lectura sensible es la RLS de P0-2. Mitigacion: blindar esa RLS; opcionalmente revisar gating de escritura por permiso de modulo.
- **[P1] Mock del portal enganoso**: `AccesosSection` "activa/desactiva" acceso solo en `useState` + toast; no persiste. Mitigacion: persistir o retirar.
- **[P2] Rotacion de clave**: cambiar `CREDENCIALES_ENCRYPTION_KEY` deja ilegibles las credenciales existentes. Mitigacion: documentar rotacion (re-cifrado por lotes / versionado de clave).
- **[P2] Retirada de legacy destructiva**: borrar `accesos_apps` sin confirmar consumidores/datos puede perder credenciales reales. Mitigacion: deprecar primero, borrar tras verificar (working tree limpio + backup).

## Modelo de datos propuesto
> **PASO 1 OBLIGATORIO: VERIFICAR SCHEMA REAL via Management API.** Volcar el DDL real y `pg_policies` de las 3 tablas en PROD. La migracion debe reflejar **lo que existe**, no el DDL del PRP. No inferir del codigo. Todo lo de abajo es la forma esperada, a confirmar/ajustar contra PROD. **Marca: VERIFICAR-SCHEMA-REAL.**

### Tablas (forma esperada, idempotente; corrige `roles` -> `empresa_roles`)

```sql
-- 1) apps_externas (1 fila por app, sin credenciales)
CREATE TABLE IF NOT EXISTS public.apps_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT,
  logo_url TEXT,
  categoria TEXT NOT NULL,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),   -- VERIFICAR-SCHEMA-REAL (el code lo escribe)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_apps_externas_empresa ON public.apps_externas(empresa_id);
ALTER TABLE public.apps_externas ENABLE ROW LEVEL SECURITY;

-- 2) app_credenciales (N por app; password cifrada en reposo)
CREATE TABLE IF NOT EXISTS public.app_credenciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps_externas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE, -- denormalizado para RLS
  etiqueta TEXT NOT NULL,
  usuario TEXT NOT NULL,
  password_cifrado TEXT NOT NULL,            -- "iv:authTag:cipher" (base64), ver lib/crypto.ts
  url_especifica TEXT,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_credenciales_app ON public.app_credenciales(app_id);
CREATE INDEX IF NOT EXISTS idx_app_credenciales_empresa ON public.app_credenciales(empresa_id);
ALTER TABLE public.app_credenciales ENABLE ROW LEVEL SECURITY;

-- 3) app_credencial_roles (M:N obligatoria; FK a empresa_roles, NO a roles)
CREATE TABLE IF NOT EXISTS public.app_credencial_roles (
  credencial_id UUID NOT NULL REFERENCES public.app_credenciales(id) ON DELETE CASCADE,
  rol_id UUID NOT NULL REFERENCES public.empresa_roles(id) ON DELETE CASCADE,  -- CORREGIDO
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (credencial_id, rol_id)
);
CREATE INDEX IF NOT EXISTS idx_app_credencial_roles_rol ON public.app_credencial_roles(rol_id);
CREATE INDEX IF NOT EXISTS idx_app_credencial_roles_empresa ON public.app_credencial_roles(empresa_id);
ALTER TABLE public.app_credencial_roles ENABLE ROW LEVEL SECURITY;
```

### RLS (la pieza P0-2 — verificar que existe o crearla)

Patron tenant (replicar el de `20260517110000_accesos_apps_rls_tenant.sql`): un helper de pertenencia `empresa_id ∈ user_empresas(auth.uid()) ∪ profiles.empresa_id(auth.uid())`.

- **`apps_externas`** y **`app_credencial_roles`**: SELECT/INSERT/UPDATE/DELETE si pasa el tenant. (Cards visibles a cualquiera con acceso al modulo.)
- **`app_credenciales` — SELECT con INTERSECCION DE ROLES (CRITICO, FALTA VERIFICAR/CREAR):** ademas del tenant, exige que exista una fila en `app_credencial_roles` cuyo `rol_id` este entre los roles del usuario en esa empresa. Forma esperada (ajustar la subquery usuario->rol a la tabla canonica real — VERIFICAR-SCHEMA-REAL, p.ej. la relacion que usa `roles-actions.ts` con `user_id`):

```sql
DROP POLICY IF EXISTS app_credenciales_tenant_role_read ON public.app_credenciales;
CREATE POLICY app_credenciales_tenant_role_read
  ON public.app_credenciales FOR SELECT
  USING (
    -- tenant
    (empresa_id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid())
     OR empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()))
    AND
    -- interseccion de roles del usuario en ESA empresa
    EXISTS (
      SELECT 1
        FROM public.app_credencial_roles acr
        JOIN <tabla_usuario_rol> ur            -- VERIFICAR-SCHEMA-REAL (empresa_roles <-> usuario)
          ON ur.rol_id = acr.rol_id
       WHERE acr.credencial_id = app_credenciales.id
         AND ur.user_id = auth.uid()
         AND ur.empresa_id = app_credenciales.empresa_id
    )
  );
```

INSERT/UPDATE/DELETE de `app_credenciales`: hoy van por `createAdminClient` (bypass). Decidir si se anaden policies de escritura tenant/rol o se mantiene la validacion en codigo (DN-3). El revelado seguro depende **solo** de la policy SELECT de arriba.

## Interfaces publicas propuestas
Las actions **ya existen** en `src/features/accesos/actions/`. Esta task NO las reescribe; las documenta y blinda la BD bajo ellas. Firmas reales (verificadas):

```ts
// apps-actions.ts
export async function listApps(): Promise<AppExterna[]>;
export async function createApp(input: AppExternaInput): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
export async function updateApp(id: string, input: AppExternaInput): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteApp(id: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function listRolesEmpresa(): Promise<Array<{ id: string; nombre: string }>>; // lee empresa_roles

// credenciales-actions.ts  (listCredencialesVisibles NUNCA devuelve password)
export async function listCredencialesVisibles(appId?: string): Promise<Credencial[]>;
export async function createCredencial(input: CredencialInput): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
export async function updateCredencial(id: string, input: CredencialUpdateInput): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteCredencial(id: string): Promise<{ ok: true } | { ok: false; error: string }>;

// revelar-action.ts  — UNICO punto que devuelve el plano (PUNTO DE REVELADO)
export async function revelarCredencial(id: string): Promise<{ ok: true; password: string } | { ok: false; error: string }>;
```

**Punto de revelado (critico)**: `revelarCredencial` usa el **cliente del usuario** (`getAppContext().supabase`), hace `select("password_cifrado").eq("id", id)` y, si la RLS deja pasar la fila, `decrypt()` y devuelve el plano. Toda la seguridad del revelado vive en la policy SELECT de `app_credenciales` (P0-2). El cifrado AES-256-GCM (`lib/crypto.ts`) protege en reposo pero NO sustituye a la RLS, porque la clave esta en el server y el descifrado se ejecuta para quien pase la policy.

## Flujo operativo esperado
**Fase 1 - Verificar PROD (Management API).** Volcar DDL real + `pg_policies` de `apps_externas`/`app_credenciales`/`app_credencial_roles`. Determinar si existe la policy de interseccion de roles sobre `app_credenciales` y si la FK de `app_credencial_roles` apunta a `empresa_roles`. Localizar la tabla/relacion usuario->rol canonica para la subquery. (NO escribir nada antes de esto.)

**Fase 2 - Versionar migracion de schema.** Crear el `.sql` idempotente que reproduce las 3 tablas + indices + FKs (contra `empresa_roles`) tal como existen en PROD. Aplicable en limpio sin tocar el PROD ya migrado.

**Fase 3 - Cerrar seguridad de revelado.** Confirmar/crear y versionar la RLS SELECT con interseccion de roles sobre `app_credenciales` (+ policies tenant en las otras dos). Smoke de seguridad con dos roles: el no autorizado no lee la fila ni revela.

**Fase 4 - Provisionar/rotar clave.** Confirmar `CREDENCIALES_ENCRYPTION_KEY` en PROD/Vercel y `.env.local`; documentar generacion (`openssl rand -hex 32`) y procedimiento de rotacion (re-cifrado por lotes o versionado de clave). Sin versionar el valor.

**Fase 5 - Retirar legacy.** Marcar `@deprecated` real en codigo o retirar `accesos_apps` + `src/features/rrhh/...accesos*` (vista/actions/io/data) tras confirmar 0 consumidores; plan de borrado de la tabla con backup.

**Fase 6 - Persistir acceso al portal.** `AccesosSection` (`perfilSections.tsx`): persistir el activar/desactivar contra estado real (tabla/columna en `profiles`/`empleados` o el modelo de accesos al portal que defina OLA2-10), o retirar los botones para no enganar.

**Fase 7 - Sincronizar docs.** PRP-043: cabecera `Estado: IMPLEMENTADO` + corregir pie y la FK `roles`->`empresa_roles`; `TASK-006`: cerrar o redirigir al estado real (modelo nuevo ya existe; remediacion de seguridad = esta task).

## Decisiones de negocio pendientes
- **DN-1 (retirada de legacy)**: ¿se borra `accesos_apps` y todo `src/features/rrhh/...accesos*`, o se mantiene `@deprecated` un tiempo? ¿hay datos legacy aun no migrados que haya que conservar/migrar antes de borrar? Requiere a Fernando.
- **DN-2 (auditoria de revelados)**: ¿se anade tabla `credenciales_accesos_log` (quien revelo que credencial y cuando)? El PRP lo dejaba fuera de scope; para credenciales sensibles (banca, Glovo) puede ser exigible. Define si entra en esta task o en una posterior.
- **DN-3 (escritura: RLS vs codigo)**: ¿se anaden policies de INSERT/UPDATE/DELETE tenant/rol a `app_credenciales` (segunda linea de defensa) o se mantiene la validacion solo en codigo con `createAdminClient`?
- **DN-4 (acceso al portal)**: ¿el activar/desactivar acceso del empleado se persiste (y dónde) o se retira? Depende del modelo de roles/accesos de OLA2-10.
- **DN-5 (rotacion de clave)**: ¿estrategia de rotacion — re-cifrado por lotes con clave nueva, o columna de version de clave para migracion gradual?

## Paths del proyecto
A crear:
- `supabase/migrations/<TS>_accesos_prp043_schema_y_rls.sql` (3 tablas + indices + FKs a `empresa_roles` + RLS tenant + RLS interseccion de roles en `app_credenciales`).

A tocar (solo si lo decide Fernando):
- `.claude/PRPs/PRP-043-gestor-credenciales-apps-permisos-por-rol.md` (Estado -> IMPLEMENTADO; FK `roles`->`empresa_roles`; pie).
- `docs/rrhh-consolidacion/TASK-006-accesos-apps-exclusion-y-remediacion.md` (cerrar/redirigir).
- `src/features/rrhh/{actions/accesos-apps-actions.ts,data/accesos-apps.ts,components/AccesosView.tsx,io/accesos.io.ts}` (deprecar/retirar legacy).
- `src/features/rrhh/components/empleados/perfilSections.tsx` + `src/features/rrhh/data/accesos-portal.ts` (persistir o retirar `AccesosSection`).
- `.env.example` / notas internas (documentar `CREDENCIALES_ENCRYPTION_KEY`, sin el valor).

A leer como referencia (no se tocan):
- `src/features/accesos/actions/{revelar-action,credenciales-actions,apps-actions}.ts`, `lib/crypto.ts`, `data/tipos.ts`, `src/app/(main)/accesos/page.tsx`.
- `supabase/migrations/{20260517110000_accesos_apps_rls_tenant.sql,060_accesos_apps.sql,088_empresa_roles_unique_nombre.sql}`.

## Agentes recomendados
- **Ninguno ejecuta**: la task esta **RESERVADA A FERNANDO**. Lo que sigue es orientativo para cuando Fernando decida abordarla (el mismo o con apoyo):
- Verificacion PROD: Management API de Supabase (DDL + `pg_policies`); regla de memoria "verificar schema real antes de migrar".
- Tabla + RLS: skill `create-supabase-table-rls-base` (idempotencia + policies tenant) y `review-rls-multi-tenant` (interseccion de roles + aislamiento `empresa_id`).
- Revision: `golden-path-review` sobre el revelado y el CRUD.
- Validacion: ejecutor con WSL para `typecheck`/`build` y smoke de seguridad con dos roles via navegador/MCP.

## Checklist de cierre
- [ ] **(P0-2)** Verificado en PROD (Management API) si existe la RLS de interseccion de roles sobre `app_credenciales`; si faltaba, creada y versionada.
- [ ] **(P0-1)** Migracion `.sql` versionada de las 3 tablas; `grep -rl 'apps_externas\|app_credenciales' supabase/migrations` deja de ser vacio.
- [ ] FK de `app_credencial_roles.rol_id` confirmada contra `empresa_roles(id)` (no `roles`).
- [ ] Migracion idempotente y aplicable en entorno limpio sin romper PROD (probado).
- [ ] Smoke de seguridad: usuario sin rol autorizado NO lee la credencial ni la revela; usuario con rol si; cross-tenant aislado.
- [ ] `CREDENCIALES_ENCRYPTION_KEY` documentada (generacion + ubicacion + rotacion), nunca versionada; confirmada en PROD/Vercel.
- [ ] DN-1 (legacy) decidido y aplicado: `@deprecated` real o retirada con backup.
- [ ] DN-4 (acceso al portal) decidido: `AccesosSection` persiste o se retira (sin botones enganosos).
- [ ] PRP-043 y TASK-006 sincronizados con el estado real.
- [ ] Si hubo codigo: `npm run typecheck` + `npm run build` verdes (WSL); commit `_FernandoClaude` + push a `main`.

## Siguiente paso sugerido
**Fernando**: ejecutar la **Fase 1** — abrir la Management API de Supabase y volcar el DDL real + `pg_policies` de `apps_externas`, `app_credenciales` y `app_credencial_roles`. El objetivo inmediato es responder UNA pregunta: ¿existe ya una policy SELECT sobre `app_credenciales` que exija interseccion de roles, o el revelado depende de una RLS que no esta? Si no esta o es laxa, crearla y versionarla es el fix de seguridad urgente, antes que cualquier otra fase.

## Ruta canonica
docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-15-accesos-prp043-reservado-fernando.md
