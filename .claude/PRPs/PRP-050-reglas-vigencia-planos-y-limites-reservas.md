# PRP-050: Reglas de vigencia para planos, aforo del turno y tamaño máximo por reserva

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-02
> **Proyecto**: Balles-Hosteleros (módulo Sala / Reservas)

---

## Objetivo

Reemplazar el modelo plano de "matriz 28 columnas por día/turno" (`empresa_reservas_config` + `empresa_reservas_excepciones`) y la lógica suelta de planos por un **sistema unificado de Reglas con Vigencia** (mismo modelo mental que Cover Manager) aplicable a tres entidades: plano vigente, aforo del turno y tamaño máximo por reserva.

Una regla = `{ valor | plano, turno, vigencia }`, donde la vigencia puede ser **Hoy / Todos los [día] / Todos los días / Rango / Fechas específicas**. Un resolver determinista decide qué regla gana en cada (fecha, turno).

## Por Qué

| Problema | Solución |
|----------|----------|
| Configurar límites por día requiere rellenar una matriz 7×2×2 = 28 inputs poco intuitiva | Lista de reglas autodescriptivas con vigencia legible ("Todos los viernes · Cena · 80 pax") |
| Las excepciones puntuales viven en otra tabla con UI distinta, duplicando la lógica de resolución | Una sola tabla `empresa_reservas_reglas` absorbe semanal + general + excepciones |
| El usuario no ve "qué aplica HOY" sin abrir la matriz mental — error operativo frecuente | Banner permanente "Hoy aplica → Comida: X · Cena: Y" sobre la lista de reglas |
| Los planos ya tienen columnas de vigencia (`fecha_desde`, `dias_semana`, `fechas_extra`…) pero la UI sólo edita el nombre — invisibilidad total de cuándo se usa cada plano | El mismo `<VigenciaSelector />` aterriza también en el modal de plano y se reusa el resolver |
| Dos lógicas paralelas de "qué aplica en X fecha" (límites vs planos) propagan bugs (PRP-047/048 ya pisaron este barro) | Un único patrón resolver compartido con prioridad determinista: fechas_extra > rango > dias_semana > todos los días |

**Valor de negocio**: Reduce el tiempo de configurar reservas para una empresa nueva de ~10 min (rellenar matriz) a <2 min (3-4 reglas declarativas). Elimina la clase de bugs "configuré jueves pero no aplica" porque la vigencia es explícita y se ve en humano. Iguala la UX de Cover Manager — referencia directa que el cliente reconoce.

## Qué

### Criterios de Éxito
- [ ] Existe tabla `empresa_reservas_reglas` con RLS multi-tenant vía `empresas_del_usuario()` y todas las filas anteriores de `empresa_reservas_config` + `empresa_reservas_excepciones` migradas como reglas equivalentes.
- [ ] La pestaña Límites en `/sala/reservas` (config) muestra una lista de reglas + banner "Hoy aplica → Comida · Cena" en lugar de la matriz 28-celdas.
- [ ] Modal "Nueva regla" permite elegir Aplicar a (Comida / Cena / Ambos) y Cuándo (Hoy / Todos los [día] / Todos los días / Entre dos fechas / Días específicos), todo en sentence case (jamás uppercase salvo siglas).
- [ ] Resolver `resolverValorEfectivo(empresaId, fechaISO, turno, metrica)` devuelve el mismo número que el viejo `valorEfectivo()` para todas las fechas activas (verificable con un test de equivalencia sobre la migración).
- [ ] Modal de plano en `PlanosTab` muestra el mismo `<VigenciaSelector />` y el plano vigente queda visible con `<VigenciaBadge />` en la lista.
- [ ] `ReservasView`, `ContadoresDia` y `useReservasMes` siguen funcionando sin cambios visibles para el usuario (las funciones `cupoEfectivo` / `maxpaxEfectivo` mantienen firma o se sustituyen por una API equivalente que consume reglas).
- [ ] `npm run typecheck` y `npm run build` pasan limpios.
- [ ] Las columnas viejas (`*_cupo_*`, `*_maxpax_*`, tabla `empresa_reservas_excepciones`) **se conservan 1 semana** como respaldo — no se eliminan en este PRP.

