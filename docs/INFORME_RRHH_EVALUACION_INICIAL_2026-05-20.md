# Informe RRHH - evaluacion inicial

Fecha: 2026-05-20
Repo: `Balles-Hosteleros`
Base revisada: codigo actual del repo + informe externo `pdf5-inventario-modulos-madurez-funcional.pdf`

## 1. Objetivo del informe

Este documento deja una primera lectura tecnica y funcional del modulo de Recursos Humanos para retomar el trabajo desde el estado real del codigo, no solo desde el informe PDF.

La idea no es cerrar un plan definitivo todavia, sino fijar:

- que partes de RRHH tienen base real aprovechable
- que partes siguen mezcladas con legacy, mocks o placeholders
- que riesgos bloquean una continuidad segura
- cual es el punto razonable de arranque para una planificacion posterior de principio a fin

## 2. Veredicto ejecutivo

La conclusion es clara:

- RRHH no esta "por hacer"; tiene una base funcional amplia y reusable.
- El nucleo mas solido hoy es `empleados` y parte de `mi-panel` / `fichajes`.
- `firmas`, `horarios` y `reclutamiento` tienen bastante implementacion real, pero aun no forman un flujo completamente consolidado de producto.
- La experiencia global de RRHH no esta cerrada como modulo coherente: hay rutas reales, pero tambien pantallas vacias, tabs legacy y componentes que aun dependen de mock/fallback.
- `accesos apps` debe tratarse como frente separado y de alto riesgo, no como parte del arranque normal de RRHH.

Lectura operativa:

- punto de entrada recomendado para continuar: `empleados`
- segunda capa natural: `fichajes` + `mi-panel`
- tercera capa: `firmas`, `horarios`, `solicitudes`, `reclutamiento`
- fuera de fase inicial: `accesos apps`

## 3. Evidencias principales encontradas

### 3.1. La landing de RRHH esta vacia

La ruta principal [`src/app/(main)/rrhh/page.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/app/(main)/rrhh/page.tsx:1>) devuelve un contenedor vacio. Esto significa que el modulo existe por subrutas, pero no tiene un hub funcional consolidado.

Impacto:

- mala continuidad de producto
- experiencia de entrada inconsistente
- dificulta una demo o un recorrido operativo del area

### 3.2. Empleados es el frente mas maduro

La accion [`src/features/rrhh/actions/empleados-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/empleados-actions.ts:21>) implementa logica real de listado y enriquecimiento por `user_empresas`.

El alta en [`createEmpleado`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/empleados-actions.ts:92>) ya hace el flujo serio:

- valida admin y pertenencia a empresas
- crea `auth.user`
- actualiza `profiles`
- inserta `user_roles`
- inserta `user_empresas`
- crea `empleados`
- hace rollback si falla la insercion del empleado

Ademas, la pantalla de alta [`src/app/(main)/rrhh/empleados/nuevo/page.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/app/(main)/rrhh/empleados/nuevo/page.tsx:26>) soporta:

- multiempresa
- empresa principal
- asignacion de local por empresa
- entrega de credenciales temporales

Esto ya no es prototipo. Es una base real de dominio.

### 3.3. La ficha de empleado esta a medio migrar

La ficha individual [`src/app/(main)/rrhh/empleados/[id]/page.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/app/(main)/rrhh/empleados/[id]/page.tsx:61>) deja explicitamente que algunos tabs siguen siendo legacy mock-driven.

Puntos concretos:

- `perfil` usa datos reales mediante `getEmpleadoConPerfil`
- `firmas` ya apunta a backend real
- `fichajes` y `horarios` convierten el empleado real a shape mock
- muchos tabs (`solicitudes`, `calendarios`, `reclutamiento`, `boarding`, `bonus`, `points`, `pagos`, `formacion`, `encuestas`, `cuestionarios`) redirigen a placeholders de submodulo

La implementacion heredada de tabs en [`src/features/rrhh/components/empleados/FichaTabsContent.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/components/empleados/FichaTabsContent.tsx:19>) confirma que parte del detalle sigue siendo demostracion visual o contenido sintetico, no trazabilidad real por empleado.

## 4. Estado por submodulo

### 4.1. Empleados

Estado actual: base real con prioridad alta para continuidad.

Lo que ya existe:

- tabla y migraciones especificas de empleados
- alta real con usuario, perfil, rol y accesos
- lectura enriquecida por multiempresa
- cambio de estado del empleado
- formulario de datos personales compartido con `mi-panel`

Evidencias:

- [`supabase/migrations/065_rrhh_empleados.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/065_rrhh_empleados.sql:11>)
- [`supabase/migrations/072_empleados_user_id_required.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/072_empleados_user_id_required.sql:18>)
- [`supabase/migrations/068_empleados_estado_constraint.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/068_empleados_estado_constraint.sql:13>)

Huecos actuales:

- ficha por empleado no migrada de forma uniforme
- coexistencia de datos reales con tabs mock
- `rrhh/page.tsx` no organiza el modulo

Evaluacion:

- es el mejor punto de arranque para retomar RRHH

### 4.2. Fichajes

