# Discovery TASK-003 — Horarios y solicitudes

Fecha: 2026-05-26
Branch: `rrhh-sync-origin-c4da3ca` (mergeada a `main` en commit `709df40`)
Modo: `discovery` — no se ha tocado runtime.

## Resumen ejecutivo

**Solicitudes**: cadena completa funcional, modelo BD sólido, lifecycle cerrado, multiempresa con RLS correcta, reflejo en calendario PERSONAL OK. Listo para runtime.

**Horarios**: gap crítico. Hay dos planos:
- ✅ Plano "tipos" (`tipos_ausencia`, `tipos_fichaje`) y plano "patrones" (`rrhh_patrones`/`rrhh_patron_semanas`/`rrhh_patron_empleados`): completos, con RLS, CRUD y seed para BACANAL.
- ❌ Plano "operativo" (`rrhh_turnos`, `rrhh_cuadrantes`, `rrhh_descansos`): **sin migración versionada**. Las server actions las consultan pero no existen en `supabase/migrations/`. La cadena patrón → turno no cierra.

Conclusión: **no se puede cerrar horarios con el esquema actual**. Se necesita una task posterior de migración + seed alineado antes de cualquier runtime de planificación.

## Matriz tabla / acción / UI / estado / gap

| Tabla | Migración | Server actions | UI surface | Estado | Gap |
|-------|-----------|----------------|------------|--------|-----|
| `rrhh_patrones` | `20260515150000_rrhh_patrones.sql` ✅ | `listPatrones`, `createPatron`, `updatePatron`, `deletePatron` en `patrones-actions.ts` ✅ | `HorariosView` → `PatronesSection` ✅ | **OK** | Ninguno propio. Pero los `dias` apuntan a turno_ids textuales (`bt-art-cenas`, ...) que no existen en BD por gap de `rrhh_turnos`. |
| `rrhh_patron_semanas` | ✅ (misma migración) | Embebido en `patrones-actions.ts` ✅ | Misma sección ✅ | **OK** | Ídem: el array `dias` jsonb referencia turno_ids huérfanos. |
| `rrhh_patron_empleados` | ✅ (misma migración) | `getEmpleadosPorTurno` en `patrones-actions.ts` ✅ | Vista de asignaciones ✅ | **OK** | Funciona como matriz de asignación. Cadena empleado → patrón → semana → turno_id válida hasta el último salto. |
| `rrhh_turnos` | ❌ **NO existe migración** | `listTurnos`, presumible CRUD en `turnos-actions.ts` ❌ | `HorariosView` → `TurnosSection` (visible en sidebar) | **ROTO** | Action consulta `from("rrhh_turnos")` pero ninguna migración crea la tabla. Si funciona en producción es porque alguien la creó manualmente fuera del control de versiones. RLS y schema desconocidos. |
| `rrhh_cuadrantes` | ❌ **NO existe migración** | `listCuadrantes` en `turnos-actions.ts` ❌ | Asignable desde turno (`cuadrante_id`) ❌ | **ROTO** | Ídem. |
| `rrhh_descansos` | ❌ **NO existe migración** | `listDescansos`, CRUD en `descansos-actions.ts` ❌ | `HorariosView` → `DescansosSection` ❌ | **ROTO** | Ídem. Action consulta `from("rrhh_descansos")` sin tabla versionada. |
| `tipos_ausencia` | `085_horarios_tipos_ausencia_y_fichaje.sql` + `20260514120000_tipos_ausencia_sesame_alignment.sql` ✅ | CRUD completo en `horarios-config-actions.ts` con replicación multi-empresa ✅ | `HorariosView` → `TiposAusenciaSection` ✅ | **OK** | Re-seed Sesame deja solo 2 ausencias por defecto (Baja médica, Ausencia justificada). Diseño deliberado. |
| `tipos_fichaje` | `085_horarios_tipos_ausencia_y_fichaje.sql` ✅ | CRUD completo en `horarios-config-actions.ts` ✅ | `HorariosView` → `TiposFichajeSection` ✅ | **OK** | Seed con 7 códigos (ENT/SAL/IPA/FPA/MAN/COR/VAL). |
| `solicitudes_personal` | `050_mi_panel_solicitudes.sql` + `20260526160000_solicitudes_personal_baja_contrato.sql` ✅ | `crearSolicitudPersonal`, `listarMisSolicitudes`, `listarSolicitudesEmpresa`, `aprobarSolicitud`, `rechazarSolicitud` en `mi-panel-actions.ts` ✅ | `SolicitudesView` (RRHH) + `MiPanel` (empleado) ✅ | **OK** | Lifecycle completo (pendiente → aprobada/rechazada/anulada). Email automático en `aprobar` para `baja_contrato` con firma PDF y generación de carta de baja. |

