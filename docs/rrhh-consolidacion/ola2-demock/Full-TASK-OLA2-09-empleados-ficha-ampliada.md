# Full-TASK-OLA2-09 - Ficha de empleado ampliada

## Estado
PLANIFICADO (Ola 2 de-mock, 2026-06-01). No implementado. Discovery en `DISCOVERY_OLA2-09-empleados-ficha-ampliada.md`.

## Objetivo
Convertir la ficha de empleado ampliada de mock a real **reutilizando el modelo de datos ya existente**, sin duplicar tablas. La pestana "Perfil" (datos personales) ya es real via `DatosPersonalesForm`/`profiles`; esta task completa el resto de la ficha cableando **contratos** y **evaluaciones** a sus tablas reales (`contratos`/`evaluaciones`, migracion 026), componiendo **formacion** desde el modelo de OLA2-08, resolviendo **documentos por empleado** (decision DN-1), y creando la unica pieza que falta de verdad: **`empleado_journey`** (hitos). Finalmente, retirar `data/empleados-ficha.ts` y las secciones/tabs huerfanas que lo consumen, sin romper lo que ya es real.

## Estimacion de complejidad
Alta. No por volumen de tablas nuevas (solo 1-2), sino por: (a) superficie amplia (varias pestanas + retirada de codigo huerfano sin romper lo real), (b) RLS de privacidad por rol sobre datos sensibles, (c) coordinacion con OLA2-08 (formacion) y OLA2-10/15 (roles/accesos) para no duplicar, (d) decision de negocio abierta sobre documentos (reuso vs nuevo), (e) verificacion de schema real en PROD antes de cablear. Riesgo medio-alto por el cruce con modulos en produccion (Documentacion de Direccion).

## Criterio de corte
- `src/features/rrhh/data/empleados-ficha.ts` eliminado; `grep -rln "empleados-ficha" src` -> vacio.
- Las secciones/tabs que consumian el mock (`perfilSections.tsx`, `ContratosTab`/`DocumentosTab`/`EvaluacionesTab` de `FichaTabsContent.tsx`) o se reconectan a datos reales o se eliminan; no queda ningun `type FichaEmpleado` mock en uso.
- Pestanas reales nuevas/recableadas en la ficha: **Contratos** (lee/crea `contratos`), **Evaluaciones** (lee/crea `evaluaciones`), **Documentos** (segun DN-1), **Journey** (lee/crea `empleado_journey`). Formacion compone desde OLA2-08 (o placeholder honesto si OLA2-08 no esta cerrada).
- Lo ya real intacto: pestana Perfil (`DatosPersonalesForm`), Fichajes, Horarios, Solicitudes, Firmas siguen funcionando.
- Toda tabla nueva o tocada lleva RLS multi-tenant por `empresa_id`; datos sensibles con gating por rol (RRHH/Direccion) y lectura del propio empleado sobre su ficha.
- Las server actions reciben el UUID de empresa (`dbId`) o resuelven empresa activa server-side; nunca el slug.
- `npm run typecheck` y `npm run build` verdes (WSL NON-login).
- Schema real verificado via Management API antes de migrar/cablear.

## Modo operativo
(taskId: OLA2-09 / taskMode: code / reviewMode: standard / sourcePlan: docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md)

