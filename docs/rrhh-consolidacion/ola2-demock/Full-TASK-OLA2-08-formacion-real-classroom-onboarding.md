# Full-TASK-OLA2-08 - Formacion real (classroom + onboarding)

## Estado

PLANIFICADO (Ola 2, 2026-06-01). **No implementado.** Contrato ejecutable derivado del discovery.
Discovery de respaldo: `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-08-formacion-real-classroom-onboarding.md` (modelo de dominio, store, rutas, estado de BD y gap de puesto verificados directamente sobre el codigo el 2026-06-01 via Read/Glob UNC WSL + grep `wsl -d Ubuntu`).
Clasificacion del discovery: **MOCK PURO** (dos productos + una web-tour); **0 tablas** de formacion en BD, **0 imports** de Supabase en toda la feature.

## Objetivo

Convertir "formacion" de mock puro a producto real y multi-tenant: persistir el classroom (Curso -> Seccion -> Leccion -> Recurso + Novedades + progreso) en Supabase con RLS por `empresa_id`, sustituir el store Zustand+localStorage por una capa real `actions/`+`services/`, derivar el puesto del **empleado real** (OLA2-01) en lugar de `localStorage`/`DEPARTAMENTO_A_PUESTO`, persistir el estado de onboarding en `profiles.onboarding_completado`, anadir un bucket de Storage privado para videos/recursos, y **resolver D4**: unificar la web-tour de `/formacion` dentro del classroom (o mantenerlas separadas). El admin RRHH (`rrhh/components/formacion/FormacionView.tsx`) hereda los datos reales sin duplicar producto.

## Estimacion de complejidad

**Alta.** Es la task mas grande de la Ola 2 por superficie (classroom ~4483 lin + seed ~726 lin + onboarding) y por numero de objetos nuevos: **6 tablas** + progreso + 1 columna en `profiles` + 1 bucket de Storage, todos con RLS multi-tenant. No es cableado correctivo (como OLA2-03/04): es **construccion de cero** del backend, una nueva capa de acceso a datos que replique la superficie CRUD + selectores del store, el reapuntado del puesto a la fuente de OLA2-01, y una decision estructural (D4) que cambia el flujo de onboarding. Riesgo de regresion alto por el numero de superficies que consumen el store (portal empleado, reproductor, admin RRHH, mobile). Mayor incertidumbre: schema productivo real, id-space del puesto (acoplado a OLA2-01) y la migracion del seed localStorage -> BD (riesgo de perdida).

## Criterio de corte

Formacion queda CERRADA cuando:

1. El classroom (cursos, secciones, lecciones, recursos, novedades, progreso) **persiste en Supabase**: lo que crea el admin y lo que completa el empleado sobrevive a recargar y es **compartido** entre navegadores del mismo tenant (no localStorage por navegador).
2. El store Zustand+localStorage deja de ser fuente funcional de verdad; los selectores (`cursosVisibles`, `novedadesActivas`, `avanceCurso`, etc.) operan sobre datos reales de BD.
3. El **puesto** del empleado y de la audiencia proviene del empleado real (OLA2-01), no de `usePuestoActual`/`localStorage` ni de `DEPARTAMENTO_A_PUESTO`; el "simulador de puesto" se retira en produccion.
4. El estado de onboarding vive en `profiles.onboarding_completado`; `OnboardingGuard` lo lee/escribe en BD (no en `localStorage`) y su decision (D4) queda implementada de forma coherente en web + mobile.
5. Las 6 tablas + progreso tienen RLS multi-tenant real por `empresa_id` (lectura) y gating de escritura admin por rol; el bucket de Storage es privado con layout `<empresa_id>/...`.
6. El admin RRHH (`rrhh/.../FormacionView.tsx`) y el portal empleado (`mi-panel/formacion`, reproductor y `(mobile)/m/formacion`) pintan datos reales sin reintroducir el mock.
7. `npm run typecheck` y `npm run build` verdes (via WSL).

## Modo operativo

- taskId: **OLA2-08**
- taskMode: **code**
- reviewMode: **standard**
- sourcePlan: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- dependsOn: **OLA2-01** (puesto/empleado desde la fuente real)

## Contexto previo obligatorio

