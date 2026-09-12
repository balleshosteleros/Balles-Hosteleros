# PRP-096: El patrón es el horario

> **Estado**: PENDIENTE
> **Fecha**: 2026-09-12
> **Proyecto**: Balles-Hosteleros
> **Sustituye a**: PRP-095 (versionado de horarios y mover asignaciones) — se queda sin efecto: su
> objetivo era arreglar el catálogo de turnos; aquí el catálogo desaparece como cosa que se mantiene
> a mano. Lo salvable de PRP-095 (arreglo de `rrhh_crear_version_turno`, relevo real de asignaciones)
> entra aquí como Fase 1.
> **Relacionado**: PRP-053 (versionado de turnos), migración manual
> `20260911120000_horario_jefes_sala_bacanal_desde_14_09.sql`, `.claude/memory/project/cuadrante_jefes_sala_bacanal.md`

---

## Objetivo

Que el horario de cada día —sus horas, su nombre y su pausa— se escriba **dentro del patrón**, y que
guardar el patrón cree una versión nueva con su fecha desde la que rige, preguntando **una sola vez**
desde qué día y a quién se aplica, y moviendo de verdad las asignaciones. El turno deja de ser un
catálogo que alguien mantiene a mano: pasa a ser la constancia fechada de lo que dijo el patrón ese
día. En el cuadrante todo se sigue viendo igual que ahora.

## Por Qué

| Problema | Solución |
|----------|----------|
| **Cambiar una semana obliga a mantener un catálogo.** Para mover media hora de un jueves hay que ir a Turnos, buscar o crear un turno con esas horas, ponerle nombre y código, volver a Patrones y colocarlo en la celda. El horario real está partido en dos pantallas y una de ellas la mantiene una persona. | El día se edita donde se ve: dentro del patrón. Se escriben las horas y el nombre en la propia celda. El turno se crea y se versiona solo. |
| **El catálogo se pudre.** Hoy en BD: **81 turnos**, de los que **11 no los usa nadie** (ni patrón ni asignación directa), y **4 descansos apuntan a turnos que ya no existen**; otro apunta a una versión vieja y hay dos descansos llamados igual («JEFE COCINA 2 VIERNES») porque se duplicaron al versionar. Nadie limpia lo que nadie usa. | Sin catálogo que mantener no hay basura que acumular: cada horario nace de un día de un patrón y muere con él. Los 11 sueltos y los enlaces rotos se resuelven en la migración. |
| **Un cambio de semana son siete decisiones.** El patrón apunta a turnos; si cambian tres días hay que versionar tres turnos, cada uno con su fecha, y luego el patrón. Si alguna fecha no cuadra, el empleado acaba con dos horarios el mismo día o con ninguno. | Se guarda la semana entera de una vez: una fecha, una pregunta, una transacción. Los días que no cambian ni se tocan. |
| **Las pausas viven aparte del turno que parten.** Los 13 descansos de BACANAL son exactamente el hueco de los turnos partidos (17:00–19:30, 17:30–20:30…), pero se configuran en otra pantalla y se enganchan a la **versión** del turno, no a su familia: al versionar, la pausa se queda atrás sin avisar. | La pausa se define en el mismo día que la parte, junto a sus dos tramos. El enlace deja de ser a una versión concreta. |
| **El cuadrante enseña, pero no deja corregir un día.** `rrhh_planificacion` existe desde el 07-06-2026, el motor ya la lee y la rejilla ya admite soltar turnos encima — pero está **vacía (0 filas)** y solo sabe *añadir* un turno del catálogo: no sabe «este jueves María entra dos horas más tarde» ni «este día libra». | Desde la celda se corrige el día suelto: se escriben sus horas, o se marca libre. Es una **excepción** de esa persona ese día: no toca el patrón ni a nadie más. |
| **Crear una versión de turno revienta desde hace tres meses.** Verificado hoy en la BD viva: `rrhh_crear_version_turno` sigue escribiendo la columna `color`, borrada el 19-06-2026. Además no copia `tipo_jornada`, `dias`, `flex_horas`, `flex_horas_dia` ni `flex_modo`, y no cierra la asignación anterior. | Se arregla mientras esa vía siga viva (quedan 2 asignaciones directas), y desaparece cuando deje de usarse. |
| **Esto hoy solo se hace con SQL.** El cuadrante de los jefes de sala de BACANAL del 14-09-2026 se cargó con una migración manual de 130 líneas. | La pantalla hace exactamente eso, en un minuto y sin programador. |

