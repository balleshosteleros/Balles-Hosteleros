# Full-TASK-OLA2-07 - Encuestas reales

## Estado

PLANIFICADO (Ola 2, 2026-06-01). No implementado.
Discovery en `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-07-encuestas-reales.md` (estado real verificado contra codigo + SQL).

Correccion al supuesto del brief: NO es green-field puro. Ya existe una **tabla legacy** `public.encuestas` (migracion `010_features_restantes.sql`) y **server actions a medias** (`src/features/gerencia/actions/encuestas-actions.ts`) que la vista llama y descarta. La tabla legacy es **inservible** para el dominio real (`empresa_id text`/slug, modelo plano `preguntas jsonb`, RLS write `using(true)`, sin `descripcion`/`updated_at`, **sin tabla de respuestas**). El de-mock = construir el modelo normalizado (5 tablas, `empresa_id uuid`, RLS canonico), reescribir las actions, cablear las 2 vistas (Gerencia crea/gestiona; Mi-Panel responde) y retirar el mock.

## Objetivo

Que Gerencia (`EncuestasView`) **cree y gestione** encuestas internas reales (estado, grupos, preguntas de 6 tipos, opciones, destinatarios, anonimato, una-respuesta, mensajes, fechas) y que el empleado (`MisEncuestasView` en Mi-Panel) **vea las encuestas activas que le corresponden y responda**, persistiendo todo en BD multi-tenant por `empresa_id` (UUID/`dbId`) con RLS real, respetando **anonimato** (no guardar identidad cuando `anonima=true`) y **una-respuesta** (unique por empleado cuando `unaRespuesta=true`). Retirar `src/features/rrhh/data/encuestas.ts` como fuente funcional de verdad.

## Estimacion de complejidad

**Alta.** Es el de-mock NUEVO mas grande de la Ola 2.

- **BD**: 5 tablas nuevas normalizadas + RLS canonico UNION en cada una + triggers `updated_at` + indices + decision de migrar/retirar la tabla legacy `encuestas` (que ademas cambia de `text` a `uuid` y de plana a normalizada). Migracion grande e idempotente, verificada contra schema real.
- **Backend**: reescritura completa de `encuestas-actions.ts` (CRUD anidado encuesta+grupos+preguntas+opciones para Gerencia; listar-para-empleado + responder para Mi-Panel; reglas de anonimato/una-respuesta server-side).
- **Frontend**: cablear 2 vistas que hoy son mock (Gerencia: editor anidado + resultados reales; Mi-Panel: responder real + identidad correcta) y retirar el mock sin romper la UI rica.
- **Decisiones de negocio** abiertas (convergencia con `cuestionarios`; anonimato vs una-respuesta).

## Criterio de corte

- Existen en prod 5 tablas (`encuestas`, `encuesta_grupos`, `encuesta_preguntas`, `encuesta_opciones`, `encuesta_respuestas`) con `empresa_id uuid`, FKs en cascada y **RLS canonico UNION** (`user_empresas` + `profiles`); ninguna con `using(true) with check(true)`.
- Gerencia crea una encuesta con grupos/preguntas/opciones, destinatarios reales (fuente OLA2-01), config (anonima/unaRespuesta/fechas/mensajes) y estado; todo persiste y sobrevive a recarga (ya no "revive" el mock).
- El empleado ve en Mi-Panel las encuestas `activa` que le corresponden y **responde**; la respuesta persiste en `encuesta_respuestas` respetando anonimato y una-respuesta.
- Los Resultados de Gerencia se calculan sobre respuestas **reales** (no mock).
- `src/features/rrhh/data/encuestas.ts` deja de ser fuente funcional (solo enums/labels/colores reutilizados, si procede).
- `encuestas-actions.ts` ya no escribe a columnas inexistentes; opera sobre el modelo nuevo.
- `npm run typecheck` y `npm run build` verdes (WSL). Cierre alineado con la fila "OLA2-07" del `EXECUTION_PLAN_OLA2.md`.

## Modo operativo

- taskId: **OLA2-07**
- taskMode: **code**
- reviewMode: **standard**
- sourcePlan: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- dependsOn: **OLA2-01** (empleados reales, para destinatarios)

## Contexto previo obligatorio