### Comportamiento Esperado

**Crear una regla** (config → Reservas → Límites):
1. Usuario abre "Aforo total del turno", pulsa `+ Nueva regla`.
2. Modal pide: valor (input number), aplicar a (toggles Comida / Cena / Ambos), cuándo (toggles + selector específico).
3. Al guardar, la regla aparece en la lista con su `<VigenciaBadge />` ("Todos los viernes", "Del 20 al 31 de diciembre", etc.).
4. El banner "Hoy aplica" recalcula y muestra el nuevo valor efectivo del día.

**Resolver el valor efectivo** (consumido por `ReservasView` al crear reserva):
1. Pasa por `resolverValorEfectivo(empresaId, '2026-06-02', 'COMIDA', 'cupo')`.
2. El resolver busca primero reglas con esa fecha en `fechas_extra` (prioridad 0).
3. Si no, reglas con rango `fecha_desde ≤ fecha ≤ fecha_hasta` (prioridad 1).
4. Si no, reglas que coincidan con `dias_semana` que incluya el día (prioridad 2).
5. Si no, regla "todos los días" (prioridad 3 — general).
6. Devuelve el `valor` del primer match (o `null` si ninguna aplica).

**Plano vigente**:
- Misma lógica con `resolverPlanoActivo(localId, fecha, turno)`. La tabla `planos` ya tiene los campos; sólo añadimos lógica + UI.

---

## Contexto

### Referencias
- `src/features/sala/lib/reserva-limites.ts` — lógica actual a sustituir (firma de `valorEfectivo`, `cupoEfectivo`, `maxpaxEfectivo` y `dentroDeAntelacion`).
- `src/features/sala/components/reservas/config/LimitesMatriz.tsx` — UI actual a reemplazar por `LimitesReglas.tsx`.
- `src/features/sala/components/reservas/config/PlanosTab.tsx` — punto de inyección del `<VigenciaSelector />` en modal de plano.
- `src/features/sala/components/reservas/config/ExcepcionesTabla.tsx` — UI cuyas filas migran a reglas con `fechas_extra`.
- `src/features/sala/actions/reservas-config-actions.ts` — actions que leen/escriben columnas planas (a mantener temporalmente para retro-compat lectura).
- `src/features/sala/actions/reservas-excepciones-actions.ts` — actions a marcar como deprecadas.
- `src/features/sala/planos/data/planos.ts` — modelo `Plano` ya con campos de vigencia (`fechaDesde`, `fechasExtra`, `diasSemana`, etc.).
- `src/features/sala/planos/actions/planos-actions.ts` — `getPlanoActivoConPosiciones` actual sólo filtra por `es_principal=true`, a refinar con vigencia.
- `src/features/sala/components/ReservasView.tsx` (línea 261), `src/features/sala/components/reservas/ContadoresDia.tsx`, `src/features/sala/hooks/useReservasMes.ts` — consumidores a actualizar.
- Memoria activa: `project_rls_multiempresa.md` (toda RLS con `empresa_id` debe aceptar `empresas_del_usuario()`); `feedback_capitalizacion_textos_ui.md` (sentence case); PRP-047 (Calendario reservas CoverManager — origen del modelo de matriz vigente) y PRP-048 (planos/locales — origen de los campos de vigencia ya presentes en `planos`).

### Arquitectura Propuesta (Feature-First)

