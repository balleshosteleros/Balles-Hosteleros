# PRP-067: Onboarding inicial de volcado de datos para empresas nuevas (bootstrap)

> **Estado**: PENDIENTE (afinado 2026-06-23)
> **Fecha**: 2026-06-23
> **Proyecto**: Balles-Hosteleros

---

## Decisiones de afinado (2026-06-23)

1. **PRP-067 es AUTÓNOMO; no depende de PRP-044.** La vía baseline de cada paso es la carga que YA existe en cada submódulo (alta manual + import por entidad: logística ya tiene `ImportadorIADialog`/`ImportadorIACatalogoDialog`). El "Cargar con IA" unificado de PRP-044 es una mejora *opcional*: cuando exista `<MigracionIADialog>`, se hace swap por paso. PRP-067 se puede implementar y mergear sin PRP-044.
2. **Empleados en el onboarding = VOLCADO MASIVO de plantilla existente (excepción sancionada).** La regla [[feedback_empleados_solo_por_portal_empleo]] (no alta manual uno a uno) se mantiene para el día a día: las **nuevas contrataciones** entran por el portal (PRP-066). PERO el bootstrap de una empresa nueva necesita cargar la **plantilla que YA trabaja allí** — eso se hace por **import masivo** (CSV/IA → `empleados-core` en lote), no por el formulario manual retirado. No se reabre `/rrhh/empleados/nuevo`; el volcado masivo es el único camino de alta en bloque y solo en onboarding.
3. **`/admin/empleados` se degrada de forma concreta:** la ruta redirige a `/rrhh/empleados` (gestión) y se **retira `CreateEmployeeForm` de `AdminPanel`** (deja de crear empleados sueltos). No se borra el código de listado/gestión.
4. **Obligatorio mínimo para "empresa operativa":** Locales + Puestos/Salarios + Empleados. El resto (proveedores, productos, imagen de marca, carta, calendarios) es opcional y omitible. Departamentos/roles/organigrama ya vienen sembrados (se muestran como "✓ listo de serie", no son pasos de carga).
5. **Ruta y guard:** `/onboarding`, visible solo para rol director (o con permiso), operando siempre sobre la empresa activa (cookie).

---

## Objetivo

Construir un **asistente de onboarding (bootstrap)** que arranca automáticamente al crear una empresa y guía al director, paso a paso, en la carga de los datos iniciales del negocio (locales, departamentos, puestos/salarios, empleados/usuarios, proveedores, productos…). Es el nuevo punto de arranque que **sustituye al panel legacy `/admin/empleados`** y orquesta — en un único flujo secuencial con progreso persistente — las herramientas de carga que ya existen (import IA de PRP-044 y altas manuales), de modo que una empresa nueva pase de "vacía" a "operativa" sin saltar a ciegas entre submódulos.

## Por Qué

| Problema | Solución |
|----------|----------|
| Al crear una empresa solo se siembran los seeds canónicos (departamentos, roles, organigrama…); el director queda ante un software vacío sin saber por dónde empezar a cargar SU negocio. | Asistente que se auto-lanza tras `createEmpresa` y propone una secuencia ordenada de bloques con CTA claro por cada uno. |
| La creación manual de empleados/usuarios vivía en `/admin/empleados`, una pantalla suelta y desconectada del resto del alta. Se decidió retirarla como punto de arranque. | El wizard absorbe ese paso (alta de usuarios/empleados) dentro del flujo guiado; `/admin/empleados` deja de ser la entrada. |
| PRP-044 da un import IA potente PERO por entidad y suelto en Ajustes; no hay un hilo conductor que diga "primero locales, luego puestos, luego empleados". El orden importa por las dependencias (un empleado necesita su puesto/depto/local). | El bootstrap define el ORDEN correcto (respetando dependencias) y reutiliza `<MigracionIADialog>` y las altas manuales como motores de cada paso, sin reimplementarlos. |
| El usuario abandona el onboarding a medias y al volver no sabe qué le falta. | Estado de progreso persistente por empresa: cada paso marca No iniciado / En progreso / Completado / Omitido, reanudable desde donde lo dejó. |

