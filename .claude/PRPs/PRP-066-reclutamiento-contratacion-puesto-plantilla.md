# PRP-066: Reclutamiento → Contratación con el puesto como plantilla

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-23
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Convertir el **puesto** en la plantilla completa de contratación (datos económicos + horario + cronograma + datos legales de gestoría) y añadir un flujo **CONTRATAR** de 2 pasos en el pipeline de reclutamiento que, con un solo clic, cree el **empleado + usuario** heredando todo del puesto y dispare la **alta a la gestoría por email**. La vacante se **desacopla** del puesto (lo guarda solo como snapshot informativo): el vínculo real empleado↔puesto nace al contratar.

Cada puesto tiene uno o varios **Niveles** (Nivel 1, 2, 3…): plantillas de condiciones reutilizables que comparten cronograma, rol y vacante, pero con **salario, horario y condiciones propios** por nivel. El Nivel 1 se crea automáticamente con el puesto. Al contratar se **copia (snapshot)** el nivel elegido al empleado: editar un nivel después solo afecta a **futuras** contrataciones, nunca a empleados ya dados de alta.

## Por Qué

| Problema | Solución |
|----------|----------|
| Al contratar hay que rellenar a mano salario, horario, departamento y datos legales que ya viven en el puesto. | El puesto es la plantilla única: contratar = confirmar + vincular, todo se hereda. |
| El alta en la gestoría es manual (copiar datos a un email aparte). | Paso 2 de CONTRATAR pre-rellena y envía el email de alta a la gestoría automáticamente. |
| El cronograma del puesto no sigue al puesto si se renombra o cambia de departamento. | Cronograma 1:1 nombrado por el puesto + trigger que cascada departamento. |
| Mover un puesto de departamento no propaga a empleados ni cronograma; la vacante crea acoplamiento rígido. | `updatePuesto` + trigger de cascada (cronograma + empleados con ese puesto principal); la vacante se desacopla. |
| `promoverCandidato` (PRP-034) pide local y datos sueltos, no hereda del puesto ni gestiona email de acceso por área. | Flujo CONTRATAR reemplaza/extiende la promoción heredando del puesto y aplicando la regla operativo/administrativo del email de login. |

**Valor de negocio**: contratación en segundos sin re-teclear datos, cero errores de transcripción a la gestoría, y un modelo de puesto coherente que se mantiene solo al reorganizar departamentos.

## Qué

### Criterios de Éxito
- [ ] Cada puesto tiene **Niveles** (1..N): el Nivel 1 se crea automático con el puesto; se pueden añadir Nivel 2, 3… Cada nivel guarda su **salario, horario y condiciones**; comparten cronograma, rol y vacante del puesto.
- [ ] Al contratar se **copia** el nivel elegido al empleado (snapshot). Editar después un nivel **no** altera a los empleados ya contratados; solo aplica a futuras contrataciones.
- [ ] El puesto guarda datos de gestoría: convenio colectivo, tipo de contrato por defecto (indefinido/temporal), grupo/categoría profesional y epígrafe/código de cotización (todos opcionales).
- [ ] Al crear un puesto, su cronograma 1:1 lleva el **nombre** del puesto; al renombrarlo o moverlo de departamento, el cronograma le **sigue** (nombre y departamento).
- [ ] En PUESTOS (`/rrhh/salarios`) el selector de departamento es **editable al editar**; `updatePuesto(nombre, descripcion, departamento_id)` existe y un trigger BD cascada `departamento_id` a `cronogramas_operativos` y a `empleados` cuyo puesto **principal** sea ese. Las vacantes NO entran en la cascada.
- [ ] Hay un único botón **CONTRATAR** en las columnas **Prueba** y **Empleado** del pipeline.
- [ ] CONTRATAR abre una pantalla de 2 pasos: Paso 1 (Confirmar y vincular) y Paso 2 (Alta en gestoría).
- [ ] Paso 1 crea EMPLEADO + USUARIO heredando del puesto (horario, calendario, salario, convenio) con el puesto pre-seleccionado pero editable, primer día de trabajo y tipo/duración de contrato; el email de login se deriva del **área** del departamento (operativo→email personal, administrativo→email empresa).
- [ ] Paso 2 envía el email de alta a la gestoría con datos pre-rellenados (empleado + puesto + convenio + primer día + datos legales de la ficha del candidato), con plantilla predefinida.
- [ ] El/los correo(s) de la gestoría se configuran en un **ajuste propio de Reclutamiento** (Ajustes → RRHH → Reclutamiento): un email principal de "alta de contrato" + un segundo email **opcional** (para enviar a dos contactos). No se vincula a ningún departamento ni persona.
- [ ] Al contratar se envía al trabajador el **email de acceso** (enlace primer login).
- [ ] La vacante deja de tener FK dura a `puestos`: guarda un snapshot/texto informativo del puesto. La dependencia de cascada hacia vacantes queda revertida.
- [ ] Migraciones versionadas como `.sql` idempotentes; sin `confirm()` nativo; estados "Activo/Inactivo"; sentence case; BARRA HORIZONTAL 1.