```
src/features/sala/
├── reglas/                       # NUEVO: módulo compartido reglas + vigencia
│   ├── components/
│   │   ├── VigenciaSelector.tsx  # 2 grupos toggle (Aplicar a / Cuándo) + selector
│   │   ├── VigenciaBadge.tsx     # render legible de una vigencia
│   │   └── ReglaModal.tsx        # modal "Nueva regla" reusable
│   ├── actions/
│   │   └── reglas-actions.ts     # list/create/update/delete + resolver server-side
│   ├── lib/
│   │   ├── resolver.ts           # resolverValorEfectivo + resolverPlanoActivo (puros)
│   │   └── vigencia-format.ts    # vigenciaEnHumano(regla) -> string
│   └── data/
│       └── reglas.ts             # types (EmpresaReservasRegla, VigenciaSpec, Turno...)
│
├── lib/
│   └── reserva-limites.ts        # se mantiene firma pero internamente delega a resolver
│
└── components/reservas/config/
    ├── LimitesReglas.tsx         # NUEVO: sustituye a LimitesMatriz
    └── PlanosTab.tsx              # usa <VigenciaSelector /> en modales
```

### Modelo de Datos

```sql
-- Tabla unificada de reglas (aforo y máx pax)
CREATE TABLE empresa_reservas_reglas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  metrica TEXT NOT NULL CHECK (metrica IN ('cupo','maxpax')),
  valor INTEGER NOT NULL CHECK (valor >= 0),
  turno TEXT NOT NULL CHECK (turno IN ('COMIDA','CENA','AMBOS')),
  -- Vigencia (todas opcionales; combinaciones definidas por el resolver)
  fecha_desde DATE,
  fecha_hasta DATE,
  dias_semana INT[],          -- 1=lunes ... 7=domingo
  fechas_extra DATE[],
  prioridad INT NOT NULL DEFAULT 0,   -- desempate manual; resolver usa tipo de vigencia primero
  nombre TEXT,                -- opcional, "Verano", "Navidad"...
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reglas_empresa_metrica ON empresa_reservas_reglas(empresa_id, metrica) WHERE activo;
CREATE INDEX idx_reglas_fechas_extra ON empresa_reservas_reglas USING GIN(fechas_extra);
CREATE INDEX idx_reglas_dias_semana ON empresa_reservas_reglas USING GIN(dias_semana);

ALTER TABLE empresa_reservas_reglas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_reservas_reglas_select" ON empresa_reservas_reglas
  FOR SELECT USING (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY "empresa_reservas_reglas_mutate" ON empresa_reservas_reglas
  FOR ALL USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

-- Resolver server-side (PL/pgSQL) — duplica la lógica TS para evitar viajes extra
CREATE OR REPLACE FUNCTION resolver_valor_efectivo(
  p_empresa_id UUID, p_fecha DATE, p_turno TEXT, p_metrica TEXT
) RETURNS INTEGER LANGUAGE sql STABLE AS $$
  -- prioridad: fechas_extra > rango > dias_semana > general (sin vigencia)
  SELECT valor FROM empresa_reservas_reglas
  WHERE empresa_id = p_empresa_id
    AND metrica = p_metrica
    AND activo
    AND (turno = p_turno OR turno = 'AMBOS')
  ORDER BY
    (p_fecha = ANY(fechas_extra)) DESC NULLS LAST,                                  -- 1º fechas extra
    (fecha_desde IS NOT NULL AND p_fecha BETWEEN fecha_desde AND fecha_hasta) DESC, -- 2º rango
    (dias_semana IS NOT NULL AND EXTRACT(ISODOW FROM p_fecha)::int = ANY(dias_semana)) DESC, -- 3º día semana
    (fechas_extra IS NULL AND fecha_desde IS NULL AND dias_semana IS NULL) DESC,    -- 4º general
    prioridad DESC, created_at DESC
  LIMIT 1;
$$;

-- Migración de datos (one-shot dentro de la migración)
-- 1. Cada general_* -> 1 regla "todos los días" por (turno, métrica)
-- 2. Cada <dia>_<metrica>_<turno> no nulo -> 1 regla con dias_semana=[N]
-- 3. Cada fila de empresa_reservas_excepciones -> 1 regla con fechas_extra=[fecha]
-- Columnas viejas se conservan 1 semana como respaldo (NO DROP en este PRP).
```

