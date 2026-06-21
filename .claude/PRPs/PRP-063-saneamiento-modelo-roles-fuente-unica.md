# PRP-063: Saneamiento del modelo de Roles (fuente única de verdad)

> **Estado**: COMPLETADO (2026-06-21) — 8 fases en main (770b9ee→c603205). Fuente única `usuarios.rol_id`; `usuario_roles` eliminada; `role`/`rol_label` espejos derivados; RLS reapuntada a `es_admin_plataforma`. Verificado: build OK, 20/20 coherentes, 2 directores, advisors sin issues nuevos.
> **Fecha**: 2026-06-21
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Convertir `empresa_roles` en la **única fuente de verdad** del rol de cada usuario, enlazada desde `usuarios` por **ID** (`usuarios.rol_id` FK), derivar el flag de "super-usuario/director" del propio rol (sin guardarlo aparte), y **eliminar la duplicidad** `usuario_roles.role` ⊕ `usuarios.role` junto con los datos sucios. Todo por fases verificables y reversibles, sin dejar a nadie fuera del sistema.

## Por Qué

| Problema | Solución |
|----------|----------|
| El "rol" vive en 3 sitios y mezcla 2 conceptos (rol funcional vs etiqueta de plataforma) | Un solo concepto: el rol funcional de `empresa_roles`; el flag de plataforma se **deriva** de él |
| El enlace usuario→rol es por **texto** (`usuarios.rol_label` ilike `empresa_roles.nombre`), frágil ante mayúsculas/acentos/renombres | Enlace por **`rol_id` FK** a `empresa_roles.id`; el renombre de un rol ya no rompe a nadie |
| Datos sucios reales: 1 usuario con `rol_label="director"` (minúscula, no existe en catálogo; el real es "DIRECCIÓN"); 1 con `usuarios.role=admin` pero `usuario_roles.role=director` (desalineados) | Migración de datos que normaliza la basura y deja `rol_id` consistente para los 20 usuarios |
| `usuario_roles` (empleado/director) y `usuarios.role` (empleado/admin) se contradicen y se leen en ~40 archivos | Capa de compatibilidad que deriva ambos desde la nueva fuente; luego retirada de ambas columnas |

**Valor de negocio**: Elimina una clase entera de bugs de autenticación/visibilidad ("a este usuario no le sale RRHH aunque es director"), reduce el coste de cambiar permisos (un solo lugar), y deja el modelo preparado para multi-empresa sin ambigüedad. Riesgo evitado: que un saneamiento mal hecho deje a los ~20 usuarios (2 directores reales, incluido el dueño) sin acceso.

## Qué

### Criterios de Éxito
- [ ] `usuarios.rol_id UUID REFERENCES empresa_roles(id)` existe; los **20/20** usuarios lo tienen poblado y coherente con su empresa (FK válida dentro de su `empresa_id`).
- [ ] El usuario sucio "Agora Demo" (`rol_label="director"`) queda apuntado al rol **DIRECCIÓN** de su empresa; el desalineado admin/director queda resuelto (un único origen de verdad).
- [ ] Existe un helper único `getRolContext(userId)` (server) que devuelve `{ rolId, rolNombre, permisos, esDirector }` leyendo **solo** desde `usuarios.rol_id → empresa_roles`; `getUserPermisos()` y `requireAdminUser()` se apoyan en él.
- [ ] El flag de plataforma (`esDirector`/admin) se **deriva** del rol (rol con `nombre` normalizado = "DIRECCIÓN" o marca equivalente), no se lee de `usuario_roles` ni de `usuarios.role`.
- [ ] Los ~40 archivos que hoy leen `usuario_roles` / `usuarios.role` / `rol_label` (texto) pasan a usar el helper o `rol_id`; ninguno queda leyendo las fuentes viejas tras la fase final.
- [ ] `usuario_roles` y `usuarios.role` quedan retiradas (o vacías/deprecadas con guardas) sin romper login, middleware (`proxy.ts`) ni visibilidad (`puedeVer`).
- [ ] Toda migración versionada como `.sql` idempotente en `supabase/migrations/`; RLS multi-tenant con `empresas_del_usuario()`.
- [ ] `npm run typecheck` y `npm run build` pasan; el dueño y un segundo director conservan acceso (verificado en BD y por login).

### Comportamiento Esperado
Tras la migración, al iniciar sesión un usuario: el servidor lee `usuarios.rol_id`, resuelve la fila de `empresa_roles` (nombre, `permisos`, y si es DIRECCIÓN → `esDirector=true`), y `AuthContext` recibe los mismos `permisos`/`roles` que hoy pero desde una sola consulta determinista por ID. `puedeVer`/`puedeEditar`, el sidebar, `proxy.ts` y los guards RRHH se comportan idénticamente para los usuarios actuales (paridad de comportamiento), pero ya sin depender de coincidencia textual ni de tablas duplicadas. Renombrar un rol en Ajustes ya no descoloca a nadie.