## Contexto previo obligatorio
1. **OLA2-01 cerrada** (empleados reales como fuente unica): aporta ids uuid reales y `getEmpleadosActivos`. La ficha navega por `empleados.id` (uuid), no por slugs mock. Ver `Full-TASK-OLA2-01-empleados-reales-fuente-unica.md`.
2. Leer `DISCOVERY_OLA2-09-empleados-ficha-ampliada.md` (estado real: mock huerfano + tablas ya existentes).
3. Leer `supabase/migrations/026_rrhh_empleados.sql`: confirmar que `contratos` y `evaluaciones` (y `vacaciones`/`nominas`) ya existen con su DDL.
4. Leer `src/features/rrhh/actions/empleados-actions.ts`: `getEmpleadoConPerfil` (l.408) y `guardarPerfilEmpleado` (l.598) ya cubren datos personales sobre `profiles`. Reutilizar, no reimplementar.
5. Leer `src/app/(main)/rrhh/empleados/[id]/page.tsx`: la pestana "Perfil" ya monta `DatosPersonalesForm`; las tabs mock no se montan. La task **anade pestanas reales** y **retira mock**, no reemplaza la vista entera.
6. Coordinar con OLA2-08 (formacion) y OLA2-10/15 (roles/accesos): la ficha **lee** de esos modelos, no los redefine.
7. Criterios globales Ola 2: RLS multi-tenant real, UUID no slug, placeholder honesto donde falte backend, verificar schema PROD via Management API.

## Scope IN
- Crear/recablear pestanas reales en la ficha:
  - **Contratos**: action de lectura + alta/edicion sobre `public.contratos` (026), filtrada por `empleado_id` + `empresa_id`.
  - **Evaluaciones**: action de lectura + alta/edicion sobre `public.evaluaciones` (026).
  - **Journey**: crear tabla `public.empleado_journey` + CRUD de hitos.
  - **Documentos por empleado**: implementar segun decision DN-1 (reuso de `documentos` con vinculo a empleado, o `empleado_documentos` nuevo + storage).
- Componer **datos laborales derivados** de solo lectura (salario/coste, jornada, contrato vigente) desde `contratos`/`nominas`/`empleados`, sin duplicar.
- **Formacion**: cablear a las tablas de OLA2-08 si esta cerrada; si no, dejar placeholder honesto y dependencia explicita.
- **Campos personalizados / habilidades**: persistir como `jsonb`/`text[]` en `empleados` (o tablas hijas ligeras), reemplazando `camposPersonalizados`/`habilidades` mock.
- Endurecer RLS de privacidad de `contratos`/`evaluaciones`/`empleado_journey`/documentos a rol RRHH/Direccion + lectura del propio empleado.
- Retirar `data/empleados-ficha.ts` y el codigo huerfano que lo importa (`perfilSections.tsx` y los 3 tabs mock), o reconectarlo a las nuevas actions.

## Scope OUT
- NO crear de nuevo `contratos` ni `evaluaciones`: ya existen (026). Solo se cablean y, si procede, se endurece RLS / se anaden columnas.
- NO duplicar el modelo de **formacion** (lo crea OLA2-08).
- NO redefinir **roles** ni **accesos** (OLA2-10 / OLA2-15-PRP-043). La ficha solo los lee/enlaza.
- NO tocar los datos personales ya reales mas alla de exponerlos en la ficha (la escritura ya existe en `guardarPerfilEmpleado`).
- NO romper las pestanas reales existentes (Fichajes/Horarios/Solicitudes/Firmas/Perfil).
- NO migrar el modulo Documentacion de Direccion (`documentos`/`carpetas_documentos`) a otro dominio salvo lo minimo que exija DN-1, y solo tras verificar impacto en PROD.

## Restricciones
- Server actions reciben `empresaActual.dbId` (uuid) o resuelven empresa activa server-side; NUNCA el slug.
- RLS multi-tenant real por `empresa_id` en toda tabla nueva o tocada; nada de `using(true) with check(true)`. Datos sensibles (contratos/evaluaciones/personales/documentos) con gating por rol RRHH/Direccion y acceso del propio empleado a su ficha.
- Reutilizar el patron `{ ok, data }`/try-catch + `friendlyError` de las actions existentes del feature; escritura con `createAdminClient` + `requireAdminUser({ empresaIds })` cuando aplique gating de rol (como `guardarPerfilEmpleado`).
- Verificar schema real en PROD via Management API antes de migrar o cablear (no inferir del codigo). Marcar en el modelo todo lo VERIFICAR-SCHEMA-REAL.
- Commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes.
- No versionar peppers, service-role ni `CREDENCIALES_ENCRYPTION_KEY`; viven en `.env.local`.
- Restaurar `next-env.d.ts` si el tooling lo modifica.

