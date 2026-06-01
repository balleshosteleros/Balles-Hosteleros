# DISCOVERY OLA2-11 - Criterios de resena reales (retirar store en RAM)

- taskId: OLA2-11
- taskMode: code
- complejidad: Baja
- depende de: OLA2-10 (mismo dominio reclutamiento)
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md
- fecha discovery: 2026-06-01
- estado: PLANIFICADO Ola 2 (no implementado). Verificacion sobre codigo real del repo.

## Resumen ejecutivo

Hay **dos mocks** detras de esta pestana, no uno:

1. **Criterios de resena** (`criteriosResenaStore.ts`): catalogo de criterios (Actitud, Experiencia, etc.) en un store en RAM con `useSyncExternalStore`. Volatil: cualquier alta/edicion/borrado se pierde al recargar y no es multi-tenant (es global del proceso cliente).
2. **Las resenas en si** (`Candidato.resenas`): las puntuaciones por criterio + comentario que el reclutador guarda sobre un candidato **tampoco se persisten**. La tabla real `public.candidatos` (migracion 010) NO tiene columna de resenas; el mapeo `listVacantesConCandidatos` no proyecta `resenas`, y `updateCandidato` no acepta `resenas`. Se guardan solo en estado de React (`onUpdateCandidato`) y desaparecen al recargar.

La task del plan ("tabla `criterios_resena` + CRUD; retirar store en RAM") cubre el punto 1. El punto 2 es un mock contiguo que sale a la luz al investigar y **hay que decidir si entra en esta task** (recomendado: si, porque persistir criterios sin persistir resenas deja la pestana medio real y confunde). Ver Decisiones de negocio en el Full-TASK.

## Estado real verificado

### `src/features/rrhh/data/criteriosResenaStore.ts` (64 lineas) — MOCK en RAM

- Modulo cliente con patron `useSyncExternalStore`:
  - `let criterios: CriterioResena[] = [...CRITERIOS_RESENA_DEFAULT]` (estado a nivel de modulo).
  - `useCriteriosResena()`: hook reactivo. `getCriteriosResena()`: lectura imperativa.
  - `addCriterioResena(nombre)`, `renameCriterioResena(id, nombre)`, `removeCriterioResena(id)`: CRUD en RAM con `emit()` a listeners.
- Los ids se generan con un `slug(nombre)` local (normaliza, quita acentos, `[^a-z0-9]+ -> _`), con desambiguacion `_2`, `_3`... y fallback `criterio_${Date.now()}`. **Son slugs, no uuid.**
- Tipo `CriterioResena { id: string; nombre: string }`.
- No hay `empresa_id`: el catalogo es unico para todo el cliente (no multi-tenant).
- No hay `orden`: el orden es el de insercion del array.

### `src/features/rrhh/data/reclutamiento.ts` — fuente de tipos y semilla

- `CRITERIOS_RESENA_DEFAULT` (l.153): 5 criterios con id slug: `actitud`, `experiencia`, `disponibilidad`, `comunicacion`, `encaje_cultural`. Es la **semilla** para el seed inicial.
- `interface CriterioResena` (l.148): `{ id, nombre }`.
- `interface ResenaCriterio` (l.161): `{ criterioId: string; estrellas: number }`.
- `interface ResenaCandidato` (l.166): `{ id; autor; fecha; puntuaciones: ResenaCriterio[]; comentario? }`.
- `interface Candidato` (l.182): incluye `resenas?: ResenaCandidato[]` (l.203), marcado en el codigo como "Extensiones del refactor 2026-05 (todos opcionales para no romper BD)". Es decir: ya se sabia que `resenas` NO existe en BD.

### `src/features/rrhh/components/reclutamiento/CandidatoDetailModal.tsx` (873 lineas) — unico consumidor

- Importa `useCriteriosResena` (l.69), unico import del store en todo el repo.
- `ResenasTab` (l.620):
  - `const criterios = useCriteriosResena()` para pintar las filas de estrellas.
  - Construye un `draft: ResenaCriterio[]` a partir de los criterios y la ultima resena.
  - `guardar()` (l.654): crea un `ResenaCandidato` con id de cliente `r-${candidato.id}-${n}`, autor fijo `CURRENT_USER = "Admin RRHH"`, fecha `new Date().toLocaleString("es-ES")`, y hace `onUpdate({ ...candidato, resenas: [...] })`. **No llama a ninguna server action.**
  - Empty state honesto: si `criterios.length === 0` muestra "No hay criterios de resena configurados. Crea criterios en Configuracion -> Candidatos". **Esa pantalla de Configuracion NO existe aun** (no hay CRUD de criterios en UI; el store se manipula por API, no por pantalla).
- `autor` y `fecha` son de cliente: no hay `created_by`/`user_id` ni timestamptz de servidor.

### Persistencia real de candidatos (contexto OLA2-10 / reclutamiento)