**Notas de migración**:
- Los valores `null` de las columnas planas NO crean reglas (preservan el sentido "sin valor en ese nivel").
- Si un día concreto tenía valor distinto al general → se crea una regla específica de ese día; el general sigue ahí como red de seguridad.
- Las excepciones con `cupoComida` y `cupoCena` ambos no nulos generan **dos reglas** (una por turno).

### Resolver TS (cliente + server)

```ts
// src/features/sala/reglas/lib/resolver.ts
export function resolverValorEfectivo(
  reglas: EmpresaReservasRegla[],
  fechaISO: string,
  turno: 'COMIDA' | 'CENA',
  metrica: 'cupo' | 'maxpax'
): number | null {
  // Ordenar igual que el SQL: extras > rango > días > general
  // Filtrar por metrica + (turno == X || turno == 'AMBOS') + activo
  // Devolver primer match
}
```

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar a cada fase con `/bucle-agentico`.

### Fase 1: Migración SQL + tipos TS
**Objetivo**: Tabla `empresa_reservas_reglas` creada con RLS, función SQL `resolver_valor_efectivo`, datos migrados desde `empresa_reservas_config` y `empresa_reservas_excepciones`. Tipos TS (`EmpresaReservasRegla`, `VigenciaSpec`, `TurnoRegla`) en `src/features/sala/reglas/data/reglas.ts`.
**Validación**: SELECT del resolver SQL sobre 10 fechas variadas en 2 empresas existentes devuelve el mismo valor que `valorEfectivo()` actual. Columnas viejas intactas.

### Fase 2: Server actions y resolver TS
**Objetivo**: `listReglasReservas`, `createReglaReserva`, `updateReglaReserva`, `deleteReglaReserva` + `resolverValorEfectivo()` puro en `src/features/sala/reglas/lib/resolver.ts`. Refinar `getPlanoActivoConPosiciones` para que respete vigencia del plano.
**Validación**: Tests unitarios del resolver con casos: solo general, día sobreescribe general, rango, extra anula rango, dos reglas con misma prioridad gana la más reciente.

### Fase 3: Componente compartido VigenciaSelector + VigenciaBadge
**Objetivo**: `<VigenciaSelector value onChange />` con dos grupos de toggles (Aplicar a / Cuándo) + selectores condicionales (date-range, day-multi, date-picker múltiple). `<VigenciaBadge regla />` para mostrar la vigencia en humano. Helper `vigenciaEnHumano()` en `lib/vigencia-format.ts`.
**Validación**: Storybook/playground mostrando los 5 casos de vigencia renderizando texto correcto en sentence case.

### Fase 4: LimitesReglas (sustituye LimitesMatriz)
**Objetivo**: Nuevo componente `LimitesReglas.tsx` con dos secciones (Aforo del turno / Tamaño máximo por reserva), cada una con su lista de reglas, banner "Hoy aplica → Comida: X · Cena: Y" y botón "+ Nueva regla" que abre `ReglaModal`. Sustituir en `ConfigTabReservas.tsx`.
**Validación**: QA visual — al crear una regla "Todos los viernes · Cena · 80" aparece en la lista; al cambiar la fecha del banner a un viernes el valor de cena pasa a 80.

### Fase 5: PlanosTab con VigenciaSelector
**Objetivo**: Modal de creación/edición de plano integra `<VigenciaSelector />`. Lista de planos muestra `<VigenciaBadge />`. Se mantiene `esPrincipal` como fallback (regla "todos los días").
**Validación**: Crear un plano "Verano 2026" con vigencia "Del 1 jun al 30 sep" y comprobar que `getPlanoActivoConPosiciones(local, '2026-07-15')` devuelve ese plano; con fecha fuera del rango devuelve el principal.

### Fase 6: Reconectar consumidores (reserva-limites.ts + UI)
**Objetivo**: Reescribir `reserva-limites.ts` para que `cupoEfectivo` / `maxpaxEfectivo` consulten reglas (vía hook que cargue una vez por mes y resuelva en cliente). Actualizar `ReservasView`, `ContadoresDia`, `useReservasMes` para alimentar las reglas en lugar de `config + excepciones`. Marcar `listReservasExcepciones` como deprecado (sin borrar).
**Validación**: Abrir `/sala/reservas` en una empresa migrada — contadores del día, calendario del mes y validación de máx pax al crear reserva devuelven exactamente los mismos números que antes.

