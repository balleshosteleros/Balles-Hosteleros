# PRP-060: Fichaje y horario unificados para empleado multi-empresa

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-19
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Permitir que un empleado que trabaja en varias empresas del grupo (p.ej. Sofia Terrón en BACANAL + HABANA) viva su fichaje, su horario y su histórico como UNA SOLA experiencia, sin elegir empresa nunca, mientras que en BD los fichajes, contratos y nóminas siguen **separados por empresa** (registro legal de jornada de cada una).

Esto implica cuatro bloques:
1. **Fichaje agnóstico de empresa** en Mi Panel: el empleado ficha una vez; el sistema atribuye las horas a la empresa correcta sin que él elija.
2. **Jornada partida en un solo fichaje**: si en un mismo turno seguido trabaja para dos empresas (p.ej. 9–12 BACANAL, 12–15 HABANA), ficha UNA entrada (9:00) y UNA salida (15:00); el sistema **reparte automáticamente** las horas entre empresas según el **horario planificado**. El empleado NUNCA desficha y vuelve a fichar a mitad de jornada.
3. **Desfiche al fin del turno, configurable por empresa**, con parada anticipada universal e incidencia.
4. **Visibilidad correcta**: los listados/módulos por empresa muestran solo lo de esa empresa; la **ficha individual** del empleado muestra todo unificado (turnos, contratos, condiciones de ambas empresas, etiquetado por empresa).
5. **Enrolamiento "Añadir a otra empresa"** desde la ficha, que crea la 2ª fila de `empleados` y obliga a completar local/horario/contrato de esa empresa.

## Por Qué

| Problema | Solución |
|----------|----------|
| El empleado multi-empresa hoy solo ve/ficha la empresa de la cookie activa: si está en HABANA pero abre con BACANAL activa, no puede fichar salida ni ver su turno | Mi Panel agnóstico de empresa: la presencia se valida por geolocalización (local más cercano); el histórico/calendario es la unión por `user_id` de todas sus empresas |
| En una jornada seguida repartida entre dos empresas, obligar a desfichar y volver a fichar a mitad de turno es fricción inaceptable; y si solo cuenta el primer local, la 2ª empresa se queda sin horas | UN solo fichaje (una entrada, una salida); el sistema **reparte las horas reales entre empresas según el horario planificado** y materializa el registro de cada empresa por separado |
| El empleado podría hacer más horas de las previstas | Al llegar la hora de fin del turno, **desfiche automático** (configurable por empresa); siempre puede parar antes (parada anticipada universal) |
| RRHH puede dar acceso a otra empresa (`usuario_empresas`) pero NO se crea la segunda fila de `empleados`, así que el empleado queda "a medias": sin local, sin horario, sin contrato en esa empresa | Flujo "Añadir a otra empresa" que crea la fila espejo + vínculo y **bloquea hasta** configurar local(es), horario/turnos y contrato (regla "datos completos obligatorio") |
| Mezclar lo de varias empresas en listados de gestión rompe nómina y registro legal | Listados por empresa = **scoped**; ficha individual del empleado = **unión** etiquetada por empresa |

**Valor de negocio**: elimina la fricción diaria del personal compartido entre locales del grupo (caso real ya en producción), evita fichajes imposibles/erróneos y horas no atribuidas, cierra el agujero de altas multi-empresa incompletas y mantiene el cumplimiento legal (un registro de jornada por contrato/empresa).

## Qué

