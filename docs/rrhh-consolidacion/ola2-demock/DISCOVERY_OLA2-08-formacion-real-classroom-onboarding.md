# DISCOVERY OLA2-08 - Formacion real (classroom + onboarding)

- Fecha: 2026-06-01
- Repo: `Balles-Hosteleros`
- Task asociada: `Full-TASK-OLA2-08-formacion-real-classroom-onboarding.md`
- Plan origen: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- Metodo: lectura directa del codigo (verdad sobre docs). Verificado hoy con Read/Glob (UNC WSL) y grep (`wsl -d Ubuntu`).
- Clasificacion: **MOCK PURO (x2 productos + 1 web-tour)**. No existe ninguna tabla de formacion en BD.

## Resumen ejecutivo

Bajo el nombre "formacion" conviven **tres cosas distintas**, todas sin backend:

1. **Portal "classroom"** (`src/features/formacion/`): producto tipo Skool (Curso -> Secciones -> Lecciones + recursos, Novedades, progreso). Todo el estado vive en un **store Zustand persistido en localStorage** con un seed hardcodeado. 0 imports de Supabase en toda la feature (verificado).
2. **Admin RRHH del mismo portal** (`src/features/rrhh/components/formacion/FormacionView.tsx`): NO es un producto aparte; es el panel de administracion del classroom. Lee del mismo store + cruza empleados del mock `rrhh/data/rrhh.ts`. **No duplicar**: reutiliza el store.
3. **Web-tour de onboarding** (ruta `/formacion`, `src/features/formacion/components/FormacionView.tsx`): pagina estatica con arrays hardcodeados (recorrido por modulos + material por puesto + Ikigai). Es la que fuerza `OnboardingGuard`. Esta **desconectada** del classroom.

El reto de la task es: persistir el classroom en Supabase (multi-tenant + RLS), derivar el puesto del empleado real (OLA2-01) en vez de localStorage, persistir el estado de onboarding en `profiles`, y **decidir D4**: unificar la web-tour dentro del classroom o mantenerlas separadas.

## Estado real verificado por sitio

### Sitio 1 — Portal classroom (`src/features/formacion/`)

Ficheros (Glob `**/features/formacion/**/*.{ts,tsx}`):

```
components/PortalFormacionView.tsx      (vista empleado, entrypoint via mi-panel)
components/CursoCard.tsx
components/CursoVista.tsx                (reproductor curso: secciones + lecciones)
components/NovedadesPanel.tsx
components/FormacionView.tsx            (== web-tour onboarding, sitio 3)
components/FormacionRolViewer.tsx       (variante embebida en Ayuda)
components/OnboardingGuard.tsx          (guard + boton completar, sitio 3)
components/admin/AdminFormacionPanel.tsx (panel admin, embebido por sitio 2)
components/admin/CursoEditor.tsx
components/admin/CursoFormDialog.tsx
components/admin/LeccionFormDialog.tsx
components/admin/NovedadFormDialog.tsx
hooks/use-puesto.ts                     (usePuestoActual: localStorage)
store/use-formacion-store.ts            (Zustand + persist localStorage)
data/seed.ts                            (seed hardcodeado)
types/index.ts                          (modelo de dominio)
```

Carpetas `actions/`, `services/`, `data/` (salvo `seed.ts`): solo `.gitkeep`. No hay capa de acceso a datos.

Modelo de dominio (cita literal de `src/features/formacion/types/index.ts`):

- `Puesto` = `"CAMARERO" | "JEFE DE SALA" | "COCINERO" | "JEFE DE COCINA" | "CACHIMBERO" | "ARTISTA" | "MANTENIMIENTO" | "GERENTE" | "CONTABLE"` (enum cerrado, `PUESTOS[]`).
- `CategoriaCurso` = `"bienvenida" | "cultura" | "protocolo" | "seguridad" | "operativa" | "atencion" | "otros"`.
- `Curso { id, titulo, descripcion, cover?, categoria, ambito: "general"|"puesto", puesto?, empresaId, orden, fechaPublicacion (ISO yyyy-mm-dd), autor, publicado }`.
- `Seccion { id, cursoId, titulo, orden }`.
- `Leccion { id, seccionId, cursoId, titulo, descripcion, url (mp4/embebible), duracionMin, orden, fechaSubida, recursos: RecursoLeccion[] }`.
- `RecursoLeccion { id, titulo, url, tipo (string libre: "pdf"|"doc"|"enlace"|"imagen") }`.
- `TipoNovedad` = `"tarea" | "leccion" | "curso" | "cambio" | "aviso"`.
- `NovedadFormacion { id, tipo, titulo, descripcion, audiencia: "todos"|Puesto[], fechaPublicacion, autor, empresaId, cursoId?, leccionId? }`.
- `FormacionState { cursos[], secciones[], lecciones[], novedades[], completadas: Record<`${userKey}:${leccionId}`, boolean> }`.