## Cadenas verificadas

### Cadena empleado → patrón → turno
1. `empleados.id` ✅
2. `rrhh_patron_empleados (patron_id, empleado_id)` ✅
3. `rrhh_patron_semanas.dias` (jsonb array de 7 strings o null) ✅
4. ID textual del turno (`bt-coc-lun`, etc.) → **CORTE**: no hay tabla `rrhh_turnos` para resolver el ID.

Resultado: la cadena devuelve un nombre/horario de turno solo si la tabla `rrhh_turnos` existe en el entorno físico (no versionado). En un entorno limpio aplicando solo las migraciones del repo, los patrones quedan huérfanos.

### Cadena solicitud → aprobación → calendario
1. Empleado crea solicitud → `crearSolicitudPersonal` en mi-panel-actions ✅
2. Supervisor RRHH lista pendientes → `listarSolicitudesEmpresa("pendientes")` ✅
3. Supervisor aprueba → `aprobarSolicitud(id)` ✅ (incluye envío de email si subtipo es `baja_contrato`)
4. Empleado abre su calendario mes → `getMiCalendarioMes(anio, mes)` filtra solicitudes con `estado='aprobada'` y rellena `ausencia` o `trabajoExtra` por día ✅
5. RRHH operativo (planificación cuadrante/empresa) → **CORTE**: no existe vista RRHH que cruce solicitudes aprobadas con planificación. Ninguna server action de horarios consume `solicitudes_personal`.

Resultado: la cadena cierra para el empleado, no cierra para RRHH operativo.

## Riesgos multiempresa / RLS

| Plano | Estado RLS | Multiempresa | Notas |
|-------|------------|--------------|-------|
| `rrhh_patrones` y descendientes | ✅ select/insert/update/delete por `empresa_id IN (profile.empresa_id)` | ✅ aislamiento correcto | Política `all` con check de pertenencia vía join a `profiles`. |
| `tipos_ausencia` / `tipos_fichaje` | ✅ select/all por `empresa_id IN (profile.empresa_id)` | ✅ aislamiento correcto | Actions soportan replicación a múltiples empresas con array `replicarEn`. |
| `solicitudes_personal` | ✅ 4 policies: `read` por empresa, `insert_own` self+empresa, `update_own_pending` solo pendientes propias, `manage` por empresa para RRHH | ✅ correcto | Reglas combinan multiempresa + ownership. Diseño robusto. |
| `rrhh_turnos` / `_cuadrantes` / `_descansos` | ❓ **desconocido** | ❓ **desconocido** | Sin migración versionada, no podemos auditar las policies. Si la tabla existe en prod sin RLS o con RLS débil, hay riesgo de fuga entre empresas. |

## Anomalía adicional: seed BACANAL apunta a turno_ids inexistentes

En `20260515150100_rrhh_patrones_seed_bacanal.sql` se insertan 14 patrones cuyos `dias[]` referencian IDs como `bt-art-cenas`, `bt-coc-lun`, `bt-jc3-vie`, etc. **Ninguno de estos IDs existe en una tabla versionada**. El seed los inserta como strings huérfanos.

El comentario inline de [src/features/rrhh/data/horarios.ts:55-57](\\wsl.localhost\Ubuntu\home\fernandomp\dev\Balles-Hosteleros\src\features\rrhh\data\horarios.ts) afirma:
> "Datos de turnos, descansos, cuadrantes... ahora viven en Supabase (rrhh_turnos / rrhh_descansos / rrhh_cuadrantes / tipos_fichaje / tipos_ausencia)."
>
Esto es **falso para `rrhh_turnos`, `rrhh_descansos`, `rrhh_cuadrantes`** desde el punto de vista de un repo limpio con migraciones aplicadas en orden. Solo es cierto si alguien creó las tablas manualmente.

## Decisión

**No se puede cerrar el frente "horarios" con el esquema actual.** El plano operativo (turnos/cuadrantes/descansos) está implementado en código sin contrato BD versionado. Hasta que se cierre ese gap:

- Hay riesgo silencioso en producción (las queries pueden fallar o devolver datos sin RLS multi-empresa).
- Cualquier runtime nuevo sobre horarios construye sobre arena.
- Repos clonados desde cero o entornos de staging recién aprovisionados rompen.

**Solicitudes sí puede cerrarse** como flujo independiente: BD, actions, UI y lifecycle están alineados. No depende del gap de turnos.

