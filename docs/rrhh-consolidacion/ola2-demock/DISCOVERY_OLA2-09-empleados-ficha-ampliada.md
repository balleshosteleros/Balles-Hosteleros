# DISCOVERY OLA2-09 - Ficha de empleado ampliada

- Fecha: 2026-06-01
- Repo: `Balles-Hosteleros`
- Task: OLA2-09 (code / Alta / depende de OLA2-01)
- Plan origen: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- Metodo: lectura directa de codigo y migraciones `.sql` (codigo como verdad, no docs). El schema PROD se confirma con Management API antes de tocar BD.

## Resumen ejecutivo

La "ficha ampliada" es **MOCK parcial sobre empleado real**, pero el solapamiento con datos ya reales es mucho mayor de lo que sugeria el plan maestro. Hallazgo central: **la pagina de ficha real ya NO consume el mock** para el bloque principal, y **las tablas hijas que el plan daba por crear (`evaluaciones`, `contratos`) YA EXISTEN** desde la migracion 026. El de-mock real se reduce a: cablear contratos/evaluaciones reales en la UI, coordinar formacion con OLA2-08, decidir documentos (reuso vs nuevo) y crear **una sola** tabla nueva inexistente: `empleado_journey`.

## Estado real verificado

### 1. El mock: `src/features/rrhh/data/empleados-ficha.ts` (191 lineas)

Tipo `FichaEmpleado` 1:1 con el empleado, con sub-bloques:

- `datosPersonales` (`DatosPersonales`): tipo/numero identificacion (x2), nacionalidad, estado civil, fecha nacimiento, genero, compartirCumple.
- `direccion` (`Direccion`): domicilio, CP, localidad, provincia, pais.
- `contacto` (`Contacto`): email empresa/personal, telefono empresa/personal, email notificaciones.
- `datosLaborales` (`DatosLaborales`): puesto, departamento, centro, fecha alta, estado, responsable, tipo contrato, jornada, salario bruto anual, coste/hora, horario base.
- `camposPersonalizados`: `Record<string,string>`.
- `formacion[]` (`Formacion`), `habilidades[]` (string), `journey[]` (`JourneyHito`), `accesos[]` (string), `roles[]` (string), `contratos[]` (`ContratoEmpleado`), `documentos[]` (`DocumentoEmpleado`), `evaluaciones[]` (`EvaluacionEmpleado`).

Datos hardcodeados en `HABANA_FICHAS` (h1,h2) y `BACANAL_FICHAS` (b1,b2) con **ids mock** ("h1"/"b1"), `generarFichaDefault(id)` y getter `getFichaEmpleado(empresaId, empleadoId)`. Todo en memoria, sin persistencia.

### 2. Consumidores reales del mock (CRITICO: la ficha ya migro)

- `src/app/(main)/rrhh/empleados/[id]/page.tsx` (pagina real de ficha, 301 lin): **NO importa `empleados-ficha.ts`**. Carga empleado real con `getEmpleadoConPerfil(id)`, fichajes/solicitudes/horario reales, y la pestana **"Perfil" ya usa `DatosPersonalesForm` (mi-panel) en modo editable** contra `guardarPerfilEmpleado`. Las demas pestanas montadas (`FichajesTab`, `HorariosTab`, `SolicitudesEmpleadoTab`, `FirmasEmpleadoTab`) son **reales**; el resto son `SubmoduloPorEmpleadoPlaceholder` (placeholders honestos). **No monta** las secciones mock de datos personales/contratos/documentos/evaluaciones/journey.
- `src/features/rrhh/components/empleados/perfilSections.tsx`: define `DatosPersonalesSection`, `DatosLaboralesSection`, `CamposPersonalizadosSection`, `FormacionSection`, `JourneySection`, `AccesosSection`, `RolesSection`, etc. Importan `type FichaEmpleado` y leen el mock. **Estan definidas pero ya no se montan** desde la pagina actual (son codigo huerfano de una version anterior de la ficha).
- `src/features/rrhh/components/empleados/FichaTabsContent.tsx`: define `ContratosTab`, `DocumentosTab`, `EvaluacionesTab` que reciben `ficha: FichaEmpleado` (mock); y `FichajesTab`/`HorariosTab`/`SolicitudesEmpleadoTab` que ya son reales (reciben datos de actions). Las 3 primeras **no se montan** hoy.

