# Plan RRHH - consolidacion

Fecha: 2026-05-20
Repo: `Balles-Hosteleros`
Documento base: `docs/INFORME_RRHH_EVALUACION_INICIAL_2026-05-20.md`

## 1. Resumen ejecutivo

Objetivo: consolidar Recursos Humanos como modulo operativo real, partiendo del codigo ya existente y evitando una reescritura innecesaria.

La estrategia queda fijada asi:

1. estabilizar base y checkpoints
2. consolidar `empleados`
3. consolidar ficha de empleado
4. consolidar `fichajes` junto con `mi-panel`
5. consolidar `horarios` y `solicitudes`
6. consolidar `firmas`
7. consolidar `reclutamiento`
8. dejar `accesos apps` fuera del plan principal de RRHH y tratarlo despues como remediacion separada

Resultado esperado al final del plan:

- RRHH deja de ser un conjunto de subrutas desiguales y pasa a ser un modulo coherente
- se elimina la dependencia de mocks en los flujos nucleares
- los flujos clave quedan trazables por empresa y por empleado
- el modulo queda listo para una fase posterior de hardening y validacion operativa profunda

## 2. Decisiones cerradas

- `empleados` es el punto de entrada del trabajo y la fuente canonica de continuidad.
- `mi-panel` forma parte del alcance funcional de RRHH en todo lo relativo a fichajes, solicitudes y experiencia del empleado.
- `/rrhh` debe convertirse en hub operativo real; no puede seguir vacio.
- los tabs legacy mock-driven de la ficha de empleado deben eliminarse del flujo real o quedar sustituidos por lecturas reales o placeholders honestos conectados a submodulos reales.
- `accesos apps` no entra en este plan porque no pertenece al nucleo funcional de RRHH y abre un frente distinto de gestion de secretos y seguridad.

## 3. Cambios de implementacion por fases

### Fase 0. Baseline y control de cambios

Objetivo:

- arrancar la consolidacion desde un estado verificable

Acciones:

- revisar `git status`
- restaurar solo ruido local generado por tooling si sigue limitado a `next-env.d.ts`
- ejecutar `npm run typecheck`
- ejecutar `npm run build`
- usar el informe base como referencia de alcance y secuencia

Criterio de salida:

- repo en estado entendible
- baseline tecnico validado

### Fase 1. Hub real de RRHH

Objetivo:

- sustituir la pantalla vacia de `/rrhh` por una entrada funcional al modulo

Cambios:

- reemplazar [`src/app/(main)/rrhh/page.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/app/(main)/rrhh/page.tsx:1>) por un dashboard operativo sobrio
- mostrar resumen real por empresa activa:
  - empleados activos
  - altas recientes
  - fichajes abiertos o incidencias
  - firmas pendientes
  - solicitudes pendientes
- incluir accesos directos a:
  - empleados
  - fichajes
  - horarios
  - firmas
  - reclutamiento
  - solicitudes

Interfaces nuevas:

- crear una lectura agregada tipo `getRrhhDashboard()` o equivalente server-side

Criterio de salida:

- `/rrhh` ya sirve como punto real de entrada y supervision

### Fase 2. Consolidacion de empleados

Objetivo:

- dejar `empleados` como nucleo canonico del modulo

Cambios:

- conservar el flujo actual de alta real en [`src/features/rrhh/actions/empleados-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/empleados-actions.ts:92>)
- revisar validacion de pertenencia multiempresa y empresa principal
- revisar alta, edicion, cambio de estado y baja
- eliminar el uso de datasets mock en cualquier flujo funcional real que aun dependa de [`src/features/rrhh/data/rrhh.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/data/rrhh.ts:1>)
- mantener `user_empresas` como fuente de verdad de pertenencia

Interfaces/contratos:

- `empleados.user_id` sigue siendo obligatorio
- `user_empresas` sigue siendo la fuente canonica de acceso multiempresa

Criterio de salida:

- alta y gestion de empleados funcionan como flujo principal sin soporte de mocks

### Fase 3. Consolidacion de ficha de empleado

Objetivo:

- convertir la ficha individual en una vista real y no en una mezcla de backend y legacy

Cambios:

- revisar [`src/app/(main)/rrhh/empleados/[id]/page.tsx`](</home/fernandomp/dev/Balles-Hosteleros/src/app/(main)/rrhh/empleados/[id]/page.tsx:1>)
- mantener `perfil` sobre datos reales
- mantener `firmas` sobre backend real
- sustituir tabs mock de `fichajes` y `horarios` por lecturas reales por empleado
- para tabs sin detalle real por empleado, mostrar acceso contextual al submodulo real, no simulacion

Interfaces nuevas:

- `listFichajesEmpleado(empleadoId, rango)`
- `getEmpleadoHorarioActual(empleadoId)`
- `listSolicitudesEmpleado(empleadoId)`
- reutilizar `listFirmasPorEmpleado(empleadoId)`

Criterio de salida:

- la ficha ya no depende de shapes mock para representar datos criticos

### Fase 4. Consolidacion de fichajes y mi-panel

Objetivo:

- unificar la experiencia empleado/supervisor sobre un mismo modelo funcional

Cambios:

- revisar diferencias entre:
  - [`src/features/rrhh/actions/fichajes-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/fichajes-actions.ts:1>)
  - [`src/features/mi-panel/actions/mi-panel-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/mi-panel/actions/mi-panel-actions.ts:98>)
- fijar una unica lectura funcional de:
  - fichaje actual
  - historial
  - pausas
  - incidencias
  - cierre manual
- validar local asignado, geolocalizacion y teletrabajo
- mantener y revisar el cron de fichajes huerfanos

Contratos:

- RRHH supervisa y corrige
- empleado registra y consulta
- ambos leen la misma realidad de datos

Criterio de salida:

- flujo de fichajes consistente entre RRHH y `mi-panel`

### Fase 5. Consolidacion de horarios y solicitudes

Objetivo:

- cerrar el modelo laboral diario y su reflejo en la operativa

Cambios:

- conectar empleado -> patron -> asignacion -> calendario -> fichaje
- validar la base actual de:
  - tipos de ausencia
  - tipos de fichaje
  - patrones
  - asignaciones
- consolidar el flujo de solicitudes personales:
  - empleado crea
  - supervisor o RRHH revisa
  - el estado aprobado o rechazado queda reflejado de forma trazable

Interfaces/contratos:

- las solicitudes deben poder consultarse por empleado y por empresa
- horarios y ausencias deben poder leerse desde RRHH sin recurrir a mocks

Criterio de salida:

- horarios y solicitudes dejan de ser piezas sueltas y pasan a formar parte del circuito laboral real

### Fase 6. Consolidacion de firmas

Objetivo:

- cerrar un flujo sensible pero ya bastante avanzado

Cambios:

- revisar [`src/features/rrhh/actions/firmas-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/firmas-actions.ts:1>)
- validar:
  - subida de PDF
  - hash
  - token
  - OTP si aplica
  - trazabilidad de eventos
  - expiracion
  - permisos por empresa