Leer antes de tocar codigo:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-08-formacion-real-classroom-onboarding.md` (este discovery: modelo TS literal, acciones del store, selectores, rutas y estado de BD).
2. `EXECUTION_PLAN_OLA2.md` (criterios globales: UUID `dbId` no slug en actions, RLS multi-tenant real, verificar schema real via Management API, placeholder honesto, no reintroducir mock, commits/push).
3. **El contrato y el cierre de OLA2-01 (empleados reales, fuente unica)**: de ahi sale el puesto real del empleado y la nocion canonica de puesto/departamento. **Debe estar CERRADA** antes de ejecutar las fases que dependen del puesto.
4. Modelo de dominio: `src/features/formacion/types/index.ts`.
5. Store a sustituir: `src/features/formacion/store/use-formacion-store.ts` (acciones + selectores) y `src/features/formacion/data/seed.ts` (seed a migrar).
6. Hook de puesto a retirar/reapuntar: `src/features/formacion/hooks/use-puesto.ts`.
7. Onboarding: `src/features/formacion/components/OnboardingGuard.tsx`, web-tour `src/features/formacion/components/FormacionView.tsx` y ruta `src/app/(main)/formacion/page.tsx`.
8. Patrones reales a respetar: RLS multi-tenant (`supabase/migrations/050_mi_panel_solicitudes.sql`, `061_profile_datos_personales.sql`); Storage privado (`048_juridico_documentos_storage.sql`); columnas sobre `profiles` (`061_*`).

## Scope IN

- **Modelo en BD (6 tablas + progreso):** `formacion_cursos`, `formacion_secciones`, `formacion_lecciones`, `formacion_recursos_leccion`, `formacion_novedades`, `formacion_progreso`, todas con `empresa_id uuid` + RLS multi-tenant; + `profiles.onboarding_completado boolean`.
- **Storage privado** para videos/recursos: bucket `formacion-media` (`public=false`) con policies por `empresa_id` y layout `<empresa_id>/cursos/<curso_id>/<filename>`.
- **Capa de acceso a datos:** poblar `src/features/formacion/actions/` y `services/` (hoy `.gitkeep`) replicando la superficie CRUD del store (cursos/secciones/lecciones/recursos/novedades + progreso) con cascada real en BD (FK `on delete cascade`) y los selectores como queries/derivaciones.
- **De-mock del consumo:** reescribir `PortalFormacionView`, `CursoVista`, `NovedadesPanel`, `admin/AdminFormacionPanel` (+ editores) y el admin RRHH `rrhh/.../FormacionView.tsx` para leer/escribir contra las actions reales; retirar `use-formacion-store.ts` y `seed.ts` como fuente funcional. Cubrir tambien `(mobile)/m/formacion`.
- **Puesto real (OLA2-01):** sustituir `usePuestoActual` y `DEPARTAMENTO_A_PUESTO` por la lectura del puesto/departamento del empleado real; alinear el enum `Puesto` con la fuente canonica (no inventar un tercer enum).
- **Onboarding en BD:** `OnboardingGuard` y `OnboardingCompleteButton` leen/escriben `profiles.onboarding_completado` via action; aplicar la decision D4 (unificacion o no de la web-tour).
- **Migracion del seed** a BD: sembrar el contenido base una vez por tenant (script/seed server-side), descartando el localStorage.

## Scope OUT

- **NO** introducir certificados, evaluaciones, notas ni progreso ponderado: el modelo solo registra "leccion completada por usuario" (confirmado por el propio codigo). Cualquier evaluacion es task futura (ver decisiones).
- **NO** rehacer el diseno/UX de las pantallas ni del reproductor; solo cambiar la fuente de datos.
- **NO** crear un segundo producto para el admin RRHH: es la cara admin del mismo classroom; reutiliza la misma capa.
- **NO** subir/recuperar el contenido que cada navegador tenga hoy en su localStorage (no es server-side); se siembra una vez en BD y se descarta.
- **NO** implementar transcodificacion/streaming de video ni reproductor propio: las lecciones siguen siendo URL (externa o del bucket privado); el bucket cubre subida/almacenamiento, no procesamiento.
- **NO** reescribir OLA2-01: esta task consume su salida de empleado/puesto, no la reimplementa.

## Restricciones

- **Verificar el schema productivo real con Management API antes de escribir o aplicar cualquier migracion.** No inferir del codigo (regla de memoria del proyecto: inferir rompe datos). Confirmar que no preexisten tablas `formacion_*` ni la columna `profiles.onboarding_completado`.
- RLS multi-tenant real por `empresa_id`; nunca `using(true) with check(true)`. Lectura por pertenencia al tenant; escritura admin gateada por rol (Director/Gerencia/RRHH).
- Las server actions reciben/derivan el **UUID de empresa (`dbId`)**, no el slug (`empresaActual.id` es slug; las tablas usan `empresa_id uuid`).
- Ids de cliente (`c-...`, `s-...`, `l-...`, `n-...` de `genId()`) pasan a `uuid` server-side; la UI deja de generar ids de dominio.
- No reintroducir `use-formacion-store.ts`/`seed.ts` ni el mock `rrhh/data/rrhh.ts` como fuente funcional de verdad.
- Mantener try/catch, errores legibles (`toast`) y comportamiento optimista coherente (revertir UI si la action falla; no fingir persistencia).
- Bucket de Storage privado (`public=false`); nunca exponer media de un tenant a otro; validar layout de path.
- Validacion por ejecutor: `npm run typecheck` + `npm run build` via `wsl -d Ubuntu bash -c` (NON-login).
- Commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes. (El agente de arquitectura NO commitea.)
- No versionar peppers, claves SMTP, `CREDENCIALES_ENCRYPTION_KEY` ni service-role. Restaurar `next-env.d.ts` si el tooling lo modifica.

## Validacion requerida

1. `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run typecheck"` -> sin errores.
2. `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run build"` -> build OK.
3. Verificacion de schema real (Management API) antes y despues de la migracion: tablas `formacion_*`, FKs/cascada, `profiles.onboarding_completado`, bucket `formacion-media` y sus policies.
4. Smoke funcional (dev local):
   - Admin crea curso -> seccion -> leccion (con recurso y, si aplica, video subido al bucket) y una novedad; recargar y confirmar persistencia.
   - Empleado ve los cursos visibles segun su **puesto real**, abre el reproductor, marca una leccion completada; el avance persiste y se ve igual en `(mobile)/m/formacion`.
   - El admin RRHH ve la cobertura por puesto derivada de empleados reales (no mock).
   - Onboarding: usuario nuevo es dirigido segun D4; al completar, `profiles.onboarding_completado=true` y el guard no vuelve a aparecer tras recargar ni en otro navegador.