## Siguiente task propuesta

**TASK-007 — Migración versionada de `rrhh_turnos / rrhh_cuadrantes / rrhh_descansos` + alineación seed BACANAL**

Scope:
1. Auditar el schema real de las tres tablas en el entorno actual (consulta a `pg_tables` y `information_schema.columns` en producción para reconstruir el DDL).
2. Crear migración nueva `2026MMDD_rrhh_turnos_cuadrantes_descansos.sql` con:
   - `rrhh_turnos`: PK uuid, FK `empresa_id` → `empresas`, FK opcional `cuadrante_id` → `rrhh_cuadrantes`, columnas inferidas del `rowToTurno` de `turnos-actions.ts` (`nombre`, `codigo`, `tramos jsonb`, `color`, `es_guardia`, `activo`, `centro`, `departamento`).
   - `rrhh_cuadrantes`: PK uuid, FK `empresa_id`, `nombre`.
   - `rrhh_descansos`: PK uuid, FK `empresa_id`, columnas de `rowToDescanso` en `descansos-actions.ts` (`nombre`, `icono`, `color`, `remunerado`, `cuando_fichar`, `intervalo_inicio`, `intervalo_fin`, `duracion_tipo`, `duracion_minutos`, `dias jsonb`, `turnos jsonb`, `activo`).
   - RLS por empresa idéntica a `rrhh_patrones`.
3. Migración separada `2026MMDD_seed_turnos_bacanal.sql` con los turno_ids que el seed actual de patrones referencia (`bt-art-cenas`, `bt-cal`, `bt-coc-lun`, etc.). Estos IDs son textuales, no UUID — decidir si seguir con strings legibles o cambiar a UUID y reescribir el seed de patrones para usar los nuevos UUIDs.
4. Reconciliar comentario de `data/horarios.ts` para que refleje la realidad.
5. Validar `npm run typecheck` y `npm run build` con BD limpia.

Modo recomendado: `code`. Estimación: media. Dependencias: TASK-003 (este discovery) cerrado.

## Frentes desbloqueados sin esperar a TASK-007

- **TASK-004 firmas hardening**: independiente. Puede ejecutarse en paralelo.
- **Runtime adicional sobre `solicitudes_personal`**: la base está sólida. Cualquier mejora de UX (notificaciones, recordatorios, filtros adicionales) no necesita TASK-007.
- **`tipos_ausencia`/`tipos_fichaje`**: si se quiere ampliar el catálogo, ya hay infraestructura completa.

## Frentes que SÍ esperan a TASK-007

- Cualquier vista RRHH de planificación operativa (cuadrantes semanales, gestión de turnos por local, asignación de descansos).
- TASK-005 (reclutamiento → empleado): aunque la dependencia documentada es TASK-002 + TASK-004, si el nuevo empleado se asigna a un patrón con turnos huérfanos, la integración será incompleta.
- Cualquier feature que consuma `getEmpleadosPorTurno` esperando nombres de turno legibles.

## Checklist de cierre (Full-TASK-003)

- [x] Cadena empleado → patrón verificada (con gap en último salto).
- [x] Cadena solicitud → aprobación → calendario verificada (cierra para empleado, no para RRHH).
- [x] Gaps con RLS / multiempresa documentados (`rrhh_turnos`/`_cuadrantes`/`_descansos` desconocidos por falta de migración).
- [x] Decisión de runtime posterior tomada: crear TASK-007 antes de cualquier runtime de planificación.

## Inputs auditados

- `supabase/migrations/050_mi_panel_solicitudes.sql`
- `supabase/migrations/085_horarios_tipos_ausencia_y_fichaje.sql`
- `supabase/migrations/20260514120000_tipos_ausencia_sesame_alignment.sql`
- `supabase/migrations/20260515150000_rrhh_patrones.sql`
- `supabase/migrations/20260515150100_rrhh_patrones_seed_bacanal.sql`
- `supabase/migrations/20260526160000_solicitudes_personal_baja_contrato.sql`
- `src/features/rrhh/actions/patrones-actions.ts`
- `src/features/rrhh/actions/horarios-config-actions.ts`
- `src/features/rrhh/actions/turnos-actions.ts`
- `src/features/rrhh/actions/descansos-actions.ts`
- `src/features/mi-panel/actions/mi-panel-actions.ts` (~1270 líneas; revisado calendario + solicitudes)
- `src/features/rrhh/components/horarios/HorariosView.tsx`
- `src/features/rrhh/components/solicitudes/SolicitudesView.tsx`
- `src/features/rrhh/data/horarios.ts`