## Validacion requerida
- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run typecheck"` -> verde.
- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run build"` -> verde.
- `grep -rln "empleados-ficha\|FichaEmpleado" src` -> sin referencias al mock retirado.
- Verificacion en PROD (Management API): `contratos`, `evaluaciones`, `empleado_journey` (nueva) y la solucion de documentos existen con RLS por `empresa_id` y policies por rol; `profiles` tiene las columnas 061/063/069.
- Smoke manual donde el flujo lo permita: abrir la ficha de un empleado real de HABANA y de BACANAL; comprobar que Contratos/Evaluaciones muestran filas reales (no mock h1/b1), que alta de hito/contrato/evaluacion persiste tras recargar, y que un usuario sin rol RRHH no ve datos sensibles que no le corresponden.
- `review-rls-multi-tenant` sobre las tablas tocadas; `golden-path-review` sobre las actions + consumo en la pagina.

## Dependencias
- Entrantes (bloquean a OLA2-09): **OLA2-01** (empleados reales / ids uuid). Recomendado: **OLA2-08** (formacion) para cablear la pestana Formacion; si no esta lista, placeholder honesto.
- Coordinacion (no bloqueo duro): **OLA2-10** (roles) y **OLA2-15/PRP-043** (accesos) para los bloques roles/accesos de la ficha (la ficha solo lee).
- Salientes: ninguna task depende de OLA2-09.

## Inputs
- `src/features/rrhh/data/empleados-ficha.ts` (mock a retirar).
- `src/app/(main)/rrhh/empleados/[id]/page.tsx` (pagina ficha real; punto de montaje de pestanas).
- `src/features/rrhh/components/empleados/perfilSections.tsx` y `FichaTabsContent.tsx` (secciones/tabs; huerfanas las mock).
- `src/features/rrhh/actions/empleados-actions.ts` (`getEmpleadoConPerfil`, `guardarPerfilEmpleado`, `DatosPersonalesCompletos`; destino de las nuevas actions de ficha).
- `src/features/mi-panel/actions/datos-personales-actions.ts` (modelo de datos personales reales).
- Migraciones: `026_rrhh_empleados.sql` (empleados/contratos/evaluaciones/nominas/vacaciones/departamentos/puestos), `061/063/069` (profiles personales), `095/096/098` (documentos/carpetas de Direccion).
- `src/features/empresa/contexts/empresa-context.tsx` (slug `id` vs uuid `dbId`).
- Outputs de OLA2-08 (tablas de formacion) cuando exista.

## Outputs esperados
- Migracion `.sql` nueva: `public.empleado_journey` (+ posibles columnas `jsonb`/`text[]` en `empleados` para campos personalizados/habilidades) + endurecimiento RLS de `contratos`/`evaluaciones` a rol; y, segun DN-1, vinculo de documentos a empleado o tabla `empleado_documentos` + storage.
- Actions nuevas en `empleados-actions.ts` (o `ficha-actions.ts`): lectura/CRUD de contratos, evaluaciones, journey y documentos por empleado; getter compuesto de ficha real.
- Ficha (`[id]/page.tsx`) con pestanas reales de Contratos/Evaluaciones/Journey/Documentos (+ Formacion via OLA2-08 o placeholder), manteniendo las reales existentes.
- `data/empleados-ficha.ts` eliminado; secciones/tabs mock retiradas o reconectadas.

