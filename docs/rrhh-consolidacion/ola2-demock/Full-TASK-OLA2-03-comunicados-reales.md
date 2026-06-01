# Full-TASK-OLA2-03 - Comunicados reales

## Estado

PLANIFICADO (Ola 2, 2026-06-01). No implementado.
Discovery en `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-03-comunicados-reales.md` (estado real verificado contra codigo + SQL).

Resumen del estado real (corrige el supuesto del brief): la **escritura** (`createComunicado`/`updateComunicado`) ya es real y `ComunicadosView` ya la invoca al guardar. El gap es la **lectura/listado**, que descarta a proposito la BD y pinta el mock (`src/features/rrhh/data/comunicados.ts`). NO hay tabla nueva ni reescritura del backend; el trabajo es de-mockear la lectura, activar handlers muertos y decidir gating de RLS.

## Objetivo

Que el panel de Gerencia (`ComunicadosView`) lea, liste, filtre, paginee en calendario y gestione (publicar/programar/archivar/eliminar) los comunicados **reales** de la tabla `public.comunicados`, en coherencia con lo que ya ve el empleado (`mi-panel`), retirando `data/comunicados.ts` como fuente funcional de verdad y respetando RLS multi-tenant por `empresa_id` (UUID).

## Estimacion de complejidad

**Baja-Media.**

- Backend: casi nulo (las actions ya existen; a lo sumo anadir mapper compartido y `archivar`/`publicar` explicitos).
- Frontend: medio (mapper fila-plana -> ViewModel, recalculo de KPIs/calendario, handlers de dropdown, retirada del mock).
- Decision/seguridad: pequena pero con bifurcacion (gating de RLS write por rol) que conviene confirmar.
- Sin migracion obligatoria (solo opcional si se endurece RLS o se anaden CHECKs).

## Criterio de corte

`ComunicadosView` (Gerencia) lee y escribe la tabla real `comunicados`; el listado, las KPI cards y el calendario muestran datos reales (no el mock); las acciones publicar/programar/archivar/eliminar operan sobre BD; `data/comunicados.ts` deja de ser fuente funcional. Cierre alineado con la fila "OLA2-03" del `EXECUTION_PLAN_OLA2.md`.

## Modo operativo

- taskId: **OLA2-03**
- taskMode: **code**
- reviewMode: **standard**
- sourcePlan: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- dependsOn: ninguna (task sin bloqueo, "Ola B - conexiones rapidas")

## Contexto previo obligatorio