### Comportamiento Esperado

**Happy path — contratar desde el pipeline:**
1. El reclutador arrastra/lleva al candidato a la columna **Prueba** o **Empleado**. Aparece el botón **Contratar** en su tarjeta/columna.
2. Pulsa Contratar → se abre el diálogo de 2 pasos.
3. **Paso 1 — Confirmar y vincular**: el puesto viene pre-seleccionado desde el snapshot de la vacante (editable). El reclutador fija el primer día de trabajo; si el tipo de contrato del puesto es temporal, indica la duración. El sistema deriva el área del departamento del puesto y decide el email de login (operativo→personal del candidato, administrativo→email de empresa). Confirma → se crean empleado + usuario (auth) heredando horario, calendario, salario y convenio del puesto; se vincula `empleado_puestos` (es_principal); se manda el email de acceso al trabajador.
4. **Paso 2 — Alta en gestoría**: el sistema muestra los datos pre-rellenados (empleado + puesto + convenio + primer día + datos legales del candidato). El reclutador revisa y envía → email con plantilla predefinida al correo de la gestoría.
5. El candidato queda marcado como contratado/promovido (idempotente: no se puede contratar dos veces).

---

## Contexto

### Referencias
- `src/features/rrhh/actions/vacantes-actions.ts` — `createPuesto`, `crearCronogramaParaPuesto` (1:1 ya existe; falta nombrar/sincronizar), `listPuestosCatalogo`, `VacanteInput.puesto_id`.
- `src/features/rrhh/actions/salarios-actions.ts` — `rowToPuesto` (ya pobla `departamentoId`), `listSalariosEmpresa`, `upsertPuestoSalario`.
- `src/features/rrhh/data/salarios.ts` — `PuestoSalarial` (ya tiene `departamentoId`).
- `src/features/rrhh/components/salarios/PuestoSalarioDialog.tsx` — departamento es texto fijo al editar (hay que hacerlo editable + llamar a `updatePuesto`).
- `src/features/rrhh/components/salarios/PuestoHorarioDialog.tsx` — horario semanal del puesto (`horario_semanal`).
- `src/features/rrhh/actions/promocion-actions.ts` — `promoverCandidato` (PRP-034): lock optimista, dedupe email/DNI, `altaUsuarioEmpleado`, magic link, notif RRHH, audit_log. Base del flujo CONTRATAR.
- `src/features/rrhh/services/empleados-core.ts` — `altaUsuarioEmpleado` (núcleo canónico auth→profile→user_empresas→empleado), `requireAdminUser`. Aquí se inyecta la herencia del puesto y la regla de email por área.
- `src/features/rrhh/actions/empleado-puestos-actions.ts` — `setPuestosDeEmpleado` (vínculo M:N, es_principal, espejo a `empleados.departamento_id`/`puesto`).
- `src/features/rrhh/components/reclutamiento/KanbanPipeline.tsx` — pipeline drag&drop; estados `prueba`/`empleado` dentro de la fase Formación.
- `src/features/rrhh/components/reclutamiento/CandidatosRealesTab.tsx` — botón actual "Crear en sistema" (línea ~417) ligado a `promoverCandidato`; se reemplaza por CONTRATAR.
- `src/features/rrhh/lib/reclutamiento-email.ts` — motor de sustitución de variables `{{...}}`.
- `src/lib/seeds/reclutamiento-email-plantillas.ts` + `reclutamiento-email-plantillas-actions.ts` — plantillas por estado (override en `vacantes.email_plantillas`). NUEVAS plantillas: acceso al trabajador + alta a gestoría.
- `src/lib/email/send.ts`, `src/lib/email/templates/bienvenida-empleado.ts` — mailer SMTP SiteGround + plantilla de bienvenida (base del email de acceso).
- `src/lib/seeds/departamentos.ts` — `area: "ADMINISTRATIVA" | "OPERATIVA"` (fuente de la regla de email de login).
- `src/app/(main)/gestoria/contrataciones/page.tsx` — módulo de gestoría existente (posible destino/registro del alta).
- `supabase/migrations/20260623120000_candidato_ficha_actividad_notas_resenas.sql` — patrón de migración idempotente con RLS `empresas_del_usuario()`.
- Memorias: `feedback_emails_empleado`, `project_login_multiempresa`, `project_modelo_empleado_usuario_rol_puesto`, `project_asignaciones_empleados`, `feedback_versionar_migraciones_siempre`, `feedback_empleado_vs_usuario` (auth solo service role).