## Riesgos conocidos
- **Duplicar `contratos`/`evaluaciones`**: ya existen (026). Mitigacion: reusar; este contrato y el plan maestro se alinean con el discovery (el plan decia "crear `empleado_evaluaciones`": queda anulado).
- **Romper lo ya real** al retirar el mock: la pestana Perfil (`DatosPersonalesForm`) y las tabs reales comparten el archivo `FichaTabsContent.tsx`. Mitigacion: retirar solo `ContratosTab`/`DocumentosTab`/`EvaluacionesTab` mock y `perfilSections.tsx`; no tocar `FichajesTab`/`HorariosTab`/`SolicitudesEmpleadoTab`.
- **Documentos por empleado (DN-1)**: reusar `documentos` (095/096) exige anadir vinculo a empleado y altera un modulo de Direccion vivo en PROD (cuotas, carpetas sembradas, storage path). Crear `empleado_documentos` duplica infra de storage/whitelist/cuotas. Riesgo de coste y de RLS. Mitigacion: decidir DN-1 antes de ejecutar.
- **RLS de privacidad laxa**: `cont_manage`/`eval_manage`/`emp_manage` (026) permiten escribir a cualquier miembro de la empresa. Datos personales/salariales sensibles. Mitigacion: endurecer a rol RRHH/Direccion + lectura del propio empleado; revisar con `review-rls-multi-tenant`.
- **Dependencia de OLA2-08** para formacion: si se ejecuta antes, la pestana Formacion queda en placeholder. Mitigacion: dependencia explicita; no inventar tablas de formacion aqui.
- **Slug vs uuid**: pasar slug a una action devolveria vacio o datos cruzados. Mitigacion: UUID/contexto server-side.
- **Schema real != migraciones**: confirmar DDL en PROD (Management API) de `contratos`/`evaluaciones`/`profiles` antes de cablear.

## Modelo de datos propuesto
> Marca global: **VERIFICAR-SCHEMA-REAL via Management API** antes de migrar o cablear. No inferir del codigo.

### Se REUTILIZA (no se crea)
- `public.profiles` (061/063/069): `datosPersonales`, `direccion`, `contacto`, tallas, banca, emergencia. Lectura `getEmpleadoConPerfil`, escritura `guardarPerfilEmpleado`. **Nada que crear.**
- `public.empleados` (026/065): ancla 1:1 (`puesto`, `departamento_id`, `fecha_alta`, `estado`, `jefe_directo_id`, `avatar_url`).
- `public.contratos` (026): seccion **Contratos**. Mapea `ContratoEmpleado` mock -> `tipo`/`fecha_inicio`/`fecha_fin`/`estado` (+ `salario_bruto`/`jornada_horas`/`documento_url`). RLS a endurecer por rol.
- `public.evaluaciones` (026): seccion **Evaluaciones**. Mapea `EvaluacionEmpleado` mock -> `fecha_evaluacion`/`tipo`/`estado`/`evaluador_id` (+ puntuaciones y textos ricos). RLS a endurecer por rol.
- `public.nominas`/`public.vacaciones` (026): datos laborales derivados de solo lectura (salario/coste, dias).
- Formacion: **modelo de OLA2-08** (no aqui).
- Roles/accesos: **modelo de OLA2-10 / OLA2-15-PRP-043** (no aqui).

### Se CREA (lo unico genuinamente nuevo)
- `public.empleado_journey` (hitos del trabajador) — VERIFICAR-SCHEMA-REAL (no existe hoy):
  - `id uuid pk default gen_random_uuid()`
  - `empresa_id uuid not null references empresas(id) on delete cascade`
  - `empleado_id uuid not null references empleados(id) on delete cascade`
  - `fecha date not null`
  - `titulo text not null`
  - `descripcion text`
  - `tipo text` (opcional: Incorporacion/Promocion/Formacion/Reconocimiento/Otro)
  - `created_by uuid references auth.users(id) on delete set null`
  - `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` + trigger
  - Indices: `(empleado_id)`, `(empresa_id, fecha)`. RLS por `empresa_id` + gating por rol RRHH/Direccion; lectura del propio empleado de su journey.