**Valor de negocio**: cambiar un horario es una decisión de dirección, no una tarea de mantenimiento de
datos. Con esto RRHH cambia una semana en un minuto, sin tocar el pasado (nóminas, fichajes e
inspecciones quedan intactos) y sin la vía por la que hoy se cuelan turnos duplicados, que descuadran
horas teóricas contra fichajes.

---

## Qué

### Criterios de Éxito

- [ ] En el editor del patrón, **cada día muestra sus horas** y se editan ahí mismo: nombre del día,
      tramo(s) y pausa. Un día también puede marcarse **libre**.
- [ ] **Ya no hay que elegir turnos de una lista** para montar una semana: el panel de catálogo
      desaparece del editor de patrón.
- [ ] Guardar el patrón pregunta **una sola vez**: desde qué día rige y a quién se aplica (los que
      siguen ese patrón, con **todos marcado por defecto**).
- [ ] Al confirmar, en **una sola transacción**: versión nueva de cada día que cambió, **una** versión
      nueva del patrón con `vigente_desde` = ese día, la anterior cerrada la víspera
      (`vigente_hasta` = víspera, `es_oficial = false`), y las asignaciones de los elegidos movidas.
- [ ] **Los días que no cambian no estrenan versión**: cambiar 3 días de una semana deja 3 versiones
      de horario y 1 de patrón, no 7 de nada.
- [ ] **Ningún empleado queda con dos horarios el mismo día** ni con ninguno: si el cambio lo
      provocaría, no se guarda y se dice en pantalla a quién y por qué.
- [ ] **El pasado no se reescribe**: las versiones viejas se conservan fechadas y no se borran nunca.
      Las horas de un mes ya cerrado no cambian después de versionar (comprobado con una consulta
      antes/después).
- [ ] Desde el **cuadrante** se puede corregir **un día suelto** de una persona (horas distintas, o
      libre) sin tocar el patrón: la excepción solo afecta a esa persona ese día, se ve marcada como
      excepción y se puede quitar.
- [ ] La **pausa de un turno partido** se define dentro del día, junto a sus tramos; los 13 descansos
      actuales quedan reflejados ahí y los 4 enlaces rotos dejan de existir.
- [ ] El **cuadrante se ve igual que ahora**: mismas píldoras, mismos colores por departamento,
      mismos totales y el mismo PDF.
- [ ] `rrhh_crear_version_turno` deja de escribir `color`, hereda la jornada completa y cierra la
      asignación anterior — mientras esa vía siga viva.
- [ ] Fechas en **día/mes/año** y con el **selector propio** (`selector-fecha.tsx`); ningún control
      ni aviso del navegador.
- [ ] Multi-empresa intacto: todo se resuelve con la **empresa activa**, nunca con la principal del perfil.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Camino normal — cambiar la semana de un puesto**

1. RRHH abre `/rrhh/horarios` → configuración → Patrones → abre un patrón. Ve los siete días con
   **sus horas escritas**: «lunes 12:30–17:00», «martes libre», «viernes 12:30–17:00 · pausa · 19:30–00:00».
2. Toca el día que quiere cambiar y escribe las horas nuevas ahí mismo. Puede cambiarle el nombre,
   añadir o quitar el segundo tramo (y con él la pausa), o marcarlo **libre**.
3. Pulsa «Guardar». Una única pregunta: **desde qué día** (por defecto hoy, en el reloj de la empresa)
   y **a quién** (todos marcado). Antes de confirmar, el resumen dice qué días cambian, con qué horas,
   y a quién se le mueve el horario.
4. Al confirmar: una versión del patrón, las versiones de día que hagan falta, y el relevo. Lo
   anterior queda cerrado la víspera y **entero**: los fichajes y las horas ya cerradas siguen leyendo
   el horario de entonces, porque se resuelve por fechas.
5. En el cuadrante se ve el horario nuevo a partir de ese día y el viejo antes. Igual que ahora.

**Corregir un día suelto (excepción)**

Desde la celda del cuadrante: «cambiar solo este día». Se escriben las horas de ese día para esa
persona, o se marca libre, con un motivo. Queda marcada como excepción, se puede quitar, y **no toca
el patrón**: el resto de la semana y el resto del equipo siguen igual.