Leer antes de ejecutar:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-03-comunicados-reales.md` (este discovery; el mapper y el inventario de muertos estan ahi).
2. `src/features/gerencia/components/ComunicadosView.tsx` (vista a de-mockear; foco en `loadComunicados` lin 604-619, `saveEditor` lin 686-728, dropdown lin 890-899, KPIs lin 828-833).
3. `src/features/gerencia/actions/comunicados-actions.ts` (CRUD real ya existente: `listComunicados`, `createComunicado`, `updateComunicado`, `deleteComunicado`, `listEmpleadosParaComunicado`).
4. `src/features/mi-panel/actions/mi-panel-actions.ts::listarComunicadosVisibles()` (patron de lectura real + reglas de visibilidad que NO se deben romper).
5. `src/features/mi-panel/mobile/lib/push-comunicado.ts` (resolucion de destinatarios + push; ya integrado en las actions).
6. `src/features/empresa/lib/empresa-server.ts::getEmpresaActivaForUser()` (devuelve UUID; explica por que el slug solo afecta al mock).
7. Migraciones: `supabase/migrations/009_operativa_diaria.sql`, `052_comunicados_destinatarios.sql`, `093_fix_canales_comunicados_empresa_id.sql`.
8. `EXECUTION_PLAN_OLA2.md` (criterios globales de corte: UUID en actions, RLS real, placeholder honesto, no reintroducir mock).

## Scope IN

- De-mockear `loadComunicados`: usar el resultado real de `listComunicados()` (ya scoped por UUID), mapeado a un ViewModel que la UI pueda pintar.
- Crear un **mapper** fila-plana (`comunicados`) -> ViewModel de la vista (campos derivados: `creadoEl` formateado, `recurrencia`, `todaEmpresa`, contadores de `destinatarios`, `alcancePct` real). Ubicarlo en el feature `gerencia` (no en `rrhh/data`).
- Recalcular las KPI cards (total, publicados, programados, alcance medio) sobre datos reales.
- Alimentar el calendario (mensual/anual) con datos reales (campo `envio`).
- Activar handlers de dropdown hoy muertos: **Archivar** (`updateComunicado` estado `archivado`), **Eliminar** (`deleteComunicado` + confirm). Opcionales: **Duplicar** (clonar payload -> `createComunicado` en borrador), **Programar** (atajo a estado `programado` con fecha).
- Distinguir explicitamente publicar (estado `publicado`, dispara push existente) vs programar (estado `programado`, `envio` futuro, sin push inmediato).
- Conservar el editor real de destinatarios (`empleadosReales` via `listEmpleadosParaComunicado`).
- Retirar `src/features/rrhh/data/comunicados.ts` como fuente funcional. Conservar SOLO los enums/labels reutilizados (`EstadoComunicado`, `ESTADO_COMUNICADO_LABELS`, `Recurrencia`, `RECURRENCIA_LABELS`) si la UI los sigue usando; moverlos a un lugar neutral del feature si conviene.
- Verificar schema real de `comunicados` via Management API antes de tocar (confirmar `empresa_id uuid`, las 3 columnas array de 052, y `alcance_pct`).

## Scope OUT

- NO crear tablas nuevas ni tabla hija de destinatarios (no existe; los destinatarios son 3 columnas array inline).
- NO reescribir las server actions de escritura (ya son reales y correctas).
- NO calcular `alcance_pct` real (requeriria tracking de lecturas/entregas; mostrar 0 honesto). Fuera de alcance.
- NO tocar el lado empleado (`listarComunicadosVisibles`, `/m/comunicados`); ya es real y no debe cambiar de comportamiento.
- NO implementar editor enriquecido real (negrita/listas son botones decorativos; siguen fuera de alcance).
- NO subir adjuntos reales (el editor simula adjuntos; storage de adjuntos es otra task si se decide).
- NO tocar recurrencia como motor de reenvio programado (cron de recurrencia es fuera de alcance; `recurrencia` se persiste como metadato).

## Restricciones

- Las server actions reciben/derivan el **UUID de empresa**, nunca el slug. La UI deja de usar `empresaActual.id` (slug) como clave de datos reales.
- RLS multi-tenant real por `empresa_id` (ya vigente desde 093). No reintroducir `using(true) with check(true)`.
- Si se endurece RLS write por rol, hacerlo con migracion idempotente y verificada; no romper el alta del creador legitimo.
- No reintroducir `data/rrhh.ts` ni `data/comunicados.ts` como fuente funcional (criterio global Ola 1/2).
- Flujos de escritura conservan try/catch, error legible (`toast`) y no rompen la vista si la BD falla (degradar a lista vacia con aviso, no a mock).
- Validacion por ejecutor: `npm run typecheck` y `npm run build` via WSL (`wsl -d Ubuntu bash -c`, NON-login).
- Commits terminan en `_FernandoClaude` (criterio del `EXECUTION_PLAN_OLA2.md`); push directo a `main` tras typecheck+build verdes. (El agente de arquitectura NO commitea.)
- No versionar peppers/SMTP/claves/service-role.

## Validacion requerida

1. `npm run typecheck` verde (WSL).
2. `npm run build` verde (WSL).
3. Smoke funcional controlado (dev local):
   - Crear un comunicado en `publicado` desde Gerencia -> aparece en el listado real de Gerencia **y** en `/m/comunicados` del empleado destinatario.
   - Editar un comunicado existente -> el cambio persiste tras recargar (ya no "revive" el mock).
   - Archivar -> desaparece de la vista empleado (estado `archivado` excluido) y queda como archivado en Gerencia.
   - Eliminar -> desaparece de ambos lados.
   - Cambiar de empresa en el switcher (habana/bacanal) -> el listado real cambia de tenant (no mezcla, no muestra mock).
4. Verificacion BD (Management API / SQL): la fila creada existe en `comunicados` con `empresa_id` = UUID correcto y los `*_destinatarios` poblados segun la seleccion.
5. RLS: un usuario de otra empresa no ve ni edita los comunicados ajenos (read+write scoped).

## Dependencias

- **Bloqueantes:** ninguna. Task de la "Ola B" (tabla ya existe).
- **Coordinacion suave:** OLA2-01 (empleados reales) — `listEmpleadosParaComunicado` ya lee `profiles` real, asi que no bloquea; si OLA2-01 unifica el selector de empleados, reutilizar esa fuente para coherencia, pero no es prerrequisito.
- **Decision de negocio:** D-OLA2-03-A (gating RLS write por rol) — ver seccion de decisiones.

## Inputs

- Tabla real `public.comunicados` (schema en seccion "Modelo de datos propuesto").
- `comunicados-actions.ts` (CRUD real ya disponible).
- `listEmpleadosParaComunicado()` (empleados reales del tenant).
- Empresa activa por UUID via `getEmpresaActivaForUser()`.
- Enums/labels de estado/recurrencia (hoy en `data/comunicados.ts`).

## Outputs esperados

- `ComunicadosView` renderiza datos reales (listado, KPIs, calendario, editor de edicion) sin tocar el mock.
- Mapper fila-plana -> ViewModel ubicado en el feature `gerencia` (p.ej. `src/features/gerencia/lib/comunicados-map.ts` o un `types`/`mappers` del feature).
- Handlers reales para Archivar y Eliminar (y opcionalmente Duplicar/Programar) cableados al CRUD.
- `data/comunicados.ts` retirado como fuente funcional (solo labels/tipos si se reutilizan, idealmente reubicados).
- (Opcional) migracion idempotente que endurezca RLS write por rol y/o anada CHECK de dominios, si se aprueba la decision.
- Documentacion de cierre y, si aplica, registro de blindaje.

## Riesgos conocidos

- **R1 Mapper incompleto** -> la tabla rompe por campos undefined (`destinatarios`, `creadoEl`). Mitigacion: mapper con defaults seguros y tipado estricto.
- **R2 Alcance ficticio** -> el mock mostraba 60/85/100 %; lo real es 0 %. Mitigacion: mostrar 0 honesto o etiquetar "sin medicion". No inventar.
- **R3 RLS write sin rol** -> hoy cualquier empleado del tenant puede escribir. Endurecer puede bloquear al creador legitimo. Mitigacion: confirmar D-OLA2-03-A antes; si se endurece, permitir explicitamente Director/Gerencia.
- **R4 Estados text libres** -> BD no valida dominio. Mitigacion: validar en TS (enums ya existen) y, opcionalmente, CHECK en BD.
- **R5 Slug residual** -> cualquier query real que reciba slug devuelve 0 filas. Mitigacion: auditar que solo el mock (a retirar) usaba `empresaActual.id`.
- **R6 Push duplicado** -> al implementar publicar/archivar reutilizando las actions, no duplicar notificaciones. Mitigacion: la logica existente ya solo notifica en borrador->publicado; archivar/eliminar no deben notificar.
- **R7 Schema prod != SQL** -> verificar con Management API que `empresa_id` es uuid y existen las 3 columnas array antes de tocar.

## Modelo de datos propuesto

**NO se propone tabla nueva.** Se documenta el schema REAL de `public.comunicados` (de 009 + 052 + 093). **VERIFICAR SCHEMA REAL via Management API** antes de escribir/migrar (el SQL versionado puede no reflejar el prod real; regla del proyecto).

Los destinatarios NO viven en una tabla hija: son **3 columnas array inline** en `comunicados` (pese al nombre del fichero `052_comunicados_destinatarios.sql`).

### `public.comunicados`

| Columna | Tipo | Default / Constraint | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` | dbId; usar este, no ids "hc1" del mock |
| `empresa_id` | `uuid` | NOT NULL, FK -> `empresas(id)` ON DELETE CASCADE | retipado de text a uuid en 093 |
| `titulo` | `text` | NOT NULL | |
| `asunto` | `text` | nullable | |
| `cuerpo` | `text` | nullable | el empleado lo ve como `contenido` |
| `estado` | `text` | NOT NULL default `'borrador'` | dominio: borrador/programado/publicado/archivado (sin CHECK) |
| `prioridad` | `text` | NOT NULL default `'normal'` | baja/normal/alta/urgente (sin CHECK) |
| `recurrencia` | `text` | NOT NULL default `'sin_repeticion'` | sin_repeticion/semanal/mensual/personalizado (sin CHECK) |
| `toda_empresa` | `boolean` | NOT NULL default `true` | |
| `roles_destinatarios` | `text[]` | NOT NULL default `'{}'` | GIN index (052) |
| `empleados_destinatarios` | `uuid[]` | NOT NULL default `'{}'` | IDs `auth.users`; GIN index (052) |
| `departamentos_destinatarios` | `text[]` | NOT NULL default `'{}'` | GIN index (052) |
| `envio` | `timestamptz` | nullable | fecha/hora de envio programado |
| `alcance_pct` | `integer` | NOT NULL default `0` | nunca escrito por la app (hoy siempre 0) |
| `observaciones` | `text` | nullable | notas internas |
| `creador_id` | `uuid` | FK -> `profiles(user_id)` ON DELETE SET NULL | la action lo rellena con `user.id` |
| `created_at` | `timestamptz` | NOT NULL default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL default `now()` | la action lo setea a mano en update |