### Criterios de Éxito
- [ ] Un empleado con filas en 2 empresas ficha **una sola** ENTRADA y una sola SALIDA en una jornada seguida; el sistema reparte las horas entre empresas según el horario planificado (9–12 → BACANAL, 12–15 → HABANA) y deja un registro de jornada correcto en CADA empresa.
- [ ] El empleado NO tiene que desfichar/refichar al cambiar de empresa dentro de la misma jornada seguida (el corte es interno y automático).
- [ ] Fichar ENTRADA no exige elegir empresa: la presencia se valida por geolocalización (local más cercano dentro de radio).
- [ ] `getMiFichajeHoy` devuelve el fichaje abierto **independientemente** de la cookie de empresa activa; el botón "Salida/Parar" aparece SIEMPRE mientras trabaja.
- [ ] El histórico (`listarMisFichajes`) y el calendario (`getMiCalendarioMes`) muestran la **unión** de ambas empresas por `user_id`, etiquetando empresa/local de cada tramo.
- [ ] La ventana de fichaje de hoy (`getMiVentanaFichajeHoy`) contempla los turnos de **ambas** empresas el mismo día.
- [ ] **Desfiche automático al fin del turno** funciona y es **seleccionable por empresa** en Ajustes → Fichajes (modo automático = cierra y no deja volver a fichar; modo manual = el empleado pone la salida). En jornada partida, manda el ajuste de la empresa del **último tramo del día**.
- [ ] **Parada anticipada universal**: cualquier empleado, en cualquier empresa, puede parar el fichaje antes de su hora; eso lo cierra y genera una **INCIDENCIA** visible en `/rrhh/fichajes` (alerta ámbar).
- [ ] **Visibilidad**: en el módulo Horarios / Fichajes / informes de una empresa, del empleado compartido solo se ven sus turnos/fichajes de ESA empresa. En su **ficha individual** (abierta desde cualquier empresa) se ven sus turnos, contratos y condiciones de **ambas**, etiquetados por empresa.
- [ ] Al **crear** un turno, contrato o condición desde la ficha unificada, se **pregunta a qué empresa** corresponde.
- [ ] Desde la ficha, "Añadir a otra empresa" crea la 2ª fila de `empleados` (espejo, mismo `user_id`) + vínculo `usuario_empresas`, y **no se completa** hasta tener local(es), horario y contrato de esa empresa.
- [ ] No se puede quitar del acceso la empresa donde el empleado tiene fichajes/horario (regla existente respetada).
- [ ] `npm run typecheck` y `npm run build` pasan; QA Playwright confirma jornada partida y doble turno.

### Comportamiento Esperado

**Fichaje — jornada partida (caso central):**
1. Sofia tiene hoy horario 9:00–12:00 en BACANAL y 12:00–15:00 en HABANA (turnos configurados por separado en cada empresa).
2. A las 9:00 ficha **entrada** (una sola vez). La geo valida que está en un local suyo. El fichaje arranca.
3. A las 12:00 NO hace nada: sigue trabajando. El sistema sabe, por el horario planificado, que a partir de las 12:00 las horas son de HABANA.
4. A las 15:00 ficha **salida** (una sola vez) — o se le desficha automáticamente si la empresa del último tramo (HABANA) tiene el desfiche automático activo.
5. El sistema **reparte** la jornada real en dos registros: 9–12 a BACANAL, 12–15 a HABANA. Cada empresa tiene su registro de jornada para su nómina. El empleado vivió un único fichaje.

**Reparto cuando la realidad ≠ el plan:** el corte entre empresas sigue el horario planificado (las 12:00). Las horas de más o de menos respecto al plan se cargan a la empresa del **tramo donde caen** (p.ej. salir a las 15:40 → los 40 min extra van a HABANA). Si hay horas sin horario que las cubra, el tramo se marca **`requiere_revision`** para RRHH.

**Fichaje — turnos separados con hueco (no seguido):** si los tramos no son contiguos (hay horas libres entre medias), son fichajes independientes; al cerrar el primero, el móvil ofrece fichar el segundo cuando entre en ventana.

**Salida / parada anticipada (universal):** mientras trabaja, SIEMPRE se ve el botón de salida/parar. Si se va antes de su hora, lo para (con motivo); el fichaje se cierra con `cierre_anticipado` + `requiere_revision` y salta la **incidencia** ámbar en `/rrhh/fichajes`.

**Histórico y calendario (empleado):** un único listado y un único calendario; cada tramo etiquetado con su empresa/local; un día repartido entre dos empresas se ve unificado.

**Visibilidad (RRHH):**
- Módulo **Horarios** de HABANA → del empleado compartido solo sus turnos de HABANA. En BACANAL, solo los de BACANAL. Igual en Fichajes e informes de empleados.
- **Ficha individual** del empleado (desde cualquiera de las dos): pestaña Horario con turnos de ambas; Contratos y condiciones de ambas; todo **etiquetado por empresa**. Es la misma ficha espejo mostrada en las dos empresas.
- Al **crear** turno/contrato/condición desde la ficha → selector de empresa obligatorio.