### Arquitectura Propuesta
```
src/features/rrhh/
├── actions/
│   ├── vacantes-actions.ts        # createPuesto nombra cronograma; updatePuesto(nombre,desc,departamento_id)
│   ├── salarios-actions.ts        # niveles (1:N) + campos gestoría del puesto
│   ├── contratacion-actions.ts    # NUEVO: contratarCandidato() (paso 1) + enviarAltaGestoria() (paso 2)
│   └── promocion-actions.ts       # se refactoriza/absorbe en contratacion-actions
├── services/
│   └── empleados-core.ts          # herencia del puesto + email login por área del depto
├── components/
│   ├── salarios/PuestoSalarioDialog.tsx   # departamento editable + campos gestoría + niveles (1,2,3…)
│   ├── ajustes/ReclutamientoConfigPanel.tsx  # NUEVO: ajuste correos gestoría (Ajustes→RRHH→Reclutamiento)
│   └── reclutamiento/
│       ├── ContratarDialog.tsx    # NUEVO: wizard 2 pasos
│       └── KanbanPipeline.tsx     # botón CONTRATAR en columnas prueba/empleado
└── lib/
    └── reclutamiento-email.ts     # nuevas variables (puesto/convenio/primer_dia/legales/gestoría)
```

### Modelo de Datos
```sql
-- 0) NIVELES del puesto. puesto_salarios ya guarda salario + horario; se amplía
--    a 1:N por puesto añadiendo `nivel`. Cada fila = un Nivel (plantilla de
--    condiciones). El Nivel 1 se crea con el puesto. Migrar filas existentes a nivel 1.
ALTER TABLE puesto_salarios ADD COLUMN IF NOT EXISTS nivel int NOT NULL DEFAULT 1;
-- Cambiar la unicidad de (puesto_id) 1:1 a (puesto_id, nivel):
--   DROP CONSTRAINT/UNIQUE viejo por puesto_id; CREATE UNIQUE (puesto_id, nivel).
-- (incluye tipo/duración de contrato por nivel si difiere del puesto)

-- 1) Datos de gestoría COMPARTIDOS a nivel de puesto (opcionales): convenio común
--    a todos los niveles. (tipo_contrato puede vivir por nivel; convenio en puesto.)
ALTER TABLE puestos
  ADD COLUMN IF NOT EXISTS convenio_colectivo      text,
  ADD COLUMN IF NOT EXISTS tipo_contrato_defecto   text,  -- 'indefinido' | 'temporal'
  ADD COLUMN IF NOT EXISTS grupo_categoria_prof    text,
  ADD COLUMN IF NOT EXISTS epigrafe_cotizacion     text;

-- Al CONTRATAR: copiar (snapshot) salario+horario+condiciones del nivel elegido a
-- las condiciones PROPIAS del empleado (no enlace vivo). Definir el almacén de
-- condiciones del empleado en Fase 5 (p.ej. empleado_puestos o empleado_condiciones).

-- 2) Cronograma sigue al puesto (nombre + departamento). Trigger sobre puestos.
--    Al UPDATE de puestos.nombre/departamento_id:
--      - cronogramas_operativos.rol = nuevo nombre, .departamento = nuevo depto
--      - empleados.departamento_id (de los que tengan empleado_puestos.es_principal = ese puesto)
--    Las vacantes NO se tocan.

-- 3) Desacople vacante↔puesto: snapshot informativo, sin FK dura.
ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS puesto_snapshot text;
-- (puesto_id puede quedar nullable/informativo; revertir cascadas que apunten a vacantes)

-- 4) Datos de contratación en el empleado (primer día, tipo/duración contrato)
--    si no existen ya en empleados.

-- 5) Ajuste propio de Reclutamiento: correo(s) de la gestoría (standalone, no
--    ligado a departamentos ni personas). Una fila por empresa.
CREATE TABLE IF NOT EXISTS reclutamiento_config (
  empresa_id        uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  gestoria_email    text,        -- email principal de alta de contrato
  gestoria_email_cc text,        -- segundo contacto opcional
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- RLS por empresa vía empresas_del_usuario(); solo gestor RRHH/director edita.

-- Migraciones idempotentes, RLS vía empresas_del_usuario().
```