Estado actual: implementacion real, pero con doble via y necesidad de consolidacion.

Lo que ya existe:

- acciones RRHH para fichaje con geolocalizacion y local asignado
- registro manual desde RRHH
- acciones personales desde `mi-panel`
- cron para cerrar fichajes huerfanos
- RLS canonico reciente

Evidencias:

- [`src/features/rrhh/actions/fichajes-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/fichajes-actions.ts:60>)
- [`src/features/mi-panel/actions/mi-panel-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/mi-panel/actions/mi-panel-actions.ts:127>)
- [`src/app/api/cron/cerrar-fichajes-huerfanos/route.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/app/api/cron/cerrar-fichajes-huerfanos/route.ts:16>)
- [`supabase/migrations/056_fichajes.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/056_fichajes.sql:1>)
- [`supabase/migrations/20260514130000_rrhh_centros_y_geolocalizacion.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/20260514130000_rrhh_centros_y_geolocalizacion.sql:3>)
- [`supabase/migrations/20260518110000_mensajes_fichajes_rls_canonico.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/20260518110000_mensajes_fichajes_rls_canonico.sql:92>)

Huecos actuales:

- coexistencia de flujo RRHH y flujo `mi-panel` que no parecen unificados al 100%
- falta validar el comportamiento end-to-end con datos reales
- la ficha por empleado sigue apoyandose en tab legacy para parte del detalle

Evaluacion:

- submodulo aprovechable y cercano a consolidacion
- deberia entrar en la primera fase operativa tras estabilizar `empleados`

### 4.3. Firmas

Estado actual: submodulo potente y sensible.

Lo que ya existe:

- tablas de documentos, tokens, OTPs y eventos
- subida de PDF a storage
- hash del documento
- trazabilidad / auditoria
- expiracion por cron
- validaciones por empresa y estado del empleado

Evidencias:

- [`src/features/rrhh/actions/firmas-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/firmas-actions.ts:199>)
- [`src/app/api/cron/firmas-expirar/route.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/app/api/cron/firmas-expirar/route.ts:19>)
- [`supabase/migrations/20260515160000_firmas_eidas.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/20260515160000_firmas_eidas.sql:10>)

Huecos actuales:

- alto acoplamiento a secretos y storage
- no he validado smoke funcional real en esta evaluacion
- sigue siendo un frente sensible por seguridad y cumplimiento

Evaluacion:

- no esta verde para tratarlo como "hecho"
- pero tampoco es maqueta; merece una fase propia de consolidacion

### 4.4. Horarios

Estado actual: backend parcial real + superficie de UI amplia + mezcla con legacy.

Lo que ya existe:

- migracion de tipos de ausencia y tipos de fichaje
- migraciones de patrones y asignaciones
- acciones para turnos, patrones, descansos y configuracion
- vista dedicada de horarios

Evidencias:

- [`supabase/migrations/085_horarios_tipos_ausencia_y_fichaje.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/085_horarios_tipos_ausencia_y_fichaje.sql:12>)
- [`supabase/migrations/20260515150000_rrhh_patrones.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/20260515150000_rrhh_patrones.sql:12>)
- [`src/features/rrhh/actions/horarios-config-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/horarios-config-actions.ts:1>)
- [`src/features/rrhh/components/horarios/HorariosView.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/components/horarios/HorariosView.tsx:1>)

Huecos actuales:

- el tab de horarios en ficha individual sigue siendo legacy
- no esta clara todavia la trazabilidad completa empleado -> patron -> calendario -> fichaje
- no hay evidencia en esta revision de smoke completo sobre una empresa real

Evaluacion:

- mas maduro de lo que sugiere una simple UI
- aun no lo trataria como submodulo cerrado

### 4.5. Solicitudes y Mi Panel

Estado actual: base real y relevante para RRHH aunque viva en otra superficie funcional.

Lo que ya existe:

- tabla propia de solicitudes personales
- listados por empleado y por empresa
- acciones personales desde `mi-panel`
- dependencia directa con fichajes, ausencia y contexto de empresa activa

Evidencias:

- [`supabase/migrations/050_mi_panel_solicitudes.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/050_mi_panel_solicitudes.sql:14>)
- [`src/features/mi-panel/actions/mi-panel-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/mi-panel/actions/mi-panel-actions.ts:36>)

Huecos actuales:

- el acoplamiento entre RRHH y `mi-panel` obliga a planificar ambos juntos
- no parece existir aun un cierre uniforme de experiencia supervisor/empleado

Evaluacion:

- no debe planificarse RRHH ignorando `mi-panel`

### 4.6. Reclutamiento

Estado actual: base funcional real, pero todavia en validacion.

Lo que ya existe:

- vacantes y candidatos
- mapeo real desde Supabase a la vista heredada
- integracion con organigrama
- seed de vacantes desde organigrama
- portal publico y rutas de candidatura

Evidencias:

- [`src/features/rrhh/actions/reclutamiento-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/reclutamiento-actions.ts:50>)
- [`src/app/empleo/[slug]/page.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/app/empleo/[slug]/page.tsx:1>)
- [`src/app/api/empleo/candidatura/route.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/app/api/empleo/candidatura/route.ts:1>)