**Caso — el horario de un día lo comparten dos patrones**: hoy solo pasa con uno
(`bt-js-partido-corto`, en dos familias). Al guardar se avisa antes de confirmar: ese patrón se queda
con el horario que tenía; el que se edita estrena el suyo propio.

**Caso — no aplicar a nadie**: se permite. La versión queda creada y oficial (el puesto apunta a la
familia, así que la siguiente contratación la hereda), avisando de que todavía no la trabaja nadie.

**Caso — fecha en el pasado**: permitida, pero si a alguien le pisa un tramo ya vigente, se bloquea
diciendo a quién y desde cuándo.

---

## Contexto

### Hallazgos verificados en la BD viva (12-09-2026)

| Dato | Valor | Qué implica |
|------|-------|-------------|
| Turnos | **81** (75 oficiales, 75 familias) | El catálogo es más grande que el horario real |
| Turnos usados por algún patrón | **70** | |
| …usados **solo** por patrones | **68** | El día del patrón ya es, de hecho, el dueño del turno |
| Turnos compartidos por 2 familias de patrón | **1** (`bt-js-partido-corto`) | El caso raro existe, pero es uno |
| Turnos que no usa nadie | **11** (todos oficiales) | Basura de catálogo: ARTISTAS COMIDAS, CAMARERO NOCHE, GERENTE MIÉRCOLES/VIERNES/SÁBADO NOCHE, JEFE COCINA 2 LUNES/MARTES, LIMPIEZA/OFFICE VIERNES, MANTENIMIENTO SÁBADO… |
| Asignaciones directas de turno | **2**, y **las dos con las fechas al revés** (`vigente_desde` 01-09-2026, `vigente_hasta` 31-07 y 31-08-2026): Javier Mora (CONTABILIDAD) y Sofía Terrón (CALIDAD) | La vía directa está casi muerta y lo poco que hay está roto |
| Patrones | 27 (22 oficiales), **todos de 1 semana** | Ningún rotativo real en producción; la rotación existe en el motor y hay que conservarla |
| Asignaciones a patrón | 24 | El horario de la casa va por patrón |
| Descansos | **13**, todos el hueco de un partido; **4 apuntan a turnos inexistentes**, 1 a una versión vieja, y hay 2 con el mismo nombre | La pausa está desenganchada del turno que parte |
| `rrhh_planificacion` | existe, el motor la lee, **0 filas** | La libreta está montada y sin estrenar |
| `rrhh_planificacion` en el motor | se **une** al resto, no manda | Hoy no puede decir «este día libra» ni pisar al patrón |
| `fichajes` | **no guarda `turno_id`** (38 columnas, ninguna) | El pasado se reconstruye por fechas ⇒ las versiones viejas **deben conservarse fechadas y no borrarse nunca** |
| `rrhh_crear_version_turno` | sigue escribiendo **`color`** (comprobado en `pg_get_functiondef`) | Crear versión de turno revienta al 100 % |
| `rrhh_crear_version_patron` | **no existe** | El versionado de patrón se hace en TypeScript, sin atomicidad |
| `crearVersionPatron` (TS) | ya cierra la anterior y **mueve a todos** los de la familia | Media Fase 2 de PRP-095 ya está escrita: falta elegir a quién y hacerlo atómico |

### Referencias

**Modelo y BD**
- `supabase/migrations/20260606180100_rrhh_crear_version_turno_fn.sql` — la función rota, a reemplazar.
- `supabase/migrations/20260619120000_drop_rrhh_turnos_color_legacy.sql` — la migración que la dejó colgada.
- `supabase/migrations/20260607150000_rrhh_planificacion.sql` — la libreta: `turno_id text NOT NULL`, `origen`, `unique(empleado_id, fecha, turno_id)`.
- `supabase/migrations/20260911120000_horario_jefes_sala_bacanal_desde_14_09.sql` — **la referencia de oro**: los 6 pasos correctos que la pantalla debe hacer sola.
- `supabase/migrations/20260622150000_rrhh_turnos_codigos_unicos.sql` — el código de turno es único por rol.