**Alta "Añadir a otra empresa" (RRHH):** en la ficha, sección "Empresas", RRHH añade HABANA → se crea la fila `empleados` espejo + vínculo; aparece un bloque "Completar datos en HABANA" (local/es, horario/turnos, contrato) que impide marcar la incorporación como completa hasta rellenarlo.

---

## Contexto

### Referencias
- `src/features/mi-panel/actions/mi-panel-actions.ts` — TODO el fichaje/calendario/ventana del empleado. Hoy todas las funciones usan `getContext()` → filtran por `empresaId` (cookie). Funciones a tocar: `getMiFichajeHoy`, `getMiVentanaFichajeHoy`, `ficharEntradaPersonal`, `ficharSalidaPersonal` (verificar), `paralizarFichajePersonal` (ya hace la parada anticipada + incidencia), `listarMisFichajes`, `getMiCalendarioMes`, `getTiposFichajeDisponibles`/`getMiConfigFichaje`. Ya existe autocierre **flexible** (objetivo de horas) en `getMiFichajeHoy`; falta el autocierre de turno **fijo** al fin del horario.
- `src/features/rrhh/utils/horario-empleado.ts` — motor `getHorarioDia`/`getTramosHorarioEmpleado`/`turnosAplicablesDia`. Reciben `(empresaId, empleadoId)`. Para la ventana unificada y el **reparto por horario** hay que invocarlo **por cada (empresa, empleadoId)** del usuario y combinar tramos (cada tramo conserva su `empresaId`).
- `empresa_fichajes_config` (BD) — hoy: `permitir_antes/despues`, `margen_antes/despues_min`, `redondear_antes/despues`. **No** tiene opción de desfiche al fin del turno → **columna nueva** (ver Modelo de Datos). UI en Ajustes → Fichajes.
- `src/features/rrhh/services/empleados-core.ts` — `altaUsuarioEmpleado()`: núcleo de alta (auth.user → profile → roles → `usuario_empresas` → `empleados` → `empleado_locales`, rollback `deleteUser`). Base para el alta espejo (SIN crear auth.user: el `user_id` ya existe).
- `src/features/rrhh/actions/empleados-actions.ts` — `updateEmpleadoEmpresasAcceso()` (L401): hoy SOLO toca `usuario_empresas`; **NO crea la 2ª fila `empleados`** (gap del Objetivo 5). `getEmpleadoConPerfil` (L608), `getEmpleadoHorarioActual` (L746).
- `src/features/rrhh/components/empleados/` — `FichaTabsContent.tsx`, `GestionEmpleadoCard.tsx`, `EmpleadosView.tsx`: ficha unificada, sección "Empresas", selector de empresa al crear turno/contrato.
- Módulo Horarios y `/rrhh/fichajes` (`FichajesView.tsx`): listados que deben quedar **scoped** por empresa.
- Mi Panel móvil: `MobileFichajeProvider.tsx`, `MisFichajesMobile.tsx`, `InicioHeader.tsx` — fichaje, pop-up, indicador, botón salida/parar siempre visible.

### Memorias clave (reglas vigentes a respetar)
- **Empleado multi-empresa = DOS filas** (una por empresa, su `empleado_id`/`local_id`/horario/contrato); vínculo por `user_id` + `usuario_empresas`. NO existe `UNIQUE(user_id)` (verificado en BD 2026-06-19: Sofia = 2 filas). Unificación SOLO de presentación.
- **Fichajes — gestión vs personal**: empleados fichan SOLO desde Mi Panel; `/rrhh/fichajes` es gestión.
- **Tipos de fichaje — color/modo/márgenes** y **app móvil — fichaje pop-up e indicador, paralización** (`cierre_anticipado`/`requiere_revision`, alerta ámbar): ya parcialmente implementado; la parada anticipada universal se apoya en esto.
- **Datos completos obligatorio**: "Guardar borrador" para WIP, completar bloqueado hasta tener todos los requeridos.
- **No se puede quitar del acceso la empresa donde ficha**.
- **Empresa activa (cookie `bh_empresa_activa`)** y **RLS multiempresa UNION** (`empleados`/`fichajes` aceptan todas las empresas del usuario).
- **Cambios al software, no a una empresa**: el desfiche configurable es por empresa pero el mecanismo es del software (todas las empresas presentes y futuras).
- **No `confirm()`/`alert()` nativos** (usar `useConfirmDelete`). **Capitalización sentence case**. **Estado Activo/Inactivo**.

