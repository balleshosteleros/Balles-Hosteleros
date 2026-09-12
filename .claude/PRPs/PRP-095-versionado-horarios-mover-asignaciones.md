# PRP-095: Cambiar un horario sin dejar a nadie atrás

> **Estado**: SUSTITUIDO POR PRP-096 (12-09-2026) — no ejecutar. El arreglo de
> `rrhh_crear_version_turno` y el relevo real de asignaciones se conservan como Fase 1 de
> `PRP-096-el-patron-es-el-horario.md`.
> **Fecha**: 2026-09-12
> **Proyecto**: Balles-Hosteleros
> **Relacionado**: PRP-053 (versionado de turnos, implementado a medias), migración manual `20260911120000_horario_jefes_sala_bacanal_desde_14_09.sql`

---

## Objetivo

Que cambiar el horario de un turno o la semana de un patrón sea una operación completa y segura desde la pantalla: el sistema pregunta **a quién se aplica** (uno a uno o a todos) y **desde qué día**, **mueve de verdad** las asignaciones de los elegidos a la versión nueva, **cierra** la anterior el día antes, y **nunca** deja a nadie con dos horarios el mismo día.

De paso se arreglan los dos fallos que hoy lo impiden: la función `rrhh_crear_version_turno` está rota (escribe una columna `color` que ya no existe) y el asistente crea asignaciones directas a quien tiene el turno por patrón, duplicándole el día.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| **Crear una versión de turno falla siempre.** La función de BD escribe `color`, columna eliminada el 19-06-2026. Verificado en la BD viva: `ERROR: column "color" of relation "rrhh_turnos" does not exist`. El botón "Crear nueva versión de turno" no ha funcionado nunca desde entonces. | Reescribir la función: fuera `color`, y que copie TODO lo que define la jornada (`tipo_jornada`, `dias`, `flex_horas`, `flex_horas_dia`, `flex_modo`, `vigente_hasta`), no solo los tramos. |
| **Cambiar la semana de un patrón deja a todo el mundo atrás.** `crearVersionPatron` documenta explícitamente que "los empleados YA asignados NO se mueven". La versión nueva nace sin nadie: el cuadro nuevo existe pero nadie lo trabaja, y la lista muestra "0 empleados". | El asistente pregunta a quién se aplica y desde qué día, y mueve las asignaciones elegidas a la versión nueva. |
| **La versión vieja nunca se cierra.** Ni en turnos ni en patrones: la asignación anterior se queda con `vigente_hasta` NULL. Desde el día del cambio, el motor de horario ve v1 **y** v2 → dos turnos el mismo día. | Relevo real: a la asignación vieja se le pone fin la víspera; la nueva empieza el día elegido. Una sola primitiva compartida. |
| **A quien tiene el turno por patrón se le crea una asignación directa.** El asistente recibe la lista combinada (directos + patrón) y preselecciona a todos; los de patrón acaban con asignación directa a v2 mientras su patrón sigue apuntando a v1 → dos turnos ese día. | En el asistente de turno solo son elegibles los de asignación directa. Los de patrón se muestran informados ("su horario viene del patrón X") y se cambian versionando el patrón. Guardado con candado también en servidor. |
| **Hoy esto solo se puede hacer escribiendo SQL a mano.** El cuadrante de los jefes de sala de BACANAL (14-09-2026) se cargó con una migración manual de 130 líneas. | La pantalla hace exactamente lo que hacía esa migración. |

**Valor de negocio**: un cambio de horario es una decisión de dirección que hoy exige un programador. Con esto lo hace RRHH en un minuto, sin tocar el pasado (nóminas, fichajes e inspecciones quedan intactos) y sin el riesgo de duplicar turnos, que descuadra horas teóricas y fichajes.

---

## Qué

### Criterios de Éxito