**Motores (los que leen el horario por fecha)**
- `src/features/rrhh/utils/horario-empleado.ts` — `turnosAplicablesDia` (líneas 111-253): une planificación + directos + patrón en un `Set`; `getHorarioDiaLote`, `getHorarioDia`, `getDiasConHorarioAsignado`, `resolverHorarioResumen`.
- `src/features/rrhh/actions/planificacion-actions.ts` — `getPlanificacionHorarios`: el cuadrante por lote, misma lógica que el motor.
- `src/features/rrhh/services/horas/horas-mes.ts` — `horasTeoricasMes` (97-336): **tercera copia** de la
  misma lógica, la que alimenta las nóminas; lee `rrhh_turno_empleados`, `rrhh_patron_empleados`,
  `rrhh_planificacion`, `rrhh_patron_semanas` y `rrhh_turnos` por su cuenta.
- `src/features/rrhh/services/baja-horario.ts` — `recortarHorarioFuturoPorBaja`: **borra** filas de
  `rrhh_planificacion` posteriores a la baja.

**Acciones**
- `src/features/rrhh/actions/patrones-actions.ts` — `crearVersionPatron` (líneas 706-877, ya cierra y mueve a todos), `getPatronesQueUsanTurno` (línea 318, usa la empresa principal), `listPatrones` (355), `asignarEmpleadosPatron` (953, **no la llama nadie**), `validarTurnosCubrenPatron` (129), `validarTurnosMismaJornada` (169).
- `src/features/rrhh/actions/turnos-actions.ts` — `crearVersionTurno` (358), `bloqueoPorPatrones` (18, regla «manda el turno»), `getEmpleadosDirectosPorTurno` (455, **no filtra por vigencia**), `makeTurnoId` (181).
- `src/features/rrhh/actions/planificacion-asignar-actions.ts` — `asignarTurnoDia`, `asignarPatronDia`, `quitarAsignacionDia`: la libreta ya se escribe desde la rejilla.
- `src/features/rrhh/actions/puesto-horario-actions.ts` — `cerrarPatronesAnteriores` (266-305): **el relevo ya está escrito aquí**, con el caso borde del patrón que aún no había empezado. Es la primitiva a extraer.

**Pantalla**
- `src/features/rrhh/components/horarios/PatronesSection.tsx` — `PatronEditor` (683), `SemanalGrid` (922), `TurnosPanel` (1168, el catálogo que desaparece), `guardar()` (735, versiona sin preguntar), `VersionesPatronDialog` (393). Usa `<Input type="date">` (prohibido).
- `src/features/rrhh/components/horarios/CuadranteGrid.tsx` — la rejilla; celdas ya droppables (`dnd-kit`), `onQuitar`.
- `src/features/rrhh/components/horarios/HorariosView.tsx` — `DndContext`, `ejecutarAsignacion` (292), `handleQuitar` (368), `PanelAsignacion`.
- `src/features/rrhh/components/horarios/TurnosSection.tsx` (1291 líneas) y `AsistenteVersionTurno.tsx` — el catálogo actual y su asistente.
- `src/features/rrhh/components/horarios/DescansosSection.tsx` — descansos enganchados a `descanso.turnos[]` (ids de versión).
- `src/features/rrhh/components/horarios/ConfiguracionHorariosSheet.tsx` — las 7 secciones de configuración.
- `src/shared/components/ui/selector-fecha.tsx` + `src/shared/lib/fecha.ts` — obligatorios para fecha.

### Decisión de arquitectura: el turno se queda, pero como constancia

Lo que desaparece es el **catálogo**, no la tabla. `rrhh_turnos` sigue siendo donde se guarda el
horario de un día, versionado y fechado, porque:

- **El pasado se reconstruye por fechas.** Los fichajes no guardan `turno_id`: si se borrara o
  reescribiera una versión, el mes ya cerrado cambiaría de horas. Las filas viejas se quedan.
- **El cuadrante, el PDF, el móvil y los 3 motores ya leen turnos.** Manteniendo la tabla, «se sigue
  viendo igual que ahora» sale gratis.
- **68 de los 70 turnos en uso ya pertenecen a un solo patrón.** La propiedad ya existe de hecho; solo
  falta escribirla.

Lo que cambia es **quién los escribe**: los crea y los versiona el editor del patrón, nunca una persona.