### Arquitectura Propuesta

No es feature nueva: cambios sobre código existente.

```
src/features/mi-panel/actions/mi-panel-actions.ts
  + getMisFilasEmpleado()        -> [{ empresaId, empleadoId, localIds }] de TODAS sus empresas
  + getTramosHorarioDiaUnificado() -> tramos del día de TODAS las empresas, cada uno con su empresaId
  + repartirFichajePorHorario()  -> dado (entrada, salida) reales + tramos planificados -> segmentos por empresa
  ~ ficharEntradaPersonal        -> valida presencia por geo; arranca jornada (no fija empresa única si hay reparto)
  ~ ficharSalidaPersonal / autocierre -> al cerrar, materializa los registros por empresa (reparto)
  ~ getMiFichajeHoy              -> fichaje abierto en cualquier empresa; autocierre fijo al fin del turno (según config empresa)
  ~ getMiVentanaFichajeHoy       -> unión de ventanas de ambas empresas
  ~ listarMisFichajes / getMiCalendarioMes -> unión por user.id; etiquetan empresa/local

empresa_fichajes_config (BD)      -> + columna desfiche automático al fin del turno
Ajustes → Fichajes (UI)           -> toggle "Al fin del turno: desfichar automático / salida manual"

src/features/rrhh/services/empleados-core.ts
  + altaEmpleadoEspejoEnEmpresa()  -> reusa pasos SIN crear auth.user

src/features/rrhh/actions/empleados-actions.ts
  ~ updateEmpleadoEmpresasAcceso   -> al añadir empresa, crear fila empleados espejo + estado "incompleto"

src/features/rrhh/components/empleados/  -> ficha unificada (Horario/Contratos/condiciones unión por user_id + etiqueta empresa + selector al crear) + sección "Empresas"
Módulo Horarios / FichajesView           -> listados scoped por empresa (sin cambiar el comportamiento mono-empresa)
```

### Modelo de Datos

Sin migraciones del modelo de contratos/horario. Cambios mínimos:
- `empresa_fichajes_config`: **columna nueva** para el desfiche al fin del turno, p.ej. `cierre_al_fin_turno boolean default false` (false = salida manual; true = desfiche automático). Confirmar nombre/semántica en Fase 0.
- `empleados`: ya existe `perfil_completado` (verificado, boolean por fila). Reutilizar como gate "datos completos por empresa"; confirmar en Fase 0 si basta o hace falta `incorporacion_completa`.
- **Reparto de jornada partida**: decisión de almacenamiento — un fichaje real (entrada→salida) se materializa como **un registro `fichajes` por empresa** (cada uno con su `empresa_id`, sus horas del tramo). El corte se calcula con el horario planificado al cerrar el fichaje (o al pasar el límite del tramo). El empleado ve la sesión como una sola; cada empresa ve su fila. Detallar el mecanismo exacto (split al cierre vs corte en el límite) en Fase 4.
- `empleado_locales`, `usuario_empresas`, `rrhh_turno_empleados`/`rrhh_patron_empleados`, contrato: ya existen por empresa.

> ⚠️ Verificar en BD (con `/supabase`) ANTES de la Fase 1: columnas de `empleados` para el gate, columna a añadir en `empresa_fichajes_config`, y RLS de `fichajes`/`empleados` para lecturas unión multi-empresa.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 0: Verificación de modelo en BD
**Objetivo**: Confirmar contra Supabase: filas múltiples de `empleados` por `user_id`; columna de completitud (`perfil_completado` u otra); columna a añadir en `empresa_fichajes_config` para el desfiche al fin del turno; RLS de `fichajes`/`empleados` para lecturas unión; locales con `lat/lng/radio` por empresa.
**Validación**: Documento de hallazgos; decididos nombres de columnas nuevas.

