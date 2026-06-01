# Execution Plan - Ola 2: De-mock integral de RRHH

Fecha: 2026-06-01
Repo: `Balles-Hosteleros`
Plan origen (Ola 1): `docs/rrhh-consolidacion/EXECUTION_PLAN.md`
Discovery base: barrido paralelo de 10 agentes el 2026-06-01 (ver `DISCOVERY_OLA2-*.md` en este directorio)

## Proposito

La Ola 1 (`TASK-001..008`) consolido el **nucleo** de RRHH: empleados, fichajes, firmas, reclutamiento (promocion) y solicitudes quedaron reales. Esta Ola 2 convierte en **real** todo lo que sigue siendo mock o esta a medias ("de adorno"), siguiendo la decision del responsable del proyecto: *llevar todo a produccion cuando sea posible, sin mas orden que la logica que dicte la construccion*.

Esto NO es una reescritura. Es:

- conectar a tablas reales lo que ya tiene tabla pero pinta mock (boarding, pagos, comunicados, calendarios/ausencias)
- construir el modelo de datos que falta (salarios, encuestas, formacion, ficha ampliada, festivos, roles, criterios)
- cerrar las "islas" reales que no se hablan entre si (horarios <-> fichajes)
- retirar `src/features/rrhh/data/rrhh.ts` como fuente de verdad (criterio global ya vigente de la Ola 1)
- documentar y reservar `accesos` (PRP-043) para ejecucion por Fernando

Cada submodulo tiene su `Full-TASK-OLA2-NN-*.md` (contrato ejecutable) y su `DISCOVERY_OLA2-NN-*.md` (estado real verificado). Este documento es el indice maestro, el grafo de dependencias y el registro de decisiones de negocio pendientes.

## Estado real de partida (consolidado del discovery)

Clasificacion verificada submodulo a submodulo (codigo como verdad, no docs):

| Submodulo | Clasificacion | Tabla real existe | Hallazgo clave |
| --- | --- | --- | --- |
| salarios | MOCK PURO | No (colisiona con `nominas`/`contratos`) | Tabla salarial **por puesto**, no por empleado. `efectivoExtra` = pago en B (riesgo legal). Lo consume `mi-panel/MisCondicionesView`. |
| bonus | MOCK PURO | `public.bonus` huerfana (010), schema divergente, nunca consultada | Importes son **texto libre** ("+15.000 EUR"), sin aritmetica. Depende de salarios. Sin fuente real de resultados. |
| calendarios | MOCK PURO | Parcial: `solicitudes_personal`, `tipos_ausencia`, `vacaciones` ya existen | Vacaciones/Bajas/Justificadas son una **vista calendario de datos que ya son reales** en `solicitudes_personal`. Solo **festivos** no tiene tabla. |
| ratios | MOCK PURO (derivado) | No propia; fuentes: `fichajes` (real), `pos_tickets` (real) | Vive en `/gerencia/ratios`. 2 de 4 fuentes ya reales. Bloqueado parcialmente por coste/hora (salarios) y por **reservas (no existe modulo)**. |
| formacion | MOCK PURO (x2) | No | DOS productos: portal "classroom" (`features/formacion`, Zustand+localStorage) + web-tour onboarding (`/formacion`) desconectada. Sin tablas. Progreso en localStorage. |
| boarding | MIXTO (roto) | `plantillas_boarding`, `procesos_boarding` (010) con RLS | La lectura **descarta a proposito** la BD y pinta mock. Escribe a columnas **inexistentes** (`created_by`, `updated_at`) -> fallos silenciosos en prod. ID empleado mock vs uuid. |
| pagos | MIXTO (sesgo mock) | `nominas` (026) **existe y no se usa** | Solo `listEmpleadosParaPagos` es real (identidad). Todos los importes son efimeros (`useState`, se pierden al recargar). No hay action de escritura. |
| horarios | MIXTO maduro (casi real) | 7 tablas con RLS, seed real BACANAL | `data/horarios.ts` ya **no tiene mock**. El gap real: es una **isla desconectada de `fichajes`** (horario teorico nunca se compara con lo fichado). `tipos_fichaje` sin consumir. |
| accesos | MIXTO + disonancia doc/codigo | `accesos_apps` (legacy, real) SI; modelo nuevo PRP-043 (3 tablas) **SIN migracion .sql** | Modelo nuevo committeado y live en `/accesos`, pero schema **no reproducible** y **RLS sin verificar** (riesgo de seguridad: revelado de credenciales). Reservado a Fernando. |
| solicitudes | **REAL** | `solicitudes_personal` (050) | No es anomalia: reutiliza `mi-panel-actions` cross-feature. Gap menor: la vista RRHH no crea ni anula. |
| comunicados | MOCK (Gerencia) | `comunicados` (009/052/093) **existe y la lee mi-panel** | De-mock = conectar `ComunicadosView` a la tabla real. Sin schema nuevo. |
| encuestas | MOCK | No | Gerencia (crear) + mi-panel (responder). El de-mock mas grande de los "nuevos": 5 tablas. |
| empleados-ficha | MOCK (ficha ampliada) | Parcial: `empleados`/`contratos` reales | Ficha extendida (formacion/contratos/documentos/evaluaciones/journey) mock sobre empleado real. |
| roles-empresa | MOCK + CLON | `empresa_roles` (033) existe | Duplicado: `rrhh/data/roles-empresa.ts` y `ajustes/data/roles-empresa.ts` (clon casi identico). Hay que unificar. |
| criteriosResena | MOCK (RAM) | No | Store volatil en memoria. De-mock ligero (1 tabla). |
| `data/rrhh.ts` | MOCK transversal | tabla `empleados` real | Provee `Empleado[]` mock a calendarios, bonus, boarding, formacion, cocina, gerencia. Debe retirarse (criterio global Ola 1). |