5. RLS: un usuario de empresa A no ve ni escribe cursos/novedades/progreso ni media de empresa B (read+write+storage scoped). Un empleado sin rol admin no puede crear/editar cursos.
6. Confirmar que ningun punto pasa el **slug** a una query real y que no quedan lecturas del store/seed como fuente funcional.

## Dependencias

- **OLA2-01** (empleados reales, fuente unica): **bloqueante** para todo lo relativo al puesto (visibilidad de cursos por puesto, audiencia de novedades, cobertura del admin) y para retirar `usePuestoActual`/`DEPARTAMENTO_A_PUESTO`. Las fases de modelo/Storage/onboarding pueden adelantarse, pero el corte exige OLA2-01 cerrada.
- Contexto de empresa: `src/features/empresa/contexts/empresa-context.tsx` (`empresaActual.dbId`).
- Resolucion de empresa server-side: `src/features/empresa/lib/empresa-server.ts` (`getEmpresaActivaForUser`, devuelve UUID).
- Patrones de migracion citados (Storage, RLS, columnas en `profiles`).
- Decision de negocio **D4** (unificacion de la web-tour) — ver seccion de decisiones.

## Inputs

- Modelo TS: `src/features/formacion/types/index.ts`.
- Superficie CRUD + selectores a replicar: `src/features/formacion/store/use-formacion-store.ts`.
- Contenido base a migrar: `src/features/formacion/data/seed.ts`.
- Puesto hoy: `src/features/formacion/hooks/use-puesto.ts`; fuente real de empleado/puesto que expone OLA2-01.
- Onboarding: `src/features/formacion/components/OnboardingGuard.tsx`, web-tour `FormacionView.tsx`, `app/(main)/formacion/page.tsx`.
- Consumidores: `PortalFormacionView`, `CursoVista`, `NovedadesPanel`, `admin/AdminFormacionPanel` (+ editores), `rrhh/components/formacion/FormacionView.tsx`, ruta mobile `app/(mobile)/m/formacion/page.tsx`.
- Schema productivo real (a obtener via Management API).

## Outputs esperados