### Fase 1: Helpers multi-empresa en Mi Panel
**Objetivo**: `getMisFilasEmpleado()` (todas las `empleados` del `user_id` con `empresaId`+locales); `getTramosHorarioDiaUnificado()` (tramos del día de todas las empresas, cada tramo con su `empresaId`, vía `getHorarioDia` por fila); `resolverPresenciaPorGeo(geo)` (local más cercano dentro de radio entre todas las empresas; desempate por más cercano).
**Validación**: Caso Sofia: helpers devuelven las 2 empresas y los tramos correctos por empresa.

### Fase 2: Fichaje agnóstico de empresa (entrada/salida/hoy)
**Objetivo**: `ficharEntradaPersonal` valida presencia por geo (no por cookie) y arranca la jornada; `getMiFichajeHoy` ve el fichaje abierto en cualquier empresa; verificar `ficharSalidaPersonal`. Botón salida/parar siempre visible.
**Validación**: Con cookie en empresa A, estando en local de B se ficha/cierra correctamente; el botón de salida aparece siempre.

### Fase 3: Vista unificada (histórico, calendario, ventana)
**Objetivo**: `listarMisFichajes` y `getMiCalendarioMes` unen por `user_id` y etiquetan empresa/local; `getMiVentanaFichajeHoy` combina ventanas de todas las empresas del día.
**Validación**: Empleado con turnos en 2 empresas ve calendario/histórico único correcto; ventana abarca mañana y noche.

### Fase 4: Reparto de jornada partida entre empresas
**Objetivo**: `repartirFichajePorHorario()` — dado (entrada, salida) reales y los tramos planificados (con su `empresaId`), produce los segmentos por empresa y materializa un registro `fichajes` por empresa. Implementar la regla de desviación (corte por horario; excedente/defecto al tramo donde cae; `requiere_revision` si no hay horario que cubra). Caso seguido = 1 fichaje del empleado → 2 registros; caso con hueco = fichajes independientes (encadenado: al cerrar el primero, ofrecer el segundo cuando entre en ventana).
**Validación**: Jornada 9–15 con plan 9–12/12–15 deja 3 h en BACANAL y 3 h en HABANA; salida a 15:40 carga el extra a HABANA; hueco entre tramos genera 2 fichajes.

### Fase 5: Desfiche al fin del turno (configurable) + parada anticipada
**Objetivo**: Columna nueva en `empresa_fichajes_config` + UI en Ajustes → Fichajes ("Al fin del turno: desfichar automático / salida manual"). Autocierre de turno **fijo** al llegar al fin del último tramo (en jornada partida manda la empresa del último tramo). Verificar/ajustar `paralizarFichajePersonal`: parada anticipada universal → cierra + `cierre_anticipado` + `requiere_revision` + **incidencia ámbar** en `/rrhh/fichajes`.
**Validación**: Empresa con automático cierra al fin del turno y no deja refichar; empresa con manual exige salida; parar antes genera incidencia visible en gestión.

### Fase 6: Visibilidad (listados scoped vs ficha unificada)
**Objetivo**: Módulo Horarios, Fichajes e informes de empleados → del empleado compartido solo lo de la empresa activa (scoped). Ficha individual del empleado → Horario/Contratos/condiciones como **unión por `user_id`** etiquetada por empresa; al **crear** turno/contrato/condición desde la ficha, **selector de empresa** obligatorio.
**Validación**: Horario de HABANA no muestra turnos de BACANAL del empleado compartido; la ficha sí muestra ambos etiquetados; crear un turno desde la ficha pregunta empresa.