## Hallazgos transversales (afectan a varias tasks)

1. **`data/rrhh.ts` mock-empleados es el cordon umbilical**: media docena de submodulos leen empleados de aqui. Sustituirlo por una fuente real unica es prerrequisito de varios de-mocks -> `OLA2-01`.
2. **Slug vs UUID**: el contexto de empresa (`useEmpresa`) usa `empresaActual.id` = slug ("habana"/"bacanal"); las tablas reales usan `empresa_id uuid` (campo `dbId`). Toda action nueva debe recibir el **UUID (`dbId`)**, no el slug.
3. **RLS laxa `using(true) with check(true)`** en tablas legacy (boarding, bonus, turnos, ausencias de la migracion 010): multi-tenant roto en escritura. Endurecer en cada task que toque esas tablas.
4. **Schema real != migraciones** en dos sitios criticos: las 3 tablas del modelo nuevo de accesos (PRP-043) no tienen `.sql`; `rrhh_*` de horarios se crearon a mano en prod. **Verificar siempre con Management API antes de migrar** (regla de memoria del proyecto).
5. **Doble fuente de verdad de dinero**: `contratos.salario_bruto` + `empleados.salario_base` + `nominas` (reales, sin UI) coexisten con `data/salarios.ts` (mock por puesto). Hay que decidir quien manda antes de cablear pagos/bonus/ratios.
6. **Mock paralelo a tabla real ya existente**: comunicados, fichajes, firmas, empleados, accesos-apps tienen mock-admin que convive con datos reales. No "de-mockear" lo que ya es real; solo conectar la vista que aun mira el mock.
7. **Mucho "mock" es en realidad codigo muerto/huerfano** (hallazgo del discovery detallado, BUENA noticia): varias pantallas reales YA migraron y el mock quedo desconectado — la ficha de empleado real ya no usa `empleados-ficha.ts`/`perfilSections` (huerfanos); `PuestosEmpresaTab`/`RolFormModal` no estan montados y `ReclutamientoView` ya lee de Supabase; el listado de comunicados/encuestas descarta la BD a proposito. Implicacion: OLA2-03/09/10 son MAS PEQUENAS de lo temido — retirar mock y cablear lectura, no construir.
8. **Tablas que ya existian y nadie usaba** (deuda inversa): `nominas`, `puestos_trabajo.salario_base`, `contratos`/`evaluaciones`, la legacy `public.encuestas`, y la real `public.reservas`. Antes de crear schema nuevo, cada task verifica si la tabla ya existe (varias si) via Management API.

## TASKs

