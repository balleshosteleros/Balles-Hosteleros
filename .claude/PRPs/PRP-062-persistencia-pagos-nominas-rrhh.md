# PRP-062: Persistencia del módulo de Pagos/Nóminas de RRHH

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-21
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Convertir `/rrhh/pagos` de UI en memoria a un módulo persistente: crear la tabla `rrhh_pagos` (un registro por empleado × empresa × periodo mensual) con RLS multi-tenant, cablear `PagosView` para cargar y guardar por periodo, y cargar el histórico real de 2026 de HABANA (5 meses) desde capturas.

## Por Qué

| Problema | Solución |
|----------|----------|
| `pagos.io.ts` → `fetchAll` devuelve `[]`; no hay tabla en BD. Todo lo que se edita en `/rrhh/pagos` (pago, nómina, propinas, bonus, descuentos, pagado) se pierde al recargar. | Tabla `rrhh_pagos` por periodo + acciones server (load/save) + cableado de `PagosView` que persiste lo editado. |
| No existe histórico de nóminas; cada mes se reconstruye a mano sobre filas vacías generadas a partir de empleados activos. | Carga del histórico 2026 de HABANA (5 meses) desde capturas, dejando el registro contable consultable mes a mes. |
| Empleados que aparecen en las capturas no existen como ficha en BD y hay nombres ambiguos. | Fase específica de carga de datos que resuelve altas y ambigüedades de forma controlada (datos completos, no a medias). |

**Valor de negocio**: el responsable de RRHH gestiona y conserva las nóminas/pagos mes a mes sin Excel paralelo; queda traza histórica auditable por empresa y periodo.

## Qué

### Criterios de Éxito
- [ ] Existe la tabla `rrhh_pagos` con RLS multi-tenant vía `empresas_del_usuario()`, versionada como migración idempotente en `supabase/migrations/`.
- [ ] `rrhh_pagos` tiene `UNIQUE (empresa_id, empleado_id, periodo)` con `periodo` mensual formato `YYYY-MM` (ej. `2026-01`).
- [ ] Al editar un pago y marcar "pagado" en `/rrhh/pagos`, el dato persiste tras recargar la página.
- [ ] Al cambiar de mes en el toggle de calendario, cada periodo carga sus propios pagos guardados (y muestra filas vacías para empleados sin registro ese mes).
- [ ] El histórico 2026 de HABANA (5 meses) queda cargado y se ve correctamente al navegar por los meses.
- [ ] Empleados de capturas inexistentes (MANUEL, ÁFRICA, CRISTINA, ESTEFANIA, KAREN LIMPIEZA) y ambigüedades (ALBERTO MANTENIMIENTO, JAVIER CONTABLE) resueltos y confirmados antes de cargar.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

1. El usuario abre `/rrhh/pagos`. El toggle mensual está en el mes actual.
2. La vista carga, para `(empresa activa, periodo del mes)`, los registros de `rrhh_pagos`. Para los empleados activos sin registro en ese periodo, genera filas vacías (no persistidas hasta que se guarden).
3. El usuario edita importes y marca casillas "pagado". Al guardar (autosave por fila o botón único), se hace upsert por `(empresa_id, empleado_id, periodo)`.
4. Al navegar a otro mes, se repite la carga con el periodo nuevo; cada mes conserva sus datos.
5. El histórico de HABANA (ene–may 2026) está precargado y se consulta navegando por los meses.

---

## Contexto

### Referencias
- `src/features/rrhh/components/pagos/PagosView.tsx` — vista actual; ya tiene toggle `useCalendarRange("MENSUAL")`, cache `pagosPorRango` por `rangoKey`, edición en memoria, KPIs y totales. Solo falta persistencia.
- `src/features/rrhh/io/pagos.io.ts` — `fetchAll` devuelve `[]` (a cablear) + columnas IO de import/export.
- `src/features/rrhh/data/pagos.ts` — tipos `PagoEmpleado`, `PagoArea`, `calcularTotalPago`, `getResumenPagos`. Campo actual `propinaMantenimiento` ↔ la captura lo llama `propina_mes_anterior` (decidir nombre canónico en Fase 1).
- `src/features/rrhh/actions/pagos-actions.ts` — `listEmpleadosParaPagos()`: patrón ya resuelto de empleados por empresa (OR `empresa_id` ∪ `usuario_empresas`, dedup por `user_id`, área desde `departamentos.area`). Reusar para fusionar empleados activos con pagos guardados.
- `src/shared/components/calendar/calendar-range.ts` — `rangeFor`/`labelFor`; periodo mensual = `range.start` (primer día de mes). Derivar `periodo = YYYY-MM` desde `range.start`.
- `supabase/migrations/20260617130200_mermas_inventario_kardex_prp058.sql` — patrón RLS canónico: `USING (empresa_id IN (SELECT empresas_del_usuario()))`, escritura vía service role / acciones server.
- `src/shared/io/types.ts` — `fetchAll: (ctx: IOContext) => Promise<T[]>`.

### Arquitectura Propuesta (Feature-First)
```
src/features/rrhh/
├── actions/pagos-actions.ts      # + loadPagos(periodo), savePago / upsertPagos(periodo)
├── data/pagos.ts                 # tipo PagoEmpleado (alinear nombres con BD)
├── io/pagos.io.ts                # fetchAll real (periodo actual) para export
└── components/pagos/PagosView.tsx # carga/guarda por periodo
supabase/migrations/
└── 2026XXXXXXXXXX_rrhh_pagos.sql # tabla + RLS + UNIQUE + índices
```