```sql
-- rrhh_turnos: columnas nuevas
alter table public.rrhh_turnos
  add column if not exists patron_familia_id uuid,          -- dueño: la familia de patrón que lo define
  add column if not exists dia_semana smallint,             -- 0=lunes … 6=domingo (el día que ocupa)
  add column if not exists pausas jsonb not null default '[]'::jsonb;
--   patron_familia_id NULL = horario suelto (asignación directa) o legacy compartido.
--   pausas: [{"inicio":"17:00","fin":"19:30","remunerada":false}]  ← el hueco del partido,
--           que hoy vive en rrhh_descansos enganchado a una VERSIÓN.

-- rrhh_planificacion: la excepción de un día (hoy solo sabe añadir un turno del catálogo)
alter table public.rrhh_planificacion
  alter column turno_id drop not null,
  add column if not exists tipo   text not null default 'turno'
    check (tipo in ('turno','horario','libre')),            -- 'horario' = horas escritas a mano; 'libre' = ese día no trabaja
  add column if not exists tramos jsonb not null default '[]'::jsonb,
  add column if not exists pausas jsonb not null default '[]'::jsonb,
  add column if not exists motivo text;
--   La excepción MANDA sobre el patrón ese día (hoy se suma, que es el bug).
--   El índice único pasa a (empleado_id, fecha, coalesce(turno_id,'')) para admitir la fila sin turno.

-- rrhh_descansos: la pausa deja de apuntar a una versión concreta
--   `turnos` (ids de versión) → se lee por familia mientras exista; los 4 ids rotos se limpian.

-- Función nueva, atómica, SECURITY INVOKER (respeta RLS):
create or replace function public.rrhh_guardar_horario_patron(
  p_empresa_id uuid, p_patron_id uuid, p_vigente_desde date,
  p_semanas jsonb,            -- [{orden, dias:[{nombre,codigo,tramos,pausas} | null]}]
  p_empleado_ids uuid[], p_asignado_por uuid
) returns uuid ...
--   1. por cada día cuyo horario CAMBIÓ: versión nueva de turno (misma familia, version+1,
--      vigente_desde = p_vigente_desde); la anterior → vigente_hasta = víspera, es_oficial = false
--   2. los días sin cambios se reutilizan tal cual (ni una versión de más)
--   3. UNA versión nueva del patrón; la anterior cerrada la víspera y sin es_oficial
--   4. relevo de las asignaciones de p_empleado_ids (cerrar víspera + abrir ese día)
--   5. rechaza si alguien quedaría con dos horarios ese día, diciendo quién

-- Función arreglada mientras la vía directa siga viva:
create or replace function public.rrhh_crear_version_turno(...)  -- sin `color`, hereda
--   tipo_jornada, dias, flex_horas, flex_horas_dia, flex_modo, vigente_hasta; cierra la anterior.
```

### Arquitectura de código

```
src/features/rrhh/
├── actions/
│   ├── patrones-actions.ts        # guardarHorarioPatron(): una llamada, un RPC, una transacción
│   ├── turnos-actions.ts          # el catálogo pasa a histórico (solo lectura); se queda la vía suelta
│   ├── planificacion-actions.ts   # la excepción MANDA sobre el patrón (hoy se suma)
│   └── excepciones-dia-actions.ts # NUEVO: poner/quitar la excepción de un día
├── services/
│   ├── relevo-asignacion.ts       # NUEVO: primitiva única «cerrar la víspera + abrir el día elegido»
│   └── horario-dia.ts             # NUEVO: forma del horario de un día (nombre, tramos, pausas) y su
│                                  #   comparación (¿cambió? ⇒ ¿versión nueva?)
├── utils/
│   └── horario-empleado.ts        # la excepción pisa al patrón; 'libre' deja el día a cero
└── components/horarios/
    ├── PatronesSection.tsx        # el día se edita dentro: horas, nombre y pausa; fuera el catálogo
    ├── EditorDiaHorario.tsx       # NUEVO: tramo(s) + pausa + nombre + libre
    ├── AsistenteGuardarHorario.tsx# NUEVO: desde qué día + a quién (todos por defecto) + resumen
    ├── ExcepcionDiaDialog.tsx     # NUEVO: corregir un día suelto desde el cuadrante
    └── CuadranteGrid.tsx          # marca la excepción; por lo demás, igual que ahora
```

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar en cada fase (bucle agéntico).

