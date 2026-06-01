# DISCOVERY OLA2-10 — Roles de empresa reales (+ unificar el clon de ajustes)

- **Fecha:** 2026-06-01
- **Autor:** Agente de arquitectura/planificacion (Balles-Hosteleros)
- **Tarea fuente:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md` (fila OLA2-10)
- **Metodo:** lectura directa de los dos clones, de sus consumidores (`ReclutamientoView`, `RolFormModal`, `PuestosEmpresaTab`), de las server actions reales de reclutamiento y de roles, y del DDL real (`033`, `062`, `087`, `088`, `097`, `.claude/migrations/005_rrhh.sql`). `diff` normalizado entre los dos archivos. Busqueda de consumidores con `grep`.
- **Estado real:** los dos `roles-empresa.ts` son **MOCK puro** (datos en RAM, sin BD). Su unica diferencia es el path de import. La mayoria de sus consumidores **ya estan demockeados o muertos**, lo que cambia radicalmente el alcance real respecto a lo que sugiere el plan.

---

## 1. Los dos clones: comparacion exacta

| | `rrhh/data/roles-empresa.ts` | `ajustes/data/roles-empresa.ts` |
|---|---|---|
| Lineas | 332 | 332 |
| Bytes | 16 463 | 16 482 |
| Diferencia | **Una sola linea**: el import de tipos de reclutamiento | idem |

- `rrhh`: `import { ... } from "./reclutamiento";` (relativo, mismo feature).
- `ajustes`: `import { ... } from "@/features/rrhh/data/reclutamiento";` (alias absoluto al feature rrhh).

`diff` normalizado (reescribiendo el import del de `rrhh` al alias absoluto del de `ajustes`) da **identico**. Los 19 bytes de diferencia son exactamente esa linea de import. No hay divergencia de tipos, datos ni funciones: es un copy-paste literal.

**Contenido compartido por ambos (idéntico):**
- Tipos: `EstadoRol`, `TipoContrato`, `DatosVacante`, `RolEmpresa`, `ValidationError`.
- Constantes: `TIPO_CONTRATO_LABELS`, `ESTADO_ROL_LABELS`, `DEPARTAMENTOS` (array hardcoded de 8 strings).
- Funciones: `rolToVacante()`, `validarRol()`, `validarVacante()`, `crearRolVacio()`, `generarCandidatosMock()`, `getRolesPorEmpresa()`, `getCandidatosPorVacante()`, `getVacantesDesdeRoles()`.
- Datos mock: `rolesHabana` (5 roles), `rolesBacanal` (3 roles), `candidatosPorVacante` (v1..v8, candidatos generados aleatoriamente).

**Implicacion:** unificar es trivial a nivel de codigo (un archivo borra y reexporta del otro, o ambos pasan a una fuente comun). El riesgo NO esta en la unificacion sino en **a que datos reales se cablea cada consumidor**, que es distinto en cada uno.

---

## 2. Consumidores reales (verificado con grep)

| Consumidor | Importa de | Que usa | Estado |
|---|---|---|---|
| `ajustes/components/PuestosEmpresaTab.tsx` | `@/features/ajustes/data/roles-empresa` | `getRolesPorEmpresa`, `crearRolVacio`, `validarRol`, `validarVacante`, `DEPARTAMENTOS`, labels, tipos | **Componente HUERFANO**: definido pero **montado en NINGUN sitio** (grep `PuestosEmpresa` solo halla su definicion). `onSave` solo hace `toast`, no persiste. |
| `rrhh/components/reclutamiento/ReclutamientoView.tsx` | `@/features/rrhh/data/roles-empresa` | importa `getVacantesDesdeRoles` y `getRolesPorEmpresa` | **Imports MUERTOS**: el render real ya carga de Supabase via `seedVacantesDesdeOrganigrama()` + `listVacantesConCandidatos()`. Ninguna de las dos funciones del mock se invoca en el cuerpo del componente. |
| `rrhh/components/reclutamiento/RolFormModal.tsx` | `@/features/rrhh/data/roles-empresa` | `RolEmpresa`, `DatosVacante`, `crearRolVacio`, `validarRol`, `validarVacante` | **Componente HUERFANO**: definido pero montado en NINGUN sitio (grep `RolFormModal` solo halla su definicion + su interface). |

**Consecuencia clave:** de los tres consumidores, **dos estan muertos** (PuestosEmpresaTab, RolFormModal) y **uno tiene imports muertos** (ReclutamientoView ya es real via organigrama/vacantes). El mock `roles-empresa.ts` no alimenta ninguna pantalla viva hoy. Esto **cambia el objetivo**: no es "demockear una pantalla que el usuario ve", es "decidir si la funcionalidad PUESTOS DE EMPRESA debe existir y, si si, cablearla a BD y montarla".

---

## 3. Confusion de conceptos: hay TRES cosas llamadas "rol"

Es imprescindible separarlas porque el plan (y PRP-043) las mezclo:

### 3.1 `empresa_roles` — roles de ACCESO (permisos). YA ES REAL.
- DDL: `supabase/migrations/033_empresa_config.sql`.
- Columnas: `id, empresa_id, nombre, descripcion, permisos jsonb, protected, created_at, updated_at`.
- `nombre` coincide con el del departamento/modulo (`087_roles_nombre_igual_departamento.sql`): DIRECCION, RECURSOS HUMANOS, SALA, COCINA, etc. (11 roles canonicos sembrados por trigger en cada empresa nueva).
- UNIQUE `(empresa_id, nombre)` (`088`). Trigger `updated_at`. RLS multi-tenant por `profiles.empresa_id`.
- FK singular `empresa_roles.departamento_id` (nullable, ON DELETE SET NULL) anadida en `062_departamentos.sql`.
- Tabla puente M:N `empresa_role_departamentos (rol_id, departamento_id)` en `097` (un rol puede cubrir varios departamentos). Helper `departamentos_del_usuario(empresa_id)`.
- **DAL real ya existe:** `src/features/ajustes/actions/roles-actions.ts` con `getRolesEmpresaNombres`, `addRolEmpresa`, `deleteRolEmpresa`, `saveRolesToSupabase`, `loadRolesFromSupabase`. Guarda `app_role='director'` server-side. Lo consumen `RolesTab`, `UsuariosTab`, `DepartamentosTab` (vivos y reales).
- **`empresa_roles` NO tiene** las columnas del mock: `descripcion_puesto`, `responsable`, `ubicacion`, `jornada`, `salario`, `tipo_contrato`, `estado(activo/inactivo/pendiente)`, `favorita`, ni los datos de vacante.

### 3.2 El mock `roles-empresa.ts` — PUESTOS organizativos + vacante embebida.
- Es un concepto **distinto** de `empresa_roles`: describe un puesto de trabajo (nombre, departamento, descripcion del puesto, responsable/supervisor, ubicacion, jornada, banda salarial, tipo de contrato, estado) **con un bloque de vacante embebido** (`DatosVacante`) y candidatos mock.
- Mapea mal a `empresa_roles` (faltan ~8 columnas). No conviene forzarlo encima de la tabla de permisos.

### 3.3 `roles_empresa` (CON guion bajo) — tabla fantasma "puestos internos".
- DDL en `.claude/migrations/005_rrhh.sql` (seccion 8): `roles_empresa (id, empresa_id, nombre, departamento, descripcion, estado, ...)`.
- **OJO:** vive en `.claude/migrations/`, **no** en `supabase/migrations/`. Hay que **VERIFICAR SCHEMA REAL** (Management API) si esta tabla existe en la BD de produccion. Su forma es la mas cercana al mock (nombre+departamento+descripcion+estado), pero NO cubre vacante/responsable/ubicacion/jornada/salario/contrato.

**Resumen:** `empresa_roles` (033) = permisos, ya real. `roles_empresa` (005, fantasma) = puestos, quizas no existe en prod. El mock = puestos + vacante. No son la misma tabla aunque el plan lo asuma.

---

## 4. Reclutamiento (vacantes/candidatos) YA es real — y NO deriva de roles

- `ReclutamientoView` carga via server actions reales: `seedVacantesDesdeOrganigrama(empresaId)` + `listVacantesConCandidatos(empresaId)` (`src/features/rrhh/actions/reclutamiento-actions.ts`).
- Las vacantes se siembran **desde el ORGANIGRAMA** (`getOrganigrama(slug)` → un nodo = un titulo de vacante), no desde el mock de roles. Idempotente por `titulo` normalizado.
- Acciones reales sobre vacantes en `vacantes-actions.ts` (`publicarVacante`, `cerrarVacante`, `deleteVacante`, `toggleVisibilidadVacante`) y candidatos en `candidatos-actions.ts` (`moverCandidatoFase`). TASK-005 ya cerrada.
- **Por tanto `rolToVacante()` / `getVacantesDesdeRoles()` del mock estan obsoletos:** la derivacion rol→vacante ya no es la fuente; la fuente es organigrama→`vacantes`. Cualquier "integrar con reclutamiento real" significa **retirar** esas funciones, no recablearlas.

### Schema real de `vacantes` / `candidatos`
- DDL declarado en `.claude/migrations/005_rrhh.sql` (NO en `supabase/migrations/`):
  - `vacantes (id, empresa_id, puesto, departamento, ubicacion, tipo_jornada, tipo_contrato, salario_min, salario_max, descripcion, requisitos[], estado, fecha_inicio, fecha_limite, created_by, ...)`.
  - `candidatos (id, empresa_id, vacante_id, nombre, apellidos, email, telefono, origen, fase, cv_url, ...)`.
- **DIVERGENCIA detectada:** `seedVacantesDesdeOrganigrama` inserta columnas `titulo`, `estado_publicacion`, `visible_publicamente`, `cuestionario`, `favorita`, `creado_por` — que **no** coinciden con el DDL de `005` (`puesto`, `estado`, `created_by`...). La BD viva ha **divergido** del archivo `005`. **VERIFICAR SCHEMA REAL de `vacantes` con Management API** antes de tocar nada que cruce roles↔vacantes.

---

## 5. slug vs uuid

- `empresa_roles.empresa_id`, `departamentos.empresa_id`, `vacantes.empresa_id`, `candidatos.empresa_id`: todos **uuid** (FK a `empresas.id`).
- El contexto cliente (`empresaActual.id`) pasa un **slug** en varios sitios; las actions resuelven slug→uuid (`getEmpresaIdFromSlug`, `resolveEmpresaId`). `empresas.slug` existe (usado en `accesos_apps`, `organigramas`, `empresa_logos`).
- **Regla para OLA2-10:** persistir y filtrar SIEMPRE por **uuid (`empresa_id`)**, resolviendo el slug del contexto en el server action. No usar el `empresaId="habana"/"bacanal"` del mock como clave de BD.

---

## 6. Conclusiones para el contrato

1. La unificacion de codigo es trivial (clones byte-identicos salvo import). Lo no-trivial es **decidir el destino funcional**: PuestosEmpresaTab y RolFormModal estan huerfanos; ReclutamientoView ya es real.
2. **No mezclar** el concepto "puesto+vacante" del mock con `empresa_roles` (permisos). Si se quiere persistir "puestos", el candidato natural es `roles_empresa` (005) **previa verificacion de que existe en prod**, o una tabla nueva; NO `empresa_roles`.
3. La integracion con reclutamiento es por **retirada**: `rolToVacante`/`getVacantesDesdeRoles` quedan muertos porque las vacantes ya vienen del organigrama.
4. Decision de negocio pendiente y bloqueante: ¿se mantiene "PUESTOS DE EMPRESA" como funcionalidad (y entonces se monta + persiste) o se elimina el mock + componentes huerfanos? El esfuerzo difiere en un orden de magnitud.
5. Marcar **VERIFICAR SCHEMA REAL** para: `vacantes` (divergencia detectada) y `roles_empresa` (tabla fantasma de `.claude/migrations`).
