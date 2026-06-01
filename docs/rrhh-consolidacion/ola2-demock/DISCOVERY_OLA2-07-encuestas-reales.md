# DISCOVERY-OLA2-07 - Encuestas reales (Gerencia crea + Mi-Panel responde)

- taskId: OLA2-07
- Fecha de verificacion: 2026-06-01 (codigo + SQL como fuente de verdad, no docs)
- sourcePlan: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- dependsOn: OLA2-01 (empleados reales, para destinatarios)
- Clasificacion declarada en el plan: "MOCK, 5 tablas, el de-mock nuevo mas grande".
- Clasificacion real tras verificar: **MIXTO-roto**. El modelo rico es MOCK, pero **ya existe una tabla legacy `public.encuestas`** (010) y **ya existen server actions** (`listEncuestas`/`createEncuesta`/`updateEncuesta`) que la vista invoca y luego **descarta a proposito** para pintar el mock. El gap real es: el modelo legacy no soporta la forma rica (grupos/preguntas/opciones/respuestas), su `empresa_id` es `text` (slug), su RLS de escritura es laxa, y **no existe ninguna tabla de respuestas**.

## Resumen ejecutivo

"Encuestas" tiene tres capas que hoy no encajan:

1. **Mock rico** (`src/features/rrhh/data/encuestas.ts`, 266 lin): el modelo de dominio completo (encuesta -> grupos -> preguntas -> opciones + respuestas por empleado). Es lo que pinta la UI.
2. **Tabla legacy plana** (`public.encuestas`, migracion `010_features_restantes.sql`): `empresa_id text`, `preguntas jsonb`, `respuestas_count int`, **sin** `descripcion`, **sin** `updated_at`, **sin** tabla de respuestas. RLS write `using(true) with check(true)`.
3. **Actions a medias** (`src/features/gerencia/actions/encuestas-actions.ts`): leen/escriben esa tabla legacy, pero **escriben a columnas que no existen** (`descripcion`, `updated_at`) -> fallo silencioso/parcial en prod. La vista las llama pero **ignora el resultado** y vuelve al mock (comentario explicito en el codigo).

El de-mock real = **reconstruir el modelo de datos en BD** (5 tablas normalizadas con `empresa_id uuid` + RLS canonico), **reescribir las actions** sobre el modelo nuevo, **cablear las dos vistas** (Gerencia crea/gestiona; Mi-Panel responde) y **retirar el mock**. Por su tamano (5 tablas nuevas + 2 superficies + reglas de anonimato/una-respuesta) sigue siendo el de-mock NUEVO mas grande de la Ola 2, aunque ya parta de una tabla legacy que habra que migrar/sustituir.

## Estado real por capa

### 1. Mock (`src/features/rrhh/data/encuestas.ts`) — 266 lineas

Tipos (forma de dominio rica):

- `EstadoEncuesta = "borrador" | "activa" | "finalizada" | "archivada"`.
- `TipoPregunta = "unica" | "multiple" | "texto" | "valoracion" | "escala" | "si_no"`.
- `OpcionRespuesta { id; texto; color }`.
- `PreguntaEncuesta { id; titulo; tipo; obligatoria; opciones[]; puntuacion }`.
- `GrupoPreguntas { id; titulo; descripcion; preguntas[] }`.
- `RespuestaEmpleado { empleadoId; fecha; respuestas: Record<preguntaId, string|string[]|number> }`.
- `Encuesta { id; empresaId; nombre; descripcion; estado; creadorId; creadorNombre; fechaCreacion; fechaCierre; anonima; unaRespuesta; modificarRespuesta; mensajeInicial; mensajeFinal; destinatarios{tipo: "todos"|"roles"|"departamentos"|"empleados"; ids[]}; grupos[]; respuestas[] }`.

Helpers: `getEncuestasPorEmpresa(slug)`, `crearEncuestaVacia(slug, creadorId, creadorNombre)`. Constantes de UI reutilizables: `ESTADO_ENCUESTA_LABEL`, `ESTADO_ENCUESTA_COLOR`, `TIPO_PREGUNTA_LABEL`, `COLORES_OPCIONES`.