Leer antes de ejecutar:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-07-encuestas-reales.md` (este discovery; las 3 capas, la tabla legacy y la relacion con cuestionarios).
2. `src/features/rrhh/data/encuestas.ts` (modelo de dominio rico a portar a BD: tipos, estados, tipos de pregunta, helpers).
3. `src/features/gerencia/components/EncuestasView.tsx` (vista Gerencia a de-mockear; foco en `loadEncuestas` lin 581-600, `handleCrear` lin 602-610, editor anidado y `ResultadosTab`).
4. `src/features/mi-panel/components/MisEncuestasView.tsx` (vista empleado a de-mockear; foco en `MisEncuestasView` lin 357-392 — identidad `profile.email` a corregir — y `ResponderEncuesta` lin 127-229 — "Enviar respuestas" no persiste).
5. `src/features/gerencia/actions/encuestas-actions.ts` (actions legacy a REESCRIBIR; hoy escriben a `descripcion`/`updated_at` inexistentes).
6. `src/features/gerencia/actions/comunicados-actions.ts` (`listEmpleadosParaComunicado` + `EmpleadoSelector`: patron real de destinatarios; `getContext()` con `getEmpresaActivaForUser` -> UUID).
7. Dependencia **OLA2-01**: `src/features/rrhh/actions/empleados-actions.ts::getEmpleadosActivos` + tipo `EmpleadoActivo` (fuente real de destinatarios). Ver `Full-TASK-OLA2-01-...md`.
8. `supabase/migrations/20260526120000_cuestionarios_campanas_semestrales.sql` (PRP-042): **patron de RLS canonico UNION + triggers `updated_at`** a replicar; y referencia para la decision de convergencia (NO fusionar).
9. `supabase/migrations/010_features_restantes.sql` (lin 292-307): tabla legacy `encuestas` (a migrar/retirar).
10. `EXECUTION_PLAN_OLA2.md` (criterios globales: UUID en actions, RLS real, placeholder honesto, no reintroducir mock, verificar schema real via Management API, commits `_FernandoClaude`).

## Scope IN

- **Migracion**: crear las 5 tablas normalizadas (`encuestas` reconstruida + `encuesta_grupos`, `encuesta_preguntas`, `encuesta_opciones`, `encuesta_respuestas`), todas con `empresa_id uuid` + FK a `empresas(id)` ON DELETE CASCADE + RLS canonico UNION + triggers `updated_at` + indices. Idempotente y verificada contra prod.
- **Tabla legacy `encuestas` (010)**: resolver su destino — reconstruir (preferido: `DROP` si esta vacia en prod y recrear con el schema nuevo) o renombrar a `encuestas_legacy` y crear la nueva. NO dejar dos tablas `encuestas` activas. Decision documentada (D-OLA2-07-C) tras verificar si hay filas reales.
- **Backend (reescritura de `encuestas-actions.ts`)**: CRUD anidado para Gerencia (crear/editar/eliminar encuesta + grupos + preguntas + opciones; cambiar estado: publicar/finalizar/archivar; gestionar destinatarios) y, para Mi-Panel, `listarEncuestasParaEmpleado` + `responderEncuesta`. Todo scoped por UUID server-side, con try/catch y `{ ok, data?, error? }`.
- **Reglas de negocio server-side**: anonimato (no persistir `user_id` en `encuesta_respuestas` cuando la encuesta es `anonima`) y una-respuesta (rechazar/upsert segun `unaRespuesta` y `modificarRespuesta`).
- **Destinatarios reales**: reutilizar `getEmpleadosActivos` (OLA2-01) / `EmpleadoSelector`. Persistir la seleccion de destinatarios de la encuesta (tipo + ids) y resolverla para el lado empleado.
- **Frontend Gerencia**: `EncuestasView` lee/crea/edita/gestiona sobre BD; editor anidado persiste; Resultados sobre respuestas reales; retirar `getEncuestasPorEmpresa`/`crearEncuestaVacia` y el `getEmpleadosPorEmpresa` mock.
- **Frontend Mi-Panel**: `MisEncuestasView` lista encuestas activas reales del empleado y persiste la respuesta; corregir identidad (`auth.uid()` en vez de `profile.email`).
- **Mappers** fila(s) BD -> ViewModel rico (encuesta con grupos/preguntas/opciones) y respuestas -> agregados de Resultados, ubicados en el feature (no en `rrhh/data`).
- **Retirar el mock** `data/encuestas.ts` como fuente funcional (conservar solo enums/labels/colores si la UI los reutiliza, idealmente reubicados a un `types`/`lib` del feature).

## Scope OUT

- NO converger con `cuestionarios` (PRP-042): es otro dominio (evaluacion semestral con nota/reunion). Solo se alinean convenciones (RLS, uuid, triggers). Ver D-OLA2-07-A.
- NO implementar envio de notificaciones/push al publicar una encuesta (puede reutilizar el patron de comunicados en una task futura; aqui basta con que aparezca en Mi-Panel). Si se decide, es scope adicional.
- NO exportacion/IO de encuestas ni informes PDF (fuera de alcance).
- NO editor de logica condicional (saltos de pregunta), aleatorizacion, ni cuotas. El modelo lo permite a futuro pero no se implementa.
- NO migrar datos mock a BD (el mock se retira, no se siembra).
- NO tocar `cuestionarios` ni sus vistas.
- NO crear roles/permisos nuevos mas alla del gating de escritura por rol si se aprueba (D-OLA2-07-D).

## Restricciones

- Toda action recibe/deriva el **UUID de empresa (`dbId`)** server-side (`getEmpresaActivaForUser`); nunca el slug. La UI deja de usar `empresaActual.id` (slug) como clave de datos reales.
- **RLS multi-tenant real** por `empresa_id` en las 5 tablas, patron **canonico UNION** (`user_empresas` + `profiles`) como en `cuestionarios`. Prohibido `using(true) with check(true)`.
- **Anonimato**: cuando `encuestas.anonima = true`, `encuesta_respuestas.user_id` se guarda `NULL` (o no se guarda); no debe poder reconstruirse la identidad del respondiente desde la fila. Documentar el trade-off con una-respuesta (D-OLA2-07-B).
- **Una-respuesta**: cuando `unaRespuesta = true` y NO anonima, `unique(encuesta_id, user_id)`; `modificarRespuesta` decide si se hace upsert o se rechaza el segundo envio.
- Verificar **schema real en prod via Management API** antes de migrar (tabla legacy, tipo de `profiles.empresa_id`, filas existentes). No inferir del codigo.
- Migracion **idempotente** (`create table if not exists`, `drop policy if exists`, guards). No romper datos existentes; si la legacy tiene filas, decidir y documentar (D-OLA2-07-C).
- Flujos de escritura conservan try/catch, error legible (`toast`) y degradan a vacio + aviso si la BD falla (no a mock).
- Validacion por ejecutor: `npm run typecheck` y `npm run build` via WSL (`wsl -d Ubuntu bash -c`, NON-login).
- Commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes. (El agente de arquitectura NO commitea.)
- No versionar peppers/SMTP/claves/service-role. Restaurar `next-env.d.ts` si el tooling lo modifica.

## Validacion requerida

1. `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run typecheck"` -> verde.
2. `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run build"` -> verde.
3. Verificacion BD (Management API / SQL): existen las 5 tablas con `empresa_id uuid`, FKs en cascada y RLS habilitada con politicas UNION; no queda RLS laxa.
4. Smoke funcional (dev local), con HABANA y BACANAL:
   - Gerencia crea encuesta con >=2 grupos, preguntas de varios tipos (incluida `unica`/`multiple` con opciones) y la publica (`activa`) con destinatarios reales -> persiste; al recargar sigue ahi (no mock).
   - El empleado destinatario la ve en Mi-Panel (`/mi-panel` encuestas) y responde -> `encuesta_respuestas` recibe filas correctas.
   - Encuesta **anonima**: la respuesta NO guarda `user_id` (verificar en BD).
   - Encuesta **unaRespuesta** (no anonima, sin modificar): el segundo intento del mismo empleado se rechaza/ignora (unique).
   - Resultados de Gerencia reflejan las respuestas reales (conteos/medias/graficas).
   - Switcher de empresa: la lista cambia de tenant (no mezcla, no mock).