### RLS real (093)

- `comunicados_read` (SELECT): `empresa_id IN (profiles del usuario)`. Multi-tenant correcto.
- `comunicados_write` (FOR ALL = INSERT/UPDATE/DELETE): mismo predicado en USING + WITH CHECK. Multi-tenant correcto **pero sin gating por rol** (cualquier empleado del tenant escribe). Ver D-OLA2-03-A.

### Cambio opcional (solo si se aprueba la decision)

Migracion idempotente que:
- reescriba `comunicados_write` para exigir rol Director/Gerencia (via `user_roles`/`empresa_roles`), y/o
- anada `CHECK` de dominio a `estado`/`prioridad`/`recurrencia`.

No es obligatorio para cerrar el de-mock.

## Interfaces publicas propuestas

Las actions de escritura **ya existen** en `comunicados-actions.ts`. La task reutiliza estas firmas (no las reinventa); a lo sumo anade alias semanticos y el mapper.

Firmas reales existentes (conservar):

```ts
// src/features/gerencia/actions/comunicados-actions.ts
export async function listComunicados(): Promise<{ ok: boolean; data: ComunicadoRow[] }>;
export async function listEmpleadosParaComunicado(): Promise<{ ok: boolean; data: EmpleadoSelector[]; error?: string }>;
export async function createComunicado(input: ComunicadoInput): Promise<{ ok: boolean; data?: ComunicadoRow; error?: string }>;
export async function updateComunicado(id: string, input: ComunicadoInput): Promise<{ ok: boolean; error?: string }>;
export async function deleteComunicado(id: string): Promise<{ ok: boolean; error?: string }>;
// ComunicadoInput = { titulo; asunto?; cuerpo?; estado?; prioridad?; recurrencia?;
//                     todaEmpresa?; rolesDestinatarios?; empleadosDestinatarios?;
//                     departamentosDestinatarios?; envio?; observaciones? }
```