- revisar el cron [`src/app/api/cron/firmas-expirar/route.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/app/api/cron/firmas-expirar/route.ts:1>)

Criterio de salida:

- firmas queda utilizable como submodulo real en entorno controlado

### Fase 7. Consolidacion de reclutamiento

Objetivo:

- cerrar el circuito de captacion y conversion a empleado

Cambios:

- revisar [`src/features/rrhh/actions/reclutamiento-actions.ts`](</home/fernandomp/dev/Balles-Hosteleros/src/features/rrhh/actions/reclutamiento-actions.ts:1>)
- validar:
  - vacantes
  - candidatura publica
  - CV/PDF
  - candidato interno
  - pipeline
  - promocion a empleado
- conectar la promocion al flujo canonico de alta de empleados

Criterio de salida:

- reclutamiento deja de ser una isla y queda unido al nucleo de RRHH

### Fase 8. Accesos apps fuera del plan principal

Objetivo:

- fijar explicitamente que no se mezcla este frente con la consolidacion de RRHH

Decisiones:

- no incluir `accesos apps` en la fase principal
- tratarlo despues como remediacion especifica
- asumir que su problema es:
  - gestion de secretos
  - revelado de credenciales
  - permisos finos
  - auditoria y seguridad

Criterio de salida:

- el equipo no mezcla dominio RRHH con dominio de secretos operativos

## 4. Casos de prueba obligatorios

### Baseline

- `npm run typecheck`
- `npm run build`

### Empleados

- alta de empleado con email personal
- alta con email empresa
- alta con una empresa
- alta con varias empresas
- cambio de estado a activo
- cambio de estado a baja temporal
- cambio de estado a baja definitiva

### Ficha de empleado

- abrir ficha de empleado real
- ver perfil real
- ver empresas de acceso
- ver firmas asociadas
- ver fichajes reales
- ver horario real o placeholder honesto si aun no existe ese detalle

### Fichajes

- empleado ficha entrada
- empleado inicia pausa
- empleado finaliza pausa
- empleado ficha salida
- RRHH crea fichaje manual
- cron cierra fichaje huerfano con `CRON_SECRET`

### Solicitudes y horarios

- empleado crea solicitud
- RRHH la aprueba
- RRHH la rechaza
- el calendario o estado asociado refleja el resultado
- patrones y asignaciones se leen sin romper multiempresa

### Firmas

- RRHH sube documento
- se genera token
- empleado firma
- queda trazabilidad
- documento vence y cron lo expira

### Reclutamiento

- vacante visible
- candidatura publica recibida
- candidato visible en RRHH
- promocion a empleado usando flujo canonico

## 5. Riesgos y controles

- riesgo: mezclar datos reales con mocks y dar una falsa sensacion de cierre
  control: eliminar mocks de flujos nucleares y dejar placeholders honestos donde aun no haya backend cerrado

- riesgo: romper multiempresa
  control: validar cada flujo con empresa principal y acceso secundario

- riesgo: consolidar RRHH ignorando `mi-panel`
  control: planificar fichajes y solicitudes como flujo compartido empleado/supervisor

- riesgo: entrar antes de tiempo en seguridad de secretos
  control: dejar `accesos apps` fuera del alcance principal

## 6. Criterio final de exito

Se considerara completada esta consolidacion cuando:

- `/rrhh` sea un hub operativo real
- `empleados` funcione como nucleo canonico
- la ficha de empleado use datos reales en los frentes clave
- `fichajes`, `horarios`, `solicitudes`, `firmas` y `reclutamiento` queden integrados con el modelo laboral real
- no queden mocks sosteniendo flujos nucleares de RRHH
- el modulo pueda recorrerse y validarse por empresa y por empleado sin ambiguedad funcional