**Valor de negocio**: el volcado inicial es el cuello de botella de activación post-demo. Un flujo guiado y reanudable reduce el time-to-value de un cliente nuevo de horas de exploración a un recorrido único de < 45 min, y elimina el riesgo de empresas "a medio cargar" (empleados sin puesto, productos sin proveedor) que generan soporte.

## Qué

### Criterios de Éxito

- [ ] Al completar `createEmpresa` y activar la empresa nueva, el director es llevado automáticamente al asistente de onboarding (ruta dedicada, p. ej. `/onboarding`), no a `/admin/empleados`.
- [ ] El asistente muestra una lista ordenada de pasos del bootstrap con su estado (No iniciado / En progreso / Completado / Omitido) y un porcentaje global de avance.
- [ ] El orden de pasos respeta las dependencias del modelo: primero estructura (locales → departamentos/roles ya sembrados → puestos+salarios), luego personas (empleados/usuarios), luego catálogo (proveedores → productos), con bloques opcionales al final.
- [ ] Cada paso ofrece **alta manual / import por submódulo** (reutiliza lo existente; el bootstrap NO reimplementa altas). "Cargar con IA" unificado es opcional: si `<MigracionIADialog>` (PRP-044) existe se usa, si no, se cae al import/alta actual del submódulo. **PRP-067 funciona sin PRP-044.**
- [ ] El paso **Empleados** carga la **plantilla existente por volcado masivo** (CSV/IA → `empleados-core` en lote), NO con el formulario manual retirado. Las nuevas contrataciones siguen entrando por el portal (PRP-066); el volcado masivo es exclusivo del onboarding.
- [ ] `/admin/empleados` **redirige a `/rrhh/empleados`** y se retira `CreateEmployeeForm` de `AdminPanel`; deja de crear empleados sueltos (no se borra el listado/gestión).
- [ ] El estado del onboarding persiste por empresa en BD y es reanudable: cerrar sesión y volver retoma el progreso exacto, sin perder pasos ya completados.
- [ ] Los pasos **opcionales** pueden marcarse "Omitir por ahora"; los **obligatorios (1–3)** NO son omitibles y deben quedar "completado" (derivado) para cerrar el onboarding.
- [ ] El estado de cada paso se deriva de datos reales (p. ej. "Empleados" se considera completado cuando hay ≥1 empleado activo), no de un flag manual desincronizable.
- [ ] El asistente puede cerrarse y reabrirse desde un acceso fijo mientras el onboarding no esté 100% completo; al completarse, deja de auto-lanzarse.
- [ ] Respeta visibilidad por rol: solo el director (o rol con permiso) ve y ejecuta el bootstrap.
- [ ] `npm run typecheck` pasa y `npm run build` es exitoso.

### Catálogo de pasos (definitivo)

Orden por dependencias del modelo. "Obl." = obligatorio para marcar el onboarding como completado.

| # | Paso | Obl. | Depende de | Motor de carga (baseline hoy) | "Completado" se deriva de |
|---|------|------|-----------|-------------------------------|---------------------------|
| 0 | Estructura base sembrada (departamentos, roles, organigrama) | — | — | Automático (`seedEmpresaDefaults`) | Siempre ✓ (informativo, no editable aquí) |
| 1 | **Locales** (puntos de fichaje) | ✅ | — | Alta manual de locales + import | ≥1 local |
| 2 | **Puestos y salarios** | ✅ | depto (sembrado) | `PuestoSalarioDialog` + import | ≥1 puesto activo con ≥1 nivel |
| 3 | **Empleados** (plantilla existente) | ✅ | locales + puestos | **Volcado masivo** (CSV/IA → `empleados-core` en lote) | ≥1 empleado activo |
| 4 | Proveedores | ⬜ | — | `ImportadorIADialog` + alta | ≥1 proveedor (si se entra) |
| 5 | Productos / catálogo | ⬜ | proveedores (recomendado) | `ImportadorIACatalogoDialog` + alta | ≥1 producto (si se entra) |
| 6 | Imagen de marca (logo/paleta) | ⬜ | — | `ImagenMarcaTab` | logo o color definidos |
| 7 | Carta digital | ⬜ | productos venta | módulo carta | — |
| 8 | Calendarios de vacaciones | ⬜ | — | calendarios RRHH | — |