Datos mock por empresa: `encuestasHabana` (3 encuestas: clima Q1, uniformes, bonus compañerismo), `encuestasBacanal` (1: formacion inicial). Indexados por **slug** (`"habana"`/`"bacanal"`).

### 2. Tabla legacy `public.encuestas` (migracion `010_features_restantes.sql`, lin 292-307)

```sql
create table if not exists public.encuestas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,                 -- SLUG, no uuid (patron legacy 010)
  titulo text not null,
  estado text not null default 'borrador',
  fecha_inicio date,
  fecha_fin date,
  preguntas jsonb not null default '[]',    -- todo el cuestionario aplanado
  respuestas_count integer default 0,       -- contador, no respuestas reales
  created_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.encuestas enable row level security;
create policy "enc_read"  ... using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "enc_write" ... for all using (true) with check (true);   -- MULTI-TENANT ROTO en escritura
```

Problemas verificados:

- **`empresa_id text`**: usa slug; las tablas nuevas de la Ola 2 usan `empresa_id uuid` (`dbId`). El `enc_read` compara `empresa_id` (text) contra `profiles.empresa_id`; si `profiles.empresa_id` es uuid, esta comparacion **no casa** (lectura cruzada/vacia segun el tipo real de `profiles.empresa_id` — VERIFICAR-SCHEMA-REAL).
- **`enc_write` = `using(true) with check(true)`**: cualquier usuario `authenticated` escribe en cualquier empresa. Hallazgo transversal #3 del plan.
- **Sin `descripcion` ni `updated_at`**: las actions las escriben igualmente (ver capa 3).
- **Sin normalizacion**: grupos/preguntas/opciones viven (a lo sumo) embebidos en `preguntas jsonb`; no hay forma de consultar por pregunta ni de imponer integridad.
- **Sin tabla de respuestas**: `respuestas_count` es un entero, no las respuestas. No hay donde guardar lo que responde el empleado, ni forma de aplicar `unaRespuesta` (unique) ni anonimato controlado.

> No existe ninguna otra migracion de encuestas: `grep -ri "encuesta" supabase` solo aparece en `010_features_restantes.sql`, su copia en `_DEMO_BUNDLE.sql`, y dos ficheros de contabilidad (falsos positivos por la subcadena). **No hay** `encuesta_grupos/preguntas/opciones/respuestas`.

### 3. Actions a medias (`src/features/gerencia/actions/encuestas-actions.ts`)

- `listEncuestas()`: `select * from encuestas` filtrado por `empresa_id` = `getEmpresaActivaForUser()` (UUID). **Pero el filtro compara UUID contra una columna `text` que guarda slug** -> en la practica devuelve 0 filas reales para datos legacy. Devuelve `{ ok, data }`.
- `createEncuesta({ titulo, descripcion?, preguntas?, fecha_inicio?, fecha_fin? })`: inserta con `empresa_id = <uuid>`, y **`descripcion`** (columna inexistente) -> el insert puede fallar o ignorar campo segun PostgREST. Pone `estado: "borrador"`, `created_by`.
- `updateEncuesta(id, {...})`: hace `update({ ...input, updated_at: ... })` -> **`updated_at` no existe** en la tabla -> error.
- No hay `EmpleadoSelector`/destinatarios, ni respuestas, ni gestion de estado fina, ni nada del lado empleado.

Conclusion: estas actions estan **rotas o incompletas** respecto al schema real y al dominio. OLA2-07 las **reescribe** sobre el modelo nuevo (no las parchea).

## Consumidores

### Gerencia (crear/gestionar): `src/features/gerencia/components/EncuestasView.tsx`