5. RLS cross-tenant: un usuario de otra empresa no ve ni edita encuestas/respuestas ajenas (read+write scoped). Verificacion explicita.

## Dependencias

- **Bloqueante**: **OLA2-01** (empleados reales) — provee `getEmpleadosActivos`/`EmpleadoActivo`, fuente real de destinatarios. Sin ella, los destinatarios seguirian siendo mock. (Si OLA2-01 no estuviera lista, se puede usar el `EmpleadoSelector` real de comunicados como puente, pero el plan fija la dependencia.)
- **Coordinacion suave**: ninguna con `cuestionarios` (dominio aparte). Compartir convenciones de RLS/uuid/triggers por coherencia.
- **Decisiones de negocio**: D-OLA2-07-A (convergencia cuestionarios), D-OLA2-07-B (anonimato vs una-respuesta), D-OLA2-07-C (destino tabla legacy), D-OLA2-07-D (gating write por rol). Ver seccion de decisiones.

## Inputs

- Modelo de dominio mock (a portar): `src/features/rrhh/data/encuestas.ts`.
- Vistas a de-mockear: `EncuestasView.tsx` (Gerencia), `MisEncuestasView.tsx` (Mi-Panel).
- Actions legacy a reescribir: `encuestas-actions.ts`.
- Fuente real de empleados (dep OLA2-01): `getEmpleadosActivos` / `EmpleadoActivo`.
- Patron destinatarios real: `listEmpleadosParaComunicado` / `EmpleadoSelector`.
- Empresa activa (uuid): `getEmpresaActivaForUser`.
- Patron RLS/triggers a replicar: migracion de `cuestionarios` (PRP-042).
- Tabla legacy: `010_features_restantes.sql` (encuestas).

## Outputs esperados

- Migracion `.sql` idempotente con las 5 tablas + RLS UNION + triggers + indices, y el tratamiento de la tabla legacy.
- `encuestas-actions.ts` reescrito: CRUD anidado para Gerencia + `listarEncuestasParaEmpleado`/`responderEncuesta` para Mi-Panel + reglas anonimato/una-respuesta.
- `EncuestasView.tsx` operando sobre BD real (crear/editar/gestionar/resultados), sin mock.
- `MisEncuestasView.tsx` operando sobre BD real (listar/responder), con identidad `auth.uid()`.
- Mappers BD -> ViewModel rico (encuesta + grupos/preguntas/opciones) y agregados de Resultados, en el feature.
- `data/encuestas.ts` retirado como fuente funcional (enums/labels/colores conservados/reubicados solo si se reutilizan).
- Documentacion de cierre + registro de blindaje si aplica.

## Riesgos conocidos

- **R1 Doble tabla `encuestas`**: ya existe la legacy (text/plana). Crear la nueva sin resolver la legacy deja dos definiciones en conflicto. Mitigacion: verificar filas reales y DROP/rename documentado (D-OLA2-07-C) antes de recrear.
- **R2 Actions rotas reutilizadas**: las actions legacy escriben a columnas inexistentes; reusarlas tal cual propaga el bug. Mitigacion: reescritura completa sobre el modelo nuevo.
- **R3 Anonimato vs una-respuesta**: son contradictorios si se exige unique por `user_id` y a la vez no guardar `user_id`. Mitigacion: D-OLA2-07-B (p.ej. token de participacion no reversible, o renunciar a unique en anonimas), implementar la decision en el modelo.
- **R4 Slug residual**: cualquier query que reciba slug devuelve 0 filas (legacy era text). Mitigacion: auditar que solo el mock (a retirar) usaba `empresaActual.id`; las actions usan uuid.
- **R5 Identidad mal tomada en mi-panel** (`profile.email`): respuestas atribuidas mal o no unicas. Mitigacion: usar `auth.uid()` server-side; el email no entra en el modelo.
- **R6 RLS laxa heredada**: la legacy tiene `enc_write using(true)`. Mitigacion: las nuevas politicas son UNION estrictas; al retirar la legacy desaparece la laxa.
- **R7 Carga anidada N+1 / consistencia**: escribir/leer encuesta+grupos+preguntas+opciones en varias tablas puede dejar estados parciales. Mitigacion: operaciones en orden con FKs en cascada; si el cliente lo soporta, agrupar; validar y limpiar en fallo.
- **R8 Schema prod != SQL**: la legacy o `profiles.empresa_id` pueden diferir del SQL versionado. Mitigacion: Management API antes de migrar (regla del proyecto).
- **R9 Perdida del editor rico**: el mock tiene un editor anidado completo; cablearlo a BD sin romper la UX es la mayor parte del frontend. Mitigacion: introducir un ViewModel equivalente al tipo mock y mapear 1:1.