Nuevas firmas propuestas (azucar semantico sobre lo anterior; opcionales pero recomendadas para legibilidad):

```ts
// Listado admin ya mapeado a ViewModel, scoped al tenant activo (UUID derivado server-side).
// NO recibe slug; el dbId lo deriva la action via getEmpresaActivaForUser.
export async function listarComunicadosAdmin(): Promise<{ ok: boolean; data: ComunicadoVM[]; error?: string }>;

// Atajos de estado sobre updateComunicado (evitan que la UI repita el patron y el push).
export async function publicarComunicado(id: string): Promise<{ ok: boolean; error?: string }>;   // estado -> 'publicado' (dispara push existente)
export async function programarComunicado(id: string, envioISO: string): Promise<{ ok: boolean; error?: string }>; // estado -> 'programado' + envio
export async function archivarComunicado(id: string): Promise<{ ok: boolean; error?: string }>;   // estado -> 'archivado' (sin push)

// Mapper puro (no action): fila plana -> ViewModel de la vista.
// src/features/gerencia/lib/comunicados-map.ts
export function mapComunicadoRowToVM(row: ComunicadoRow): ComunicadoVM;
```

Notas de contrato:

- `listarComunicadosAdmin` puede ser, en la practica, `listComunicados` + `.map(mapComunicadoRowToVM)`; se expone como una sola interfaz para que la UI no toque filas crudas.
- `publicar/programar/archivar` son envoltorios de `updateComunicado` para centralizar la regla de push (publicar notifica; archivar/programar no notifican inmediato).
- `ComunicadoVM` incluye los derivados: `creadoEl` (formateado), `destinatarios:{empresas,departamentos,empleados}` (contadores derivados de `toda_empresa` + longitudes de arrays), `alcancePct` (real, hoy 0), camelCase de los arrays.