**No hay** certificado, evaluacion ni nota. Confirmado por comentario en `rrhh/.../FormacionView.tsx`:
> "No se inventan notas, evaluaciones ni progreso por empleado: el modelo del store solo registra 'leccion completada por usuario logueado'. Cuando exista una tabla `formacion_progreso` por empleado en Supabase, esta vista cruzara los datos reales."

Store (`store/use-formacion-store.ts`, verificado):

- `STORAGE_KEY = "balles_formacion_v2"`, `persist` + `createJSONStorage(() => localStorage)`.
- Estado sembrado con `buildSeed()` al cargar el modulo; `completadas` arranca `{}`.
- Acciones (esta es la superficie CRUD que la capa real debe replicar):
  - Cursos: `addCurso(Omit<Curso,"id">) => string`, `updateCurso(id, Partial<Curso>)`, `removeCurso(id)` (cascada manual a secciones/lecciones/completadas/novedades).
  - Secciones: `addSeccion`, `updateSeccion`, `removeSeccion` (cascada a lecciones/completadas).
  - Lecciones: `addLeccion`, `updateLeccion`, `removeLeccion` (cascada a completadas/novedades).
  - Novedades: `addNovedad`, `updateNovedad`, `removeNovedad`.
  - Progreso: `marcarCompletada(userKey, leccionId)`, `desmarcarCompletada(userKey, leccionId)`.
  - `resetSeed()`.
- Selectores puros exportados (reutilizables tal cual contra datos reales): `novedadesActivas` (filtra por empresaId + ventana 90 dias + audiencia/puesto), `cursosVisibles` (empresaId + publicado + ambito/puesto), `leccionesDeCurso`, `leccionesOrdenadas`, `avanceCurso` (vistas/total/pct), `duracionCurso`.
- `genId()` genera ids string en cliente (`c-...`, `s-...`, `l-...`, `n-...`); en BD pasaran a `uuid`.

Riesgo de migracion: el contenido creado por el admin **vive en el localStorage de cada navegador** (no es compartido ni server-side pese al comentario "lo ve el empleado al instante" — solo es cierto dentro del mismo navegador). Al pasar a BD, lo creado en cada navegador **no se recupera**; se siembra una vez en BD y se descarta el localStorage.

### Sitio 2 — Admin RRHH (`src/features/rrhh/components/formacion/FormacionView.tsx`, 403 lin)

- Render en ruta `/rrhh/formacion` (`src/app/(main)/rrhh/formacion/page.tsx`).
- Lee del **mismo** `useFormacionStore` (cursos/secciones/lecciones/novedades) y embebe `<AdminFormacionPanel />` (CRUD real de cursos+novedades).
- Empleados: `getEmpleadosPorEmpresa(empresaActual.id)` desde el **mock** `rrhh/data/rrhh.ts` (cordon umbilical que OLA2-01 retira).
- Mapea departamento->puesto con un diccionario fragil de string-match:
  `DEPARTAMENTO_A_PUESTO = { CAMAREROS: "CAMARERO", "JEFE DE SALA": "JEFE DE SALA", COCINA: "COCINERO", CACHIMBEROS: "CACHIMBERO", ARTISTAS: "ARTISTA", MANTENIMIENTO: "MANTENIMIENTO", GERENTE: "GERENTE", ADMINISTRATIVO: "CONTABLE" }`.
  Los departamentos sin match (DIRECCION, RRPP) caen a "sin puesto formativo".
- KPIs y tabla "cobertura por puesto" derivan en tiempo real del store + empleados mock. No persiste nada propio: es una vista de lectura sobre el store + el panel admin.

Conclusion: NO crear un segundo producto. Es la cara admin del classroom; al cablear el store a BD, esta vista hereda los datos reales.

### Sitio 3 — Web-tour onboarding (ruta `/formacion`)

- `src/app/(main)/formacion/page.tsx` -> `src/features/formacion/components/FormacionView.tsx` (no confundir con el sitio 2, mismo nombre de fichero en otra carpeta).
- Contenido 100% estatico hardcodeado: `recorridoModulos` (9 enlaces a /direccion, /sala, /cocina, ... /contabilidad), `materialPorPuesto` (Sala/Cocina/Logistica/Gerencia) y dos tarjetas de filosofia Ikigai (pags. 94 y 102). Sin store, sin BD, sin puesto real.
- `FormacionRolViewer.tsx`: variante del mismo recorrido embebida en Ayuda.
- `OnboardingGuard.tsx` (132 lin, verificado):
  - `STORAGE_KEY = "balles:onboarding-completado"`; estado por usuario en `localStorage[`${STORAGE_KEY}-${user.id}`]`.
  - Overlay fullscreen bloqueante que aparece si `completado !== true`; el CTA enlaza a **`/formacion`** (la web-tour), NO al classroom `/mi-panel/formacion`.
  - Exentos: `loading || !user || roles incluye admin|director|gerencia`. Tambien exenta la propia ruta `/formacion` (`esFormacion`).
  - `OnboardingCompleteButton`: escribe `localStorage[...] = "true"` y redirige a `LANDING_PATH`.
  - Comentario explicito en el codigo:
    > "Fase 2 (futura): reemplazar localStorage por un campo `onboarding_completado` en la tabla `profiles` de Supabase, para que la info viaje con el usuario."