> El onboarding se considera **completado** cuando los pasos 1–3 (obligatorios) están en estado "completado" (derivado) u "omitido" explícito NO se permite en obligatorios. Los opcionales pueden quedar pendientes sin bloquear.

### Comportamiento Esperado

1. El director crea una empresa (flujo `createEmpresa` actual: inserta empresa + vincula usuario + `seedEmpresaDefaults`). Tras activarla (cookie `bh_empresa_activa`), es redirigido a `/onboarding`.
2. El asistente muestra los pasos del bootstrap con su estado calculado en tiempo real. El primer paso pendiente aparece destacado.
3. El director entra a un paso (p. ej. "Locales"). Elige "Cargar con IA" → abre `<MigracionIADialog>` o "Añadir manualmente" → abre el alta del submódulo. Al guardar, vuelve al asistente y el paso refleja su nuevo estado.
4. Avanza por estructura → personas → catálogo. El asistente impide o avisa si intenta un paso cuyas dependencias faltan (p. ej. crear empleados sin ningún puesto), ofreciendo ir antes al paso requerido.
5. Puede "Omitir por ahora" cualquier paso opcional y continuar. El progreso global se actualiza.
6. Si abandona, al volver a la app con esa empresa activa el asistente se reabre en el punto exacto. Cuando todos los pasos obligatorios están completados, el auto-lanzamiento se desactiva y queda un acceso para revisarlo.

---

## Contexto

### Referencias

- `src/features/empresa/actions/empresas-actions.ts` — `createEmpresa()` (insert + link `usuario_empresas` + `seedEmpresaDefaults`). Punto donde engancha la redirección al onboarding.
- `src/lib/seeds/sync.ts` — `seedEmpresaDefaults()`: qué se siembra automáticamente (departamentos, roles, puestos, organigrama, plantillas…). El bootstrap NO repite esto; arranca DESPUÉS de la siembra y carga los datos propios del cliente.
- `.claude/PRPs/PRP-044-ajustes-migracion-datos-ia-unificada.md` — define `<MigracionIADialog entidad="…">` y la promoción dual activo/borrador. **Dependencia directa**: el bootstrap orquesta estos dialogos; idealmente PRP-044 se implementa antes o en paralelo. Si aún no existe el componente unificado, el wizard cae a las altas/imports actuales por submódulo.
- `src/features/admin/components/AdminPanel.tsx`, `CreateEmployeeForm.tsx`, `EmployeeList.tsx` y `src/actions/admin.ts` (`createEmployee`) — lógica legacy de alta de empleados/usuarios a absorber/reutilizar; `src/app/admin/empleados/page.tsx` es la ruta a degradar como punto de arranque.
- `src/features/rrhh/actions/empleados-actions.ts`, `puesto-horario-actions.ts`, `jornadas-actions.ts` — altas reales de RRHH (empleados, puestos/salarios).
- `src/features/ajustes/actions/locales-actions.ts`, `departamentos-actions.ts`, `roles-actions.ts` — estructura.
- `src/features/logistica/components/ImportadorIADialog.tsx`, `ImportadorIACatalogoDialog.tsx`, `productos/ImportExportButtons.tsx` — carga de proveedores/productos (motor que el paso de catálogo reutiliza).
- `src/features/empresa/actions/empresa-activa-actions.ts` — cookie de empresa activa (el onboarding opera siempre sobre la empresa activa).
- Memorias aplicables: BARRA HORIZONTAL 1 (toolbar), capitalización sentence case, no `confirm()` nativo (`useConfirmDelete`), Estado = Activo/Inactivo, datos completos obligatorio (borrador vs completado), título de página = vista actual, visibilidad por rol, versionar migraciones como `.sql`.