| Task | Full-TASK | Modo | Complejidad | Depende de | Corte |
| --- | --- | --- | --- | --- | --- |
| OLA2-01 | `Full-TASK-OLA2-01-empleados-reales-fuente-unica.md` | code | Media | — | Retirar `data/rrhh.ts` como fuente funcional; selector/listado de empleados reales reutilizable por todos los submodulos. |
| OLA2-02 | `Full-TASK-OLA2-02-salarios-reales.md` | code | Alta | — | Tabla salarial real + fuente de coste/hora; decidir frontera con `contratos`/`nominas`. Keystone de pagos/bonus/ratios. |
| OLA2-03 | `Full-TASK-OLA2-03-comunicados-reales.md` | code | Baja-Media | — | `ComunicadosView` (Gerencia) escribe/lee la tabla real `comunicados`. |
| OLA2-04 | `Full-TASK-OLA2-04-boarding-reparar-mixto.md` | code | Media | OLA2-01 | Reparar columnas faltantes, leer BD (no mock), reconciliar enums, RLS real, CRUD completo. |
| OLA2-05 | `Full-TASK-OLA2-05-calendarios-festivos-y-ausencias.md` | code | Media | (OLA2-14 coordinacion) | Crear `festivos`; ausencias = vista read-only de `solicitudes_personal`; config desde `tipos_ausencia`. |
| OLA2-06 | `Full-TASK-OLA2-06-pagos-sobre-nominas.md` | code | Media-Alta | OLA2-02 | Cablear pagos a `nominas` (persistencia real por periodo), derivar base de salarios/contratos, RLS por rol. |
| OLA2-07 | `Full-TASK-OLA2-07-encuestas-reales.md` | code | Alta | OLA2-01 | 5 tablas + crear (Gerencia) + responder (mi-panel), anonimato y una-respuesta. |
| OLA2-08 | `Full-TASK-OLA2-08-formacion-real-classroom-onboarding.md` | code | Alta | OLA2-01 | Unificar web-tour con classroom; 6 tablas + progreso + storage; onboarding persistente en `profiles`. |
| OLA2-09 | `Full-TASK-OLA2-09-empleados-ficha-ampliada.md` | code | Media | OLA2-01 | Reutiliza `contratos`/`evaluaciones`/`nominas` (ya existen); solo crea `empleado_journey` (+documentos por decidir). La ficha real ya migro: retirar mock huerfano sin romper. |
| OLA2-10 | `Full-TASK-OLA2-10-roles-empresa-unificar.md` | code | Baja-Media | — | Mayormente RETIRADA: el mock es huerfano (ReclutamientoView ya lee Supabase; PuestosEmpresaTab/RolFormModal sin montar) y `empresa_roles` ya es real. Decidir retirar vs persistir "puestos de empresa". |
| OLA2-11 | `Full-TASK-OLA2-11-criterios-resena-reales.md` | code | Baja | OLA2-10 | Tabla `criterios_resena` + CRUD; retirar store en RAM. |
| OLA2-12 | `Full-TASK-OLA2-12-bonus-reales.md` | code | Media | OLA2-02 | Reconciliar tabla huerfana, `bonus_resultados`/config, RLS; decision descriptivo vs calculo. |
| OLA2-13 | `Full-TASK-OLA2-13-ratios-reales-parcial.md` | code | Media | OLA2-02 | Calcular sobre fichajes+pos reales; reservas bloqueado (documentar/placeholder honesto). |
| OLA2-14 | `Full-TASK-OLA2-14-horarios-fichajes-integracion.md` | code | Media-Alta | — | Conectar horario teorico (turno/patron) con fichaje real; consumir `tipos_fichaje`. |
| OLA2-15 | `Full-TASK-OLA2-15-accesos-prp043-reservado-fernando.md` | discovery+code | Alta | — (reservado) | RESERVADO FERNANDO. Versionar migracion 3 tablas, verificar/definir RLS (seguridad), provisionar clave cifrado, retirar legacy. |

## Grafo de dependencias

```
OLA2-01 (empleados reales) --+--> OLA2-04 (boarding)
                             +--> OLA2-07 (encuestas: destinatarios)
                             +--> OLA2-08 (formacion: puesto real)
                             +--> OLA2-09 (ficha ampliada)

OLA2-02 (salarios) ----------+--> OLA2-06 (pagos: base)
                             +--> OLA2-12 (bonus)
                             +--> OLA2-13 (ratios: coste/hora)

OLA2-10 (roles) -----------------> OLA2-11 (criterios resena)

OLA2-05 (calendarios) <--coordina--> OLA2-14 (horarios) [turnos: evitar 3a duplicacion]

Sin bloqueo: OLA2-03, OLA2-10, OLA2-14
Reservado:   OLA2-15 (Fernando)
```

## Orden operativo (olas de ejecucion)

1. **Ola A - Fundaciones** (habilitan al resto): `OLA2-01`, `OLA2-02`. Pueden ir en paralelo (no se bloquean entre si).
2. **Ola B - Conexiones rapidas** (tabla ya existe): `OLA2-03`, `OLA2-04` (tras 01), `OLA2-05`, `OLA2-11` (tras 10). Bajo riesgo, alto valor visible.
3. **Ola C - Construccion nueva** (independientes): `OLA2-07` (tras 01), `OLA2-09` (tras 01), `OLA2-10`, `OLA2-08` (tras 01; la mas grande).
4. **Ola D - Dinero** (tras salarios): `OLA2-06`, `OLA2-12`, `OLA2-13`.
5. **Ola E - Cierre de islas**: `OLA2-14`.
6. **Reservado**: `OLA2-15` (Fernando, cuando quiera; la parte de seguridad RLS es **urgente** aunque la feature no se amplie).

El orden NO es rigido salvo por las flechas del grafo. Dentro de cada ola, priorizar por valor visible para el responsable del proyecto.