- Nueva migracion en `supabase/migrations/<siguiente>_formacion_real.sql` (numero siguiente disponible): 6 tablas + progreso + `profiles.onboarding_completado` + bucket `formacion-media` + RLS/policies; idempotente y reproducible.
- `src/features/formacion/actions/*` y `services/*` poblados (CRUD + progreso + onboarding + seed server-side), devolviendo datos ya mapeados al tipo TS.
- Consumidores (portal, reproductor, novedades, admin classroom, admin RRHH, mobile) leyendo/escribiendo BD; `store/` y `data/seed.ts` retirados como fuente funcional.
- Puesto derivado del empleado real (OLA2-01); `use-puesto.ts`/`DEPARTAMENTO_A_PUESTO` retirados o reapuntados; enum `Puesto` reconciliado.
- `OnboardingGuard` operando contra `profiles.onboarding_completado`; D4 implementada.
- Validacion verde + smoke documentado + estado de blindaje declarado.

## Riesgos conocidos

- **R1 - Perdida del contenido del admin.** Lo creado por el admin vive en el localStorage de cada navegador (no es server-side pese al comentario "lo ve el empleado al instante"). Al pasar a BD no se recupera; se siembra una vez y se descarta. Mitigacion: avisar antes de migrar; el seed canonico es `data/seed.ts`, no los localStorage dispersos.
- **R2 - Enum `Puesto` desalineado con DEPARTAMENTOS reales.** El classroom usa un enum cerrado (CAMARERO, JEFE DE SALA, ...) que no casa con los departamentos de RRHH (DIRECCION/RRPP sin equivalente; nombres distintos) ni con la salida de OLA2-01. Mitigacion: definir el mapeo canonico contra la fuente de OLA2-01 antes de tocar visibilidad; no inventar un tercer vocabulario.
- **R3 - Acoplamiento con OLA2-01.** Si OLA2-01 aun no esta cerrada o cambia el contrato de empleado/puesto, la visibilidad por puesto y la cobertura del admin no son fiables. Mitigacion: gatear el corte a OLA2-01 cerrada; las fases de modelo/Storage/onboarding pueden adelantarse.
- **R4 - Superficie amplia de regresion.** Multiples vistas consumen el store (portal, reproductor, novedades, admin classroom, admin RRHH, mobile). Mitigacion: centralizar lectura/escritura en la capa `actions/services` y migrar consumidor a consumidor, no en bloque.
- **R5 - Slug vs UUID.** `empresaActual.id` es slug; cualquier query real con slug devuelve 0 filas. Mitigacion: las actions derivan/reciben `dbId` (UUID) server-side.
- **R6 - RLS de escritura sin rol.** Si la escritura solo se filtra por tenant, cualquier empleado podria crear cursos. Mitigacion: gating de write por rol admin (Director/Gerencia/RRHH), verificado en smoke.
- **R7 - Storage privado mal scoped.** Un layout/policy incorrecto filtraria media entre tenants. Mitigacion: replicar el patron `048_*` (foldername[1] = empresa_id) y verificar cross-tenant.
- **R8 - D4 sin decidir.** Si no se resuelve D4, persiste la duplicidad (web-tour estatica vs curso "bienvenida" del classroom) y el onboarding seguiria apuntando a `/formacion`. Mitigacion: resolver D4 antes de cablear `OnboardingGuard`.

## Modelo de datos propuesto

> **VERIFICAR SCHEMA REAL (Management API) antes de redactar y aplicar esta migracion.** No existe ninguna tabla `formacion_*` ni `profiles.onboarding_completado` (verificado en discovery); el schema productivo real manda igualmente. DDL idempotente (`if not exists`). Tipos: `empresa_id uuid`, ids `uuid default gen_random_uuid()`.