- **Campos personalizados / habilidades** (decision tecnica): `empleados.campos_personalizados jsonb default '{}'` y `empleados.habilidades text[] default '{}'` (alternativa: tabla hija `empleado_campos`/`empleado_habilidades` si se requiere consultar/filtrar). Reemplazan `camposPersonalizados`/`habilidades` mock.
- **Documentos por empleado** (segun DN-1):
  - Opcion A (reuso): vincular `public.documentos` (096) a empleado — carpeta logica por empleado **o** columna `empleado_id uuid references empleados(id)` + policy. Reusa bucket/cuotas/whitelist existentes.
  - Opcion B (nuevo): `public.empleado_documentos` (`empleado_id`, `nombre`, `tipo`, `storage_path`, `tipo_mime`, `tamano_bytes`, fecha, `empresa_id`) + bucket privado dedicado con whitelist + RLS por `empresa_id`/rol. Mas aislado, duplica infra.

### Endurecimiento RLS (tablas existentes)
- `contratos`/`evaluaciones`/`empleado_journey`/documentos: reemplazar `manage` laxo por policy que exija rol RRHH/Direccion para escritura y permita al propio empleado **leer** su ficha (join por `empleados.user_id = auth.uid()`), manteniendo el aislamiento por `empresa_id`.

## Interfaces publicas propuestas
En `src/features/rrhh/actions/empleados-actions.ts` (o nuevo `src/features/rrhh/actions/ficha-actions.ts`). Firmas orientativas (ajustar a los tipos reales tras VERIFICAR-SCHEMA-REAL):

```ts
// Getter compuesto: arma la ficha REAL desde las fuentes ya reales + las nuevas.
// Reutiliza getEmpleadoConPerfil para personales; NO usa el mock.
export interface FichaEmpleadoReal {
  empleado: EmpleadoRow;                 // empleados (+ departamento)
  datosPersonales: DatosPersonalesCompletos; // de profiles (ya existe)
  contratos: ContratoRow[];              // public.contratos
  evaluaciones: EvaluacionRow[];         // public.evaluaciones
  journey: JourneyHitoRow[];             // public.empleado_journey (nueva)
  documentos: DocumentoEmpleadoRow[];    // segun DN-1
  // formacion: FormacionRow[];          // de OLA2-08 (o [] + flag pendiente)
}
export async function getFichaEmpleado(empleadoId: string): Promise<
  { ok: true; data: FichaEmpleadoReal } | { ok: false; error: string }
>;

// Contratos (reuso tabla 026)
export async function listContratosEmpleado(empleadoId: string): Promise<{ ok: boolean; data: ContratoRow[] }>;
export async function crearContrato(input: CrearContratoInput): Promise<{ ok: boolean; error?: string }>;
export async function actualizarContrato(id: string, updates: ActualizarContratoInput): Promise<{ ok: boolean; error?: string }>;

// Evaluaciones (reuso tabla 026)
export async function listEvaluacionesEmpleado(empleadoId: string): Promise<{ ok: boolean; data: EvaluacionRow[] }>;
export async function crearEvaluacion(input: CrearEvaluacionInput): Promise<{ ok: boolean; error?: string }>;

// Journey (tabla nueva)
export async function listJourneyEmpleado(empleadoId: string): Promise<{ ok: boolean; data: JourneyHitoRow[] }>;
export async function crearHitoJourney(input: { empleadoId: string; fecha: string; titulo: string; descripcion?: string; tipo?: string }): Promise<{ ok: boolean; error?: string }>;
export async function eliminarHitoJourney(id: string): Promise<{ ok: boolean; error?: string }>;

// Documentos por empleado (segun DN-1; usar create-storage-upload-flow)
export async function listDocumentosEmpleado(empleadoId: string): Promise<{ ok: boolean; data: DocumentoEmpleadoRow[] }>;
export async function subirDocumentoEmpleado(input: SubirDocumentoInput): Promise<{ ok: boolean; error?: string }>;
export async function eliminarDocumentoEmpleado(id: string): Promise<{ ok: boolean; error?: string }>;
```
Las acciones de escritura siguen el patron `guardarPerfilEmpleado`: `requireAdminUser({ empresaIds: [emp.empresa_id] })` + `createAdminClient` + `friendlyError` + `revalidatePath(\`/rrhh/empleados/${empleadoId}\`)`. Datos personales **no** llevan action nueva (ya existe `guardarPerfilEmpleado`).