### Fase 7: Botón "Copiar empleado en otra empresa" (RRHH)
**Objetivo**: botón **"Copiar empleado en otra empresa"** (lista/ficha de empleados) que: (1) elige empleado + empresa destino; (2) muestra **modal informativo** de QUÉ se copia y QUÉ no; (3) al confirmar crea la 2ª fila de `empleados` + vínculo `usuario_empresas` reusando datos personales (ya compartidos vía `user_id`) y copiando lo copiable; (4) deja la config por empresa pendiente con gate `perfil_completado=false`. `altaEmpleadoEspejoEnEmpresa()` reusa pasos SIN crear auth.user (rollback ≠ deleteUser). Respetar "no quitar la empresa donde ficha".
- **SE COPIA** (no depende de empresa): datos personales (ya compartidos vía `usuarios`) + `permite_teletrabajo`.
- **NO se copia** (único de cada empresa): departamento, puesto(s)+salario, local(es), horario/turnos, validadores, calendario de vacaciones, rol/accesos, estado (arranca Activo). Histórico (fichajes/solicitudes/firmas/cuestionarios/inspecciones) nunca.
**Validación**: el botón crea la 2ª fila; el modal informa bien; no se marca completa hasta configurar lo de esa empresa; tras completar, el empleado ficha en la nueva empresa (vía fichaje unificado ya construido).

### Fase 8: Casos borde y baja de empresa
**Objetivo**: Baja de empresa: los fichajes/horario históricos de esa empresa se conservan y siguen en el histórico unificado etiquetados; el empleado deja de poder fichar ahí. Día con turnos en dos empresas en el calendario; desempate de locales en radio.
**Validación**: Quitar una empresa conserva su histórico y bloquea nuevo fichaje en ella; calendario coherente.

### Fase 9: Validación Final
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] QA Playwright: jornada partida (1 fichaje → 2 registros) y doble turno con hueco
- [ ] Desfiche automático/manual por empresa y parada anticipada con incidencia
- [ ] Visibilidad scoped vs ficha unificada
- [ ] Criterios de éxito cumplidos; sin regresión en empleados mono-empresa

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación.

### 2026-06-19: Fase 0 — verificación de modelo en BD
- **Gate de completitud**: usar `empleados.perfil_completado` (bool, default false) + `perfil_completado_at`. Existen por fila → gate por empresa sin columna nueva.
- **RLS ya soporta unión multi-empresa**: `fichajes_read_empresa`/`fichajes_manage_empresa` usan `empresas_del_usuario()` (= `usuarios.empresa_id` ∪ `usuario_empresas`); `empleados` tiene `empleados_self_read`/`_self_update` por `user_id` y `empleados_empresa_rw` por unión. NO hace falta migración de RLS para las lecturas unificadas de Mi Panel.
- **`fichajes` defaults**: todas las NOT NULL tienen default (`origen='online'`, `centro=''`, `departamento=''`, `observaciones=''`, `tipo='ENT'`, `estado='pendiente'`, `horas_totales=0`, booleans false). Crear filas de reparto es seguro.
- **`fichajes.empleado_id` = `user.id`** (auth uid), confirmado; el `empleados.id` es distinto por empresa.
- **No hay columna de sesión/grupo en `fichajes`** para atar tramos de jornada partida → decisión en Fase 4: añadir `sesion_id uuid` (aditiva) o agrupar en presentación por `user_id`+fecha+contigüidad.
- **`empresa_fichajes_config`** NO tiene opción de desfiche al fin del turno → Fase 5 añade `cierre_al_fin_turno boolean default false` (aditiva).
- **Permiso de esquema**: las 2 columnas anteriores son los ÚNICOS cambios de esquema; aditivos. Pedir permiso al dueño antes de aplicarlas (regla de seguridad CLAUDE.md).