### Arquitectura Propuesta (Feature-First)

```
src/features/onboarding/
├── components/
│   ├── OnboardingWizard.tsx        # Layout del asistente (lista de pasos + panel del paso activo)
│   ├── OnboardingStepCard.tsx      # Card por paso: estado, CTA "Cargar con IA" / "Manual" / "Omitir"
│   ├── OnboardingProgress.tsx      # Barra/% de avance global
│   └── OnboardingLauncher.tsx      # Auto-lanzamiento + acceso fijo mientras no esté completo
├── actions/
│   └── onboarding-actions.ts       # Leer/escribir progreso + derivar estado real por paso
├── data/
│   └── steps.ts                    # Catálogo canónico de pasos (orden, dependencias, entidad, opcional?)
├── hooks/
│   └── useOnboardingProgress.ts
└── types/
    └── onboarding.ts

src/app/onboarding/page.tsx          # Ruta del asistente (guard: director / empresa activa)
```

> El wizard es **orquestador**: cada paso delega en componentes ya existentes (`<MigracionIADialog>` de PRP-044 o el alta manual del submódulo). No duplica formularios de entidad.

### Modelo de Datos (si aplica)

Catálogo de pasos = código (`data/steps.ts`), no tabla. El progreso por empresa se persiste; el estado "completado" de cada paso se DERIVA de datos reales (conteos) salvo el flag de "omitido"/"iniciado" que sí se guarda.

```sql
-- Progreso del bootstrap por empresa (una fila por empresa × paso).
CREATE TABLE IF NOT EXISTS empresa_onboarding_pasos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  paso_key TEXT NOT NULL,                 -- coincide con steps.ts (ej. 'locales', 'empleados')
  estado TEXT NOT NULL DEFAULT 'pendiente' -- pendiente | en_progreso | completado | omitido
    CHECK (estado IN ('pendiente','en_progreso','completado','omitido')),
  completado_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, paso_key)
);

ALTER TABLE empresa_onboarding_pasos ENABLE ROW LEVEL SECURITY;
-- Acceso multi-tenant vía helper canónico (profiles ∪ user_empresas).
CREATE POLICY empresa_onboarding_pasos_rw ON empresa_onboarding_pasos
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

-- Flag global de onboarding completado (para dejar de auto-lanzar).
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS onboarding_completado_at TIMESTAMPTZ;
```

> Migración versionada como `.sql` idempotente en `supabase/migrations/` (regla `feedback_versionar_migraciones_siempre`).

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Modelo de progreso y catálogo de pasos
**Objetivo**: Crear tabla `empresa_onboarding_pasos` + columna `onboarding_completado_at`, RLS con helper canónico, migración `.sql` versionada, y el catálogo `data/steps.ts` (orden, dependencias, entidad asociada, opcional/obligatorio).
**Validación**: La migración aplica idempotente; `steps.ts` exporta los pasos con sus dependencias y typecheck pasa.

### Fase 2: Acciones de progreso + derivación de estado real
**Objetivo**: `onboarding-actions.ts` que lee/escribe progreso (iniciar/omitir/completar) y deriva el estado real de cada paso a partir de conteos de datos (locales, puestos, empleados activos, proveedores, productos…), sin depender de flags manuales para "completado".
**Validación**: Para una empresa de prueba, las acciones devuelven el estado correcto antes/después de insertar datos en cada entidad.

### Fase 3: UI del asistente (orquestación)
**Objetivo**: `OnboardingWizard` + `OnboardingStepCard` + `OnboardingProgress` en `/onboarding`; cada paso ofrece "Cargar con IA" (abre `<MigracionIADialog>`/import existente), "Añadir manualmente" (abre el alta del submódulo) y "Omitir por ahora". Avisos de dependencias no satisfechas. Guard por rol director y empresa activa. Estilo según memorias UI (sentence case, toolbar, no confirm nativo).
**Validación**: Recorrer pasos de punta a punta sobre una empresa nueva; el progreso se refleja y persiste tras recargar.