- [ ] Crear una versión de un turno **funciona** (hoy revienta): la función `rrhh_crear_version_turno` ya no escribe `color`.
- [ ] La versión nueva de un turno **hereda la jornada completa** de la anterior: `tipo_jornada`, `dias`, `flex_horas`, `flex_horas_dia`, `flex_modo` y `vigente_hasta`. Un turno flexible versionado sigue siendo flexible con sus mismas horas.
- [ ] Al crear versión (turno **o** patrón) el asistente pregunta siempre dos cosas: **a quién se aplica** (lista con marcar uno a uno + "Aplicar a todos") y **desde qué día**.
- [ ] Las asignaciones de los elegidos **se mueven de verdad**: la fila anterior queda cerrada con `vigente_hasta` = víspera del día elegido, y se crea la nueva con `vigente_desde` = ese día. A quien no se marque no se le toca nada.
- [ ] **Ningún empleado tiene dos turnos el mismo día** por efecto del cambio: consulta de verificación sobre el motor (`getHorarioDia`) antes y después del cambio para los afectados.
- [ ] En el asistente de **turno**, los empleados cuyo horario viene de un **patrón** aparecen marcados como tal y **no son seleccionables**: se avisa de que ese horario se cambia versionando el patrón. El servidor rechaza la asignación directa aunque llegue forzada.
- [ ] Al versionar un **patrón**, la versión anterior se cierra (`vigente_hasta` = víspera, `es_oficial = false`) y la nueva nace con `vigente_desde` = el día elegido — igual que hizo la migración manual de los jefes de sala.
- [ ] La lista de patrones muestra los empleados de la **familia** (no solo los de la fila oficial), de modo que tras versionar no aparece "0 empleados".
- [ ] Fechas en pantalla en **día/mes/año** y con el **selector de fecha propio** (`selector-fecha.tsx`), nunca el del navegador.
- [ ] Multi-empresa intacto: el bloqueo "manda el turno" se resuelve con la **empresa activa**, no con la empresa principal del perfil.
- [ ] Si al aplicar un cambio algún empleado quedaría con dos horarios ese día, la operación **no se guarda** y se explica en pantalla cuál y por qué.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

> **El sitio para cambiar una semana es Patrones, no Turnos.** Decidido con Iván
> el 12-09-2026: si cada turno pregunta por su cuenta si versionar el patrón,
> cambiar los siete días crea siete versiones del patrón para un solo cambio de
> semana. Se cambia la semana entera de una vez, en un sitio, con una fecha.

**Happy path A — cambiar la semana de un patrón (el camino normal)**

1. RRHH abre `/rrhh/horarios` → Patrones → editar un patrón. Ve los siete días
   con **las horas de cada uno a la vista**, no solo el nombre del turno.
2. Cambia lo que quiera: las **horas** de uno o varios días, cambiar el turno de
   un día por otro, o dejar un día libre.
3. Pulsa "Guardar". El asistente pregunta **una sola vez**: desde qué día y a
   quién (los que siguen ese patrón, con "Aplicar a todos" marcado por defecto).
4. Al confirmar, en **una sola transacción**:
   - Cada día cuyo horario cambió estrena **versión de turno** con esa fecha; el
     turno viejo se queda intacto y cerrado la víspera.
   - Nace **una** versión del patrón con esos turnos, vigente desde ese día.
   - La versión anterior del patrón se cierra la víspera.
   - Las asignaciones de los elegidos se mueven con el relevo.
5. Resultado: una versión de patrón, una fecha, y lo pasado intacto — los
   fichajes y las horas ya cerradas siguen leyendo los turnos de entonces.

**Si un turno que cambia lo usan otros patrones**, se avisa antes de confirmar
con el nombre de esos patrones: se quedan con el horario anterior, porque siguen
apuntando al turno viejo. Es lo normal (cada turno suele ser de un solo puesto),
pero si se comparte hay que verlo antes de guardar, no después.

**Happy path B — cambiar un turno suelto desde Turnos (el caso raro)**