```sql
-- ─── CURSOS ────────────────────────────────────────────────
create table if not exists public.formacion_cursos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  titulo            text not null,
  descripcion       text,
  cover             text,
  categoria         text not null,           -- bienvenida|cultura|protocolo|seguridad|operativa|atencion|otros
  ambito            text not null default 'general', -- general|puesto
  puesto            text,                     -- nullable; solo si ambito='puesto' (enum reconciliado con OLA2-01)
  orden             integer not null default 0,
  fecha_publicacion date,
  autor             text,
  publicado         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── SECCIONES ─────────────────────────────────────────────
create table if not exists public.formacion_secciones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  curso_id    uuid not null references public.formacion_cursos(id) on delete cascade,
  titulo      text not null,
  orden       integer not null default 0
);

-- ─── LECCIONES ─────────────────────────────────────────────
create table if not exists public.formacion_lecciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  seccion_id   uuid not null references public.formacion_secciones(id) on delete cascade,
  curso_id     uuid not null references public.formacion_cursos(id) on delete cascade,
  titulo       text not null,
  descripcion  text,
  url          text,                          -- mp4 externo o storage_path del bucket
  duracion_min integer,
  orden        integer not null default 0,
  fecha_subida date
);

-- ─── RECURSOS DE LECCION ───────────────────────────────────
create table if not exists public.formacion_recursos_leccion (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  leccion_id  uuid not null references public.formacion_lecciones(id) on delete cascade,
  titulo      text not null,
  url         text not null,
  tipo        text                            -- pdf|doc|enlace|imagen (texto libre)
);

-- ─── NOVEDADES ─────────────────────────────────────────────
create table if not exists public.formacion_novedades (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  tipo               text not null,           -- tarea|leccion|curso|cambio|aviso
  titulo             text not null,
  descripcion        text,
  audiencia_todos    boolean not null default true,
  audiencia_puestos  text[] not null default '{}', -- si audiencia_todos=false
  fecha_publicacion  date,
  autor              text,
  curso_id           uuid references public.formacion_cursos(id) on delete cascade,
  leccion_id         uuid references public.formacion_lecciones(id) on delete cascade
);

-- ─── PROGRESO (= 'completadas' del store) ──────────────────
create table if not exists public.formacion_progreso (
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  leccion_id  uuid not null references public.formacion_lecciones(id) on delete cascade,
  completada  boolean not null default true,
  completado_at timestamptz not null default now(),
  primary key (user_id, leccion_id)
);

-- ─── ONBOARDING en profiles ────────────────────────────────
alter table public.profiles
  add column if not exists onboarding_completado boolean not null default false;

-- ─── STORAGE privado para media (patron 048) ───────────────
insert into storage.buckets (id, name, public)
values ('formacion-media', 'formacion-media', false)
on conflict (id) do nothing;
-- Layout: <empresa_id>/cursos/<curso_id>/<filename>
-- Policies select/insert/update/delete sobre storage.objects con
--   bucket_id = 'formacion-media'
--   and (storage.foldername(name))[1] in (
--     select p.empresa_id::text from public.profiles p where p.user_id = auth.uid())

-- ─── RLS multi-tenant (patron 050/061) ─────────────────────
-- Para cada tabla formacion_*:
--   alter table ... enable row level security;
--   READ  (authenticated): empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
--   WRITE (authenticated, admin): mismo predicado de tenant + gating por rol (Director/Gerencia/RRHH)
--     using (<tenant> and <es_admin>) with check (<tenant> and <es_admin>)
-- formacion_progreso: el empleado escribe SU progreso ->
--   write using/with check: user_id = auth.uid() and empresa_id in (<tenant del usuario>)
```

Notas del modelo:

- `puesto` y `audiencia_puestos` usan el **vocabulario de puesto reconciliado con OLA2-01** (no el enum cerrado actual del classroom): fijar el mapeo canonico antes de poblar.
- Los selectores del store se reimplementan como queries/derivaciones: `cursosVisibles` (tenant + `publicado` + ambito/puesto del empleado real), `novedadesActivas` (tenant + ventana 90 dias + audiencia), `avanceCurso` (count de `formacion_progreso` / total de lecciones del curso).
- `formacion_progreso` reemplaza el `completadas: Record<\`${userKey}:${leccionId}\`, boolean>`; la clave deja de ser `userKey` derivado en cliente y pasa a `user_id` real.
- Cascada manual del store -> FK `on delete cascade` real en BD (curso->secciones->lecciones->recursos/progreso/novedades).

## Interfaces publicas propuestas

Server actions en `src/features/formacion/actions/` (devuelven datos **ya mapeados al tipo TS** del dominio; el `dbId`/UUID de empresa se deriva server-side, nunca slug):