## Flujo operativo esperado (fases)

1. **Fase 0 - Verificacion de schema.** Confirmar via Management API que `comunicados` real tiene `empresa_id uuid`, las 3 columnas array (052) y `alcance_pct`. Anotar cualquier divergencia con el SQL.
2. **Fase 1 - Mapper + ViewModel.** Definir `ComunicadoRow` (forma BD), `ComunicadoVM` (forma vista) y `mapComunicadoRowToVM`. Derivar contadores de destinatarios y formatos de fecha. Tests minimos del mapper si el repo los soporta.
3. **Fase 2 - De-mock de lectura.** Reescribir `loadComunicados` para usar `listarComunicadosAdmin()` (o `listComunicados()`+map). Eliminar la rama que llama a `getComunicadosByEmpresa`. Degradar a lista vacia + aviso si falla (no a mock).
4. **Fase 3 - KPIs y calendario reales.** Recalcular las 4 cards y alimentar el calendario con el ViewModel real.
5. **Fase 4 - Handlers de gestion.** Implementar Archivar y Eliminar (con confirm) via `archivarComunicado`/`deleteComunicado`; opcional Duplicar/Programar. Recargar listado tras cada accion.
6. **Fase 5 - Retirada del mock.** Eliminar `data/comunicados.ts` como import funcional; reubicar labels/tipos si se reutilizan. Asegurar que ningun punto pasa el slug a datos reales.
7. **Fase 6 - Validacion.** `typecheck` + `build` (WSL) + smoke Gerencia<->empleado + verificacion BD + RLS cross-tenant.
8. **Fase 7 (condicional) - RLS por rol.** Solo si se aprueba D-OLA2-03-A: migracion idempotente verificada que endurece write y/o anade CHECKs.

## Decisiones de negocio pendientes

- **D-OLA2-03-A (gating de escritura por rol).** Hoy la RLS `comunicados_write` permite a **cualquier** usuario `authenticated` del tenant crear/editar/borrar comunicados (no solo Director/Gerencia). ¿Se restringe la escritura a roles de gestion (Director/Gerencia/RRHH) o se mantiene abierta al tenant? Afecta a la Fase 7 y a una posible migracion de RLS. Recomendacion del discovery: restringir (es un panel de Gerencia), pero requiere confirmacion del responsable.
- **D-OLA2-03-B (alcance).** `alcance_pct` no se mide. ¿Se muestra 0 honesto, se oculta la metrica, o se planifica una task futura de tracking de lecturas? Recomendacion: mostrar 0/"sin medicion" ahora; tracking fuera de alcance.
- **D-OLA2-03-C (adjuntos y recurrencia).** El editor simula adjuntos y la recurrencia no dispara reenvios. ¿Se persisten como metadato (sin efecto) o se retiran de la UI hasta tener backend? Recomendacion: persistir recurrencia como metadato; ocultar adjuntos hasta tener storage.