### Fase 1: Cimientos — que versionar deje de romper
**Objetivo**: `rrhh_crear_version_turno` funciona (sin `color`, heredando `tipo_jornada`, `dias`,
`flex_horas`, `flex_horas_dia`, `flex_modo` y `vigente_hasta`) y existe **una sola primitiva de
relevo** —extraída de `cerrarPatronesAnteriores`— que cierra la asignación anterior la víspera y abre
la nueva el día elegido, contemplando la que aún no había empezado. La usan turnos y patrones.
**Validación**: la prueba que hoy devuelve `column "color" does not exist` pasa (en transacción
revertida); versionar un turno flexible lo deja flexible con sus horas; tras aplicar una versión,
`getHorarioDia` devuelve **un** turno la víspera (el viejo) y **uno** el día del cambio (el nuevo).

### Fase 2: El día es el horario (modelo)
**Objetivo**: el horario de un día pasa a tener dueño y forma propia: `patron_familia_id`,
`dia_semana` y `pausas` en `rrhh_turnos`, y la función atómica `rrhh_guardar_horario_patron` que
recibe la semana entera con las horas escritas y hace en una transacción las versiones de día
necesarias (**solo las de los días que cambiaron**), **una** versión de patrón, el relevo de los
elegidos y la comprobación de que nadie queda con dos horarios.
**Validación**: llamada directa a la función con tres días cambiados de siete → 3 turnos nuevos,
1 patrón nuevo, el resto de turnos son los mismos registros; el estado en BD queda idéntico al que
dejó la migración manual del 14-09; ante un solape, la función no guarda nada y dice quién.

### Fase 3: El editor del patrón escribe las horas
**Objetivo**: cada día del patrón muestra y edita **sus horas, su nombre y su pausa**, o se marca
libre; el panel de catálogo de turnos desaparece del editor. El turno partido se define con sus dos
tramos y la pausa en medio, dentro del día.
**Validación**: recorrido en `/rrhh/horarios` con captura: se cambian las horas de dos días y la
pausa de un partido sin salir de la pantalla; ningún control nativo del navegador; fechas en
día/mes/año.

### Fase 4: Una sola pregunta al guardar
**Objetivo**: al pulsar «Guardar» aparece el asistente único: **desde qué día** (selector propio, por
defecto hoy en el reloj de la empresa) y **a quién** (los del patrón, con todos marcado por defecto),
con un resumen previo de qué días cambian, con qué horas, a quién se le mueve y qué otro patrón
comparte alguno de esos horarios y se queda con el suyo. Al confirmar se llama a la función de la
Fase 2. La lista de patrones cuenta empleados **por familia** (que no vuelva a salir «0 empleados»).
Se resuelve el destino de `asignarEmpleadosPatron` (se usa o se borra).
**Validación**: captura del asistente y del resultado; cambiar una semana aplicada a todos y otra
aplicada a uno de tres; el aviso de horario compartido aparece con `bt-js-partido-corto`.

### Fase 5: La excepción de un día, desde el cuadrante
**Objetivo**: desde la celda se corrige **un día suelto** de una persona —horas distintas o libre, con
motivo— sin tocar el patrón, y se puede quitar. `rrhh_planificacion` guarda la excepción y el motor
la hace **mandar** sobre el patrón ese día (hoy se suma), incluido el caso «libre» que deja el día a
cero horas.
**Validación**: una excepción de horas y una de libre sobre un empleado con patrón; `getHorarioDia`
y las horas del mes reflejan la excepción solo ese día y solo a esa persona; quitarla devuelve el
día al patrón; los otros del mismo patrón no se enteran.

### Fase 6: Migración sin reescribir el pasado
**Objetivo**: los turnos actuales pasan a este modelo sin tocar una sola fila histórica: se rellena
`patron_familia_id` y `dia_semana` de los 68 que ya pertenecen a un único patrón; el compartido se
deja sin dueño y se separa **solo** cuando alguien edite uno de sus dos patrones; los 13 descansos se
reflejan como `pausas` del día que parten y se limpian los **4 enlaces rotos**; los **11 turnos que no
usa nadie** y las **2 asignaciones directas con las fechas al revés** (Javier Mora, Sofía Terrón) se
resuelven según lo que decida Iván (ver «Decisiones pendientes»). La sección Turnos deja de ser
catálogo editable y pasa a histórico de horarios.
**Validación**: migración idempotente; consulta antes/después que demuestra que **ninguna fila de
`rrhh_turnos` existente cambia de `tramos`, `vigente_desde` ni `vigente_hasta`**; las horas de agosto
y de la primera quincena de septiembre no se mueven ni un minuto.