- `supabase/migrations/010_features_restantes.sql` l.464: `public.candidatos` real. Columnas: `id uuid`, `empresa_id text`, `nombre`, `email`, `telefono`, `puesto`, `fase`, `origen`, `cv_url`, `notas`, **`puntuacion integer default 0`**, `created_at`, `updated_at`. **No hay columna `resenas` ni jsonb de evaluaciones.** Lo unico parecido es un escalar `puntuacion` que la UI de resenas ni lee ni escribe.
- RLS de `candidatos` (010 l.480-482): `cand_read` filtra por `empresa_id in (select empresa_id from profiles ...)`, pero `cand_write` es **`for all ... using(true) with check(true)`** (laxo). El schema real puede divergir (ver mas abajo).
- `src/features/rrhh/actions/reclutamiento-actions.ts`:
  - `listVacantesConCandidatos` mapea la fila real a la forma `Candidato` (l.190) **sin** `resenas` ni `notas` (las extensiones opcionales no se hidratan desde BD).
  - `updateCandidato` (l.262) acepta `nombre/.../puntuacion` pero **no** `resenas`.
  - Resuelve empresa con `getEmpresaActivaForUser(supabase, user.id)` (devuelve el UUID de empresa como string) y luego `.eq("empresa_id", empresaId)`.
- `src/features/rrhh/actions/candidatos-actions.ts`: mismo patron `getContext()` + `getEmpresaActivaForUser`; `select` real de candidatos incluye `puntuacion`, **no** resenas (l.24-32).
- Conclusion: **las resenas de candidato no se guardan en ninguna tabla real hoy.** El campo `Candidato.resenas` es puramente de cliente.

### Schema real (multi-tenant) — punto a verificar

- `public.empresas.id` es **uuid** (migracion 002 l.10), pero `public.candidatos.empresa_id` es **text** (010 l.466). Las actions pasan el UUID de empresa como string y la columna text lo acepta. Cualquier tabla nueva (`criterios_resena`) debe **igualar la convencion real de `candidatos`** (tipo de `empresa_id` y forma de RLS) tras verificar el schema en PROD, no inferir de migraciones. El repo ya tiene memoria de "verificar schema real antes de migrar" (010 declara una cosa y PROD puede diferir, p.ej. `candidatos` tiene en codigo columnas `apellidos`, `vacante_id`, `empleado_id`, `dni_nie`, `estado`, `promovido_at` que NO estan en el DDL de 010 -> el schema real esta por delante de esa migracion).

## Inventario de mock a retirar / cablear

| Pieza | Archivo | Estado | Accion OLA2-11 |
| --- | --- | --- | --- |
| Store criterios en RAM | `src/features/rrhh/data/criteriosResenaStore.ts` | MOCK volatil | Retirar; sustituir por tabla `criterios_resena` + actions + (opcional) cache/hook que lea de servidor |
| Semilla criterios | `CRITERIOS_RESENA_DEFAULT` en `reclutamiento.ts` | Constante | Conservar como datos de **seed inicial** por empresa |
| Tipos resena | `CriterioResena`/`ResenaCriterio`/`ResenaCandidato` en `reclutamiento.ts` | Tipos | Conservar/ajustar `id` a uuid (dbId) |
| Resenas del candidato | `Candidato.resenas` + `ResenasTab.guardar()` | MOCK (estado React) | Decidir DN: persistir en columna jsonb de `candidatos` o en tabla aparte; cablear a action |
| Empty state "Configuracion -> Candidatos" | `CandidatoDetailModal.tsx` | UI sin backend | (Fuera de scope duro) la pantalla de gestion de criterios no existe; el CRUD se expone por actions |

## Dependencia con OLA2-10

- OLA2-10 ("roles-empresa unificar") toca el mismo dominio (reclutamiento/roles) y persiste estructura de roles/vacantes. **No hay aun** `DISCOVERY_OLA2-10-*.md` ni `Full-TASK-OLA2-10-*.md` en la carpeta (solo aparece en el EXECUTION_PLAN, l.67). OLA2-11 debe ejecutarse **despues** de OLA2-10 para no chocar en el mismo feature ni duplicar el patron de tabla+RLS+actions del dominio reclutamiento.

## Riesgos detectados

- **Doble mock**: persistir criterios sin persistir resenas deja la pestana medio funcional (los criterios sobreviven, las puntuaciones no). Decision de negocio obligatoria (DN-2).
- **Slug vs uuid**: el store usa slugs como id; las resenas existentes (en RAM) referencian `criterioId` por slug. Al migrar a uuid (`dbId`), hay que mapear por nombre/slug en el seed para no romper `ResenaCriterio.criterioId`.
- **empresa_id text vs uuid**: igualar la convencion real de `candidatos` (verificar PROD), no la del DDL de 010.
- **RLS laxa de candidatos**: `cand_write using(true)`. La nueva tabla NO debe heredar ese patron; debe ser multi-tenant estricta por `empresa_id`.
- **Schema real != migracion 010**: el codigo demuestra columnas en `candidatos` ausentes del DDL 010 -> PROD esta por delante. Verificar via Management API antes de decidir donde guardar resenas.
- **Sin pantalla de gestion de criterios**: el empty state remite a una Config que no existe; el CRUD quedara accesible por actions aunque la UI de administracion no sea parte del corte de esta task pequena.

## Conclusion

De-mock ligero y de baja complejidad para los **criterios** (1 tabla + RLS + 4 actions + reemplazo del hook). El riesgo real no es tecnico sino de alcance: **decidir si las resenas tambien se persisten en esta task**. Recomendacion: incluir la persistencia de resenas (DN-2 = columna `resenas jsonb` en `candidatos`, lo mas barato y alineado con el modelo actual) para no dejar la pestana a medias. Verificar schema real de `candidatos` (empresa_id, existencia de jsonb) en PROD antes de migrar.