### 2026-06-19: Fases 1–4 — implementación
- **Fase 1**: util puro `src/features/mi-panel/utils/fichaje-multiempresa.ts` (recibe el cliente, estilo `horario-empleado.ts`): `getMisFilasEmpleado`, `getMisLocales`, `resolverPresenciaPorGeo`, `getHorariosDiaUnificado`, y el planner puro `planificarReparto`.
- **El working tree estaba desfasado respecto a mi primera lectura**: las firmas reales diferían (p.ej. `getMiVentanaFichajeHoy` ya devolvía `popup*`). Lección: releer SIEMPRE la versión actual con grep+offset antes de editar; las líneas se mueven.
- **Fase 2**: `ficharEntradaPersonal` resuelve empresa+empleado+local por geo (presencial) ANTES de validar tipo/horario; teletrabajo queda ligado a la empresa de la cookie (no hay geo que lo desambigüe). `getMiFichajeHoy` busca el fichaje de hoy sin filtro de empresa y resuelve el flexible contra `fichaje.empresa_id`. `autoCerrarFichajesHuerfanos` acepta `empresaId|null`. `ficharSalidaPersonal` ya era agnóstica.
- **Fase 3**: `listarMisFichajes` y `getMiCalendarioMes` quitan el filtro de empresa (RLS ya une) → histórico/calendario unificados; el calendario SUMA horas del día (no sobrescribe). `getMiVentanaFichajeHoy` combina los tramos fijos de TODAS las empresas (entrada = min, salida = max; config del pop-up = empresa del tramo más temprano). La ventana del pop-up es aproximada con cruce de medianoche multi-empresa; la validación dura sigue server-side en la entrada.
- **Fase 4**: `fichajes.sesion_id` aplicado. `ficharSalidaPersonal` calcula el reparto con `planificarReparto`; si hay >1 segmento, reaprovecha la fila original para el 1.º e inserta una fila por empresa para el resto, todas con el mismo `sesion_id`; los tramos no cubiertos por horario van con `requiere_revision`. La geo de salida se guarda solo en el último segmento.
- **LIMITACIÓN conocida (pendiente)**: la jornada CONTINUA partida ya funciona (un solo fichaje → reparto). Pero el caso de turnos SEPARADOS con hueco (fichar salida tras la mañana y volver a fichar por la tarde) NO está encadenado en el móvil: tras un fichaje "completado" hoy, `MobileFichajeProvider` no vuelve a ofrecer el pop-up de entrada para un 2.º turno. Pendiente de resolver (Fase 4b o ampliación del provider).

---

## 🧭 Diseño de la ficha multi-empresa (Fases 6/7 — decidido 2026-06-20)

Auditadas las 16 pestañas de la ficha. Clasificación:

**Compartido (espejo, idéntico desde cualquier empresa) — tabla `usuarios`, 1 fila por `user_id`:**
nombre, apellidos, documento/DNI, fecha nac., nacionalidad, género, estado civil, nº SS, contacto (emails/teléfonos), dirección, datos bancarios (IBAN), contacto de emergencia, talla de uniforme, y el acceso multiempresa (`usuario_empresas`).

**Por empresa — 1 fila `empleados` por empresa + tablas con `empresa_id`:**
estado (Activo/Inactivo), fecha_baja, permite_teletrabajo, puesto(s) (`empleado_puestos`), local(es) (`empleado_locales`), departamento, validadores (trabajo/ausencias), calendario de vacaciones, rol/accesos (`empresa_roles`), salario (`puesto_salarios`), y transaccionales: horario/turnos, fichajes, solicitudes, firmas, cuestionarios, inspecciones.

**Decisión UX (dueño, 2026-06-20): SELECTOR DE EMPRESA arriba de la ficha. TODO independiente por empresa, SIN MEZCLAR NADA.**
- Solo los **datos personales** (espejo, `usuarios`) son compartidos y siempre visibles.
- **TODO lo demás** se muestra/edita por la **empresa seleccionada en el selector**, incluido el **HORARIO** (sin excepciones, sin combinar). Eliges empresa → ves SOLO lo de esa empresa: estado, puesto, local, depto, teletrabajo, validadores, contrato, salario, vacaciones, rol, horario/turnos, fichajes, solicitudes, firmas, cuestionarios, inspecciones.
- Regla del dueño: "no haya unas cosas sí y otras no" → uniformidad total, todo por empresa.

**IMPORTANTE — dos contextos distintos (no confundir):**
- **Ficha de empleado (RRHH/gestión)** = por empresa, con selector (este diseño).
- **Mi Panel (el propio empleado, móvil)** = unificado (un fichaje agnóstico de empresa, horario de ambas, histórico unido). Es lo construido en Fases 2–4 y NO cambia. La unificación es solo para la experiencia del empleado, no para la gestión.