Para corregir un turno puntual o uno que se asigna en directo, sin pasar por la
semana. Mismo asistente: desde qué día y a quién. Los que tienen ese turno **por
un patrón** salen listados en gris con la nota «viene del patrón «X» — cámbialo
desde ahí», y no se pueden marcar: si se les asignara en directo, ese día
tendrían dos turnos (el suyo por patrón y el nuevo suelto).

**Caso — no aplicar a nadie**: se permite (la versión queda creada y oficial, para futuras contrataciones, porque el puesto apunta a la familia), avisando en pantalla de que nadie la trabaja todavía.

**Caso — fecha en el pasado**: permitida, pero si al empleado le pisa un tramo ya vigente de otra versión, se bloquea con el motivo concreto.

---

## Contexto

### Hallazgos verificados en la BD viva (12-09-2026)

- `rrhh_crear_version_turno` en producción **sigue con `color`**; prueba ejecutada y revertida: `ERROR: column "color" of relation "rrhh_turnos" does not exist`. Crear versión de turno está roto al 100 %.
- La función **no copia** `tipo_jornada`, `dias`, `flex_horas`, `flex_horas_dia`, `flex_modo` ni `vigente_hasta`. Todos tienen `DEFAULT` ('fijo', '{}', '{}', 'diario') → una versión de un turno flexible nacería como fijo sin horas. Pérdida de datos silenciosa.
- La función **no cierra** la asignación anterior; solo valida que la fecha nueva sea posterior. La fila vieja queda con `vigente_hasta` NULL → v1 y v2 aplican a la vez.
- `crearVersionPatron` no recibe `vigente_desde`: la versión nueva tomaría `CURRENT_DATE` por defecto, y la anterior se queda **sin** `vigente_hasta` y `activo = true` → dos versiones vivas a la vez.
- Las 5 familias de patrón con versión 2 que hay en BD (`…0009`, `…000a`, `…000b`, `…000f`, `…0010`) están todas bien fechadas (1: →13-09, 2: 14-09→∞) porque se hicieron **a mano** por migración, no por la pantalla.
- Hoy no hay duplicados en datos: 19 empleados con patrón, 2 con asignación directa, 0 con ambos. El fallo es latente, no aún materializado — pero salta al primer uso de la pantalla.
- `asignarEmpleadosPatron` (patrones-actions.ts) **no la llama nadie**: las asignaciones a patrón entran solo por puesto (contratación/promoción). O se convierte en la vía del asistente, o se borra (regla de cero deuda).

### Referencias