### Fase 7: Validación Final
**Objetivo**: sistema funcionando end-to-end, sin duplicados y sin pasado reescrito.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Capturas: editor de patrón con horas, asistente de guardado, excepción de día, cuadrante igual que antes, PDF igual que antes
- [ ] Cero empleados con dos horarios el mismo día en los 90 días siguientes al cambio
- [ ] Las horas de los meses ya cerrados no cambian tras versionar
- [ ] Criterios de éxito cumplidos

---

## Decisiones pendientes (necesitan un sí de Iván)

1. **Los 11 turnos que no usa nadie** (ARTISTAS COMIDAS, CAMARERO NOCHE, CAMARERO NOCHE JUEVES,
   GERENTE MIÉRCOLES, GERENTE SÁBADO NOCHE, GERENTE VIERNES, GERENTE VIERNES NOCHE, JEFE COCINA 2
   LUNES, JEFE COCINA 2 MARTES, LIMPIEZA/OFFICE VIERNES, MANTENIMIENTO SÁBADO): ¿se borran (cero
   deuda) o alguno es un horario que todavía hay que montar en un patrón?
2. **Las 2 asignaciones directas rotas** (Javier Mora → CONTABILIDAD, Sofía Terrón → CALIDAD, las dos
   con fecha de fin **anterior** a la de inicio): ¿se convierten en patrón propio, como el resto de la
   casa, o se mantiene la vía suelta para administración?
3. **La sección «Turnos»**: ¿desaparece del menú de configuración y su histórico se ve desde el
   patrón, o se queda como pantalla de solo lectura?

---

## 🧠 Aprendizajes (Self-Annealing)

> Se rellena durante la implementación.

### 2026-09-12: Un catálogo que se mantiene a mano se pudre solo
- **Error**: 81 turnos para 70 horarios reales, 11 que no usa nadie, 4 descansos apuntando a turnos
  borrados y 2 descansos con el mismo nombre por duplicarse al versionar. Nadie lo rompió: nadie lo limpió.
- **Fix**: que el dato lo genere el sitio donde se decide (el patrón), no una pantalla aparte.
- **Aplicar en**: cualquier catálogo que exista solo para que otra pantalla lo referencie.

### 2026-09-12: Quitar una columna puede dejar una función muerta
- **Error**: al quitar `rrhh_turnos.color` (19-06-2026) nadie revisó las funciones que la escribían.
  `rrhh_crear_version_turno` lleva casi tres meses reventando en cada intento.
- **Fix**: al quitar una columna, buscarla también en `pg_get_functiondef` de todas las funciones del
  esquema, no solo en el código TypeScript.
- **Aplicar en**: cualquier `DROP COLUMN` futuro.

---

## Gotchas

- [ ] **Los fichajes no guardan `turno_id`**: el pasado se reconstruye por fechas. Las versiones
      viejas se conservan **fechadas** y **no se borran nunca**; ni sus `tramos` ni sus fechas se tocan.
- [ ] **La planificación hoy se SUMA, no manda** (`turnosAplicablesDia`, `Set` de ids). Para que la
      excepción funcione hay que convertirla en override — y con ella el caso «libre», que hoy no se
      puede expresar de ninguna manera.
- [ ] **`rrhh_planificacion.turno_id` es `NOT NULL` y entra en el índice único** `(empleado_id, fecha,
      turno_id)`: una excepción con horas escritas a mano no tiene turno.
- [ ] **El horario define la jornada del contrato** (`jornada_sale_del_horario`): cambiar las horas
      puede cambiar las horas contratadas. Este PRP **no** recalcula la jornada ni avisa a la gestoría;
      conviene decirlo en el propio asistente.
- [ ] **El día es el de la empresa, no el del navegador** (`dia_que_se_abre_zona_empresa`): «hoy» por
      defecto sale del reloj de la empresa.
- [ ] `rrhh_turnos.id` es **text** generado en cliente (`makeTurnoId`); `rrhh_patrones.id` es **uuid**.
      Las dos funciones no son copia-pega.
- [ ] Los índices únicos parciales `uq_rrhh_turnos_familia_oficial` / `uq_rrhh_patrones_familia_oficial`
      exigen quitar el oficial al viejo **antes** de insertar el nuevo, en la misma transacción.
- [ ] `UNIQUE(turno_id, empleado_id)` se mantiene: el historial vive en versiones distintas (ids
      distintos), no en varias filas del mismo turno.
- [ ] **El código del turno es único por rol** (`20260622150000`): al generar el código de un día
      automáticamente hay que respetarlo o el `INSERT` falla.