## Decisiones de negocio pendientes (requieren al responsable, no las decide el agente)

Estas son las bifurcaciones que el discovery dejo abiertas. Conviene resolverlas antes de ejecutar la task afectada:

- **D1 (salarios/pagos)**: fuente de verdad del salario -> `contratos.salario_bruto` (real, ya existe) vs tabla salarial nueva por puesto vs `nominas`. Afecta OLA2-02/06/12/13.
- **D2 (salarios)**: persistir `efectivoExtra` ("pago en B") en BD tiene implicaciones legales/fiscales. Confirmar si se almacena o se retira del modelo. Afecta OLA2-02.
- **D3 (bonus)**: el modulo solo persiste la **descripcion** del plan de bonus, o debe **calcular importes** (rediseno numerico). Afecta OLA2-12.
- **D4 (formacion)**: unificar la web-tour `/formacion` dentro del portal classroom (`/mi-panel/formacion`) o mantenerlas separadas. Afecta OLA2-08. Recomendacion del discovery: unificar.
- **D5 (calendarios)**: la pestana Vacaciones/Bajas/Justificadas es **read-only** sobre `solicitudes_personal`, o "Registrar..." debe **crear** una solicitud. Afecta OLA2-05.
- **D6 (ratios)**: CORREGIDO en discovery — la tabla `reservas` SI existe (009, con RLS y actions en `sala`). Lo bloqueado NO son las reservas sino la **prevision/desviacion/tendencia**, que exige historico de ano anterior del que la BD demo carece. Decidir: posponer prevision (placeholder honesto) o sembrar historico. Afecta OLA2-13.
- **D7 (turnos)**: la pestana Laboral de calendarios se mantiene o se delega al modulo Horarios real (evitar tercera duplicacion de turnos). Afecta OLA2-05/14.
- **D8 (horarios)**: alcance de la integracion con fichajes -> solo mostrar desviacion, o tambien validar/bloquear fichajes fuera de turno. Afecta OLA2-14.

## Criterios globales de corte (heredados de Ola 1 + nuevos)

- Ninguna task reintroduce `src/features/rrhh/data/rrhh.ts` como fuente funcional de verdad.
- Verificar **schema real en prod via Management API** antes de escribir o aplicar cualquier migracion (no inferir del codigo).
- Toda tabla nueva o tocada lleva **RLS multi-tenant real** por `empresa_id` (nunca `using(true) with check(true)`); datos sensibles (salarios/nominas/credenciales) con gating por rol.
- Las server actions reciben el **UUID de empresa (`dbId`)**, no el slug.
- Tabs sin backend real muestran placeholder honesto o acceso contextual, no simulacion de datos.
- Flujos de escritura criticos conservan try/catch, errores legibles y rollback donde aplique.
- Validacion por ejecutor: `npm run typecheck` y `npm run build` (via WSL `wsl -d Ubuntu bash -c`, NON-login). Smoke controlado donde el flujo lo permita.
- Commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes.
- Restaurar `next-env.d.ts` si el tooling lo modifica, salvo decision de versionarlo.
- No versionar peppers, claves SMTP, `CREDENCIALES_ENCRYPTION_KEY` ni service-role; viven en `.env.local`.

## Fuera de alcance

- No ampliar `accesos` (OLA2-15) salvo que Fernando lo pida; solo se documenta y se senala la deuda de seguridad.
- No crear historico sintetico de ventas/reservas para las previsiones de ratios; OLA2-13 muestra placeholder honesto donde falte historico real (la tabla `reservas` ya existe y se usa).
- No tocar el documento real productivo de firmas (`04d2db61...`) ni rotar peppers.
- No instalar dependencias en la raiz de la Forja; el trabajo de producto vive en `Balles-Hosteleros`.

## Decision de descomposicion

Se descompone por **madurez real + dependencia de datos**, no por pantalla:

- Lo que solo necesita **cablear a una tabla que ya existe** (comunicados, pagos, boarding, calendarios-ausencias) se separa de lo que exige **construir el modelo** (salarios, encuestas, formacion, ficha, festivos, roles, criterios).
- Las **fundaciones** (empleados reales, salarios) se aislan porque desbloquean a varias: empezarlas tarde encarece todo lo demas.
- El **dinero** (pagos/bonus/ratios) se agrupa detras de salarios porque comparten la fuente de coste y arrastran la decision D1.
- **Horarios** no es un de-mock de datos (ya es real) sino una **integracion** (isla -> conectada con fichajes); por eso es una task aparte, no un "hacer real".
- **Accesos** se mantiene reservado a Fernando (decision tomada en Ola 1) pero se documenta entero porque arrastra una **deuda de seguridad** (RLS sin verificar) que no debe quedar invisible.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md