## Modelo de datos propuesto

> **VERIFICAR-SCHEMA-REAL via Management API antes de migrar** (tabla legacy `public.encuestas` de `010`, tipo de `profiles.empresa_id`, y si hay filas que conservar). El SQL versionado puede no reflejar prod (regla del proyecto).
>
> **Convergencia con `cuestionarios` (PRP-042): NO fusionar.** Dominio distinto (clima/opinion anonima vs evaluacion semestral con nota/reunion). Se **replica el patron** de RLS canonico UNION (`user_empresas` + `profiles`) y los triggers `updated_at`, pero las tablas son propias. Ver D-OLA2-07-A.
>
> **Tabla legacy**: `public.encuestas` (010) es `empresa_id text`, plana (`preguntas jsonb`), RLS write laxa, sin respuestas. Se **reconstruye** (DROP si vacia + CREATE nuevo) o se **renombra** a `encuestas_legacy`. Ver D-OLA2-07-C. El DDL siguiente asume reconstruccion de `encuestas` con `empresa_id uuid`.

DDL completo (idempotente). Enums de dominio como `CHECK` (coherente con el estilo de `cuestionarios`):

```sql
-- ============================================================
-- OLA2-07 — Encuestas internas reales (clima/opinion)
-- 5 tablas (encuestas + grupos + preguntas + opciones + respuestas)
-- empresa_id uuid + RLS canonico UNION (user_empresas + profiles).
-- VERIFICAR-SCHEMA-REAL antes de aplicar. Idempotente.
-- ============================================================

-- (D-OLA2-07-C) Tratamiento de la tabla legacy 'encuestas' (010, empresa_id text):
--   Si esta vacia en prod -> DROP y recrear con el schema de abajo.
--   Si tiene filas -> renombrar:  ALTER TABLE public.encuestas RENAME TO encuestas_legacy;
--   (decidir y dejar UNA sola 'encuestas' activa, con empresa_id uuid).

-- ─── 1. ENCUESTA (cabecera) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encuestas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  descripcion          TEXT NOT NULL DEFAULT '',
  estado               TEXT NOT NULL DEFAULT 'borrador',
  anonima              BOOLEAN NOT NULL DEFAULT FALSE,
  una_respuesta        BOOLEAN NOT NULL DEFAULT TRUE,
  modificar_respuesta  BOOLEAN NOT NULL DEFAULT FALSE,
  mensaje_inicial      TEXT NOT NULL DEFAULT '',
  mensaje_final        TEXT NOT NULL DEFAULT '',
  -- destinatarios: tipo + ids (uuids de user/empleado o claves de depto/rol segun tipo)
  destinatarios_tipo   TEXT NOT NULL DEFAULT 'todos',
  destinatarios_ids    TEXT[] NOT NULL DEFAULT '{}',
  fecha_apertura       DATE,
  fecha_cierre         DATE,
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT encuestas_estado_chk
    CHECK (estado IN ('borrador','activa','finalizada','archivada')),
  CONSTRAINT encuestas_destinatarios_tipo_chk
    CHECK (destinatarios_tipo IN ('todos','roles','departamentos','empleados'))
);
CREATE INDEX IF NOT EXISTS encuestas_empresa_idx ON public.encuestas (empresa_id);
CREATE INDEX IF NOT EXISTS encuestas_estado_idx  ON public.encuestas (estado);

-- ─── 2. GRUPOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encuesta_grupos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id  UUID NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  empresa_id   UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL DEFAULT '',
  descripcion  TEXT NOT NULL DEFAULT '',
  orden        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS encuesta_grupos_encuesta_idx ON public.encuesta_grupos (encuesta_id);
CREATE INDEX IF NOT EXISTS encuesta_grupos_empresa_idx  ON public.encuesta_grupos (empresa_id);

-- ─── 3. PREGUNTAS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encuesta_preguntas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id     UUID NOT NULL REFERENCES public.encuesta_grupos(id) ON DELETE CASCADE,
  encuesta_id  UUID NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  empresa_id   UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL DEFAULT '',
  tipo         TEXT NOT NULL DEFAULT 'unica',
  obligatoria  BOOLEAN NOT NULL DEFAULT TRUE,
  puntuacion   BOOLEAN NOT NULL DEFAULT FALSE,
  orden        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT encuesta_preguntas_tipo_chk
    CHECK (tipo IN ('unica','multiple','texto','valoracion','escala','si_no'))
);
CREATE INDEX IF NOT EXISTS encuesta_preguntas_grupo_idx    ON public.encuesta_preguntas (grupo_id);
CREATE INDEX IF NOT EXISTS encuesta_preguntas_encuesta_idx ON public.encuesta_preguntas (encuesta_id);
CREATE INDEX IF NOT EXISTS encuesta_preguntas_empresa_idx  ON public.encuesta_preguntas (empresa_id);

-- ─── 4. OPCIONES (solo unica/multiple) ───────────────────────
CREATE TABLE IF NOT EXISTS public.encuesta_opciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta_id  UUID NOT NULL REFERENCES public.encuesta_preguntas(id) ON DELETE CASCADE,
  encuesta_id  UUID NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  empresa_id   UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  texto        TEXT NOT NULL DEFAULT '',
  color        TEXT NOT NULL DEFAULT '#3b82f6',
  orden        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS encuesta_opciones_pregunta_idx ON public.encuesta_opciones (pregunta_id);
CREATE INDEX IF NOT EXISTS encuesta_opciones_empresa_idx  ON public.encuesta_opciones (empresa_id);

-- ─── 5. RESPUESTAS (1 fila por encuesta x respondiente) ──────
-- respuestas: jsonb { preguntaId: string | string[] | number } (coherente con la UI).
-- Anonimato (D-OLA2-07-B): si encuestas.anonima -> user_id = NULL (no identificable).
-- Una-respuesta: si encuestas.una_respuesta y NO anonima -> unique(encuesta_id, user_id).
CREATE TABLE IF NOT EXISTS public.encuesta_respuestas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id   UUID NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,   -- NULL si anonima
  respuestas    JSONB NOT NULL DEFAULT '{}'::jsonb,
  enviada_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS encuesta_respuestas_encuesta_idx ON public.encuesta_respuestas (encuesta_id);
CREATE INDEX IF NOT EXISTS encuesta_respuestas_empresa_idx  ON public.encuesta_respuestas (empresa_id);
-- Una-respuesta SOLO para no anonimas (unique parcial; permite multiples NULL anonimas):
CREATE UNIQUE INDEX IF NOT EXISTS encuesta_respuestas_uniq_no_anon
  ON public.encuesta_respuestas (encuesta_id, user_id)
  WHERE user_id IS NOT NULL;

-- ─── Triggers updated_at (patron de cuestionarios) ───────────
CREATE OR REPLACE FUNCTION public.encuestas_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS encuestas_touch_updated_at ON public.encuestas;
CREATE TRIGGER encuestas_touch_updated_at
  BEFORE UPDATE ON public.encuestas
  FOR EACH ROW EXECUTE FUNCTION public.encuestas_touch_updated_at();

DROP TRIGGER IF EXISTS encuesta_respuestas_touch_updated_at ON public.encuesta_respuestas;
CREATE TRIGGER encuesta_respuestas_touch_updated_at
  BEFORE UPDATE ON public.encuesta_respuestas
  FOR EACH ROW EXECUTE FUNCTION public.encuestas_touch_updated_at();

-- ============================================================
-- RLS canonico UNION (user_empresas + profiles) — las 5 tablas
-- ============================================================
ALTER TABLE public.encuestas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_grupos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_preguntas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_opciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_respuestas ENABLE ROW LEVEL SECURITY;

-- Patron por tabla (repetir cambiando <tabla>):
--   DROP POLICY IF EXISTS "<tabla>_read"  ON public.<tabla>;
--   DROP POLICY IF EXISTS "<tabla>_write" ON public.<tabla>;
--   CREATE POLICY "<tabla>_read" ON public.<tabla>
--     FOR SELECT TO authenticated USING (
--       EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = <tabla>.empresa_id)
--       OR EXISTS (SELECT 1 FROM profiles p  WHERE p.user_id  = auth.uid() AND p.empresa_id  = <tabla>.empresa_id)
--     );
--   CREATE POLICY "<tabla>_write" ON public.<tabla>
--     FOR ALL TO authenticated USING ( <mismo predicado> ) WITH CHECK ( <mismo predicado> );

-- encuestas
DROP POLICY IF EXISTS "encuestas_read"  ON public.encuestas;
DROP POLICY IF EXISTS "encuestas_write" ON public.encuestas;
CREATE POLICY "encuestas_read" ON public.encuestas FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = encuestas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.empresa_id = encuestas.empresa_id)
  );
CREATE POLICY "encuestas_write" ON public.encuestas FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = encuestas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.empresa_id = encuestas.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = encuestas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.empresa_id = encuestas.empresa_id)
  );

-- encuesta_grupos / encuesta_preguntas / encuesta_opciones / encuesta_respuestas:
--   aplicar EXACTAMENTE el mismo par read/write cambiando el nombre de tabla
--   (todas tienen empresa_id, por lo que el predicado es identico).
```