---

## Contexto

### Diagnóstico de datos (verificado en BD, 2026-06-21)
- `usuarios`: **20** filas · `usuario_roles`: **20** · `empresa_roles`: **26** (catálogo por empresa).
- `usuarios.role` distinct = `{admin, empleado}` · `usuario_roles.role` distinct = `{director, empleado}` (vocabularios distintos para el mismo concepto).
- `rol_label` → `empresa_roles` por ilike: **19 con match, 1 sin match** (Agora Demo, `rol_label="director"`, debe ser "DIRECCIÓN").
- **1** usuario desalineado entre `usuarios.role=admin` y `usuario_roles.role=director`.
- `usuarios sin rol_label` = 0 · usuarios con >1 fila en `usuario_roles` = 0 (relación 1:1 hoy).
- `usuario_empresas` solo tiene `(user_id, empresa_id, created_at)` → **NO** hay rol por-empresa secundaria; el rol vive en `usuarios.rol_label` + `usuarios.empresa_id` (empresa de referencia). El multi-empresa secundario hereda permisos del mismo rol (decisión actual; mantener, no introducir rol-por-empresa en este PRP).

### Referencias (blast radius ~40-50 archivos)
**Resolución de permisos / login**
- `src/features/auth/actions/permisos-actions.ts` — `getUserPermisos()`: lee `usuarios.rol_label`+`empresa_id` → `empresa_roles` por **ilike(nombre, rol_label)**; lee `usuario_roles.role` para `appRoles`. **Núcleo a reescribir.**
- `src/features/auth/contexts/auth-context.tsx` — `AppRole`, `ROLE_MODULES`, `puedeVer/puedeEditar` (bypass para `director`/`admin`), `normalizarModulo`.
- `src/proxy.ts` (middleware) — lee `usuario_roles.role`, `usuarios.rol_label` y `empresa_roles.nombre`+`permisos` para permitir/denegar módulos por request.
- `src/features/auth/lib/profile-guard.ts` — exige `rol_label` no nulo para sesión válida.

**Guards de plataforma / admin**
- `src/features/rrhh/services/empleados-core.ts` — `requireAdminUser()` (chequea `usuario_roles.role ∈ {admin,director}`) y `requireRRHHAcceso()`.
- `src/actions/admin.ts` — `requireAdmin()`, `getEmployees()`, `inferAppRoleFromLabel()`, `assertRoleExistsInEmpresa()`, alta de usuario/empleado.
- `src/features/ajustes/actions/roles-actions.ts` — CRUD de `empresa_roles`, `requireDirectorAppRole()`.

**Lecturas de `usuarios.role` / `usuario_roles.role` (≈25 archivos)** — entre otros: `ayuda/page.tsx`, `locales-actions.ts`, `useComandasPermisos.ts`, `usePOSPermisos.ts`, `comunicacion-actions.ts`, `cronograma-ejecuciones-actions.ts`, `user-empresas-actions.ts`, `producto-actions.ts`, `mi-panel-actions.ts`, `accesos-apps-actions.ts`, `fichajes-actions.ts`, `firmas-actions.ts`, `tareas-actions.ts`, `toques-actions.ts`, `toques-admin-actions.ts`, soporte (`conocimiento/faq/indexar-formacion`).

**Lecturas de `rol_label` texto (≈18 archivos)** — `UsuariosTab.tsx`, `RolesTab.tsx`, `DepartamentosTab.tsx`, `use-hydrate-usuarios.ts`, `AccesosView.tsx`, `comunicados-actions.ts`, `app-layout.tsx`, `cronograma-actions.ts`, `mobile-inicio-data.ts`, `validadores-actions.ts`, `promocion-actions.ts`, `tareas-actions.ts`, etc.

**`puedeVer/puedeEditar` (≈11 archivos)** — `app-sidebar.tsx`, `app-layout.tsx`, `nav-routes.tsx`, `CamarasDrawer.tsx`, `MisDepartamentosView.tsx`, Google Workspace drawers; server-side replica en `src/lib/soporte/modulos-visibles.ts`.

**Seeds** — `src/lib/seeds/roles.ts` (catálogo canónico + `permisos`), `src/lib/seeds/sync.ts` (`syncRolesAEmpresa`). Cualquier cambio de modelo de rol se propaga vía `syncSeedsToAllEmpresas()`.

