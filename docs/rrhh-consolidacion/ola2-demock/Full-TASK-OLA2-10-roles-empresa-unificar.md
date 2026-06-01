# Full-TASK-OLA2-10 - Roles de empresa reales (unificar clon)

## Estado

PLANIFICADO — Ola 2, 2026-06-01. **No implementado.** Discovery completo en `DISCOVERY_OLA2-10-roles-empresa-unificar.md` (mismo directorio). Este documento es un contrato ejecutable; el codigo de producto se escribe en fase de ejecucion, no aqui.

## Objetivo

Eliminar el mock duplicado de "roles/puestos de empresa" (`rrhh/data/roles-empresa.ts` y su clon byte-identico `ajustes/data/roles-empresa.ts`), dejando **una sola fuente de datos/tipos**, y resolver su estado funcional real:

- Para los **roles de ACCESO** (`empresa_roles`): no hay nada que demockear — ya son reales (`ajustes/actions/roles-actions.ts`). El trabajo es **confirmar** que ninguna pantalla viva depende del mock para esto.
- Para los **PUESTOS de empresa + vacante embebida** (lo que describe el mock): decidir destino (persistir en BD o retirar) y ejecutarlo. Hoy sus consumidores estan huerfanos o muertos.
- Para la **integracion con reclutamiento**: retirar `rolToVacante()`/`getVacantesDesdeRoles()`, obsoletos porque las vacantes ya derivan del **organigrama** (TASK-005 cerrada), no del mock.

Resultado: cero datos mock de roles/puestos en el arbol vivo, una fuente unica, y `typecheck`/`build` verdes sin imports muertos.

## Estimacion de complejidad

**Media.** Justificacion:
- La unificacion de codigo es **Baja** (archivos identicos salvo el import).
- Lo que sube a Media es la **decision de negocio** (mantener vs retirar "PUESTOS DE EMPRESA") y, si se mantiene, **construir DAL + montar UI + verificar schema real** sobre una tabla cuya existencia en prod no esta confirmada (`roles_empresa` de `.claude/migrations/005`).
- Riesgo de regresion bajo porque dos de los tres consumidores estan huerfanos.

## Criterio de corte

- Existe **un solo** archivo fuente de tipos/datos de roles-puestos (o uno reexporta del otro). El segundo path deja de tener una copia divergente.
- **Cero** datos mock de roles/puestos y **cero** generadores de candidatos mock en el arbol importado por pantallas vivas.
- `rolToVacante` y `getVacantesDesdeRoles` retirados (o marcados deprecated y sin consumidores).
- `ReclutamientoView` ya no importa nada de `roles-empresa` (imports muertos eliminados).
- Decididos y ejecutados los huerfanos `PuestosEmpresaTab` y `RolFormModal` (montados+persistentes, o eliminados).
- `npm run typecheck` y `npm run build` en verde (ejecutados por el agente de ejecucion en WSL, no en esta tarea).
- Si se persiste algo: filtra por `empresa_id` **uuid** y respeta RLS multi-tenant.

## Modo operativo

- **taskId:** OLA2-10
- **taskMode:** code
- **reviewMode:** standard
- **sourcePlan:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`

## Contexto previo obligatorio

Leer antes de ejecutar:
1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-10-roles-empresa-unificar.md` (este discovery; contiene la separacion de los TRES conceptos de "rol" y el mapa de consumidores muertos).
2. `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md` (fila OLA2-10; OLA2-11 depende de esta).
3. Codigo: los dos `roles-empresa.ts`, `ReclutamientoView.tsx`, `RolFormModal.tsx`, `PuestosEmpresaTab.tsx`, `ajustes/actions/roles-actions.ts`, `rrhh/actions/reclutamiento-actions.ts`.
4. DDL: `supabase/migrations/033_empresa_config.sql`, `062_departamentos.sql`, `087`, `088`, `097`, y `.claude/migrations/005_rrhh.sql` (vacantes/candidatos/roles_empresa).

## Scope IN