```ts
// ── CRUD admin: Cursos ────────────────────────────────────
export async function listCursos(): Promise<{ ok: true; data: Curso[] } | { ok: false; data: [] }>;
export async function createCurso(input: Omit<Curso, "id" | "empresaId">): Promise<{ ok: true; data: Curso } | { ok: false; error: string }>;
export async function updateCurso(id: string, patch: Partial<Omit<Curso, "id" | "empresaId">>): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteCurso(id: string): Promise<{ ok: true } | { ok: false; error: string }>; // cascada via FK

// ── CRUD admin: Secciones ─────────────────────────────────
export async function createSeccion(input: { cursoId: string; titulo: string; orden: number }): Promise<{ ok: true; data: Seccion } | { ok: false; error: string }>;
export async function updateSeccion(id: string, patch: Partial<{ titulo: string; orden: number }>): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteSeccion(id: string): Promise<{ ok: true } | { ok: false; error: string }>;

// ── CRUD admin: Lecciones (+ recursos) ────────────────────
export async function createLeccion(input: { seccionId: string; cursoId: string; titulo: string; descripcion?: string; url?: string; duracionMin?: number; orden: number; recursos?: Omit<RecursoLeccion, "id">[] }): Promise<{ ok: true; data: Leccion } | { ok: false; error: string }>;
export async function updateLeccion(id: string, patch: Partial<{ titulo: string; descripcion: string; url: string; duracionMin: number; orden: number }>): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteLeccion(id: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function setRecursosLeccion(leccionId: string, recursos: Omit<RecursoLeccion, "id">[]): Promise<{ ok: true } | { ok: false; error: string }>;

// ── CRUD admin: Novedades ─────────────────────────────────
export async function createNovedad(input: Omit<NovedadFormacion, "id" | "empresaId">): Promise<{ ok: true; data: NovedadFormacion } | { ok: false; error: string }>;
export async function updateNovedad(id: string, patch: Partial<Omit<NovedadFormacion, "id" | "empresaId">>): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteNovedad(id: string): Promise<{ ok: true } | { ok: false; error: string }>;

// ── Empleado: lectura visible + progreso ──────────────────
// Deriva el puesto del empleado REAL (OLA2-01); aplica visibilidad por tenant/puesto y ventana de novedades.
export async function listarFormacionEmpleado(): Promise<{
  ok: true;
  data: { cursos: Curso[]; secciones: Seccion[]; lecciones: Leccion[]; novedades: NovedadFormacion[]; completadas: string[] /* leccionId[] */ };
} | { ok: false; error: string }>;
export async function marcarLeccionCompletada(leccionId: string, completada: boolean): Promise<{ ok: true } | { ok: false; error: string }>;

// ── Onboarding (profiles.onboarding_completado) ───────────
export async function getEstadoOnboarding(): Promise<{ ok: true; completado: boolean } | { ok: false; error: string }>;
export async function completarOnboarding(): Promise<{ ok: true } | { ok: false; error: string }>;

// ── Seed inicial por tenant (server-side, una vez) ────────
export async function sembrarFormacionInicial(): Promise<{ ok: true; creados: number } | { ok: false; error: string }>;
```

Notas de contrato:

- `marcarLeccionCompletada` usa el `user_id` real (de sesion) como clave de progreso; la UI deja de construir `userKey`.
- Las actions admin gatean por rol server-side (coherente con la RLS de escritura); la UI puede ocultar controles, pero la autoridad esta en el servidor.
- `listarFormacionEmpleado` resuelve el puesto del empleado real (no `usePuestoActual`); de ahi salen los cursos de ambito "puesto" y las novedades dirigidas.
- Subida de video/recurso al bucket privado: se realiza con el flujo de Storage (patron 048) y la `url`/`storage_path` se persiste en `formacion_lecciones.url` / `formacion_recursos_leccion.url`.

## Flujo operativo esperado

**Fase 0 - Verificacion + decisiones.** Verificar schema real (Management API): confirmar que no existen tablas `formacion_*` ni `profiles.onboarding_completado` ni el bucket. Resolver **D4** (unificacion de la web-tour) y fijar el **mapeo canonico de puesto** contra la salida de OLA2-01. Confirmar OLA2-01 cerrada (al menos para las fases dependientes del puesto).

**Fase 1 - Migracion de BD + Storage.** Crear y aplicar la migracion idempotente: 6 tablas + `formacion_progreso` + FKs/cascada, `profiles.onboarding_completado`, bucket `formacion-media` privado y RLS/policies (read por tenant; write admin por rol; progreso por `user_id`). Confirmar en prod.

**Fase 2 - Capa de acceso a datos.** Poblar `actions/` y `services/` con el CRUD + progreso + onboarding + seed, replicando la superficie del store y reimplementando los selectores como queries. Mapeo BD (snake) -> tipo TS del dominio en la capa, no en los componentes.

**Fase 3 - Seed inicial.** Ejecutar `sembrarFormacionInicial` (server-side, idempotente por tenant) con el contenido de `data/seed.ts`. Descartar el localStorage como fuente. Documentar el aviso de R1 (lo creado en navegadores no se recupera).

**Fase 4 - De-mock del consumo (classroom).** Migrar consumidor a consumidor: `PortalFormacionView`, `CursoVista`, `NovedadesPanel`, `admin/AdminFormacionPanel` (+ editores) y el admin RRHH `rrhh/.../FormacionView.tsx` para usar las actions reales; cubrir `(mobile)/m/formacion`. Retirar `use-formacion-store.ts`/`seed.ts` como fuente funcional.