- `supabase/migrations/20260606180100_rrhh_crear_version_turno_fn.sql` — la función rota, a reemplazar.
- `supabase/migrations/20260619120000_drop_rrhh_turnos_color_legacy.sql` — la migración que quitó `color` y dejó la función colgada.
- `supabase/migrations/20260911120000_horario_jefes_sala_bacanal_desde_14_09.sql` — **la referencia de oro**: los 6 pasos correctos (turnos nuevos → cerrar patrón viejo → patrón nuevo v2 → semanas → cerrar asignación vieja → asignar desde el lunes). La pantalla debe hacer esto mismo.
- `src/features/rrhh/actions/turnos-actions.ts` — `crearVersionTurno` (llama a la RPC), `setEmpleadosDirectosTurno`, `getEmpleadosDirectosPorTurno` (hoy **no** filtra por vigencia: enseña asignaciones caducadas como vigentes).
- `src/features/rrhh/actions/patrones-actions.ts` — `crearVersionPatron` (líneas ~658-770, no mueve a nadie), `getPatronesQueUsanTurno` (usa la empresa **principal** del perfil, no la activa), `listPatrones` (cuenta empleados solo de la fila oficial), `asignarEmpleadosPatron` (muerto).
- `src/features/rrhh/actions/puesto-horario-actions.ts` — `cerrarPatronesAnteriores` (líneas ~262-305): **el relevo ya está escrito aquí**, con el caso borde del patrón que aún no había empezado. Es la primitiva a extraer y reutilizar.
- `src/features/rrhh/utils/horario-empleado.ts` — motor de horario por fecha: `turnosAplicablesDia` une planificación + directos + patrón en un `Set`. Es donde se materializa el turno duplicado.
- `src/features/rrhh/components/horarios/AsistenteVersionTurno.tsx` — asistente actual: usa `<Input type="date">` (prohibido) y pinta la fecha en ISO (prohibido); preselecciona a todos, incluidos los de patrón.
- `src/features/rrhh/components/horarios/TurnosSection.tsx` — `empleadosCombinadosPorTurno` (líneas ~249-277) ya sabe el origen de cada empleado (`directo` / `patron`): esa marca es la que debe gobernar la selección.
- `src/features/rrhh/components/horarios/PatronesSection.tsx` — `guardar()` (líneas ~730-770) llama a `crearVersionPatron` sin preguntar nada; `VersionesPatronDialog` (histórico).
- `src/shared/components/ui/selector-fecha.tsx` + `src/shared/lib/fecha.ts` (`formatearFechaEs`) — componentes propios obligatorios para fecha.
- `.claude/memory/project/cuadrante_jefes_sala_bacanal.md` — sección "CÓMO SE CAMBIA UN HORARIO (el antiguo NUNCA se toca)": el procedimiento en 4 pasos que este PRP automatiza.

### Modelo de Datos

Sin tablas nuevas. Las columnas ya existen; lo que falla es quién las escribe.

```sql
-- rrhh_turnos:          id text PK, familia_id text, version int, es_oficial bool,
--                       vigente_desde date, vigente_hasta date, tipo_jornada,
--                       dias text[], flex_horas jsonb, flex_horas_dia numeric, flex_modo
-- rrhh_turno_empleados: turno_id text, empleado_id uuid, vigente_desde date NOT NULL,
--                       vigente_hasta date, UNIQUE(turno_id, empleado_id)
-- rrhh_patrones:        familia_id uuid, version int, es_oficial bool,
--                       vigente_desde date NOT NULL DEFAULT CURRENT_DATE, vigente_hasta date
-- rrhh_patron_empleados: patron_id uuid, empleado_id uuid, vigente_desde, vigente_hasta

-- Función reescrita (idempotente, SECURITY INVOKER, RLS respetada):
create or replace function public.rrhh_crear_version_turno(...) ...
--   · sin `color`
--   · hereda tipo_jornada, dias, flex_horas, flex_horas_dia, flex_modo, vigente_hasta
--   · cierra la asignación anterior del empleado: vigente_hasta = p_vigente_desde - 1
--   · inserta la nueva con vigente_desde = p_vigente_desde
--   · rechaza empleados cuyo turno venga de un patrón vigente de esa familia
--   · todo en una transacción (la función ya lo es)

-- Función gemela para patrones (misma forma, misma garantía atómica):
create or replace function public.rrhh_crear_version_patron(...) ...
```

### Arquitectura de código

```
src/features/rrhh/
├── actions/
│   ├── turnos-actions.ts       # crearVersionTurno: pasa vigenteDesde y filtra
│   │                           #   empleados de patrón; getEmpleadosDirectosPorTurno
│   │                           #   filtra por vigencia
│   ├── patrones-actions.ts     # crearVersionPatron: +vigenteDesde +empleadoIds,
│   │                           #   cierra la versión anterior, mueve asignaciones;
│   │                           #   getPatronesQueUsanTurno usa la empresa ACTIVA;
│   │                           #   listPatrones cuenta por familia
│   └── ...
├── services/
│   └── relevo-asignacion.ts    # NUEVO: primitiva única "cerrar la víspera + abrir
│                               #   el día elegido", extraída de cerrarPatronesAnteriores
└── components/horarios/
    ├── AsistenteVersionTurno.tsx   # selector-fecha propio, fechas dd/mm/aaaa,
    │                               #   origen del empleado visible, patrón no elegible
    ├── AsistenteVersionPatron.tsx  # NUEVO: mismo asistente para la semana del patrón
    └── PatronesSection.tsx         # guardar() abre el asistente antes de versionar
```

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar en cada fase (bucle agéntico).