### Modelo de Datos (cambios)
```sql
-- Fase 1: columna nueva + FK (no destructiva)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol_id UUID REFERENCES empresa_roles(id);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios(rol_id);

-- (Recomendado) marca explícita de "director/super-usuario" en el catálogo,
-- para no depender de comparar el nombre "DIRECCIÓN" por string:
ALTER TABLE empresa_roles
  ADD COLUMN IF NOT EXISTS es_admin_plataforma BOOLEAN NOT NULL DEFAULT false;
-- seed: marcar true en el rol DIRECCIÓN de cada empresa.

-- Fase 2: backfill idempotente (mapeo por empresa + normalización de basura)
UPDATE usuarios u
SET rol_id = er.id
FROM empresa_roles er
WHERE er.empresa_id = u.empresa_id
  AND er.nombre ILIKE u.rol_label
  AND u.rol_id IS NULL;

-- Casos sucios sin match textual → mapeo explícito normalizado
-- (ej. rol_label='director' → DIRECCIÓN de su empresa). Se resuelve con un
-- diccionario de equivalencias en la migración (director→DIRECCIÓN, etc.).
```
> `usuarios.rol_label` se mantiene de momento como **columna espejo** (mismo patrón legacy que `empresa_logos`): se sigue escribiendo derivada de `rol_id` para no romper las ~18 lecturas hasta su tanda. Se retira al final.

---

## Blueprint (Assembly Line)

> Solo FASES. Subtareas se generan al entrar a cada fase (bucle agéntico).
> Regla de oro de todas las fases: **paridad de comportamiento** para los 20 usuarios actuales y **cero usuarios sin acceso** en ningún punto intermedio. Cada fase deja el sistema desplegable.

### Fase 0: Snapshot reversible y red de seguridad
**Objetivo**: Backup verificable del estado actual de roles antes de tocar nada: tabla `_roles_backup_063` con `(user_id, empresa_id, usuarios_role, usuario_roles_role, rol_label)` para los 20 usuarios + script de rollback documentado.
**Validación**: Tabla de backup con 20 filas; consulta de rollback probada en dry-run; migración versionada en `supabase/migrations/`.

### Fase 1: Esquema nuevo (no destructivo)
**Objetivo**: Añadir `usuarios.rol_id` (FK `empresa_roles`) + índice, y `empresa_roles.es_admin_plataforma` (default false), con sus migraciones idempotentes. Marcar `es_admin_plataforma=true` en el rol DIRECCIÓN de cada empresa y propagarlo al seed canónico (`roles.ts` + `sync.ts`).
**Validación**: Columnas/índice creados; cada empresa tiene exactamente 1 rol con `es_admin_plataforma=true`; nada lee aún `rol_id` (sin cambios de comportamiento); typecheck/build verdes.

### Fase 2: Migración de datos (backfill + limpieza de basura)
**Objetivo**: Poblar `rol_id` de los 20 usuarios mapeando `rol_label`→`empresa_roles.id` por empresa, con diccionario de normalización para los casos sucios (`director`→DIRECCIÓN; alinear el admin/director desalineado). Tras esto, recalcular `usuarios.rol_label` y `usuario_roles.role`/`usuarios.role` **derivados** de `rol_id` (dejar las viejas coherentes mientras coexisten).
**Validación**: `SELECT count(*) FROM usuarios WHERE rol_id IS NULL` = 0; FK de cada `rol_id` pertenece a la `empresa_id` del usuario; 0 desalineados; los 2 directores reales (incluido el dueño) tienen rol con `es_admin_plataforma=true`.

### Fase 3: Capa de compatibilidad (fuente única detrás de un helper)
**Objetivo**: Crear `getRolContext(userId)` (server) que devuelve `{ rolId, rolNombre, permisos, esDirector }` leyendo solo `usuarios.rol_id → empresa_roles`. Reescribir `getUserPermisos()` y `requireAdminUser()`/`requireRRHHAcceso()` para apoyarse en él. Mantener firmas/retornos públicos (`appRoles`, `rolLabel`, `permisos`) idénticos para no romper consumidores aún.
**Validación**: Login y `proxy.ts` siguen dando los mismos `permisos`/visibilidad para una muestra de usuarios (director, gerencia, empleado); `getUserPermisos()` ya no hace `ilike` por texto; typecheck/build verdes; `/qa` smoke de login.

### Fase 4: Reapuntar lecturas por tandas (≈40 archivos)
**Objetivo**: Migrar consumidores a `getRolContext`/`rol_id` en tandas temáticas y aisladas para minimizar choque con la sesión paralela de cámaras/RRHH: (T1) middleware+auth+guards core; (T2) RRHH/empleados; (T3) Mi Panel/comunicación/tareas/toques; (T4) sala/cocina/POS/comandas; (T5) ajustes/admin UI + soporte. Cada tanda es un commit independiente y desplegable.
**Validación**: Por tanda: grep confirma 0 lecturas nuevas de `usuario_roles`/`usuarios.role` en los archivos tocados; typecheck/build verdes; humo de la zona afectada. No tocar archivos en conflicto activo con la sesión paralela (coordinar orden).

