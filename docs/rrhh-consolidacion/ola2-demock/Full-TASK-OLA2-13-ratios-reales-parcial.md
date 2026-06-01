# Full-TASK-OLA2-13 - Ratios reales (parcial)

## Estado

PLANIFICADO Ola 2 (2026-06-01). No implementado. Discovery verificado en `DISCOVERY_OLA2-13-ratios-reales-parcial.md` (mismo directorio). Clasificacion confirmada: MOCK PURO derivado (la vista lee 100% de `data/ratios.ts` y calcula on-the-fly en cliente). De-mock **PARCIAL**: tres de las cuatro fuentes ya son tablas reales; lo unico bloqueado es prevision/desviacion/tendencia por falta de historico de ano anterior.

> Correccion al plan maestro: el `EXECUTION_PLAN_OLA2.md` (D6) afirma que no existe tabla/modulo de Reservas. **Falso contra el codigo:** `public.reservas` existe (migracion 009), tiene RLS y la usan actions vivas de Sala. Detalle en el discovery.

## Objetivo

Convertir el panel de ratios de `/gerencia/ratios` de mock a datos reales en lo que es calculable HOY: coste de personal (horas reales de `fichajes` x coste/hora de OLA2-02), facturacion real (`SUM(pos_tickets.total)`), reservas reales (`reservas`), y los ratios derivados (% RRHH, ratio facturacion, ratio reservas), con navegacion temporal real por rango. Tratar la **prevision/desviacion/tendencia** como bloqueo honesto (placeholder o columna oculta) hasta que exista historico de ano anterior suficiente. El calculo recibe el **UUID de empresa (`dbId`)** para `fichajes`/`pos_tickets` y el **slug** para `reservas` (clave divergente verificada).

## Estimacion de complejidad

**Media.** Justificacion: no requiere modelo de datos nuevo (las cuatro fuentes existen o se aportan), pero exige (a) agregaciones SQL correctas con filtros de estado y rango; (b) consumir la interfaz de OLA2-02 sin re-derivar coste; (c) reconciliar la clave divergente slug/uuid de `reservas`; (d) parametrizar navegacion temporal hoy decorativa; y (e) separar limpiamente lo calculable de lo bloqueado sin simular datos. No es un CRUD, es agregacion multi-fuente con una frontera de honestidad.

## Criterio de corte

La tarea esta COMPLETA cuando:

1. `RatiosView` consume una server action real (no `getRatiosPorEmpresa` del mock) que agrega `fichajes` + `pos_tickets` + `reservas` reales por empresa y rango.
2. El coste de personal proviene de `getCosteHoraPorEmpleado`/`getCosteHoraPorPuesto` de OLA2-02 (no se recalcula salario aqui).
3. % RRHH, ratio facturacion y ratio reservas se calculan sobre cifras reales y cuadran con la BD sembrada (smoke bacanal/habana).
4. La navegacion Dia/Semana/Mes/Trimestre y los botones `< >` afectan al rango consultado (dejan de ser decorativos).
5. Las pestanas de prevision (facturacion/reservas en `RatiosPrevisiones`) muestran **placeholder honesto** o solo la serie real (sin "previsto" inventado) mientras no haya historico; el `RecuadroMetodologia` refleja el estado real, no una promesa.
6. La consulta de `reservas` usa el **slug** y la de `fichajes`/`pos_tickets` el **uuid**; ningun filtro pasa la clave equivocada.
7. `data/ratios.ts` queda solo como fixture/seed o se elimina; ningun import de produccion lo usa para datos vivos.