Notas del modelo:

- **`encuesta_respuestas.respuestas` jsonb** `{ preguntaId: valor }` (valor = `string | string[] | number`) replica la forma que ya usa la UI (`RespuestaEmpleado.respuestas`), evitando una tabla `respuesta_items` extra; si negocio quiere analitica por item a futuro, se normaliza entonces (fuera de alcance).
- **Anonimato + una-respuesta** (D-OLA2-07-B): el `UNIQUE` parcial `WHERE user_id IS NOT NULL` permite multiples respuestas anonimas (user_id NULL) y a la vez impone una sola por usuario en las no anonimas. Si negocio exige "una respuesta tambien en anonimas", se necesita un token de participacion no reversible (rediseño; documentar).
- **`empresa_id` redundante en hijas**: se incluye en grupos/preguntas/opciones/respuestas para poder aplicar **la misma politica RLS UNION** en todas sin joins (patron de `cuestionario_puntos`/`envios`). Las actions deben rellenarlo coherente con la cabecera.
- **Destinatarios**: `destinatarios_tipo` + `destinatarios_ids text[]` inline en la cabecera (como comunicados, que tampoco normaliza destinatarios). `ids` guarda uuids de empleado/user (tipo `empleados`) o claves de depto/rol (tipos `departamentos`/`roles`).

## Interfaces publicas propuestas

Reescritura de `src/features/gerencia/actions/encuestas-actions.ts` (las firmas legacy `listEncuestas`/`createEncuesta`/`updateEncuesta` se sustituyen). Todas resuelven el UUID de empresa server-side (`getContext()` -> `getEmpresaActivaForUser`) y devuelven `{ ok, data?, error? }`.