- Unificar los dos `roles-empresa.ts` en una unica fuente de tipos/datos.
- Eliminar el generador de candidatos mock y los arrays `rolesHabana`/`rolesBacanal`.
- Retirar `rolToVacante()` y `getVacantesDesdeRoles()` (obsoletos por organigrama→vacantes).
- Limpiar imports muertos en `ReclutamientoView.tsx`.
- Resolver los componentes huerfanos `PuestosEmpresaTab` y `RolFormModal` segun la decision de negocio (ver seccion correspondiente).
- Si la decision es "persistir puestos": DAL server-side sobre `empresa_roles`+`empresa_role_departamentos` (o `roles_empresa` previa verificacion), con RLS y `empresa_id` uuid.
- Sustituir el array hardcoded `DEPARTAMENTOS` por la fuente real (`departamentos` en BD) si algun consumidor vivo lo necesita.

## Scope OUT

- **NO** rehacer los roles de ACCESO (`empresa_roles`): ya son reales y funcionan (`RolesTab`/`roles-actions.ts`). No tocar permisos JSONB.
- **NO** rehacer reclutamiento (vacantes/candidatos): TASK-005 cerrada. No tocar `seedVacantesDesdeOrganigrama`, `listVacantesConCandidatos`, `vacantes-actions`, `candidatos-actions`.
- **NO** tocar el organigrama ni su tabla.
- **NO** migraciones de datos de produccion fuera de lo estrictamente necesario para persistir puestos (y solo tras verificar schema real).
- **NO** cambios de UI/diseno mas alla de montar/retirar los componentes implicados.

## Restricciones

- TypeScript estricto, Feature-First. No `any` sin justificar.
- Multi-tenant: toda lectura/escritura filtra por `empresa_id` (uuid). Resolver slug→uuid en el server action (`getEmpresaIdFromSlug`/`resolveEmpresaId`), nunca usar `"habana"`/`"bacanal"` como clave de BD.
- RLS obligatoria en cualquier tabla tocada; no abrir policies `using (true)`.
- Mutaciones de roles de empresa: mantener la defensa `app_role='director'` server-side ya presente en `roles-actions.ts` si se extiende esa DAL.
- No romper `RolesTab`, `UsuariosTab`, `DepartamentosTab`, `ReclutamientoView` (pantallas vivas).
- **VERIFICAR SCHEMA REAL** con Management API antes de asumir columnas (regla del proyecto: inferir del codigo rompe datos).

## Validacion requerida

- `npm run typecheck` limpio (sin imports muertos colgando del borrado del mock).
- `npm run build` en verde.
- Grep de regresion: `getVacantesDesdeRoles|rolToVacante|rolesHabana|rolesBacanal|generarCandidatosMock` → cero ocurrencias en el arbol vivo (`src/`).
- Grep: `from "@/features/ajustes/data/roles-empresa"` y `from ".../rrhh/data/roles-empresa"` → apuntan a la fuente unica (o el segundo desaparece).
- Si se persisten puestos: smoke manual de alta/edicion/borrado de un puesto en una empresa real, verificando fila en BD con `empresa_id` uuid correcto y aislamiento RLS entre dos empresas.
- Verificacion de que `ReclutamientoView` sigue listando vacantes reales tras el cambio (no se rompio nada al limpiar imports).

## Dependencias

- **Depende de:** ninguna (sin bloqueo segun el plan; `empresa_roles`/`empresa_role_departamentos`/`departamentos` ya existen; reclutamiento ya real).
- **Bloquea a:** OLA2-11 (`criterios_resena`), declarada con `depende de: OLA2-10` en el plan.

## Inputs

- Los dos `roles-empresa.ts` (mock a unificar/retirar).
- `empresa_roles` (033), `empresa_role_departamentos` (097), `departamentos` (062): tablas reales existentes.
- `ajustes/actions/roles-actions.ts`: DAL real de roles de acceso (referencia de patrones server-side: auth director, resolveEmpresaId, admin client).
- `rrhh/actions/reclutamiento-actions.ts` + `vacantes-actions.ts`: reclutamiento real (referencia; no se toca).
- Decision de negocio sobre PUESTOS DE EMPRESA (ver seccion correspondiente).

## Outputs esperados

- Una fuente unica de tipos/datos de roles-puestos (path a decidir: ver decisiones de negocio).
- `ReclutamientoView.tsx` sin imports de `roles-empresa`.
- `rolToVacante`/`getVacantesDesdeRoles` eliminados.
- `PuestosEmpresaTab`/`RolFormModal`: montados+persistentes o eliminados (segun decision).
- Si aplica: DAL nueva (server actions) para puestos + (opcional) migracion idempotente con RLS.
- Reporte de cierre con estado de blindaje.

## Riesgos conocidos