### Fase 1: Arreglar la función de versión de turno
**Objetivo**: `rrhh_crear_version_turno` funciona y la versión nueva es una copia fiel de la anterior salvo el horario: sin `color`, heredando toda la jornada (`tipo_jornada`, `dias`, `flex_horas`, `flex_horas_dia`, `flex_modo`, `vigente_hasta`).
**Validación**: la prueba que hoy devuelve `column "color" does not exist` pasa (en transacción revertida); versionar un turno flexible conserva flexible y sus horas; sigue habiendo exactamente una versión oficial por familia.

### Fase 2: Relevo real de asignaciones (primitiva única)
**Objetivo**: una sola pieza — reutilizada por turnos y por patrones — que al aplicar una versión a un empleado **cierra** su asignación anterior la víspera y **abre** la nueva el día elegido, contemplando el caso de la asignación que aún no había empezado. Con ella, tanto la versión de turno como la de patrón dejan de solapar.
**Validación**: tras aplicar una versión a un empleado, el motor `getHorarioDia` devuelve **un** turno el día anterior (el viejo) y **un** turno el día del cambio (el nuevo); cero días con dos turnos.

### Fase 3: La semana se cambia entera desde el patrón
**Objetivo**: guardar un patrón versiona **en cascada y en una sola transacción**: una versión por cada turno cuyo horario cambió + **una sola** versión del patrón + el relevo de las asignaciones elegidas, todo con la misma fecha. `crearVersionPatron` acepta el día desde el que rige, la lista de empleados y los horarios nuevos de cada día; cierra la versión anterior (`vigente_hasta` = víspera, `es_oficial = false`). Un turno que no cambia de horas se reutiliza tal cual, sin versión nueva. La lista de patrones cuenta empleados por familia. Se resuelve el destino de `asignarEmpleadosPatron` (se usa o se borra).
**Validación**: cambiar las horas de tres días de una semana deja **una** versión de patrón y **tres** de turno, no siete de nada; el estado en BD es el mismo que dejó la migración manual del 14-09; los turnos sin cambios siguen siendo los mismos registros; el patrón nuevo muestra sus empleados y el viejo queda cerrado como histórico.

### Fase 4: El asistente, uno para los dos
**Objetivo**: un asistente común que pregunta **a quién** (uno a uno + "Aplicar a todos" marcado por defecto, con el origen de cada empleado a la vista y los de patrón no elegibles en el camino de Turnos) y **desde qué día** (selector de fecha propio, fechas en día/mes/año), usado tanto al guardar la semana de un patrón como al versionar un turno suelto. Antes de confirmar, el resumen dice exactamente qué va a pasar: qué días cambian de horario, qué otros patrones usan esos turnos y se quedan con el horario viejo, y a quién se le mueve la asignación. En el editor de patrón, cada día muestra sus horas y se pueden cambiar ahí mismo.
**Validación**: recorrido completo en `/rrhh/horarios` con captura: semana de patrón con dos días cambiados de hora aplicada a todos; turno suelto aplicado a dos de tres empleados; el aviso de turno compartido aparece cuando toca; ningún control nativo del navegador; ninguna fecha en formato ISO.

### Fase 5: Candados y multi-empresa
**Objetivo**: el servidor es la fuente de verdad — rechaza aplicar un turno por vía directa a quien lo tiene por patrón, y rechaza cualquier cambio que dejaría a alguien con dos horarios el mismo día, explicando cuál. El bloqueo "manda el turno" pasa a resolverse con la **empresa activa**.
**Validación**: llamada forzada desde el servidor con un empleado de patrón → rechazada con motivo; usuario con dos empresas: el bloqueo por patrón acierta en ambas.