Aqui esta la duplicidad que motiva **D4**: hay un "curso de bienvenida" (estatico, fuera del classroom) y un classroom que ya tiene `categoria: "bienvenida"`. El discovery recomienda unificar (ver Decisiones).

## Rutas implicadas (Glob `**/app/**/formacion/**/page.tsx`)

- `src/app/(main)/formacion/page.tsx` — web-tour onboarding (sitio 3).
- `src/app/(main)/mi-panel/formacion/page.tsx` — portal empleado (sitio 1) via `MiFormacionView -> PortalFormacionView`.
- `src/app/(main)/mi-panel/formacion/curso/[cursoId]/page.tsx` — reproductor de curso.
- `src/app/(main)/rrhh/formacion/page.tsx` — admin RRHH (sitio 2).
- `src/app/(mobile)/m/formacion/page.tsx` — version mobile del portal empleado (reusa `MiFormacionView`, `force-dynamic`). Cobertura mobile a considerar en el de-mock.

## Estado de base de datos (verificado)

- `grep -rEl "formacion_(cursos|secciones|lecciones|novedades|progreso|recursos)" supabase/migrations` -> **NINGUNA**.
- `grep -rl "onboarding_completado" supabase/migrations` -> **NINGUNA**.
- `grep -rl "supabase" src/features/formacion` -> **NINGUNO** (0 imports en toda la feature).
- No existe bucket de storage para formacion. Los videos hoy son URLs externas (`SAMPLE_MP4` de Google common datastorage) o `url: "#"`; los recursos son URLs libres.

Hay que crear de cero: `formacion_cursos`, `formacion_secciones`, `formacion_lecciones`, `formacion_recursos_leccion`, `formacion_novedades` (+ audiencia), `formacion_progreso` (= `completadas`), todas multi-tenant `empresa_id` + RLS; + campo `profiles.onboarding_completado`; + bucket de storage privado para videos/recursos.

## Puesto del empleado (gap clave, depende de OLA2-01)

- Hoy `usePuestoActual(userKey)` (`hooks/use-puesto.ts`) guarda el puesto en `localStorage["balles_formacion_puesto_v1"]`, **default `"CAMARERO"`**, con setter para que el usuario "simule" su puesto. Comentario propio: "En produccion deberia leerse del registro de empleado (ficha laboral)".
- El admin deriva puesto via `DEPARTAMENTO_A_PUESTO` (string-match fragil).
- El enum `Puesto` del classroom esta **desalineado** con los `DEPARTAMENTOS` reales de RRHH (existen DIRECCION/RRPP sin equivalente; nombres distintos). Hay que **unificar** la nocion de puesto contra la fuente real de empleados de OLA2-01 (no inventar un tercer enum).

## Convenciones reales observadas (a respetar en la task)

- RLS multi-tenant canonica (patron en `050_mi_panel_solicitudes.sql`, `061_profile_datos_personales.sql`): `empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())` para lectura; insert/update con `with check` equivalente; gating de escritura admin por rol.
- Storage privado (patron en `048_juridico_documentos_storage.sql`): `insert into storage.buckets (...) values (..., false) on conflict do nothing`; policies sobre `storage.objects` con `(storage.foldername(name))[1] in (select p.empresa_id::text ...)` y layout `<empresa_id>/<...>/<filename>`.
- `profiles` es la fuente canonica de datos del usuario (`061_*` anade columnas sobre `profiles`); el onboarding debe vivir ahi (`profiles.onboarding_completado`).
- Slug vs UUID (hallazgo transversal del plan): `empresaActual.id` es slug; las tablas usan `empresa_id uuid`. Las actions deben recibir el **UUID (`dbId`)**.
- Validacion del ejecutor: `npm run typecheck` + `npm run build` via `wsl -d Ubuntu bash -c` (NON-login). Commits terminan en `_FernandoClaude`; push directo a `main` tras verde.

## Conclusion del discovery

`formacion` es de-mock de construccion (no de cableado): hay que crear el modelo entero en Supabase, una capa `actions/`+`services/` que reemplace el store localStorage, derivar puesto del empleado real (OLA2-01), persistir onboarding en `profiles`, y resolver D4 (unificacion de la web-tour). Es la task mas grande de la Ola 2 por superficie (classroom 4483 lin + seed 726 lin + onboarding) y por el numero de tablas nuevas (6 + progreso) con storage y RLS. Recomendacion fuerte sobre D4: **unificar** la web-tour como "curso de bienvenida" dentro del classroom y reapuntar `OnboardingGuard` a `/mi-panel/formacion`, eliminando la duplicidad y dejando una sola fuente de verdad de la formacion de entrada.
