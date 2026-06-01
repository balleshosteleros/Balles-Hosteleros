# DISCOVERY OLA2-13 - Ratios reales (parcial)

- **taskId:** OLA2-13
- **submodulo:** ratios (vive en Gerencia: `/gerencia/ratios`)
- **clasificacion:** MOCK PURO (derivado de mock; calculo on-the-fly en cliente)
- **fecha verificacion:** 2026-06-01 (codigo como verdad, no docs)
- **depende de:** OLA2-02 (coste/hora) — ya redactada
- **sourcePlan:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`

## Resumen ejecutivo

Ratios es un **panel derivado**: no tiene datos propios, los calcula a partir de cuatro fuentes (horas de personal, coste/hora, facturacion, reservas). Hoy las cuatro salen 100% de un mock estatico (`data/ratios.ts`), pero **tres de las cuatro fuentes ya existen como tablas reales** en Supabase. La parte realmente bloqueada NO es "reservas" como se creia en el plan maestro, sino la **prevision/desviacion** (real vs previsto), que exige historico del ano anterior del que la BD demo carece.

> **CORRECCION AL PLAN MAESTRO (D6).** El `EXECUTION_PLAN_OLA2.md` y la decision D6 afirman que "el modulo de Reservas NO existe / no hay tabla". **Es falso contra el codigo actual.** La tabla `public.reservas` existe (migracion `009_operativa_diaria.sql`), tiene RLS, y la consumen server actions vivas del modulo Sala (`src/features/sala/actions/reservas-actions.ts`, `analitica-origen-actions.ts`) y la captacion publica (`reservar-publica`). Lo que falta no es la tabla, sino: (a) historico de ano anterior para la prevision, y (b) que `reservas.empresa_id` es `text` (slug), no `uuid`. Ver "Reservas" abajo.

## Donde vive (verificado)

| Archivo | Lineas | Rol |
| --- | --- | --- |
| `src/app/(main)/gerencia/ratios/page.tsx` | — | Ruta. Monta el contenedor. |
| `src/features/gerencia/components/RatiosView.tsx` | 86 | Contenedor cliente (`"use client"`). KPIs + tabs. |
| `src/features/rrhh/components/ratios/RatiosTablaPersonal.tsx` | 149 | Tabla coste/horas por puesto/dia + % RRHH. |
| `src/features/rrhh/components/ratios/RatiosPrevisiones.tsx` | 263 | Comparativa real vs previsto (facturacion y reservas) + `RecuadroMetodologia`. |
| `src/features/rrhh/data/ratios.ts` | 293 | **MOCK.** `getRatiosPorEmpresa(empresaId: slug)` -> `buildHabanaSemana()` / `buildBacanalSemana()`. |

En el catalogo de submodulos (`src/features/ajustes/lib/reglas-submodulos-catalogo.ts`) Reservas figura como `placeholder("reservas", "Reservas")`, pero eso es estado de *catalogo de reglas*, no ausencia de tabla.

## Que calcula hoy (todo en cliente, desde mock)

- **% RRHH** = `coste_personal / facturacion * 100`, por dia y global, y por puesto. Semaforo (<=30 ok, <=40 warning, >40 danger).
- **Ratio facturacion** = `coste_total / facturacion_real * 100`.
- **Ratio reservas** = `coste_total / reservas_reales * 100`.
- **Desviacion real-vs-prevision** (facturacion y reservas): `(real - previsto) / previsto * 100`, con badge de color.
- **Tendencia**: factor multiplicativo (`factorFacturacion`, `factorReservas`) sobre el ano anterior; descripcion ascendente/descendente/estable.
- **Coste por fila**: `horas[dia] * costePorHora` (el coste/hora es un literal en el mock; el coste NUNCA es un dato almacenado, siempre es horas x coste/hora).
- **Mapeo puesto -> area** `operativa | administrativa`: hardcodeado fila a fila en el mock.

La navegacion **Semana / Dia / Mes / Trimestre** y los botones `< Semana actual >` son **decorativos**: `vista` es estado local que no altera el calculo; siempre se devuelve la misma semana fija (`2026-03-30` a `2026-04-05`). No hay parametro de rango en `getRatiosPorEmpresa`.

## Las cuatro fuentes (estado real verificado)

### 1. Horas de personal -> YA REAL (`fichajes`, migracion 056)

`supabase/migrations/056_fichajes.sql`:

```
fichajes(
  id uuid pk,
  empresa_id uuid not null references empresas(id),
  empleado_id uuid not null references auth.users(id),
  fecha date not null,
  horas_totales numeric not null default 0,
  estado text check (... 'completado'),
  departamento text default '',
  centro text default '',
  ...
)
```

- Indice util: `idx_fichajes_empresa_fecha (empresa_id, fecha desc)`.
- RLS real por empresa (`empresa_id in (select empresa_id from profiles where user_id = auth.uid())`).
- **`empresa_id` es `uuid`** -> la agregacion recibe `empresaDbId`.
- **NO hay columna de coste.** El coste se obtiene siempre como `horas_totales * coste/hora`. Confirmado.
- `departamento` permite separar area operativa/administrativa (coordinar con OLA2-01, que ya deriva area desde departamento).

### 2. Facturacion -> YA REAL (`pos_tickets`, migracion 035)

`supabase/migrations/035_pos.sql`:

```
pos_tickets(
  id uuid pk,
  empresa_id uuid not null references empresas(id),
  total numeric(10,2) not null default 0,
  estado ticket_estado not null default 'ABIERTO',  -- enum: ABIERTO|ENVIADO|COBRADO|ANULADO
  abierto_at timestamptz not null default now(),
  cerrado_at timestamptz,
  anulado_at timestamptz,
  ...
)
```

- Indice util: `idx_pos_tickets_empresa_fecha (empresa_id, abierto_at desc)`.
- RLS real por empresa. **`empresa_id` es `uuid`**.
- Facturacion del dia = `SUM(total)` filtrando por `estado` cobrado (excluir `ANULADO`) y por fecha (decidir si por `abierto_at` o `cerrado_at`; recomendado `cerrado_at` para reflejar venta consumada).

### 3. Reservas -> YA REAL pero con matices (`reservas`, migracion 009)

`supabase/migrations/009_operativa_diaria.sql` (+ alters en `027_direccion_aperturas.sql`):

```
reservas(
  id uuid pk,
  empresa_id text not null,          -- !! TEXT (slug), no uuid
  fecha date not null,
  hora time not null,
  personas integer not null default 2,
  turno text default 'COMIDA',
  estado text default 'PENDIENTE',
  mesa text, zona text,
  mesa_id uuid (FK), zona_id uuid (FK),  -- anadidas en 027
  ...
)
```

- Indice: `reservas_empresa_fecha (empresa_id, fecha desc)`.
- **Existe y es real.** La consumen `listReservas`, `listReservasRango(desde, hasta)`, `createReserva` y la analitica de origen en Sala; tambien la insercion publica de `reservar-publica`.
- **MATIZ 1 — clave de empresa divergente:** `reservas.empresa_id` es **`text` (slug, p.ej. "habana")**, mientras que `fichajes`/`pos_tickets` usan `empresa_id uuid`. La agregacion de ratios debe traducir: pasar el **slug** a la consulta de reservas y el **uuid (`dbId`)** a fichajes/pos. Las firmas deben recibir ambos o resolver uno desde el otro.
- **MATIZ 2 — RLS laxa en escritura:** la politica `reservas_write ... using(true) with check(true)` es multi-tenant rota en escritura (hallazgo transversal #3 del plan). La **lectura** SI esta acotada por empresa, asi que para ratios (solo lee) no es bloqueante, pero conviene anotarlo.
- "Reservas reales" del dia = `COUNT(*)` (o `SUM(personas)`, decidir metrica) de `reservas` por `empresa_id (slug)` + `fecha`, filtrando estados que cuenten como reserva efectiva (excluir canceladas/no-show segun `ESTADOS_RESERVA`).

### 4. Coste/hora -> de OLA2-02 (no se re-deriva aqui)

OLA2-02 (`Full-TASK-OLA2-02-salarios-reales.md`, ya redactada) expone la interfaz canonica:

```ts
getCosteHoraPorEmpleado(empresaDbId): Promise<{ ok; data: Array<CosteHoraPuesto & { empleadoId }>; error? }>
getCosteHoraPorPuesto(empresaDbId): Promise<{ ok; data: CosteHoraPuesto[]; error? }>
// CosteHoraPuesto incluye: puestoId, puesto, departamento, horasSemanales, costeHoraEmpresa, costeHoraNeto, fuente
```

Ratios **debe consumir** `getCosteHoraPorEmpleado` / `getCosteHoraPorPuesto` para el coste; no recalcular salario ni leer `contratos`/`nominas` directamente. La fuente etiquetada (`nomina | contrato | plantilla`) permite mostrar la precision del dato.

## Que esta calculable YA vs que esta bloqueado

| Metrica | Estado | Por que |
| --- | --- | --- |
| Coste personal por puesto/dia (horas reales x coste/hora) | **CALCULABLE YA** | `fichajes` real + OLA2-02. |
| Horas totales reales | **CALCULABLE YA** | `fichajes.horas_totales`. |
| Facturacion real por dia/semana | **CALCULABLE YA** | `SUM(pos_tickets.total)`. |
| Reservas reales por dia/semana | **CALCULABLE YA** | `COUNT/SUM(reservas)` (con traduccion slug). |
| % RRHH, ratio facturacion, ratio reservas | **CALCULABLE YA** | son cocientes de las anteriores. |
| Navegacion temporal real (dia/semana/mes/trimestre) | **CALCULABLE YA** (requiere parametrizar rango) | hoy decorativa; las tablas ya indexan por `(empresa, fecha)`. |
| Prevision facturacion/reservas (real vs previsto) | **BLOQUEADO (parcial)** | exige historico del **ano anterior**. POS quiza lo tenga a futuro; reservas casi seguro no en demo. Sin historico, la prevision es un invento. |
| Desviacion vs prevision | **BLOQUEADO** | depende de la prevision. |
| Tendencia (factor ano vs ano) | **BLOQUEADO** | depende del historico. |

**Conclusion:** lo realmente bloqueado es la **prevision/desviacion/tendencia** (historico ano anterior), no las "reservas". Las pestanas de comparativa (`facturacion`, `reservas` en `RatiosPrevisiones`) deben pasar a **placeholder honesto** (o mostrar solo la parte real, ocultando la columna "previsto") hasta que exista historico suficiente.

## Riesgos / decisiones detectadas

- **D6 reformulada:** no es "crear modulo Reservas" (ya existe), sino decidir si la metrica de reservas usa `COUNT` o `SUM(personas)`, y de donde sale el **historico ano anterior** para la prevision.
- **Slug vs uuid en reservas:** unico punto del de-mock donde la fuente real usa slug. Riesgo de devolver vacio si se pasa el uuid a `reservas`.
- **Caching/coste de agregacion POS:** si el volumen de `pos_tickets` crece, agregar on-the-fly por rango puede pesar. Opcion: snapshot diario (no obligatorio en el corte; documentado).
- **Filtro de estados:** definir que estados de `pos_tickets` (COBRADO) y de `reservas` cuentan; un filtro mal puesto falsea el ratio.
- **Area operativa/administrativa:** hoy hardcodeada en el mock; en real derivar de `departamento` coordinando con OLA2-01.

## Veredicto de clasificacion

**MOCK PURO derivado, de-mock PARCIAL viable.** Tres fuentes reales disponibles hoy; el coste lo aporta OLA2-02. La fase 1 (calculo real de coste/facturacion/reservas + % RRHH + navegacion real) es ejecutable ya. La fase de prevision/desviacion queda como placeholder honesto por falta de historico, no por falta de modulo.

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-13-ratios-reales-parcial.md`