## Flujo operativo esperado
**Fase 0 - Verificacion de schema real (Management API).** Confirmar DDL/RLS de `contratos`, `evaluaciones`, `profiles` (061/063/069) en PROD; confirmar que `empleado_journey` y los documentos por empleado no existen; decidir DN-1.

**Fase 1 - Migracion.** Crear `empleado_journey` (+ columnas `jsonb`/`text[]` o tablas ligeras para campos personalizados/habilidades) y, segun DN-1, el vinculo/tabla de documentos. Endurecer RLS por rol en `contratos`/`evaluaciones`/`empleado_journey`/documentos. typecheck/verificacion antes de seguir.

**Fase 2 - Actions de lectura.** `getFichaEmpleado` compuesto (reusa `getEmpleadoConPerfil`) + `listContratosEmpleado`/`listEvaluacionesEmpleado`/`listJourneyEmpleado`/`listDocumentosEmpleado`. typecheck.

**Fase 3 - Pestanas reales en la ficha.** Anadir/recablear en `[id]/page.tsx` las pestanas Contratos/Evaluaciones/Journey/Documentos a las actions reales, manteniendo intactas Perfil/Fichajes/Horarios/Solicitudes/Firmas. Formacion: cablear a OLA2-08 o placeholder honesto.

**Fase 4 - Actions de escritura + CRUD UI.** Alta/edicion de contrato, evaluacion, hito, documento (gate por rol). Reusar `create-storage-upload-flow` para documentos.

**Fase 5 - Retirar mock.** Borrar `data/empleados-ficha.ts`; eliminar `perfilSections.tsx` y los 3 tabs mock de `FichaTabsContent.tsx` (o reconectarlos). `grep` de criterio de corte vacio.

**Fase 6 - Validar.** typecheck + build verdes (WSL), smoke HABANA/BACANAL, revision RLS, verificacion PROD. Commit `_FernandoClaude` + push a `main`.

## Decisiones de negocio pendientes
- **DN-1 (documentos por empleado)**: ¿reusar `documentos`/`carpetas_documentos` (095/096) vinculandolos a empleado (carpeta por empleado o columna `empleado_id`), o crear `empleado_documentos` + storage propio? Trade-off: reuso evita duplicar infra pero altera un modulo de Direccion en PROD; tabla nueva aisla pero duplica cuotas/whitelist/bucket. **Requiere al responsable.**
- **DN-2 (alcance de evaluaciones)**: ¿la ficha solo **lista** evaluaciones reales y permite alta simple (fecha/tipo/resultado), o expone el modelo completo de 026 (5 puntuaciones 1-5, media, puntos fuertes/areas de mejora/objetivos, estado Borrador/Completada/Firmada)? Define el formulario y el peso de la UI.
- **DN-3 (campos personalizados / habilidades)**: ¿`jsonb`/`text[]` en `empleados` (simple, no filtrable) o tablas hijas (consultables/filtrables)? Recomendado: `jsonb`/`text[]` salvo necesidad de filtrar.
- **DN-4 (formacion en la ficha)**: ¿esperar a OLA2-08 para cablear o publicar la ficha con placeholder honesto de Formacion? Recomendado: placeholder honesto si OLA2-08 no esta cerrada.
- **DN-5 (privacidad/rol)**: ¿que roles ven/editan contratos/evaluaciones/documentos (RRHH y Direccion) y que ve el propio empleado de su ficha? Define las policies RLS.