### Fase 6: Validación Final
**Objetivo**: sistema funcionando end-to-end, sin duplicados, sin pasado reescrito.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Captura del asistente (turno y patrón) y del histórico de versiones
- [ ] Consulta de verificación: cero empleados con dos turnos el mismo día en los 90 días siguientes al cambio
- [ ] Las horas del mes ya cerrado no cambian tras versionar
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Se rellena durante la implementación.

### 2026-09-12: Una migración de esquema puede dejar una función muerta
- **Error**: al quitar `rrhh_turnos.color` (19-06-2026) nadie revisó las funciones que la escribían. `rrhh_crear_version_turno` lleva casi tres meses reventando en cada intento.
- **Fix**: al quitar una columna, buscarla también en `pg_get_functiondef` de todas las funciones del esquema, no solo en el código TypeScript.
- **Aplicar en**: cualquier `DROP COLUMN` futuro.

---

## Gotchas

- [ ] **El horario define la jornada del contrato** (`jornada_sale_del_horario`): cambiar el horario de alguien puede cambiar sus horas contratadas. Este PRP **no** recalcula la jornada ni avisa a la gestoría; si el cambio altera las horas, hay que decidirlo aparte. Conviene dejarlo escrito en el propio asistente.
- [ ] **El día es el de la empresa, no el del navegador** (`dia_que_se_abre_zona_empresa`): "hoy" por defecto en el asistente debe salir del reloj de la empresa.
- [ ] `rrhh_turnos.id` es **text** generado en cliente (`makeTurnoId`); `rrhh_patrones.id` es **uuid**. Las dos funciones no son copia-pega.
- [ ] `UNIQUE(turno_id, empleado_id)` se mantiene: el historial vive en versiones distintas (ids distintos), no en varias filas del mismo turno.
- [ ] El índice único parcial `uq_rrhh_turnos_familia_oficial` / `uq_rrhh_patrones_familia_oficial` exige quitar el oficial al viejo **antes** de insertar el nuevo, en la misma transacción.
- [ ] `crearVersionTurno` está bloqueada si el turno está dentro de un patrón ("manda el turno"). Ese bloqueo se queda: el camino para esos turnos es versionar el patrón. Hay que decirlo en pantalla, no solo bloquear.
- [ ] `getEmpleadosDirectosPorTurno` no filtra por vigencia: hoy lista como actuales asignaciones ya cerradas. Corregir o el asistente enseñará gente que ya no lleva ese turno.
- [ ] La planificación concreta (`rrhh_planificacion`, la libreta) es foto fija y **manda** sobre versiones: versionar no debe tocar los días ya planificados.
- [ ] Los 3 motores (fichaje, horas del mes, planner) leen `vigente_desde`/`vigente_hasta`: si el relevo no fecha bien, el descuadre aparece en nóminas, no en pantalla.
- [ ] El asistente actual usa controles nativos del navegador para la fecha: prohibido (`componentes_propios_nunca_del_navegador`). Fechas siempre día/mes/año.

## Anti-Patrones

- NO reescribir filas históricas: una versión nueva nunca pisa la anterior.
- NO dejar una asignación anterior abierta al abrir la nueva (ese es el duplicado).
- NO crear asignación directa a quien tiene el turno por patrón.
- NO duplicar la lógica de relevo: una sola primitiva para turnos y patrones.
- NO filtrar por la empresa principal del perfil: siempre la empresa activa.
- NO usar controles nativos del navegador (fecha, confirmaciones, avisos).
- NO meter aquí el motor de tiempo teórico ni el recálculo de jornada contratada.

---

*PRP pendiente aprobación. No se ha modificado código.*