- Importa el mock (`getEncuestasPorEmpresa`, `crearEncuestaVacia`, tipos y labels) **y** las actions (`listEncuestas`, `createEncuesta`).
- `loadEncuestas()` llama a `listEncuestas()` y, **gane o pierda**, hace `setEncuestas(getEncuestasPorEmpresa(eId))` — comentario en codigo: *"DB has data - but the shape is flat; fall back to mock for rich nested data for now"*. Es decir: **lee la BD y la tira**.
- `handleCrear()` crea una encuesta mock en memoria **y** llama a `createEncuesta({ titulo, descripcion:"" })` (toast de exito/fallo), pero el editor posterior trabaja sobre el objeto mock, no sobre la fila.
- Editor completo (mock, en `useState`): grupos, preguntas (6 tipos), opciones con color, destinatarios (`todos|departamentos|roles|empleados`), config (anonima, unaRespuesta, modificarRespuesta, fechas, mensajes), y pestaña de **Resultados** con graficas (recharts) calculadas sobre `encuesta.respuestas` mock.
- Empleados/destinatarios: hoy via `getEmpleadosPorEmpresa(empresaActual.id)` (**mock**, slug). Debe pasar a la fuente real de OLA2-01 (`getEmpleadosActivos`) o al `EmpleadoSelector` de comunicados. `DEPARTAMENTOS` se sigue usando para destinatarios por departamento.
- Botones de dropdown (Duplicar/Finalizar/Archivar/Eliminar) y "Publicar"/"Guardar borrador" hoy **solo mutan estado local** (muertos respecto a BD).

### Mi-Panel (responder): `src/features/mi-panel/components/MisEncuestasView.tsx`

- 100% mock: `getEncuestasPorEmpresa(empresaActual.id).filter(estado === "activa")`.
- Identidad del empleado: **`empleadoId = profile?.email`** (de `useAuth`). Se compara contra `r.empleadoId` mock. **Bug latente**: la identidad real para respuestas debe ser `user.id` (uuid), no el email. Documentar y corregir en el de-mock.
- Pendientes/completadas se derivan de `e.respuestas.some(r => r.empleadoId === empleadoId)` + `modificarRespuesta`.
- "Enviar respuestas" hoy solo hace `setEnviada(true)` — **no persiste nada**. No respeta anonimato real ni una-respuesta a nivel BD.
- Soporta los 6 tipos de pregunta en la UI de respuesta (radio, checkbox, si/no, estrellas 1-5, escala 1-10, textarea).

## Patron de destinatarios reutilizable (ya real)

- `src/features/gerencia/actions/comunicados-actions.ts::listEmpleadosParaComunicado()` -> `EmpleadoSelector { userId; nombre; apellidos; rolLabel; departamento }`, leyendo `profiles` por `empresa_id` (uuid). Es el patron real que ya usan comunicados y (a futuro) encuestas.
- OLA2-01 introduce `getEmpleadosActivos()` -> `EmpleadoActivo` (empleados reales por empresa, uuid). **Para los destinatarios de la encuesta se reutiliza la fuente real de OLA2-01** (criterio del plan); `EmpleadoSelector` queda como alternativa equivalente.
- `getEmpresaActivaForUser(supabase, user.id)` devuelve el **UUID** de la empresa activa (confirmado en el discovery de comunicados OLA2-03). Las actions nuevas reciben/derivan UUID, nunca slug.

## Relacion con `cuestionarios` (PRP-042) — VERIFICADO, dominios distintos

Migracion `supabase/migrations/20260526120000_cuestionarios_campanas_semestrales.sql` (aplicada via MCP el 2026-05-26). Crea **4 tablas**: `cuestionario_plantillas`, `cuestionario_campanas`, `cuestionario_envios`, `cuestionario_puntos`, con `empresa_id uuid` y **RLS canonico UNION (`user_empresas` + `profiles`)**.

Semantica de `cuestionarios` (lo que ES):

- **Evaluaciones de conocimiento/formacion** con nota: `nota_corte`, `intentos_max`, `duracion_minutos`, `aprobado`, `puntuacion`, `nota_sobre`, `mostrar_resultados`, `aleatorizar_preguntas`, `categoria in (evaluacion|formacion|conocimiento|induccion)`.
- **Campañas semestrales** (`periodo ~ '^\d{4}-S[12]$'`, 1 por semestre x empresa) con periodo inicio/fin.
- **Envio por empleado** (`cuestionario_envios`, unique `(campana_id, empleado_id)`, FK a `empleados`) con **reunion de seguimiento** (`reunion_fecha/estado/notas/at`) y **puntos clave** (`cuestionario_puntos`, timeline de seguimiento con estado).

Semantica de `encuestas` (lo que ES):