Consecuencia: el de-mock no es "sustituir lo que se ve" (el bloque visible ya es real), sino **reconstruir contratos/evaluaciones/documentos/journey como pestanas reales** y **retirar el mock y las secciones huerfanas** sin romper lo ya real.

### 3. BD existente reutilizable (verificado en migraciones)

**`profiles` (migraciones 061/063/069) YA CONTIENE practicamente todos los datos personales de la ficha:**
- `tipo_documento` (check DNI/NIE/PASAPORTE), `dni_nie`, `fecha_nacimiento`, `nacionalidad`, `genero` (check), `estado_civil` (check), `numero_ss`.
- Contacto: `telefono`, `telefono_secundario`, `telefono_empresa`, `email_personal`, `email_empresa`.
- Direccion completa: `direccion`, `codigo_postal`, `ciudad`, `provincia`, `pais`.
- Banca, emergencia, permiso de trabajo, `carnet_manipulador`, `talla_camiseta`, `talla_pantalon`, `alergias`, `datos_personales_actualizado_at`.

Es decir: `datosPersonales`, `direccion`, `contacto` del mock **mapean 1:1 a columnas ya existentes en `profiles`**. Lectura via `getEmpleadoConPerfil` (empleados-actions.ts:408) -> `DatosPersonalesCompletos`; escritura via `guardarPerfilEmpleado` (empleados-actions.ts:598, gate `requireAdminUser` + scope por empresa). **No hay que crear nada de datos personales.**

**`empleados` (026/065):** tabla maestra real con datos base + `puesto`, `puesto_id`, `departamento_id`, `fecha_alta`, `estado`, `tipo_jornada`, `jefe_directo_id`, `avatar_url`. Es el ancla 1:1 de la ficha.

**`contratos` (026) YA EXISTE** — `contratos[]` debe leer de aqui, NO crear tabla. Columnas: `empleado_id` (FK), `tipo` (check Indefinido/Temporal/Por obra/Formacion/Practicas/Relevo), `fecha_inicio`, `fecha_fin`, `salario_bruto`, `jornada_horas`, `grupo_cotizacion`, `categoria_profesional`, `convenio`, `estado` (check Vigente/Finalizado/Rescindido/Prorrogado), `documento_url`, `created_by`. RLS por `empresa_id` (laxa: `cont_manage` = cualquier miembro de la empresa; endurecer a rol RRHH/Direccion).

**`evaluaciones` (026) YA EXISTE** — el plan maestro hablaba de crear `empleado_evaluaciones`; **es innecesario**, hay tabla rica: `empleado_id`, `evaluador_id`, `periodo`, `tipo` (check Mensual..Anual/Prueba periodo), puntuaciones 1-5 (`puntualidad`/`actitud`/`calidad_trabajo`/`trabajo_equipo`/`iniciativa`), `puntuacion_media`, textos (`puntos_fuertes`/`areas_mejora`/`objetivos_siguiente`/`comentarios`), `estado` (Borrador/Completada/Firmada), `fecha_evaluacion`. RLS por `empresa_id`. **Reutilizar.**

**`vacaciones`, `nominas`, `departamentos`, `puestos_trabajo` (026):** existen y son reales; la ficha puede componerlos como derivados de solo lectura (p.ej. salario/coste de `contratos`+`nominas`).

### 4. Dominio "documentos": NO confundir con la ficha

`documentos` + `carpetas_documentos` (migraciones 095/096/098) son del modulo **Direccion -> Documentacion** (estilo Google Drive por empresa): carpetas planas (CONTRATOS/FISCALIDAD/ANTIGUOS sembradas por trigger), `documentos.carpeta_id` FK obligatoria, bucket privado `documentacion` con path `<empresa_id>/<carpeta_id>/<file>`, cuotas y whitelist MIME. **NO tienen `empleado_id`** -> no son documentos por empleado. `documentos_juridicos` (032) es del dominio juridico. Por tanto los "documentos de la ficha" son **otro dominio**; ver decision DN-1.

### 5. Tablas/columnas inexistentes (verificado: no hay match en `supabase/migrations/`)