Queda FUERA del corte: crear historico de ano anterior, construir un modulo de Reservas nuevo (ya existe), y endurecer la RLS de `reservas` (deuda transversal #3, se anota pero no se resuelve aqui salvo decision).

## Modo operativo

- **taskId:** OLA2-13
- **taskMode:** code
- **reviewMode:** standard
- **sourcePlan:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`

## Contexto previo obligatorio

Antes de tocar codigo, leer:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-13-ratios-reales-parcial.md` (estado real completo).
2. `docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-02-salarios-reales.md` — **CERRADA / interfaz a consumir.** De aqui salen `getCosteHoraPorEmpleado(empresaDbId)` y `getCosteHoraPorPuesto(empresaDbId)` y el tipo `CosteHoraPuesto`. Ratios depende de OLA2-02 y NO re-deriva coste.
3. `supabase/migrations/056_fichajes.sql`, `035_pos.sql`, `009_operativa_diaria.sql` (DDL real de las tres fuentes; ver matices de clave en el discovery).
4. `src/features/rrhh/data/ratios.ts` (forma de `SemanaRatio` que la UI espera; la action real debe devolver una forma compatible o adaptar los componentes).
5. `src/features/empresa/contexts/empresa-context.tsx` (`Empresa.id` = slug, `Empresa.dbId` = UUID) y `src/features/empresa/lib/empresa-server.ts` (`getEmpresaActivaForUser` devuelve el UUID).
6. `src/features/sala/actions/reservas-actions.ts` (`listReservasRango` como patron de lectura de reservas por rango/slug).
7. Resolver D6 (metrica reservas + origen de historico) y la decision de caching.

## Scope IN

- Server action(s) de agregacion real: coste de personal (horas `fichajes` x coste/hora OLA2-02), facturacion (`SUM(pos_tickets.total)` cobrados) y reservas (`COUNT`/`SUM(personas)`), por empresa y rango, agrupadas por dia y por area operativa/administrativa.
- Calculo real de % RRHH, ratio facturacion, ratio reservas (por dia y global).
- Navegacion temporal real: el rango (dia/semana/mes/trimestre + desplazamiento) se traduce a `[fechaDesde, fechaHasta]` y se pasa a la action.
- Refactor de `RatiosView.tsx` para consumir la action por `empresaActual.dbId` (+ slug para reservas) en vez de `getRatiosPorEmpresa(empresaActual.id)`.
- Adaptacion de `RatiosTablaPersonal.tsx` para datos reales por puesto/area (mapeo area desde `departamento`, coordinado con OLA2-01).
- En `RatiosPrevisiones.tsx`: mostrar la serie **real** y degradar la parte "previsto"/desviacion a placeholder honesto mientras no haya historico; ajustar `RecuadroMetodologia` al estado real.
- Mapeo puesto/empleado -> area `operativa | administrativa` derivado de `departamento` (no hardcode).
- `data/ratios.ts` pasa a fixture/seed o se elimina de produccion.

## Scope OUT

- Crear un **modulo de Reservas** nuevo (ya existe; solo se consume su tabla).
- Generar/poblar **historico de ano anterior** de facturacion o reservas (sin el, la prevision queda como placeholder).
- Calcular previsiones/tendencias "reales" (bloqueado por el historico; no se simula).
- Endurecer la RLS `using(true) with check(true)` de `reservas` (deuda transversal #3): se anota como riesgo; solo se aborda si el negocio lo decide en esta task.
- Modificar `salarios`/`contratos`/`nominas` o la formula de coste/hora (es OLA2-02; aqui solo se consume).
- Snapshot/materializacion obligatoria de POS (solo se documenta como opcion si el volumen lo exige).

## Restricciones

- TS estricto; Feature-First. La logica de agregacion vive en `src/features/rrhh/actions/ratios-actions.ts` (mutaciones/lecturas server-side bajo `"use server"`); los componentes siguen en `gerencia/` y `rrhh/components/ratios/`.
- **VERIFICAR SCHEMA REAL via Management API antes de consultar/escribir.** No inferir columnas de `fichajes`/`pos_tickets`/`reservas` solo del DDL del repo; confirmar tipos (especialmente `reservas.empresa_id text` vs `uuid` en las otras dos) y estados validos antes de fijar los filtros.
- `fichajes` y `pos_tickets` se filtran por `empresa_id = empresaDbId` (UUID); `reservas` por `empresa_id = slug`. Nunca cruzar las claves.
- Consumir la interfaz de OLA2-02 para el coste; prohibido recalcular salario o leer `contratos`/`nominas` directamente desde ratios.
- No simular datos en pestanas bloqueadas: placeholder honesto o serie real parcial (criterio global "tabs sin backend real muestran placeholder honesto, no simulacion").
- Lecturas server-side con `try/catch` y errores legibles; degradacion limpia si una fuente falla (p.ej. reservas vacias -> ratio reservas = n/d, no crash).
- Si se introduce snapshot, su migracion es idempotente (`create table if not exists`, `drop policy if exists`) con RLS multi-tenant real por `empresa_id`.

## Validacion requerida

- `npm run typecheck` y `npm run build` (en WSL, `wsl -d Ubuntu bash -c`, NON-login) en verde.
- Smoke con datos sembrados: para bacanal y habana, % RRHH y ratios cuadran con un calculo manual sobre las filas reales de `fichajes`/`pos_tickets`/`reservas`.
- La navegacion temporal cambia las cifras (verificar dos rangos distintos devuelven resultados distintos).
- Las pestanas de prevision NO muestran numeros inventados de "previsto" cuando no hay historico.
- La consulta de reservas devuelve filas con el **slug** (no vacio por pasar uuid).
- RLS: un usuario de otra empresa no ve cifras cruzadas (lectura ya acotada por empresa en las tres tablas).

## Dependencias

- **Depende de:** OLA2-02 (salarios reales) — **CERRADA**. Provee `getCosteHoraPorEmpleado`/`getCosteHoraPorPuesto`. Sin esa interfaz, el coste de personal no es real.
- **Coordina con:** OLA2-01 (empleados reales / derivacion de area desde `departamento`) para el mapeo operativa/administrativa.
- **Bloquea a:** nada aguas abajo.
- **Bloqueo externo (parcial):** prevision/desviacion/tendencia dependen de historico de ano anterior inexistente en la BD demo (no es una task, es un dato).
- Reutiliza infra: `fichajes` (056), `pos_tickets` (035), `reservas` (009), `getAppContext`/`createAdminClient`, `empresa-context`, `listReservasRango` (patron Sala).

## Inputs

- `empresaActual.dbId` (UUID) y `empresaActual.id` (slug) desde `empresa-context`.
- Rango temporal `[fechaDesde, fechaHasta]` derivado de la navegacion (dia/semana/mes/trimestre + offset).
- Coste/hora desde OLA2-02 (`getCosteHoraPorEmpleado(empresaDbId)` / `getCosteHoraPorPuesto(empresaDbId)`).
- Schema real (via Management API) de `fichajes`, `pos_tickets`, `reservas`.
- Decisiones D6 (metrica reservas + origen historico) y de caching resueltas.
- Mock actual `data/ratios.ts` (forma `SemanaRatio`, candidato a fixture; referencia de la forma que la UI espera).

## Outputs esperados

- `src/features/rrhh/actions/ratios-actions.ts` (NUEVO — server actions de agregacion; firmas en "Interfaces publicas propuestas").
- `RatiosView.tsx` refactorizado: consume la action por `dbId`+slug y rango; navegacion real.
- `RatiosTablaPersonal.tsx` y `RatiosPrevisiones.tsx` adaptados a datos reales; prevision como placeholder honesto.
- `RecuadroMetodologia` actualizado al estado real (deja de prometer un calculo que no se ejecuta).
- (Opcional, solo si el volumen POS lo exige) migracion de snapshot diario `0NN_ratios_snapshot.sql` con RLS.
- `data/ratios.ts` reducido a fixture/seed o eliminado de produccion.
- Actualizacion del estado de este Full-TASK (a IMPLEMENTADO) y auto-blindaje al cerrar.

## Riesgos conocidos

- **Clave divergente slug/uuid:** `reservas.empresa_id` es `text` (slug) frente a `uuid` en `fichajes`/`pos_tickets`. Pasar el uuid a `reservas` devuelve vacio silenciosamente. Mitigacion: firma que recibe ambos; tests que verifican filas devueltas.
- **Prevision sin historico = numeros inventados:** si se conecta "previsto" a algo que no existe, se miente al usuario. Mitigacion: placeholder honesto / serie real parcial hasta que haya historico; nunca derivar de mock.
- **Filtro de estados mal puesto:** incluir tickets `ANULADO` o reservas canceladas falsea ratios. Mitigacion: filtrar `pos_tickets` cobrados y `reservas` por estados efectivos (verificar enums reales).
- **Coste/hora ausente o etiquetado debil:** si OLA2-02 no tiene datos para un puesto, el coste sale incompleto. Mitigacion: usar `fuente` (`nomina`>`contrato`>`plantilla`) y marcar puestos sin coste; degradar, no crashear.
- **Coste de agregacion POS:** muchos tickets x rango amplio (trimestre) puede ser lento. Mitigacion: agregacion SQL (`SUM`/`GROUP BY date`) server-side; snapshot opcional documentado.
- **Mapeo area fragil:** si `departamento` no esta normalizado, operativa/administrativa sale mal. Mitigacion: coordinar con OLA2-01; fallback a "sin clasificar".
- **Acoplamiento a la forma `SemanaRatio`:** la UI espera ese shape; cambiarlo arrastra los 3 componentes. Mitigacion: que la action devuelva una forma compatible o refactor coordinado.
- **RLS laxa de `reservas` (escritura):** no afecta a la lectura de ratios, pero es deuda viva (#3). Anotar.

## Modelo de datos propuesto

> **VERIFICAR SCHEMA REAL via Management API antes de consultar.** Confirmar tipos y estados de `fichajes`, `pos_tickets`, `reservas`; en especial que `reservas.empresa_id` sigue siendo `text` (slug) y las otras dos `uuid`.

**Probablemente SIN tabla propia.** Ratios es derivado: el camino por defecto es **calculo on-the-fly** mediante agregaciones, sin persistir nada. Las tres fuentes ya estan indexadas por `(empresa_id, fecha)` / `(empresa_id, abierto_at)`, lo que hace barata la agregacion por rango.

Agregaciones reales (pseudo-SQL, adaptar a esquema verificado):

```sql
-- Horas de personal por dia y empleado (coste = horas x coste/hora de OLA2-02)
select f.fecha, f.empleado_id, f.departamento, sum(f.horas_totales) as horas
from public.fichajes f
where f.empresa_id = :empresaDbId            -- UUID
  and f.fecha between :desde and :hasta
group by f.fecha, f.empleado_id, f.departamento;
-- coste_dia_empleado = horas * costeHoraEmpresa(empleado)  [de getCosteHoraPorEmpleado]

-- Facturacion real por dia
select date(t.cerrado_at) as fecha, sum(t.total) as facturacion
from public.pos_tickets t
where t.empresa_id = :empresaDbId            -- UUID
  and t.estado = 'COBRADO'                    -- VERIFICAR estados a incluir
  and t.cerrado_at::date between :desde and :hasta
group by date(t.cerrado_at);

-- Reservas reales por dia (metrica D6: COUNT vs SUM(personas))
select r.fecha, count(*) as reservas, sum(r.personas) as comensales
from public.reservas r
where r.empresa_id = :empresaSlug            -- !! SLUG (text), no uuid
  and r.fecha between :desde and :hasta
  and r.estado not in (/* canceladas/no-show, VERIFICAR ESTADOS_RESERVA */)
group by r.fecha;
```

Derivados (en la action, ya en TS):
- `% RRHH (dia)` = `coste_personal_dia / facturacion_dia * 100`.
- `ratio facturacion` = `coste_total / facturacion_total * 100`.
- `ratio reservas` = `coste_total / reservas_total * 100`.
- `area` por empleado/puesto desde `departamento` (mapa operativa/administrativa coordinado con OLA2-01).

**Opcion snapshot (NO por defecto, solo si el volumen POS lo exige):** tabla `ratios_snapshot(empresa_id uuid, fecha date, coste numeric, facturacion numeric, reservas int, ...)` poblada por job/cron, con RLS multi-tenant por `empresa_id` y unique `(empresa_id, fecha)`. Util tambien como semilla futura de historico para la prevision. Migracion idempotente estilo `056_*`. **VERIFICAR SCHEMA REAL** si se materializa.

## Interfaces publicas propuestas

Archivo: `src/features/rrhh/actions/ratios-actions.ts` (`"use server"`, patron `getAppContext` + `createAdminClient` + `try/catch` + retorno `{ ok, data?, error? }`). Recibe el **UUID** para fichajes/pos y el **slug** para reservas.

```ts
export interface RangoRatios {
  desde: string;          // YYYY-MM-DD
  hasta: string;          // YYYY-MM-DD
  granularidad: "dia" | "semana" | "mes" | "trimestre";
}

// Agregacion real. Devuelve una forma compatible con SemanaRatio (o un superset),
// ya con coste resuelto via OLA2-02 y reservas por slug.
// empresaDbId = empresaActual.dbId (UUID); empresaSlug = empresaActual.id (slug).
export async function getRatiosSemana(
  empresaDbId: string,
  rango: RangoRatios,
  empresaSlug?: string,            // necesario para la tabla reservas (text/slug)
): Promise<{ ok: boolean; data: SemanaRatioReal | null; error?: string }>;

// Estructura de salida (extiende la SemanaRatio del mock, marcando lo que NO hay historico)
export interface SemanaRatioReal {
  fechaInicio: string;
  fechaFin: string;
  filas: FilaRatio[];                       // coste/horas reales por puesto/area
  facturacionDiaria: Record<string, number>;
  facturacionTotal: number;
  reservasDiarias: Record<string, number>;
  reservasRealesTotal: number;
  // Prevision: opcional. null/ausente => placeholder honesto (sin historico).
  previsiones?: DiaPrevisiones[] | null;
  prevision: { disponible: false; motivo: "sin_historico_ano_anterior" }
           | { disponible: true; /* ... */ };
  fuenteCoste: "nomina" | "contrato" | "plantilla" | "mixta";  // de OLA2-02
}
```

`RatiosView.tsx`: sustituir `const semana = useMemo(() => getRatiosPorEmpresa(empresaActual.id), ...)` por una carga (server action / RSC) de `getRatiosSemana(empresaActual.dbId, rango, empresaActual.id)`, con `rango` derivado del estado de navegacion.

## Flujo operativo esperado (fases)

1. **Fase 1 — Calculable YA (nucleo real).** Implementar `ratios-actions.ts`: agregar `fichajes` (horas) + `pos_tickets` (facturacion) + `reservas` (count/personas) por empresa y un rango fijo de semana; resolver coste con `getCosteHoraPorEmpleado` (OLA2-02); calcular % RRHH y ratios; mapear area desde `departamento`. Refactor `RatiosView`/`RatiosTablaPersonal` para consumir esto. Las pestanas de prevision quedan ya degradadas a placeholder. Verificar typecheck+build+smoke. **Este es el entregable de valor minimo.**
2. **Fase 2 — Navegacion temporal real.** Derivar `[desde, hasta]` de la vista (dia/semana/mes/trimestre) y los botones `< >`; pasarlo a la action; confirmar que cambiar de rango cambia cifras. Retirar el caracter decorativo de los controles.
3. **Fase 3 — Bloqueo de reservas/prevision honesto.** Cerrar la presentacion: `RatiosPrevisiones` muestra solo la serie real (o placeholder) sin "previsto" inventado; `RecuadroMetodologia` explica que la prevision se activara cuando exista historico. Documentar la deuda (historico + RLS reservas). Opcional: introducir `ratios_snapshot` si el volumen POS lo justifica y como semilla de historico futuro.

## Decisiones de negocio pendientes

- **D6 (reformulada) — Reservas y prevision.** El plan maestro asumia "no existe modulo Reservas"; **la tabla `reservas` SI existe y es real**. Lo que queda por decidir: (a) la **metrica** de reservas para el ratio: `COUNT(*)` (numero de reservas) vs `SUM(personas)` (comensales); (b) de donde sale el **historico de ano anterior** para la prevision (POS quiza acumule; reservas demo no lo tiene) — sin el, la prevision es placeholder. **Recomendacion del agente:** Fase 1+2 con metrica = `COUNT(*)` (y exponer `comensales` como secundario); prevision deshabilitada hasta tener >=1 ano de historico real.
- **Caching / materializacion.** ¿Calculo on-the-fly siempre, o snapshot diario? **Recomendacion:** on-the-fly por defecto (las tablas estan indexadas por fecha); reevaluar snapshot solo si el rango trimestral sobre `pos_tickets` se vuelve lento en datos reales. El snapshot tiene el beneficio colateral de sembrar historico para la prevision.
- **Filtro de estados (POS y reservas).** Que estados de `pos_tickets` cuentan como facturacion (recomendado: `COBRADO`, excluir `ANULADO`) y que estados de `reservas` cuentan como reserva efectiva (excluir canceladas/no-show). Confirmar contra los enums reales.
- **RLS de `reservas` (transversal #3).** ¿Se endurece la politica `using(true) with check(true)` en esta task o se deja a una task de seguridad? Solo lectura afecta a ratios; la decision es del negocio.

## Paths del proyecto

- `src/app/(main)/gerencia/ratios/page.tsx` (ruta).
- `src/features/gerencia/components/RatiosView.tsx` (contenedor a refactorizar).
- `src/features/rrhh/components/ratios/RatiosTablaPersonal.tsx` (tabla coste/% RRHH).
- `src/features/rrhh/components/ratios/RatiosPrevisiones.tsx` (comparativa + `RecuadroMetodologia`; degradar prevision).
- `src/features/rrhh/data/ratios.ts` (mock actual; futuro fixture/seed).
- `src/features/rrhh/actions/ratios-actions.ts` (NUEVO — server actions de agregacion).
- `src/features/rrhh/actions/salarios-actions.ts` (OLA2-02; interfaz de coste/hora a consumir).
- `supabase/migrations/056_fichajes.sql`, `035_pos.sql`, `009_operativa_diaria.sql` (fuentes reales).
- `src/features/sala/actions/reservas-actions.ts` (patron `listReservasRango`).
- `src/features/empresa/contexts/empresa-context.tsx`, `src/features/empresa/lib/empresa-server.ts` (slug vs dbId).
- `supabase/migrations/0NN_ratios_snapshot.sql` (OPCIONAL — solo si se materializa).

## Agentes recomendados

- **generate-data-access-layer** — capa de actions/agregacion consistente con el patron del repo.
- **detect-overarchitecture** — confirmar que NO se crea tabla/snapshot innecesario (ratios es derivado).
- **review-rls-multi-tenant** — verificar que la lectura no cruza empresas y anotar la deuda de `reservas` (write `using(true)`).
- **execute-phase** — ejecucion por fases (1 nucleo, 2 navegacion, 3 honestidad de prevision).
- (Consulta a negocio para D6 y filtro de estados antes de fijar metricas.)

## Checklist de cierre

- [ ] Schema real verificado via Management API (tipos de `empresa_id` en las tres tablas, estados de POS/reservas).
- [ ] D6 (metrica reservas + historico) y filtro de estados resueltos por escrito.
- [ ] `ratios-actions.ts` implementado: agrega `fichajes` + `pos_tickets` + `reservas` por empresa y rango.
- [ ] Coste de personal via `getCosteHoraPorEmpleado`/`getCosteHoraPorPuesto` (OLA2-02), no recalculado.
- [ ] `reservas` consultada con slug; `fichajes`/`pos_tickets` con uuid (sin cruzar claves).
- [ ] % RRHH y ratios cuadran con calculo manual (smoke bacanal/habana).
- [ ] Navegacion Dia/Semana/Mes/Trimestre + `< >` afecta al rango real.
- [ ] Prevision/desviacion = placeholder honesto o serie real parcial (sin numeros inventados); `RecuadroMetodologia` realista.
- [ ] Mapeo area operativa/administrativa derivado de `departamento` (coordinado con OLA2-01).
- [ ] `data/ratios.ts` fuera de produccion (fixture/seed o eliminado).
- [ ] (Si aplica) migracion `ratios_snapshot` idempotente con RLS.
- [ ] `npm run typecheck` + `npm run build` en verde (WSL).
- [ ] Estado de este Full-TASK actualizado a IMPLEMENTADO + auto-blindaje declarado.

## Siguiente paso sugerido

Confirmar D6 (metrica de reservas + que NO hay historico de ano anterior) y el filtro de estados con el negocio; en paralelo, verificar via Management API los tipos reales de `empresa_id` en `fichajes`/`pos_tickets`/`reservas`. Con eso, ejecutar la **Fase 1** (agregacion real de coste/facturacion/reservas + % RRHH, consumiendo OLA2-02) con `generate-data-access-layer`, validando que NO se sobre-modela con `detect-overarchitecture`. Si se prefiere granularidad, descomponer con `/plan-to-tasks`.

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-13-ratios-reales-parcial.md`