---

## Blueprint (Assembly Line)

> Solo FASES. Subtareas se generan al entrar en cada fase (bucle agéntico).
> Orden acordado con el usuario: 2 → 3 → 1 → 7 → 5 → 6.
> Permiso explícito requerido antes de tocar esquema BD, auth y emails (reglas de seguridad).

### Fase 1: Cronograma 1:1 nombrado por el puesto (punto 2)
**Objetivo**: `createPuesto` crea el cronograma con el nombre del puesto; renombrar/mover el puesto sincroniza el cronograma (`rol` + `departamento`).
**Validación**: crear un puesto genera cronograma con su nombre; renombrar el puesto actualiza el cronograma; idempotente (1 cronograma por puesto).

### Fase 2: Mover puesto de departamento + cascada (punto 3)
**Objetivo**: `updatePuesto(nombre, descripcion, departamento_id)` + selector de departamento editable al EDITAR en `PuestoSalarioDialog`; trigger BD que cascada `departamento_id` a `cronogramas_operativos` y a `empleados` con ese puesto principal. Vacantes excluidas.
**Validación**: editar el departamento de un puesto mueve su cronograma y a los empleados cuyo puesto principal es ese; ninguna vacante cambia.

### Fase 3: El puesto como plantilla — Niveles + datos de gestoría (punto 1)
**Objetivo**: (a) **Niveles** del puesto: `puesto_salarios` pasa a 1:N con `nivel`; el Nivel 1 se crea con el puesto; UI en `PuestoSalarioDialog` para añadir/editar Nivel 2, 3… (cada uno con su salario/horario/condiciones); cronograma y rol siguen compartidos. (b) campos de gestoría compartidos en el puesto (convenio, tipo de contrato por defecto, grupo/categoría, epígrafe/cotización), leídos por `listSalariosEmpresa`/`rowToPuesto`.
**Validación**: un puesto nuevo trae Nivel 1; añadir Nivel 2 con datos propios y releer ambos; editar un nivel no toca a otros; guardar/releer los 4 campos de gestoría (opcionales); typecheck.

### Fase 4: Desacople vacante ↔ puestos (punto 7)
**Objetivo**: la vacante guarda el puesto solo como snapshot/texto informativo; se revierten dependencias de cascada hacia vacantes; el puesto sigue pre-seleccionable en CONTRATAR desde el snapshot.
**Validación**: renombrar/mover un puesto no altera vacantes; la vacante muestra el puesto informativo; CONTRATAR pre-selecciona desde el snapshot.

### Fase 5: Pantalla CONTRATAR de 2 pasos + botón en pipeline (puntos 4 y 5)
**Objetivo**: botón único CONTRATAR en columnas Prueba/Empleado → `ContratarDialog` (wizard 2 pasos). Paso 1: confirmar puesto (editable) + **elegir Nivel** + primer día + tipo/duración contrato + regla email de login por área; crea empleado+usuario **copiando (snapshot)** salario/horario/condiciones del nivel elegido a las condiciones propias del empleado (no enlace vivo), hereda cronograma/rol del puesto y vincula `empleado_puestos`. Paso 2: alta en gestoría (UI pre-rellenada). Reemplaza "Crear en sistema". Idempotente (no contratar dos veces).
**Validación**: contratar un candidato crea empleado+usuario con las condiciones del nivel copiadas, email de login según área correcto, vínculo de puesto correcto; editar luego el nivel no cambia a ese empleado; segundo intento bloqueado.