- `empleado_journey` / `journey` (hitos del trabajador): **no existe en ninguna parte**. Es la unica tabla genuinamente nueva.
- `empleado_documentos` / `empleado_evaluaciones`: **no existen** (y `empleado_evaluaciones` no hace falta: usar `evaluaciones`).
- `habilidades`, `campos_personalizados`/`camposPersonalizados`: **no existen** como tabla ni columna. Candidatos a `jsonb`/`text[]` en `empleados` o tablas hijas ligeras.

### 6. Dependencias cruzadas confirmadas

- **OLA2-01** (empleados reales como fuente unica): cerrada por contrato; aporta `getEmpleadosActivos`/ids uuid reales. La ficha usa ids uuid reales (la pagina ya navega por `empleados.id`).
- **OLA2-08** (formacion real): crea el modelo de formacion (classroom + progreso + storage). `formacion[]` de la ficha **debe leer de ahi**, NO duplicar tablas de formacion.
- **OLA2-10** (roles): `roles[]`/`accesos[]` de la ficha tocan el dominio de roles/accesos que OLA2-10 (roles) y OLA2-15/PRP-043 (accesos) gobiernan. La ficha **lee**, no redefine ese modelo.

## Clasificacion final

MOCK parcial con **alto solapamiento real ya implementado**. El esfuerzo neto:
- REUTILIZAR (sin crear): `profiles` (personales), `empleados` (base), `contratos`, `evaluaciones`, `vacaciones`/`nominas` (derivados), formacion (OLA2-08), roles/accesos (OLA2-10/15).
- CREAR: solo `empleado_journey` (+ resolver documentos por empleado y campos personalizados/habilidades como jsonb o tablas ligeras).
- RETIRAR: `data/empleados-ficha.ts` y las secciones/tabs huerfanos que lo consumen.

## Riesgos detectados

1. **Duplicar tablas ya existentes** (`contratos`, `evaluaciones`) por seguir literalmente el plan maestro. Mitigacion: reusar 026; el plan se actualiza con este discovery.
2. **Romper lo ya real**: la pestana Perfil real (`DatosPersonalesForm`) y las tabs reales (fichajes/horarios/solicitudes/firmas) no deben tocarse al retirar el mock.
3. **Documentos por empleado**: si se reusa `documentos` (095/096) hay que anadir vinculo a empleado (carpeta por empleado o columna `empleado_id`), lo que altera un modulo de Direccion en produccion. Si se crea `empleado_documentos` se duplica infra de storage/cuotas. Decision de negocio DN-1.
4. **RLS de privacidad**: datos personales sensibles. `cont_manage`/`eval_manage`/`emp_manage` de 026 son laxas (cualquier miembro de la empresa escribe). Endurecer a rol RRHH/Direccion + permitir al propio empleado ver su ficha (su `profiles` ya lo permite por `user_id`).
5. **Slug vs uuid**: toda action nueva recibe `dbId` (uuid) o resuelve empresa activa server-side; nunca el slug.
6. **Schema real != migraciones**: confirmar con Management API que `contratos`/`evaluaciones` en PROD tienen el DDL de 026 y que `profiles` tiene las columnas 061/063/069 antes de cablear.

## Fuentes (paths leidos)

- `src/features/rrhh/data/empleados-ficha.ts`
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`
- `src/features/rrhh/components/empleados/perfilSections.tsx`
- `src/features/rrhh/components/empleados/FichaTabsContent.tsx`
- `src/features/rrhh/actions/empleados-actions.ts` (`getEmpleadoConPerfil`:408, `guardarPerfilEmpleado`:598, `DatosPersonalesCompletos`)
- `src/features/mi-panel/actions/datos-personales-actions.ts` (`guardarDatosPersonales`/`cargarDatosPersonales`)
- `supabase/migrations/026_rrhh_empleados.sql` (empleados, contratos, nominas, vacaciones, evaluaciones, departamentos, puestos)
- `supabase/migrations/061_profile_datos_personales.sql`, `063_profile_telefono_email_empresa.sql`, `069_profile_tallas_uniforme.sql`
- `supabase/migrations/095_carpetas_documentos.sql`, `096_documentos_storage.sql`, `098_carpetas_subcarpetas.sql`
- `supabase/migrations/065_rrhh_empleados.sql`, `032_juridico_documentos.sql`
- Confirmacion de inexistencia: `grep` sin match para `empleado_journey|empleado_documentos|empleado_evaluaciones|habilidades|campos_personalizados` en `supabase/migrations/`.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-09-empleados-ficha-ampliada.md