1. **Confundir los tres "roles"** (acceso `empresa_roles` vs puestos mock vs fantasma `roles_empresa`) y reescribir permisos por error. Mitigacion: Scope OUT explicito sobre `empresa_roles`/permisos.
2. **`roles_empresa` (005) puede no existir en prod** (esta en `.claude/migrations`, no en `supabase/migrations`). Mitigacion: VERIFICAR SCHEMA REAL antes de usarla; si no existe, decidir tabla nueva o `empresa_roles`+columnas.
3. **Divergencia del schema de `vacantes`** entre `.claude/migrations/005` y la BD viva (las actions insertan `titulo`/`estado_publicacion`/`visible_publicamente`, ausentes en el DDL del archivo). Mitigacion: no asumir columnas de vacantes; verificar.
4. **Romper `ReclutamientoView`** al quitar imports si quedara algun uso oculto. Mitigacion: grep previo (ya hecho en discovery: imports muertos confirmados) + build.
5. **Borrar funcionalidad que el usuario esperaba** (PuestosEmpresaTab) sin confirmar. Mitigacion: la decision de negocio es bloqueante y debe resolverla el owner antes de ejecutar.
6. **slug vs uuid**: persistir con el `empresaId="habana"` del mock corromperia el tenant. Mitigacion: resolver a uuid en el server action.

## Modelo de datos propuesto

> **VERIFICAR SCHEMA REAL (Management API) antes de implementar.** Lo de abajo es el estado declarado en migraciones; la BD viva ha divergido en al menos `vacantes`.

### Tablas que YA existen (reutilizar, no recrear)

**`public.empresa_roles`** (033_empresa_config.sql) — roles de ACCESO (permisos). NO es el destino natural de los "puestos" del mock.
```
id uuid pk default gen_random_uuid()
empresa_id uuid not null -> empresas(id) on delete cascade
nombre text not null
descripcion text not null default ''
permisos jsonb not null default '[]'
protected boolean not null default false
created_at / updated_at timestamptz (trigger updated_at)
+ departamento_id uuid null -> departamentos(id) on delete set null   (062)
UNIQUE (empresa_id, nombre)   (088)
RLS: select/all por empresa_id IN (profiles.empresa_id del auth.uid())
```

**`public.empresa_role_departamentos`** (097) — puente M:N rol↔departamento.
```
rol_id uuid not null -> empresa_roles(id) on delete cascade
departamento_id uuid not null -> departamentos(id) on delete cascade
created_at timestamptz
PRIMARY KEY (rol_id, departamento_id)
RLS: erd_read / erd_manage por empresa del rol
helper: departamentos_del_usuario(empresa_id uuid)
```

**`public.departamentos`** (062) — fuente real para sustituir el array hardcoded `DEPARTAMENTOS`.
```
id uuid pk, empresa_id uuid not null, nombre text, descripcion, responsable_id, estado, ...
UNIQUE (empresa_id, lower(nombre))
```

### Columnas que FALTAN para representar un "puesto" del mock sobre `empresa_roles`

El mock `RolEmpresa` tiene: `descripcionPuesto`, `responsable`, `ubicacion`, `jornada`, `salario`, `tipoContrato`, `estado(activo/inactivo/pendiente)`, `favorita` + bloque `DatosVacante`. **Ninguna** existe en `empresa_roles`. Forzarlas ahi contamina la tabla de permisos.

### Tabla fantasma candidata para "puestos" (VERIFICAR si existe en prod)

**`public.roles_empresa`** (con guion bajo; `.claude/migrations/005_rrhh.sql`, seccion 8):
```
id uuid pk, empresa_id uuid not null -> empresas(id), nombre text, departamento text,
descripcion text, estado text default 'activo', created_at/updated_at
```
Mas cercana al mock que `empresa_roles`, pero **tampoco** cubre responsable/ubicacion/jornada/salario/contrato ni vacante. Si se elige persistir puestos completos, faltarian columnas (anadir `responsable text`, `ubicacion text`, `jornada`, `salario text`, `tipo_contrato`, etc.) o usar una tabla nueva. **Confirmar primero que `roles_empresa` existe en la BD real; si no, NO crearla a ciegas: decidir en la fase de negocio.**

### RLS para cualquier tabla de puestos nueva/usada
- `enable row level security`.
- `select`/`all` con `empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())` (mismo patron que `empresa_roles`).
- Mutacion adicional restringida a `app_role='director'` si reutiliza la DAL de `roles-actions.ts`.