### Fase 5: Derivar el flag de plataforma y eliminar duplicidad
**Objetivo**: Sustituir todo chequeo `role ∈ {admin,director}` por `esDirector` derivado (`empresa_roles.es_admin_plataforma`). Una vez 0 lectores: retirar `usuario_roles` (drop tabla) y `usuarios.role` (drop columna), con migraciones idempotentes y guardas. Eliminar `inferAppRoleFromLabel()` y código muerto.
**Validación**: grep global = 0 referencias a `usuario_roles` y `usuarios.role` en `src/`; las tablas/columnas viejas eliminadas; login + visibilidad + guards RRHH intactos para los 20 usuarios.

### Fase 6: Retirar `rol_label` texto como enlace (opcional, último)
**Objetivo**: Con todo enlazado por `rol_id`, decidir si `usuarios.rol_label` se conserva como mero espejo de display o se elimina. Si se conserva, dejarlo siempre derivado de `rol_id` (trigger o en server actions de asignación). Actualizar `profile-guard.ts` para validar `rol_id` en vez de `rol_label`.
**Validación**: Asignar/renombrar un rol en Ajustes no descoloca a ningún usuario; `profile-guard` exige `rol_id`; criterios de éxito completos.

### Fase 7: Validación Final
**Objetivo**: Sistema funcionando end-to-end con fuente única.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] `/qa` (Playwright): login dueño + 1 director secundario + 1 empleado → ven exactamente sus módulos
- [ ] BD: 20/20 `rol_id` poblados y coherentes; 0 referencias a fuentes viejas
- [ ] Todas las migraciones versionadas e idempotentes en `supabase/migrations/`

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Crece durante la implementación.

---

## Gotchas

- [ ] **No dejar a nadie fuera**: en toda fase intermedia las fuentes viejas y `rol_id` deben coexistir coherentes; nunca borrar `usuario_roles`/`usuarios.role` antes de que grep dé 0 lectores.
- [ ] **Login del dueño** usa `email_empresa` de su empresa de referencia (`usuarios.empresa_id`); validar explícitamente que su `rol_id` resuelve a un rol con `es_admin_plataforma=true`.
- [ ] **Multi-empresa**: el rol vive en la empresa de referencia (`usuarios.empresa_id`); `usuario_empresas` NO lleva rol. No introducir rol-por-empresa secundaria aquí; el acceso secundario hereda el mismo rol/permisos (comportamiento actual).
- [ ] **Match textual frágil**: el backfill por `ILIKE` falla en 1 caso real (`director`); usar diccionario de normalización explícito, no solo ilike.
- [ ] **`proxy.ts` (middleware)** corre en cada request: cualquier cambio de la forma de resolver permisos debe mantener su latencia y no romper el bypass de director.
- [ ] **RLS multi-tenant**: cualquier política nueva usa `empresas_del_usuario()`/`_text()`; la FK `rol_id` debe respetar que el rol pertenezca a una empresa del usuario.
- [ ] **Versionar SIEMPRE**: aunque se aplique por MCP, cada cambio de esquema/datos se guarda como `.sql` idempotente en `supabase/migrations/`.
- [ ] **Sesión paralela (cámaras/RRHH)**: ordenar las tandas de Fase 4 para tocar al final los archivos en conflicto; sin `git stash` entre agentes; verificación manual al cierre.
- [ ] **`es_admin_plataforma` por seed**: marcar DIRECCIÓN en TODAS las empresas (actuales y futuras) vía `roles.ts` + `syncSeedsToAllEmpresas()`, no a mano por empresa.
- [ ] **Pedir permiso antes de ejecutar cada fase con cambio de esquema/auth** (planificación ya autorizada; ejecución por fases con aprobación).

## Anti-Patrones

- NO enlazar usuario→rol por nombre/texto nunca más (la causa raíz del bug).
- NO guardar el flag director/admin en una columna aparte: se **deriva** del rol.
- NO borrar `usuario_roles`/`usuarios.role` hasta que grep confirme 0 lectores.
- NO introducir el concepto de "grupos" de empresas (descartado esta sesión).
- NO migrar los ~40 archivos en un solo commit gigante: tandas aisladas y desplegables.
- NO usar `any`; tipar `getRolContext` y derivados.
- NO tocar una empresa concreta: todo cambio es multi-tenant (código compartido).

---

*PRP pendiente de aprobación. No se ha modificado código.*