**🚩 Cosas que HOY no funcionan con 2 empresas (a corregir en Fase 6/7):**
- `getEmpleadoConPerfil` carga UNA sola fila (empresa activa) → debe poder cargar la fila de la empresa SELECCIONADA y exponer la lista de empresas del `user_id` para el selector.
- **Validadores**: hoy un solo par; al ser por empresa con selector, cada empresa muestra/edita SU par.
- **Estado Activo/Inactivo**: por empresa; la UI refleja el de la empresa seleccionada. Baja de una empresa = marcar Inactivo esa fila (ver [[feedback_no_borrar_empleados_grabados]]), nunca borrar, mín. 1 empresa.
- **Horario** (`getEmpleadoHorarioActual`): el de la empresa seleccionada (NO combinar en la ficha).
- **Calendario de vacaciones / saldo**: por empresa (de la seleccionada). Coherente con "todo independiente".
- Todos los listados transaccionales de la ficha (fichajes/solicitudes/firmas/cuestionarios/inspecciones): filtrados por la empresa seleccionada.

## Gotchas

- [ ] `getContext()` devuelve UNA `empresaId` (cookie). Para Mi Panel agnóstico NO usar ese `empresaId` en entrada/histórico/ventana/reparto: resolver por geo (presencia) y por unión `user_id` (lectura/reparto). Mantenerlo donde la empresa sí importa (comunicados, solicitudes).
- [ ] `fichajes.empleado_id` guarda el `user.id` (auth uid), NO el `empleados.id`. El `empleados.id` (distinto por empresa) se necesita para horario/tipos/locales. No confundirlos.
- [ ] **Reparto**: el corte entre empresas lo manda el **horario planificado**, no la geo. La geo solo valida presencia. Un único fichaje del empleado puede generar varios registros `fichajes` (uno por empresa).
- [ ] **Desfiche automático en jornada partida**: NO debe dispararse en el límite intermedio (12:00) — ahí solo hay corte/reparto, el empleado sigue. Solo al fin del **último tramo del día**, gobernado por el ajuste de la empresa de ese último tramo.
- [ ] Ya existe autocierre **flexible** (objetivo de horas) en `getMiFichajeHoy` y `autoCerrarFichajesHuerfanos` (cierre de días pasados). El autocierre de turno **fijo** al fin del horario es nuevo; no duplicar ni pelear con los existentes.
- [ ] `paralizarFichajePersonal` ya hace cierre anticipado + `requiere_revision` + incidencia. La parada anticipada universal debe apoyarse en esto, no reimplementarlo.
- [ ] RLS de `fichajes`/`empleados` debe permitir leer filas de TODAS las empresas del usuario (UNION `usuario_empresas`), o las lecturas/repartos solo verán la empresa principal.
- [ ] Turnos que cruzan medianoche + doble turno: `getHorarioDia` maneja medianoche en el consumidor; al combinar dos empresas no duplicar/solapar tramos.
- [ ] El alta espejo NO crea `auth.user` (ya existe); el rollback no puede ser `deleteUser`.
- [ ] Listados scoped: al hacer las lecturas de Mi Panel agnósticas, NO volver agnósticos por error los listados de gestión por empresa (Horarios/Fichajes/informes siguen filtrando por empresa activa).

## Anti-Patrones

- NO fusionar físicamente fichajes ni `empleados` de varias empresas (contratos/nóminas separados; cumplimiento legal).
- NO pedir al empleado que elija empresa al fichar, ni obligarle a desfichar/refichar a mitad de jornada seguida.
- NO atribuir todas las horas de una jornada partida a la empresa del primer local (la 2ª empresa quedaría sin horas).
- NO romper el flujo mono-empresa existente (la mayoría tiene una sola fila) ni mostrar datos de otra empresa en los listados de gestión por empresa.
- NO crear nuevos patrones de horario: reusar `getHorarioDia`/`turnosAplicablesDia`.
- NO ignorar errores de TypeScript ni saltarse "datos completos obligatorio" en el alta espejo.
- NO usar `confirm()`/`alert()` nativos (usar `useConfirmDelete`).

---

*PRP pendiente aprobación. No se ha modificado código.*