- **Encuestas de clima/opinion/satisfaccion** internas, **sin nota ni aprobado**, con **anonimato** opcional y **una-respuesta** opcional.
- Estados `borrador|activa|finalizada|archivada` (no `activa|cerrada|archivada` de campañas).
- Tipos de pregunta orientados a opinion (`valoracion 1-5`, `escala 1-10`, `si_no`, `texto`, `unica`, `multiple` con **color por opcion**) — no a examen con respuesta correcta.
- Destinatarios flexibles (todos/departamentos/roles/empleados) en el momento, no "1 envio por empleado de la plantilla en una campaña semestral".

Decision recomendada (a confirmar por el responsable — ver D-OLA2-07-A): **son dominios distintos; NO converger.** `cuestionarios` = evaluacion semestral con nota y reunion; `encuestas` = clima/opinion anonima. Compartiran **convenciones** (RLS canonico UNION, `empresa_id uuid`, triggers `updated_at`, jsonb donde aplique) y conviene **alinear nombres y patron** para coherencia, pero **no** fusionar tablas: meter anonimato/clima en el modelo de campañas con nota/reunion ensuciaria ambos. Si negocio prefiere un unico "motor de formularios", es un rediseño mayor fuera del alcance de un de-mock.

## Hallazgos / riesgos clave

1. **Ya hay tabla + actions legacy** (no es green-field): hay que **migrar/sustituir** `public.encuestas` (text empresa_id, plana, RLS laxa) por el modelo nuevo, y **reescribir** `encuestas-actions.ts` (hoy escribe a columnas inexistentes).
2. **5 tablas nuevas** con `empresa_id uuid` + RLS canonico UNION: `encuestas` (reconstruida o nueva), `encuesta_grupos`, `encuesta_preguntas`, `encuesta_opciones`, `encuesta_respuestas`.
3. **Anonimato y una-respuesta** son reglas de modelo, no de UI: si `anonima`, no persistir `user_id` identificable en `encuesta_respuestas`; si `unaRespuesta`, `unique(encuesta_id, user_id)` (incompatible con anonimato estricto — ver D-OLA2-07-B).
4. **Slug vs uuid**: el mock y la tabla legacy usan slug; todo lo nuevo usa `dbId` (uuid). Las actions ya reciben uuid; el bug es la columna legacy `text`.
5. **Identidad del empleado mal tomada** en mi-panel (`profile.email`): debe ser `auth.uid()` para respuestas reales (salvo el caso anonimo).
6. **Convergencia con `cuestionarios`**: dominios distintos; alinear patron, no fusionar (D-OLA2-07-A).
7. **Destinatarios**: reutilizar la fuente real de OLA2-01 (`getEmpleadosActivos`) / `EmpleadoSelector`; retirar `getEmpleadosPorEmpresa` (mock). Esta task depende de OLA2-01.
8. **VERIFICAR-SCHEMA-REAL via Management API** antes de migrar (regla del proyecto): confirmar el estado real de `public.encuestas` en prod (puede haberse tocado a mano), el tipo de `profiles.empresa_id`, y si la tabla legacy tiene filas que migrar.

## Archivos relevantes

- Mock: `src/features/rrhh/data/encuestas.ts`
- Vista Gerencia: `src/features/gerencia/components/EncuestasView.tsx`
- Vista Mi-Panel: `src/features/mi-panel/components/MisEncuestasView.tsx`
- Actions legacy (a reescribir): `src/features/gerencia/actions/encuestas-actions.ts`
- Tabla legacy: `supabase/migrations/010_features_restantes.sql` (lin 292-307)
- Patron destinatarios real: `src/features/gerencia/actions/comunicados-actions.ts` (`listEmpleadosParaComunicado`, `EmpleadoSelector`)
- Fuente real de empleados (dep): OLA2-01 `src/features/rrhh/actions/empleados-actions.ts` (`getEmpleadosActivos`)
- Empresa activa (uuid): `src/features/empresa/lib/empresa-server.ts` (`getEmpresaActivaForUser`)
- Modelo de convergencia (referencia, NO fusionar): `supabase/migrations/20260526120000_cuestionarios_campanas_semestrales.sql`
- Contrato ejecutable: `docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-07-encuestas-reales.md`

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-07-encuestas-reales.md