```ts
// ── Tipos de dominio (reubicados desde data/encuestas.ts o en lib del feature) ──
export type EstadoEncuesta = "borrador" | "activa" | "finalizada" | "archivada";
export type TipoPregunta = "unica" | "multiple" | "texto" | "valoracion" | "escala" | "si_no";
export type DestinatariosTipo = "todos" | "roles" | "departamentos" | "empleados";

export interface OpcionVM   { id: string; texto: string; color: string; orden: number; }
export interface PreguntaVM { id: string; titulo: string; tipo: TipoPregunta; obligatoria: boolean; puntuacion: boolean; orden: number; opciones: OpcionVM[]; }
export interface GrupoVM    { id: string; titulo: string; descripcion: string; orden: number; preguntas: PreguntaVM[]; }
export interface EncuestaVM {
  id: string; nombre: string; descripcion: string; estado: EstadoEncuesta;
  anonima: boolean; unaRespuesta: boolean; modificarRespuesta: boolean;
  mensajeInicial: string; mensajeFinal: string;
  destinatarios: { tipo: DestinatariosTipo; ids: string[] };
  fechaApertura: string | null; fechaCierre: string | null;
  creadorId: string | null; fechaCreacion: string;
  grupos: GrupoVM[];
  totalRespuestas: number; // contador derivado
}

// ── GERENCIA: CRUD encuesta ──────────────────────────────────
export async function listarEncuestasAdmin(): Promise<{ ok: boolean; data: EncuestaVM[]; error?: string }>;
export async function obtenerEncuesta(id: string): Promise<{ ok: boolean; data?: EncuestaVM; error?: string }>;

export interface EncuestaInput {
  nombre: string; descripcion?: string;
  anonima?: boolean; unaRespuesta?: boolean; modificarRespuesta?: boolean;
  mensajeInicial?: string; mensajeFinal?: string;
  destinatariosTipo?: DestinatariosTipo; destinatariosIds?: string[];
  fechaApertura?: string | null; fechaCierre?: string | null;
}
export async function crearEncuesta(input: EncuestaInput): Promise<{ ok: boolean; data?: { id: string }; error?: string }>;
export async function actualizarEncuesta(id: string, input: Partial<EncuestaInput>): Promise<{ ok: boolean; error?: string }>;
export async function eliminarEncuesta(id: string): Promise<{ ok: boolean; error?: string }>;

// Transiciones de estado (centralizan la regla; 'activa' = publicada/visible al empleado)
export async function publicarEncuesta(id: string): Promise<{ ok: boolean; error?: string }>;   // estado -> 'activa'
export async function finalizarEncuesta(id: string): Promise<{ ok: boolean; error?: string }>;   // estado -> 'finalizada'
export async function archivarEncuesta(id: string): Promise<{ ok: boolean; error?: string }>;     // estado -> 'archivada'
export async function duplicarEncuesta(id: string): Promise<{ ok: boolean; data?: { id: string }; error?: string }>; // clona a 'borrador'

// ── GERENCIA: grupos / preguntas / opciones ──────────────────
export async function crearGrupo(encuestaId: string, input: { titulo?: string; descripcion?: string; orden?: number }): Promise<{ ok: boolean; data?: { id: string }; error?: string }>;
export async function actualizarGrupo(id: string, input: { titulo?: string; descripcion?: string; orden?: number }): Promise<{ ok: boolean; error?: string }>;
export async function eliminarGrupo(id: string): Promise<{ ok: boolean; error?: string }>;

export async function crearPregunta(grupoId: string, input: { titulo?: string; tipo?: TipoPregunta; obligatoria?: boolean; puntuacion?: boolean; orden?: number }): Promise<{ ok: boolean; data?: { id: string }; error?: string }>;
export async function actualizarPregunta(id: string, input: { titulo?: string; tipo?: TipoPregunta; obligatoria?: boolean; puntuacion?: boolean; orden?: number }): Promise<{ ok: boolean; error?: string }>;
export async function eliminarPregunta(id: string): Promise<{ ok: boolean; error?: string }>;

export async function crearOpcion(preguntaId: string, input: { texto?: string; color?: string; orden?: number }): Promise<{ ok: boolean; data?: { id: string }; error?: string }>;
export async function actualizarOpcion(id: string, input: { texto?: string; color?: string; orden?: number }): Promise<{ ok: boolean; error?: string }>;
export async function eliminarOpcion(id: string): Promise<{ ok: boolean; error?: string }>;

// Variante "guardar todo" (alternativa al CRUD granular; persiste la encuesta completa anidada
// en una sola llamada, util para el editor que hoy trabaja sobre un objeto en useState):
export async function guardarEncuestaCompleta(id: string, payload: EncuestaVM): Promise<{ ok: boolean; error?: string }>;

// ── GERENCIA: resultados ─────────────────────────────────────
// Devuelve la encuesta + sus respuestas crudas (anonimizadas) para que el VM calcule agregados,
// o agregados ya calculados por pregunta. Forma recomendada: respuestas crudas + helper de mapeo.
export interface RespuestaRow { preguntaRespuestas: Record<string, string | string[] | number>; enviadaAt: string; userId: string | null; }
export async function listarRespuestasEncuesta(encuestaId: string): Promise<{ ok: boolean; data: RespuestaRow[]; error?: string }>;

// ── MI-PANEL: empleado ───────────────────────────────────────
// Encuestas 'activa' que le corresponden al usuario actual (por destinatarios + empresa),
// con flag yaRespondida (derivado de encuesta_respuestas para no anonimas).
export interface EncuestaEmpleadoVM extends EncuestaVM { yaRespondida: boolean; }
export async function listarEncuestasParaEmpleado(): Promise<{ ok: boolean; data: EncuestaEmpleadoVM[]; error?: string }>;

// Persiste la respuesta del empleado. Aplica anonimato (user_id NULL si encuesta.anonima)
// y una-respuesta (rechaza/upsert segun una_respuesta + modificar_respuesta) server-side.
export async function responderEncuesta(
  encuestaId: string,
  respuestas: Record<string, string | string[] | number>, // preguntaId -> valor
): Promise<{ ok: boolean; error?: string }>;
```