## Interfaces publicas propuestas

> Firmas orientativas; ajustar a la decision de negocio. Lectura por slug que se resuelve a uuid internamente.

**Si solo se UNIFICA y se RETIRA (camino minimo, recomendado por defecto):**
```ts
// Ya existe — reutilizar, NO duplicar:
// ajustes/actions/roles-actions.ts
getRolesEmpresaNombres(empresaIdParam?: string): Promise<string[]>
loadRolesFromSupabase(empresaIdParam?: string): Promise<Rol[] | null>
saveRolesToSupabase(roles: Rol[], empresaIdParam?: string): Promise<{ error?: string }>
addRolEmpresa(nombreDepartamento, departamentoId?, empresaIdParam?): Promise<{ error?: string }>
deleteRolEmpresa(nombreDepartamento, empresaIdParam?): Promise<{ error?: string }>
// rolToVacante / getVacantesDesdeRoles: ELIMINAR (no reemplazar).
```

**Si se PERSISTEN puestos (camino ampliado) — nueva DAL `features/<destino>/actions/puestos-actions.ts`:**
```ts
export async function getPuestosEmpresa(empresaSlugOrId?: string): Promise<Puesto[]>
export async function crearPuesto(input: PuestoInput, empresaSlugOrId?: string): Promise<{ ok: boolean; id?: string; error?: string }>
export async function actualizarPuesto(id: string, patch: Partial<PuestoInput>): Promise<{ ok: boolean; error?: string }>
export async function eliminarPuesto(id: string): Promise<{ ok: boolean; error?: string }>
// Derivacion de vacantes: NO se reimplementa aqui. Las vacantes vienen del organigrama
// (seedVacantesDesdeOrganigrama). Si un puesto debe generar vacante, se documenta como
// decision aparte; por defecto NO se acopla puesto->vacante.
```
`Puesto` = tipo unico (ex-`RolEmpresa`) sin el bloque `DatosVacante` ni `vacanteId`/`favorita` heredados del mock, salvo que la decision de negocio los conserve.

## Flujo operativo esperado

**Fase 1 — Unificar los dos clones en una fuente.**
- Elegir destino (ver decisiones de negocio). Dejar un unico archivo con tipos/constantes/validaciones; el otro path reexporta o desaparece.
- Eliminar `rolesHabana`, `rolesBacanal`, `candidatosPorVacante`, `generarCandidatosMock`.
- Retirar `rolToVacante` y `getVacantesDesdeRoles`.

**Fase 2 — Cablear a BD (solo si la decision es persistir puestos).**
- VERIFICAR SCHEMA REAL (`roles_empresa` ¿existe? columnas de `vacantes`).
- Crear DAL `puestos-actions.ts` sobre la tabla confirmada, con RLS y `empresa_id` uuid; reutilizar patrones de `roles-actions.ts` (resolveEmpresaId, admin client, auth director).
- Si la decision es retirar: borrar el mock y los componentes huerfanos; saltar a Fase 4.

**Fase 3 — Integrar con reclutamiento real (por RETIRADA).**
- Confirmar que `ReclutamientoView` ya no importa `roles-empresa` y sigue listando vacantes via `seedVacantesDesdeOrganigrama`+`listVacantesConCandidatos`.
- No reintroducir derivacion rol→vacante.

**Fase 4 — Validar PuestosEmpresaTab + ReclutamientoView.**
- Si PuestosEmpresaTab se mantiene: montarlo donde corresponda (tab de Ajustes) y cablear su `onSave` a la DAL real (hoy solo hace `toast`); cambiar su import al destino unico; sustituir `DEPARTAMENTOS` hardcoded por `departamentos` reales.
- Si se retira: eliminar `PuestosEmpresaTab.tsx` y `RolFormModal.tsx`.
- `typecheck` + `build` verdes; grep de regresion limpio.

## Decisiones de negocio pendientes

1. **¿Se mantiene la funcionalidad "PUESTOS DE EMPRESA" (puesto + vacante embebida)?**
   - **Opcion A (retirar — recomendada por defecto):** los consumidores estan huerfanos/muertos y reclutamiento ya cubre vacantes via organigrama. Borrar mock + `PuestosEmpresaTab` + `RolFormModal`. Esfuerzo Bajo, riesgo minimo. Cumple "demockear" eliminando el mock.
   - **Opcion B (persistir):** montar PuestosEmpresaTab, crear DAL + tabla. Esfuerzo Medio/Alto; requiere verificar/crear tabla. Solo si el owner confirma que el concepto debe existir como entidad separada de los roles de acceso.