**Fase 5 - Puesto real (OLA2-01).** Sustituir `usePuestoActual`/`DEPARTAMENTO_A_PUESTO` por la lectura del empleado real; reconciliar el enum `Puesto`; recalcular visibilidad de cursos y cobertura del admin sobre empleados reales. Retirar el "simulador de puesto" en produccion.

**Fase 6 - Onboarding + D4.** Cablear `OnboardingGuard`/`OnboardingCompleteButton` a `profiles.onboarding_completado` (via `getEstadoOnboarding`/`completarOnboarding`). Implementar la decision D4: si se **unifica**, reapuntar el guard a `/mi-panel/formacion` y representar la bienvenida como curso `categoria: "bienvenida"` del classroom (la web-tour `/formacion` queda como redireccion o se deprecia); si se **mantiene separada**, persistir igualmente el estado en BD pero conservar la web-tour. Aplicar coherentemente en web + mobile.

**Fase 7 - Validacion.** `typecheck` + `build` (WSL) + smoke (admin crea contenido; empleado ve por puesto y marca progreso; mobile coherente; onboarding persiste en BD) + verificacion BD + RLS/Storage cross-tenant + gating de write por rol.

## Decisiones de negocio pendientes

- **D4 (unificacion del onboarding) — la decision estructural de la task.** ¿Se unifica la web-tour de `/formacion` como "curso de bienvenida" dentro del classroom, reapuntando `OnboardingGuard` a `/mi-panel/formacion`, o se mantienen separadas? **Recomendacion del discovery (fuerte): UNIFICAR.** El classroom ya tiene `categoria: "bienvenida"`; unificar elimina la duplicidad, deja una sola fuente de verdad de la formacion de entrada y permite que el contenido de bienvenida sea editable por el admin (hoy la web-tour es estatica y hardcodeada). Coste: migrar el contenido de la web-tour (`recorridoModulos`, `materialPorPuesto`, Ikigai) a curso(s) de bienvenida y deprecar/redirigir `/formacion`. Si se decide mantener separadas, igualmente hay que persistir el onboarding en `profiles` (no localStorage); la duplicidad de contenido persistiria.
- **DN-2: certificacion/evaluacion futura.** El modelo actual NO tiene nota ni evaluacion (solo "leccion completada"). ¿Se planifica una task futura de certificacion/evaluacion (tabla `formacion_evaluaciones`/certificados), o el alcance se queda en progreso binario? Recomendacion: dejar fuera de esta task (Scope OUT) y documentarla como evolutivo.
- **DN-3: migracion del seed vs perdida de contenido.** El contenido del admin vive en localStorage por navegador (R1). ¿Se asume la perdida y se siembra solo `data/seed.ts`, o se intenta una exportacion previa del localStorage de los navegadores que tengan contenido? Recomendacion: asumir la perdida (no es server-side; recuperarlo es fragil y de bajo valor) y comunicarlo antes de migrar.
- **DN-4: gating de escritura por rol.** ¿Que roles pueden crear/editar cursos y novedades (Director/Gerencia/RRHH)? Recomendacion: gatear write a esos roles (es un panel de gestion), coherente con la RLS de escritura.

(El agente de arquitectura no toma estas decisiones; se elevan al responsable. El de-mock principal depende de D4 para la Fase 6 y de OLA2-01 para la Fase 5.)

## Paths del proyecto

- Modelo TS: `src/features/formacion/types/index.ts`
- Store a retirar: `src/features/formacion/store/use-formacion-store.ts`
- Seed a migrar: `src/features/formacion/data/seed.ts`
- Capa nueva: `src/features/formacion/actions/` y `src/features/formacion/services/` (hoy `.gitkeep`)
- Puesto: `src/features/formacion/hooks/use-puesto.ts` (retirar/reapuntar)
- Onboarding: `src/features/formacion/components/OnboardingGuard.tsx`
- Web-tour: `src/features/formacion/components/FormacionView.tsx` y `src/app/(main)/formacion/page.tsx`
- Portal empleado: `src/features/formacion/components/PortalFormacionView.tsx`, `CursoVista.tsx`, `NovedadesPanel.tsx`
- Admin classroom: `src/features/formacion/components/admin/AdminFormacionPanel.tsx` (+ `CursoEditor`, `CursoFormDialog`, `LeccionFormDialog`, `NovedadFormDialog`)
- Admin RRHH: `src/features/rrhh/components/formacion/FormacionView.tsx` y `src/app/(main)/rrhh/formacion/page.tsx`
- Rutas: `src/app/(main)/mi-panel/formacion/page.tsx`, `src/app/(main)/mi-panel/formacion/curso/[cursoId]/page.tsx`, `src/app/(mobile)/m/formacion/page.tsx`
- Migracion nueva: `supabase/migrations/<siguiente>_formacion_real.sql`
- Patrones de referencia: `supabase/migrations/050_mi_panel_solicitudes.sql`, `061_profile_datos_personales.sql`, `048_juridico_documentos_storage.sql`
- Empresa: `src/features/empresa/contexts/empresa-context.tsx` (`dbId`), `src/features/empresa/lib/empresa-server.ts` (`getEmpresaActivaForUser`)