### Fase 7: QA Playwright + validación final
**Objetivo**: Test e2e que (a) crea una regla nueva, (b) navega al día afectado, (c) confirma que el banner refleja el cambio, (d) intenta crear una reserva con pax > tope y ve el bloqueo.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot confirma banner "Hoy aplica" y lista de reglas
- [ ] Todos los Criterios de Éxito cumplidos
- [ ] Columnas viejas de `empresa_reservas_config` siguen presentes (1 semana de respaldo antes de borrar en un PRP futuro)

---

## Aprendizajes (Self-Annealing)

> Se rellena durante la implementación.

---

## Gotchas

- [ ] **Sentence case obligatorio** en todos los labels del modal de regla y los toggles. La captura de Cover usa `COMIDA / CENA / AMBOS` en uppercase — NO copiar ese estilo, usar `Comida / Cena / Ambos`.
- [ ] **`EXTRACT(ISODOW FROM fecha)` devuelve 1=lunes ... 7=domingo** en Postgres, distinto del JS `Date.getDay()` (0=domingo). Mantener `dias_semana` como `INT[]` con convención ISO (1-7) y convertir en cliente.
- [ ] **RLS multi-tenant** debe usar `empresas_del_usuario()` (no `auth.uid()` directo ni `profiles.empresa_id`) — consultar memoria `project_rls_multiempresa.md` y `project_rls_helper_empresas_del_usuario.md`.
- [ ] **Conservar columnas viejas 1 semana**: no incluir `DROP COLUMN` en la migración de Fase 1. El borrado va en un PRP futuro tras validar en producción.
- [ ] El resolver client-side y el SQL deben dar el **mismo resultado bit-a-bit** — añadir un test que cruce 20 fechas con `mcp__supabase__execute_sql` vs `resolverValorEfectivo()` TS antes de marcar Fase 2 completa.
- [ ] `turno = 'AMBOS'` debe matchear tanto COMIDA como CENA en el resolver. Olvidarlo deja reglas inertes.
- [ ] Los planos ya tenían `cubre_comidas` / `cubre_cenas` como booleanos — al añadir `<VigenciaSelector />` mapear el toggle Comida/Cena/Ambos a estos campos (no añadir columna `turno` nueva a `planos`).
- [ ] `useReservasMes` carga 30-31 días — al cambiar a reglas, **una sola lectura** de `empresa_reservas_reglas` por mes y resolver en cliente; no consultar el resolver SQL por cada día (N+1).
- [ ] Modal "Nueva regla" dentro de `Dialog`: usar dropdowns nativos para los selectores (no Popover+cmdk) — ver memoria `feedback_combobox_dentro_dialog.md`.
- [ ] El banner "Hoy aplica" debe usar la **fecha en TZ Europe/Madrid** (no UTC) — verificar con un caso en horario de cambio de día.

## Anti-Patrones

- NO duplicar lógica entre cliente y servidor: el resolver TS y el SQL son **paralelos pero equivalentes**, no se reescriben por separado.
- NO eliminar `empresa_reservas_config` ni `empresa_reservas_excepciones` en este PRP. Borrado = PRP futuro tras validación.
- NO crear una tabla `planos_reglas` separada: los campos ya existen en `planos`.
- NO añadir uppercase a labels (Cover lo hace, nosotros NO — memoria `feedback_capitalizacion_textos_ui.md`).
- NO meter reglas globales en el mismo `<ReglaModal />` que reglas con vigencia particular: una sola entrada con la vigencia explícita ("Todos los días" es una opción más).
- NO consultar el resolver SQL por cada día del mes: hidratar reglas una vez y resolver en cliente.
- NO usar `any` ni saltarse Zod en el form del modal.

---

*PRP pendiente aprobación. No se ha modificado código.*