### Fase 6: Cadena de emails completa + ajuste de correos de gestoría (punto 6)
**Objetivo**: mantener los emails por cambio de estado (ya existen); añadir email de **acceso al trabajador** (enlace primer login) al contratar y email de **alta a la gestoría** (paso 2) con plantilla predefinida y variables (empleado/puesto/convenio/primer día/datos legales). Seed canónico propagable. Crear el **ajuste de correos de gestoría** (`reclutamiento_config`: principal + CC opcional) con su panel en Ajustes → RRHH → Reclutamiento; el paso 2 lee de ahí los destinatarios.
**Validación**: al contratar llega el email de acceso al trabajador (al email correcto por área); configurar el/los correo(s) de gestoría en Ajustes y, al confirmar el paso 2, el email de alta llega al correo principal (y al CC si está) con datos correctos; SMTP SiteGround.

### Fase N: Validación Final
**Objetivo**: sistema end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: contratar desde el pipeline crea empleado+usuario y dispara ambos emails
- [ ] Criterios de éxito cumplidos
- [ ] Migraciones `.sql` idempotentes versionadas en `supabase/migrations/`

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación.

---

## Gotchas

- [ ] **Permiso explícito** antes de tocar esquema BD, auth y emails (reglas de seguridad de CLAUDE.md). No aplicar migraciones sin OK.
- [ ] El usuario YA empezó la Fase 2 en working tree: `departamentoId` añadido a `PuestoSalarial` (`data/salarios.ts`) y poblado en `rowToPuesto` (`salarios-actions.ts`). No duplicar.
- [ ] Working tree compartido con otra sesión: `git add` selectivo, **nunca** `-A`/`--force` (memorias `feedback_versionar_migraciones_siempre`, `feedback_agentes_paralelos_git_stash`).
- [ ] `empleado_puestos.es_principal` es índice único parcial: limpiar antes de marcar principal (ver `setPuestosDeEmpleado`).
- [ ] `empleados.departamento_id`/`empleados.puesto` son **espejo** del puesto principal: el trigger de cascada debe mantenerlos coherentes con `empleado_puestos`.
- [ ] Auth solo vía **service role** (`createAdminClient`); usuario+auth nunca por OAuth/signup público (memoria `feedback_empleado_vs_usuario`).
- [ ] Email de login: operativo=personal, administrativo=empresa; `email_empresa` solo si corporativo real (memoria `feedback_emails_empleado`). Derivar de `departamentos.area`.
- [ ] Reutilizar el **lock optimista** (`promovido_at`) y la dedupe email/DNI de `promoverCandidato`: no contratar dos veces; reactivar ficha existente si reingreso.
- [ ] Confirmaciones internas vía `useConfirmDelete`, **nunca** `confirm()` nativo.
- [ ] Plantillas email = biblioteca por nombre; asociación email↔estado vive en `reclutamiento_plantillas_estado` + override `vacantes.email_plantillas`. No reacoplar a estados (memoria `project_reclutamiento_emails_sueltos`). El email de acceso y el de gestoría son **plantillas nuevas de evento**, no de estado.
- [ ] `getEmpresaActivaForUser` / cookie `bh_empresa_activa`: respetar empresa activa, no `profiles.empresa_id` por defecto.
- [ ] **Niveles = snapshot, no enlace vivo**: al contratar se COPIAN salario/horario/condiciones del nivel al empleado. Editar un nivel NUNCA debe alterar empleados ya contratados (solo futuros). El empleado necesita almacén propio de condiciones.
- [ ] **Nivel 1 automático**: crear un puesto crea su Nivel 1; la numeración es secuencial (1, 2, 3…). No permitir un puesto sin al menos Nivel 1.
- [ ] `puesto_salarios` pasa de 1:1 a 1:N por `nivel`: migrar filas existentes a `nivel = 1` y cambiar la unicidad a `(puesto_id, nivel)` antes de tocar `upsertPuestoSalario` (hoy hace `onConflict: puesto_id`).

## Anti-Patrones
- NO crear un modelo paralelo de puesto/cronograma (cronograma 1:1 ya existe; nombrar y sincronizar).
- NO meter las vacantes en la cascada de departamento (deben desacoplarse).
- NO duplicar el núcleo de alta: reutilizar `altaUsuarioEmpleado`/`empleados-core`.
- NO `any`; SIEMPRE Zod en inputs de usuario; SIEMPRE RLS `empresas_del_usuario()`.
- NO hardcodear ni colgar el correo de la gestoría de departamentos/personas: vive en su propio ajuste (`reclutamiento_config`, por empresa), con email principal + CC opcional.

---

*PRP pendiente aprobación. No se ha modificado código.*