Notas de contrato:

- **`responderEncuesta`** es el punto donde viven las reglas: lee `encuestas.anonima`/`una_respuesta`/`modificar_respuesta`, valida que la encuesta esta `activa` y que el usuario es destinatario, y persiste en `encuesta_respuestas` (con `user_id = NULL` si anonima). Si `una_respuesta` y ya existe fila (no anonima): rechaza o hace upsert segun `modificar_respuesta`.
- **`listarEncuestasParaEmpleado`** resuelve destinatarios: `todos` -> todas las activas de la empresa; `empleados` -> `auth.uid()` en `destinatarios_ids`; `departamentos`/`roles` -> match contra el `profiles`/`empleados` del usuario. El flag `yaRespondida` solo aplica a no anonimas.
- **Destinatarios reales**: la UI de Gerencia usa `getEmpleadosActivos()` (OLA2-01) o `EmpleadoSelector` para poblar la seleccion; las actions de encuestas no reimplementan la lectura de empleados.
- Se ofrecen **dos estilos** (CRUD granular vs `guardarEncuestaCompleta`): el ejecutor elige; recomendado `guardarEncuestaCompleta` para encajar con el editor actual (objeto en `useState`) y CRUD granular si se quiere autosave por elemento.

## Flujo operativo esperado (fases)

1. **Fase 0 - Verificacion de schema (Management API).** Confirmar estado real de `public.encuestas` (010) en prod, tipo de `profiles.empresa_id`, existencia de `user_empresas`/`empresas`, y si la legacy tiene filas. Decidir D-OLA2-07-C (DROP vs rename).
2. **Fase 1 - Migracion.** Aplicar el DDL de las 5 tablas + RLS UNION + triggers + indices (idempotente), resolviendo la legacy. Verificar RLS habilitada y politicas creadas.
3. **Fase 2 - Tipos/VM + mappers.** Definir `EncuestaVM`/`GrupoVM`/`PreguntaVM`/`OpcionVM` (equivalentes al tipo mock) y los mappers fila(s) BD -> VM. Reubicar enums/labels/colores reutilizados fuera de `data/encuestas.ts`.
3b. **Fase 3 - Reescritura de actions.** Implementar el CRUD anidado + transiciones de estado + `listarEncuestasParaEmpleado`/`responderEncuesta` + `listarRespuestasEncuesta`, con UUID server-side, try/catch y reglas anonimato/una-respuesta.
4. **Fase 4 - De-mock Gerencia.** `EncuestasView`: `loadEncuestas` usa `listarEncuestasAdmin`; el editor persiste (guardar completo o CRUD granular); destinatarios via fuente real OLA2-01; Resultados via `listarRespuestasEncuesta`. Retirar `getEncuestasPorEmpresa`/`crearEncuestaVacia`/`getEmpleadosPorEmpresa`.
5. **Fase 5 - De-mock Mi-Panel.** `MisEncuestasView`: `listarEncuestasParaEmpleado` para pendientes/completadas; `responderEncuesta` en "Enviar respuestas"; identidad por `auth.uid()` (retirar `profile.email`).
6. **Fase 6 - Retirada del mock.** `data/encuestas.ts` deja de ser fuente funcional (solo enums/labels/colores si se reutilizan, reubicados). Auditar que ningun punto pasa slug a datos reales.
7. **Fase 7 - Validacion.** `typecheck` + `build` (WSL) + smoke Gerencia<->empleado (crear/publicar/responder, anonima, una-respuesta, resultados) + verificacion BD + RLS cross-tenant.
8. **Fase 8 (condicional) - Gating write por rol.** Solo si se aprueba D-OLA2-07-D: endurecer `*_write` para exigir rol de gestion (Director/Gerencia/RRHH) en la cabecera/estructura, dejando a cualquier destinatario solo INSERT en `encuesta_respuestas`.

## Decisiones de negocio pendientes

- **D-OLA2-07-A (convergencia con `cuestionarios`).** ¿`encuestas` y `cuestionarios` (PRP-042) son dominios distintos (recomendado: SI — clima/opinion anonima vs evaluacion semestral con nota/reunion) o negocio quiere un unico "motor de formularios"? Recomendacion del discovery: **no fusionar**; alinear convenciones (RLS UNION, uuid, triggers). Fusionar seria un rediseño mayor fuera del de-mock.
- **D-OLA2-07-B (anonimato vs una-respuesta).** Cuando una encuesta es `anonima`, ¿se renuncia a "una sola respuesta por empleado" (modelo propuesto: unique parcial solo para no anonimas) o se exige unicidad tambien en anonimas via token de participacion no reversible (rediseño)? Recomendacion: renunciar a unique en anonimas (mas simple, anonimato real); revisar si negocio necesita evitar duplicados anonimos.
- **D-OLA2-07-C (tabla legacy `encuestas`).** Tras verificar prod: ¿DROP+recrear (si vacia) o renombrar a `encuestas_legacy` (si tiene filas)? No migrar datos mock. Recomendacion: DROP si vacia; rename si hay filas reales que conservar como historico.
- **D-OLA2-07-D (gating de escritura por rol).** ¿La creacion/edicion de la estructura de encuestas se restringe a roles de gestion (Director/Gerencia/RRHH), dejando a los empleados solo responder (`INSERT` en `encuesta_respuestas`)? Recomendacion: restringir la estructura a gestion; permitir responder a cualquier destinatario del tenant. Afecta a la Fase 8.