### Modelo de Datos
```sql
CREATE TABLE IF NOT EXISTS rrhh_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,                 -- 'YYYY-MM', ej '2026-01'
  fijo BOOLEAN NOT NULL DEFAULT false,
  pago NUMERIC(12,2) NOT NULL DEFAULT 0,
  nomina NUMERIC(12,2) NOT NULL DEFAULT 0,
  horas_reales NUMERIC(8,2) NOT NULL DEFAULT 0,
  horas_trabajadas NUMERIC(8,2) NOT NULL DEFAULT 0,
  propina NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
  horas_extras NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  propina_mes_anterior NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  pagado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_pagos_periodo_fmt CHECK (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT rrhh_pagos_uniq UNIQUE (empresa_id, empleado_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_pagos_empresa_periodo
  ON rrhh_pagos (empresa_id, periodo);

ALTER TABLE rrhh_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY rrhh_pagos_select ON rrhh_pagos
  FOR SELECT USING (empresa_id IN (SELECT empresas_del_usuario()));
-- Escritura vía acciones server (service role); políticas de INSERT/UPDATE/DELETE
-- alineadas al patrón del proyecto (mismas que mermas/kardex).
```

> Nota nombres: la captura usa `propina_mes_anterior`; el código actual usa `propinaMantenimiento`. La columna BD canónica será `propina_mes_anterior`. En Fase 2 se decide si se renombra el campo TS o se mapea (`propinaMantenimiento` → `propina_mes_anterior`) en la capa de acciones.

---

## Blueprint (Assembly Line)

### Fase 1: Migración `rrhh_pagos`
**Objetivo**: tabla, UNIQUE, índices y RLS multi-tenant creados y versionados como migración idempotente.
**Validación**: `list_tables` muestra `rrhh_pagos`; `get_advisors` sin warnings nuevos de RLS; migración `.sql` en `supabase/migrations/`.

### Fase 2: Acciones server de carga/guardado
**Objetivo**: `loadPagos(periodo)` (devuelve registros guardados del periodo para la empresa activa, fusionados con empleados activos como filas vacías) y `upsertPagos(periodo, filas)` (upsert por `(empresa_id, empleado_id, periodo)` con recálculo de `total` y `updated_at`). Mapeo de nombres TS↔BD resuelto.
**Validación**: typecheck pasa; prueba manual de upsert y relectura desde acción.

### Fase 3: Cableado de `PagosView` + `pagos.io.ts`
**Objetivo**: `PagosView` carga por periodo desde `loadPagos` (sustituye a la generación de filas vacías) y guarda los cambios (autosave por fila o botón). `pagos.io.ts#fetchAll` lee el periodo actual para export. Persistencia tras recargar verificada.
**Validación**: editar + marcar pagado + recargar conserva los datos; navegar de mes conserva cada periodo; Playwright screenshot.

### Fase 4: Carga del histórico 2026 de HABANA
**Objetivo**: resolver primero empleados inexistentes (MANUEL, ÁFRICA, CRISTINA, ESTEFANIA, KAREN LIMPIEZA) y ambigüedades (ALBERTO MANTENIMIENTO, JAVIER CONTABLE) confirmando con el usuario; luego cargar los 5 meses (ene–may 2026) desde las capturas vía script/seed de datos para HABANA. Solo datos completos.
**Validación**: navegar por los meses de HABANA muestra el histórico correcto y los totales cuadran con las capturas.

### Fase N: Validación Final
**Objetivo**: módulo Pagos persistente end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright confirma persistencia y navegación por meses
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación.

---

## Gotchas

- [ ] Versionar la migración SIEMPRE como `.sql` idempotente, aunque se aplique por MCP (regla del proyecto).
- [ ] RLS DEBE usar `empresas_del_usuario()` (acepta `profiles.empresa_id` ∪ `usuario_empresas`); no filtrar solo por la empresa principal.
- [ ] Empleado multiempresa = una fila de `empleados` por empresa; `rrhh_pagos` referencia `empleado_id` (no `user_id`), así el pago queda atado a la empresa correcta. Reusar la dedup de `listEmpleadosParaPagos`.
- [ ] `periodo` debe derivarse de `range.start` en horario local (no UTC) para no caer al mes anterior por desfase de zona.
- [ ] Mapear `propinaMantenimiento` (TS) ↔ `propina_mes_anterior` (BD) de forma consistente.
- [ ] `total` se recalcula en server (`calcularTotalPago`) antes de upsert; no confiar en el valor del cliente.
- [ ] No crear fichas de empleado "a medias": resolver inexistentes/ambiguos con el usuario antes de cargar (datos completos obligatorio).

## Anti-Patrones
- NO crear nuevos patrones de empresa/empleado si `listEmpleadosParaPagos` ya los resuelve.
- NO ignorar errores de TypeScript.
- NO hardcodear el periodo ni los importes históricos en el código (van a BD vía seed/script de datos).
- NO omitir validación Zod en inputs de usuario.

---

*PRP pendiente aprobación. No se ha modificado código.*