## Paths del proyecto
A crear:
- `supabase/migrations/<NNN>_empleado_journey_y_ficha_rls.sql` (journey + jsonb/text[] + endurecer RLS contratos/evaluaciones; documentos segun DN-1).
- Opcional `src/features/rrhh/actions/ficha-actions.ts` (si no se amplia `empleados-actions.ts`).

A tocar:
- `src/features/rrhh/actions/empleados-actions.ts` (actions de ficha: contratos/evaluaciones/journey/documentos + getter compuesto).
- `src/app/(main)/rrhh/empleados/[id]/page.tsx` (montar pestanas reales nuevas).
- `src/features/rrhh/components/empleados/FichaTabsContent.tsx` (recablear `ContratosTab`/`DocumentosTab`/`EvaluacionesTab` a datos reales o eliminarlas).
- `src/features/rrhh/components/empleados/perfilSections.tsx` (retirar/reconectar secciones mock).

A retirar:
- `src/features/rrhh/data/empleados-ficha.ts`.

A leer como referencia (no se tocan salvo lo indicado):
- `src/features/mi-panel/actions/datos-personales-actions.ts`.
- `supabase/migrations/026_rrhh_empleados.sql`, `061/063/069`, `095/096/098`.
- Outputs de OLA2-08 (formacion).

## Agentes recomendados
- Implementacion: agente de codigo Next.js/Supabase (Feature-First, TS estricto).
- Tabla + RLS: skill `create-supabase-table-rls-base` (para `empleado_journey` y endurecimiento de policies).
- Documentos: skill `create-storage-upload-flow` (DN-1 opcion A o B).
- Revision: `review-rls-multi-tenant` (privacidad por rol + aislamiento por `empresa_id`) y `golden-path-review` (actions + consumo en la pagina).
- Validacion: ejecutor con WSL para `typecheck`/`build` y smoke con navegador (HABANA/BACANAL).

## Checklist de cierre
- [ ] Schema real verificado en PROD (Management API): `contratos`/`evaluaciones`/`profiles`; inexistencia de `empleado_journey`/documentos por empleado; DN-1 decidido.
- [ ] Migracion aplicada: `empleado_journey` + campos personalizados/habilidades + (DN-1) documentos; RLS por rol en contratos/evaluaciones/journey/documentos.
- [ ] Actions de lectura y escritura de contratos/evaluaciones/journey/documentos + `getFichaEmpleado` compuesto (reusa `getEmpleadoConPerfil`).
- [ ] Pestanas reales en la ficha (Contratos/Evaluaciones/Journey/Documentos); Formacion via OLA2-08 o placeholder honesto.
- [ ] Pestanas reales existentes intactas (Perfil/Fichajes/Horarios/Solicitudes/Firmas).
- [ ] `data/empleados-ficha.ts` eliminado; secciones/tabs mock retiradas o reconectadas; `grep -rln "empleados-ficha" src` -> vacio.
- [ ] RLS revisada: rol RRHH/Direccion para escritura sensible; el propio empleado lee su ficha; aislamiento por `empresa_id`.
- [ ] `npm run typecheck` y `npm run build` verdes (WSL).
- [ ] Smoke HABANA + BACANAL: datos reales, alta persiste tras recarga, gating de rol respetado.
- [ ] Commit `_FernandoClaude` + push a `main` tras validacion.

## Siguiente paso sugerido
Ejecutar la **Fase 0** (verificar via Management API el DDL/RLS de `contratos`/`evaluaciones`/`profiles` y resolver DN-1 con el responsable). Confirmado eso, crear la migracion de `empleado_journey` + endurecimiento RLS (Fase 1) y `typecheck` antes de cablear actions y pestanas. Recomendado cerrar OLA2-08 antes para poder cablear la pestana Formacion sin placeholder.

## Ruta canonica
docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-09-empleados-ficha-ampliada.md