(Estas decisiones no las toma el agente; se elevan al responsable. El de-mock principal no depende de A/D; B y C condicionan el detalle del modelo y la migracion.)

## Paths del proyecto

A tocar:
- `src/features/gerencia/actions/encuestas-actions.ts` (reescritura completa).
- `src/features/gerencia/components/EncuestasView.tsx` (de-mock Gerencia).
- `src/features/mi-panel/components/MisEncuestasView.tsx` (de-mock Mi-Panel + identidad).
- `src/features/rrhh/data/encuestas.ts` (retirar como fuente funcional; conservar/reubicar enums/labels/colores si se reutilizan).
- Nueva migracion: `supabase/migrations/<timestamp>_encuestas_reales.sql`.
- Nuevo (mappers/tipos VM): p.ej. `src/features/gerencia/lib/encuestas-map.ts` (o `types`/`lib` del feature).

A leer como referencia (no se tocan salvo coherencia):
- `src/features/gerencia/actions/comunicados-actions.ts` (`listEmpleadosParaComunicado`/`EmpleadoSelector`, `getContext`).
- `src/features/rrhh/actions/empleados-actions.ts` (`getEmpleadosActivos`, dep OLA2-01).
- `src/features/empresa/lib/empresa-server.ts` (`getEmpresaActivaForUser`, uuid).
- `supabase/migrations/20260526120000_cuestionarios_campanas_semestrales.sql` (patron RLS/triggers; NO fusionar).
- `supabase/migrations/010_features_restantes.sql` (tabla legacy a resolver).

## Agentes recomendados

- **create-supabase-table-rls-base**: para las 5 tablas + RLS canonico UNION + triggers (replicando el patron de `cuestionarios`).
- **generate-data-access-layer** / patron de server actions: para reescribir `encuestas-actions.ts` (CRUD anidado + respuestas).
- **review-rls-multi-tenant**: validar que las 5 tablas filtran por `empresa_id` (UNION), que anonimato no filtra identidad y que un tenant no ve a otro; y, si se aprueba D-OLA2-07-D, el gating write por rol.
- **golden-path-review** / **review-repo-coherence**: revision final (que no quede mock funcional ni slug en datos reales; coherencia Gerencia<->Mi-Panel).
- Ejecutor humano (Fernando) para `typecheck`/`build` por WSL, smoke con switcher de empresa, verificacion BD via Management API y aprobacion de decisiones B/C/D.

## Checklist de cierre

- [ ] Fase 0: schema real verificado (legacy `encuestas`, `profiles.empresa_id`, `user_empresas`/`empresas`, filas legacy). D-OLA2-07-C decidida.
- [ ] Migracion aplicada (idempotente): 5 tablas con `empresa_id uuid`, FKs cascada, indices, triggers `updated_at`.
- [ ] RLS canonico UNION en las 5 tablas; ninguna con `using(true) with check(true)`; legacy laxa retirada.
- [ ] `encuestas-actions.ts` reescrito: CRUD anidado + transiciones + `listarEncuestasParaEmpleado`/`responderEncuesta`/`listarRespuestasEncuesta`; UUID server-side; sin columnas inexistentes.
- [ ] Reglas server-side: anonimato (user_id NULL) y una-respuesta (unique parcial / upsert segun `modificarRespuesta`) implementadas.
- [ ] `EncuestasView` (Gerencia) crea/edita/gestiona/Resultados sobre BD real; destinatarios via fuente OLA2-01; sin mock.
- [ ] `MisEncuestasView` (Mi-Panel) lista y responde sobre BD real; identidad por `auth.uid()` (no `profile.email`).
- [ ] Mappers BD -> VM rico implementados y tipados; sin campos undefined en la UI.
- [ ] `data/encuestas.ts` retirado como fuente funcional; enums/labels/colores reubicados o conservados solo si se reutilizan.
- [ ] Ningun punto pasa `empresaActual.id` (slug) a una query real.
- [ ] `npm run typecheck` verde (WSL).
- [ ] `npm run build` verde (WSL).
- [ ] Smoke: crear+publicar (Gerencia) -> responder (empleado) -> Resultados reales; anonima sin user_id; una-respuesta bloquea duplicado; switcher de empresa sin mezclar.
- [ ] RLS cross-tenant verificada (otra empresa no ve ni edita encuestas ni respuestas).
- [ ] Decisiones D-OLA2-07-A/B/C/D resueltas; si procede, Fase 8 (gating write por rol) aplicada y verificada.
- [ ] Estado de blindaje declarado (documentado / no aplica / pendiente) segun `docs/dev/ERRORES.md`.
- [ ] Commit `..._FernandoClaude` + push a `main` tras validacion (lo ejecuta Fernando).

## Siguiente paso sugerido

Resolver con el responsable D-OLA2-07-B (anonimato vs una-respuesta) y D-OLA2-07-C (destino de la tabla legacy), y ejecutar la **Fase 0** (verificacion de schema real via Management API). Confirmado eso, abordar Fase 1 (migracion de las 5 tablas con RLS UNION) y Fase 3 (reescritura de actions), que es donde vive el grueso del trabajo. Requiere **OLA2-01 cerrada** para los destinatarios reales; si aun no lo esta, usar el `EmpleadoSelector` real de comunicados como puente.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-07-encuestas-reales.md