- [ ] **La leyenda del PDF del cuadrante se agrupa por CÓDIGO, no por turno**
      (`src/features/rrhh/utils/export-horarios.ts`, `construirLeyenda`): el código tiene que ser
      estable **por familia**, no por versión, o cada cambio de horario añade una línea nueva a la
      leyenda y el PDF deja de parecerse al de ahora.
- [ ] **Contratación y promoción asignan el horario por patrón** vía
      `asignarPlantillaPuestoAEmpleado` (`empleado-puestos-actions.ts`, `promocion-interna-actions.ts`,
      `contratacion-actions.ts`): ese camino no cambia, pero comparte la primitiva de relevo de la Fase 1.
- [ ] **Los patrones rotativos existen en el motor** (`semanaQueRige`) aunque en producción todos
      tengan una sola semana: el editor debe seguir admitiendo hasta 5 semanas (`MAX_SEMANAS_PATRON`).
- [ ] **La regla «manda el turno»** (`bloqueoPorPatrones`) y `validarTurnosCubrenPatron` dejan de tener
      sentido cuando el patrón es el dueño: revisar antes de borrarlas, porque hoy son lo único que
      impide editar un turno compartido.
- [ ] `getEmpleadosDirectosPorTurno` no filtra por vigencia: lista como actuales asignaciones ya
      cerradas.
- [ ] `getPatronesQueUsanTurno` filtra por la empresa **principal** del perfil, no por la activa.
- [ ] Los **3 motores** (fichaje, horas del mes, planner) leen `vigente_desde`/`vigente_hasta`: si el
      relevo no fecha bien, el descuadre aparece en la nómina, no en pantalla.
- [ ] **Hay TRES copias de la misma lógica de resolución del día**, y la excepción hay que enseñársela
      a las tres: `horario-empleado.ts` (`turnosAplicablesDia`, fichaje), `horas-mes.ts`
      (`horasTeoricasMes`, líneas 97-336, **copia propia** que lee las mismas cinco tablas por su
      cuenta → es la que alimenta las nóminas) y `planificacion-actions.ts` (el cuadrante). Si solo se
      cambia una, la pantalla y la nómina dirán cosas distintas.
- [ ] **`recortarHorarioFuturoPorBaja`** (`src/features/rrhh/services/baja-horario.ts`, línea 51)
      **borra** filas de `rrhh_planificacion` posteriores a la baja: al meter ahí las excepciones y los
      «libre», hay que decidir qué pasa con ellos al causar baja (hoy los borraría todos).
- [ ] El editor actual usa `<Input type="date">`: prohibido (`componentes_propios_nunca_del_navegador`).
- [ ] **Móvil: el teléfono se consulta** (`movil_solo_consulta`): ni el editor de patrón ni la
      excepción de día aparecen en el móvil — pero el trabajador **sí tiene que ver** la excepción en
      su calendario, y eso vive en tres sitios a la vez (`portal_trabajador_tres_superficies`):
      `src/features/mi-panel/actions/mi-panel-actions.ts`, `mi-panel/mobile/lib/mobile-horario-data.ts`
      y su ficha. Todo pasa por el motor, así que se arregla en el motor, pero hay que comprobarlo en los tres.
- [ ] **El cron de reavisos de fichaje** (`src/app/api/cron/fichajes-reavisos/route.ts`) llama a
      `getHorarioDiaLote` cada minuto: un día marcado «libre» por excepción no debe generar aviso.
      Ojo al coste de consultas al añadir la excepción al lote (`crons_hora_madrid_utc`).

## Anti-Patrones

- NO reescribir filas históricas: una versión nueva nunca pisa la anterior.
- NO borrar una versión vieja de turno o de patrón, aunque no la use nadie hoy.
- NO versionar un día que no ha cambiado de horario.
- NO dejar una asignación anterior abierta al abrir la nueva (ese es el duplicado).
- NO duplicar la lógica de relevo: una sola primitiva para turnos, patrones y excepciones.
- NO filtrar por la empresa principal del perfil: siempre la empresa activa.
- NO usar controles nativos del navegador (fecha, confirmaciones, avisos).
- NO meter aquí el recálculo de la jornada contratada ni el aviso a la gestoría.
- NO cambiar cómo se ve el cuadrante ni el PDF.

---

*PRP pendiente aprobación. No se ha modificado código.*