2. **Donde vive la fuente unica:** `features/rrhh/data` vs `features/ajustes/data` vs `features/<shared>/data`. Recomendacion: si se conserva como "puesto de empresa" (gestion en Ajustes) → `ajustes`; si se trata como dominio RRHH → `rrhh`; si lo consumen ambos features vivos → `shared/`. Decision del owner.
3. **¿`empresa_roles` (acceso) y "puestos" deben fusionarse en un solo concepto?** Recomendacion: **no** (semanticas distintas: permisos vs estructura organizativa). Mantener separados.
4. Si Opcion B: ¿un puesto genera/edita una vacante? Por defecto **no** se acopla (vacantes = organigrama). Decidir explicitamente si se quiere el acoplamiento.

## Paths del proyecto

- `src/features/rrhh/data/roles-empresa.ts` (mock — origen).
- `src/features/ajustes/data/roles-empresa.ts` (clon byte-identico salvo import — origen).
- `src/features/rrhh/components/reclutamiento/ReclutamientoView.tsx` (imports muertos a limpiar).
- `src/features/rrhh/components/reclutamiento/RolFormModal.tsx` (huerfano).
- `src/features/ajustes/components/PuestosEmpresaTab.tsx` (huerfano; `onSave` no persiste).
- `src/features/ajustes/actions/roles-actions.ts` (DAL real de roles de acceso — referencia/destino).
- `src/features/rrhh/actions/reclutamiento-actions.ts`, `vacantes-actions.ts`, `candidatos-actions.ts` (reclutamiento real — no tocar).
- `supabase/migrations/033_empresa_config.sql`, `062_departamentos.sql`, `087_*`, `088_*`, `097_*`.
- `.claude/migrations/005_rrhh.sql` (vacantes/candidatos/`roles_empresa` — verificar contra prod).
- `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-10-roles-empresa-unificar.md`.

## Agentes recomendados

- **generate-data-access-layer** — si Opcion B: DAL server-side de puestos sobre BD.
- **create-supabase-table-rls-base** — si Opcion B y hace falta tabla/columnas nuevas con RLS.
- **review-rls-multi-tenant** — verificar aislamiento por `empresa_id` en cualquier tabla tocada.
- **golden-path-review** / **review-repo-coherence** — confirmar que no quedan imports muertos ni divergencias tras la unificacion.
- **detect-overarchitecture** — vigilar que Opcion B no construya de mas (vacante acoplada, tablas redundantes).

## Checklist de cierre

- [ ] Una sola fuente de tipos/datos de roles-puestos; el clon eliminado o reexportando.
- [ ] `rolesHabana`/`rolesBacanal`/`candidatosPorVacante`/`generarCandidatosMock` eliminados.
- [ ] `rolToVacante`/`getVacantesDesdeRoles` retirados; sin consumidores.
- [ ] `ReclutamientoView` sin imports de `roles-empresa`; sigue listando vacantes reales.
- [ ] `PuestosEmpresaTab` y `RolFormModal` resueltos (montados+persistentes o eliminados) segun decision de negocio.
- [ ] Si se persiste: DAL con RLS, `empresa_id` uuid, auth director donde aplique; smoke alta/edicion/borrado + aislamiento entre dos empresas.
- [ ] SCHEMA REAL verificado (Management API) para `roles_empresa` y `vacantes` antes de cualquier persistencia.
- [ ] `npm run typecheck` y `npm run build` en verde (WSL).
- [ ] Grep de regresion limpio en `src/`.
- [ ] Estado de blindaje declarado (documentado / no aplica / pendiente).
- [ ] Commit con sufijo `_Fernando`.

## Siguiente paso sugerido

Resolver la **Decision de negocio #1** (retirar vs persistir PUESTOS DE EMPRESA) con el owner. Por defecto, ejecutar **Opcion A** (unificar+retirar): es el camino que mas reduce deuda con menor riesgo y desbloquea OLA2-11. Tras ello, lanzar la fase de ejecucion con `generate-data-access-layer` solo si se eligio Opcion B.

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-10-roles-empresa-unificar.md`