Huecos actuales:

- parte de la vista sigue adaptando tipos legacy
- hay configuraciones con contenido mock o no conectado
- necesita smoke de flujo completo candidato -> vacante -> promocion interna

Evaluacion:

- buen candidato para una fase posterior a `empleados` y `fichajes`

### 4.7. Accesos apps

Estado actual: alto riesgo, no apto como frente inicial.

Lo que ya existe:

- CRUD real
- lectura por empresa y lectura global para admin/director
- almacenamiento de `usuario` y `contrasena` en tabla funcional

Evidencias:

- [`src/features/rrhh/actions/accesos-apps-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/accesos-apps-actions.ts:7>)

Riesgo:

- persiste contrasenas
- las devuelve a la UI
- es un frente de seguridad por definicion

Evaluacion:

- excluir de la primera ola de desarrollo de RRHH
- tratarlo como remediacion especifica

## 5. Dependencias transversales que condicionan el modulo

### 5.1. Multiempresa

La pieza central es `user_empresas`, ya versionada como estructura canonica en [`supabase/migrations/20260518000000_user_empresas_canonico.sql`](</home/fernandomp/dev/Balles-Hosteleros/supabase/migrations/20260518000000_user_empresas_canonico.sql:31>).

Esto mejora mucho la base de RRHH, porque `empleados`, `fichajes`, `firmas` y el contexto de empresa dependen de ello. Aun asi, RRHH debe pensarse siempre bajo esta premisa:

- cada flujo debe validarse con empresa principal
- accesos secundarios deben probarse
- la ficha de empleado multiempresa aun necesita consolidacion funcional

### 5.2. Mezcla de dominio real y legacy

Hay varios sintomas claros:

- `src/app/(main)/rrhh/page.tsx` vacio
- `src/features/rrhh/data/rrhh.ts` sigue siendo dataset mock exportable
- `src/features/rrhh/io/empleados.io.ts` sigue leyendo ese dataset mock
- la ficha por empleado usa conversion a shape mock para tabs heredados

Esto no invalida el trabajo hecho, pero si obliga a una limpieza de arquitectura antes de considerar RRHH como producto coherente.

### 5.3. Secretos, crons y service role

Firmas y fichajes dependen de:

- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- storage y rutas server-side

Eso no impide avanzar, pero implica que cualquier plan posterior debe separar:

- consolidacion funcional
- endurecimiento operativo

## 6. Lectura de madurez actual

Si traduzco el estado del codigo a una escala operativa propia, la foto es esta:

- `Empleados`: A-
- `Fichajes`: B+
- `Mi Panel RRHH relacionado`: B
- `Firmas`: B / D segun el criterio sea funcional o de riesgo
- `Horarios`: B-
- `Reclutamiento`: B-
- `Solicitudes`: B
- `Accesos apps`: D
- `Hub principal RRHH`: C/D porque practicamente no existe como modulo orquestado

## 7. Punto de arranque recomendado para la siguiente fase

Si la siguiente conversacion va a ser planificar "de principio a fin", mi recomendacion es no arrancar por el modulo mas vistoso ni por el mas sensible.

El orden natural de continuidad es:

1. Consolidar `empleados` como nucleo canonico.
2. Cerrar `fichajes` + `mi-panel` como flujo empleado/supervisor.
3. Unificar `horarios`, `solicitudes` y trazabilidad por empleado.
4. Consolidar `firmas`.
5. Consolidar `reclutamiento`.
6. Dejar `accesos apps` como remediacion separada.

La razon es simple:

- `empleados` define identidad, pertenencia, empresa, perfil y acceso
- `fichajes` consume ese modelo
- `horarios`, `solicitudes` y `firmas` dependen de tener ese nucleo estable
- `reclutamiento` puede crecer despues sin bloquear el nucleo laboral

## 8. Conclusiones para planificar despues

Esta evaluacion deja cuatro conclusiones firmes:

- RRHH ya tiene suficiente base como para no reconstruir desde cero.
- El frente correcto no es "hacer RRHH", sino consolidar y unificar RRHH.
- El mejor punto de entrada para una hoja de ruta es `empleados`, no `firmas` ni `accesos apps`.
- El plan posterior debera separar con claridad:
  - consolidacion del nucleo
  - migracion de legacy/mock
  - smokes funcionales
  - hardening de seguridad y operacion

## 9. Limites de esta evaluacion

Esta revision ha sido:

- estatica sobre el codigo actual
- contrastada con el PDF de inventario
- apoyada en el hecho de que el repo ya paso `typecheck` y `build` antes de esta inspeccion

No he hecho en esta fase:

- smoke tests funcionales especificos de RRHH
- validacion real de flujos con usuarios y empresas de prueba
- auditoria profunda de RLS tabla por tabla fuera de los frentes mas evidentes
- plan detallado de ejecucion

## 10. Siguiente uso recomendado de este informe

Usar este documento como base para el siguiente paso:

- convertir esta lectura en un plan completo de implementacion y consolidacion de RRHH, desde el estado actual hasta una version cerrada de producto