## Agentes recomendados

- `create-supabase-table-rls-base` (Fase 1: 6 tablas + progreso + RLS multi-tenant).
- `create-storage-upload-flow` (Fase 1/2: bucket privado `formacion-media` + flujo de subida, patron 048).
- `review-rls-multi-tenant` (verificacion de que read/write/storage quedan blindados por `empresa_id` y write gateado por rol).
- `generate-data-access-layer` (Fase 2: actions/services + mapeo BD -> TS + reimplementacion de selectores).
- `execute-phase` (ejecucion guiada del contrato fase a fase).
- `golden-path-review` / revisor estandar (cierre con `reviewMode: standard`; que no quede store/seed/mock como fuente funcional ni slug en datos reales).

## Checklist de cierre

- [ ] Fase 0: schema real verificado (no preexisten `formacion_*`, `profiles.onboarding_completado` ni bucket); D4 resuelta; mapeo de puesto fijado; OLA2-01 cerrada para las fases dependientes.
- [ ] Migracion aplicada: 6 tablas + `formacion_progreso` + FKs/cascada + `profiles.onboarding_completado` + bucket `formacion-media` privado; RLS read por tenant, write admin por rol, progreso por `user_id`.
- [ ] `actions/` y `services/` poblados: CRUD cursos/secciones/lecciones/recursos/novedades + progreso + onboarding + seed; mapeo BD -> TS en la capa.
- [ ] Selectores reimplementados como queries (`cursosVisibles`, `novedadesActivas`, `avanceCurso`, ...).
- [ ] Seed inicial sembrado por tenant; `store/use-formacion-store.ts` y `data/seed.ts` retirados como fuente funcional; R1 comunicado.
- [ ] Consumidores migrados a BD: portal, reproductor, novedades, admin classroom, admin RRHH y `(mobile)/m/formacion`.
- [ ] Puesto derivado del empleado real (OLA2-01); `use-puesto.ts`/`DEPARTAMENTO_A_PUESTO` retirados o reapuntados; enum `Puesto` reconciliado; "simulador de puesto" retirado en produccion.
- [ ] `OnboardingGuard`/`OnboardingCompleteButton` operan sobre `profiles.onboarding_completado`; D4 implementada coherentemente en web + mobile.
- [ ] Ningun punto pasa `empresaActual.id` (slug) a una query real; la UI no genera ids de dominio.
- [ ] `npm run typecheck` verde (WSL).
- [ ] `npm run build` verde (WSL).
- [ ] Smoke documentado: admin crea curso/seccion/leccion/recurso/novedad (+ video al bucket) persistente; empleado ve por puesto real y marca progreso (coherente en mobile); onboarding persiste en BD.
- [ ] RLS/Storage cross-tenant verificada (empresa A no ve/escribe contenido ni media de B); write admin gateado por rol.
- [ ] Estado de blindaje declarado (documentado / no aplica / pendiente) segun `docs/dev/ERRORES.md`.
- [ ] Commit `..._FernandoClaude` + push a `main` tras validacion (lo ejecuta Fernando).

## Siguiente paso sugerido

Resolver **D4** (recomendacion: unificar la web-tour como curso de bienvenida del classroom y reapuntar `OnboardingGuard` a `/mi-panel/formacion`) y confirmar el **mapeo canonico de puesto** + el **cierre de OLA2-01**. Acto seguido ejecutar la **Fase 1** (migracion idempotente de las 6 tablas + progreso + `profiles.onboarding_completado` + bucket privado con RLS), que es independiente del puesto y desbloquea la capa de acceso a datos sin tocar todavia los componentes.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-08-formacion-real-classroom-onboarding.md