(Estas decisiones no las toma el agente; se elevan al responsable. El de-mock principal -lectura real + handlers- no depende de ellas salvo la Fase 7.)

## Paths del proyecto

- Vista a de-mockear: `src/features/gerencia/components/ComunicadosView.tsx`
- Actions reales (reutilizar/ampliar): `src/features/gerencia/actions/comunicados-actions.ts`
- Mapper nuevo (propuesto): `src/features/gerencia/lib/comunicados-map.ts`
- Mock a retirar: `src/features/rrhh/data/comunicados.ts`
- Patron de lectura real (referencia): `src/features/mi-panel/actions/mi-panel-actions.ts` (`listarComunicadosVisibles`)
- Push (ya integrado): `src/features/mi-panel/mobile/lib/push-comunicado.ts`
- Empresa activa (UUID): `src/features/empresa/lib/empresa-server.ts`
- Migraciones de referencia: `supabase/migrations/009_operativa_diaria.sql`, `052_comunicados_destinatarios.sql`, `093_fix_canales_comunicados_empresa_id.sql`
- IO/exportacion (ya cableado, no tocar salvo coherencia): `src/features/gerencia/io/comunicados.io.ts`

## Agentes recomendados

- **generate-data-access-layer** / patron de server actions: para el mapper y los envoltorios `publicar/programar/archivar` si se formalizan.
- **review-rls-multi-tenant**: para validar (y, si se aprueba D-OLA2-03-A, endurecer) la RLS de escritura por rol antes de cerrar.
- **golden-path-review** o **review-repo-coherence**: revision final de coherencia (que no quede mock funcional ni slug en datos reales).
- Ejecutor humano (Fernando) para `typecheck`/`build` por WSL, smoke con switcher de empresa y verificacion BD via Management API.

## Checklist de cierre

- [ ] Fase 0: schema de `comunicados` verificado en prod via Management API (empresa_id uuid + 3 columnas array + alcance_pct).
- [ ] `loadComunicados` usa datos reales; `getComunicadosByEmpresa` ya no se llama.
- [ ] Mapper fila-plana -> ViewModel implementado y tipado; sin campos undefined en la tabla.
- [ ] KPI cards y calendario recomputados sobre datos reales.
- [ ] Handlers Archivar y Eliminar cableados al CRUD (con confirm en Eliminar); opcionales Duplicar/Programar si se incluyen.
- [ ] Publicar vs programar diferenciados; push solo en publicar (sin duplicados).
- [ ] `data/comunicados.ts` retirado como fuente funcional; labels/tipos reubicados o conservados solo si se reutilizan.
- [ ] Ningun punto pasa `empresaActual.id` (slug) a una query real.
- [ ] `npm run typecheck` verde (WSL).
- [ ] `npm run build` verde (WSL).
- [ ] Smoke: crear/editar/archivar/eliminar coherente entre Gerencia y `/m/comunicados`; switcher de empresa cambia de tenant sin mezclar.
- [ ] RLS cross-tenant verificada (otra empresa no ve ni edita).
- [ ] D-OLA2-03-A resuelta; si procede, migracion de RLS por rol aplicada y verificada (idempotente).
- [ ] Estado de blindaje declarado (documentado / no aplica / pendiente) segun politica `docs/dev/ERRORES.md`.
- [ ] Commit `..._FernandoClaude` + push a `main` tras validacion (lo ejecuta Fernando).

## Siguiente paso sugerido

Confirmar **D-OLA2-03-A** (gating de escritura por rol) con el responsable y ejecutar la **Fase 0** (verificacion de schema real via Management API). Hecho eso, abordar Fases 1-6 (mapper + de-mock de lectura + handlers + retirada de mock), dejando la Fase 7 (RLS por rol) condicionada a la decision. Es una task de "Ola B" de bajo riesgo y alto valor visible: puede ejecutarse de inmediato sin depender de OLA2-01/02.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-03-comunicados-reales.md