### Fase 4: Auto-lanzamiento y degradación de `/admin/empleados`
**Objetivo**: Tras `createEmpresa` + activación, redirigir a `/onboarding`; `OnboardingLauncher` reabre el asistente mientras `onboarding_completado_at` sea null. Degradación concreta de `/admin/empleados`: la ruta **redirige a `/rrhh/empleados`** y se **retira `<CreateEmployeeForm>` de `AdminPanel`** (sin borrar listado/gestión). Marcar `onboarding_completado_at` cuando los pasos 1–3 estén completados.
**Validación**: Crear empresa → cae en `/onboarding`; abandonar y volver retoma el punto; completar 1–3 desactiva el auto-lanzamiento; entrar a `/admin/empleados` redirige a `/rrhh/empleados` y ya no hay alta suelta de empleados.

### Fase 5: Validación Final
**Objetivo**: Sistema funcionando end-to-end (empresa nueva → vacía → operativa vía wizard).
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: crear empresa, recorrer el bootstrap (un paso IA + uno manual + uno omitido), recargar y confirmar persistencia, completar y confirmar que no se auto-lanza
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Crece con cada error durante la implementación.

---

## Gotchas

- [ ] **Dependencia de PRP-044**: el wizard reutiliza `<MigracionIADialog>`. Si ese componente unificado aún no existe al implementar, conectar cada paso al import/alta actual del submódulo y dejar el cableado al dialog unificado como swap posterior. No bloquear PRP-067 por PRP-044.
- [ ] **Estado derivado, no flag suelto**: "completado" debe calcularse de conteos reales (regla de asignaciones persistentes: verificar BD, no fiarse de caché). `empresa_onboarding_pasos.estado` solo persiste señales que no se pueden derivar (omitido, en_progreso).
- [ ] **Empresa activa, no la principal**: operar siempre sobre la cookie `bh_empresa_activa` (`getAppContext`), nunca sobre `profiles.empresa_id`, para no cargar datos en la empresa equivocada.
- [ ] **RLS con helper**: usar `empresas_del_usuario()` en toda política (regla `project_rls_helper_empresas_del_usuario`).
- [ ] **Orden por dependencias**: empleados requieren puesto/depto/local; productos requieren proveedor. El catálogo de pasos debe codificar y avisar estas dependencias.
- [ ] **No borrar `/admin/empleados`**: degradar como punto de arranque sí; eliminar el código de gestión NO (pedir permiso antes de borrar archivos — regla de seguridad CLAUDE.md).
- [ ] **Empleados = volcado masivo en lote, no formulario manual**: el paso Empleados llama a `empleados-core` en bucle/lote desde un import (CSV/IA), NO reabre `/rrhh/empleados/nuevo` (retirado). Cada empleado importado debe quedar COMPLETO (regla `feedback_datos_completos_obligatorio`): puesto + local + datos mínimos; si falta algo, queda como borrador del import, no como empleado a medias. Respeta `feedback_empleados_solo_por_portal_empleo` (esto es excepción de bootstrap, no alta del día a día).
- [ ] **Obligatorios no omitibles**: pasos 1–3 no admiten "Omitir"; su estado se deriva de conteos reales. Solo los opcionales (4–8) son omitibles.
- [ ] **Multi-tenant del software**: el wizard es del software (todas las empresas actuales y futuras), no se hardcodea para HABANA/BACANAL.
- [ ] **Migración versionada**: guardar el `.sql` en `supabase/migrations/` aunque se aplique por MCP.

## Anti-Patrones

- NO reimplementar formularios de alta que ya existen (empleados, productos, proveedores…). El wizard orquesta, no duplica.
- NO crear un segundo motor de import IA: reutilizar el de PRP-044 / submódulos.
- NO usar `confirm()`/`alert()` nativos (usar `useConfirmDelete`).
- NO marcar pasos "completados" con un flag manual desincronizable.
- NO ignorar errores de TypeScript ni usar `any`.
- NO filtrar RLS solo por la empresa principal (romper acceso multi-empresa).

---

*PRP pendiente aprobación. No se ha modificado código.*
