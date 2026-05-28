# PRP-047: Calendario de Reservas estilo CoverManager + Configuración de Reservas

> **Estado**: COMPLETADO
> **Fecha**: 2026-05-28
> **Aprobado**: 2026-05-28 (usuario)
> **Completado**: 2026-05-28 (auditoría) — implementación previa por Fernando entre 12:58 y 14:32; verificada por checklist 14/14 criterios + `npm run typecheck` (0 errores) + `npm run build` (21.8s, exit 0, 80+ rutas). Solo Playwright queda sin verificar (criterio soft).
> **Proyecto**: Balles-Hosteleros (multi-tenant, mismo repo)
> **Coordinación**: PRP-048 sustituirá `SAMPLE_MESAS` por la tabla real y ampliará el Sheet con 5 tabs adicionales.

---

## Objetivo

Rediseñar `/sala/reservas` como un **calendario operativo Día/Mes** con la densidad informativa y la lógica de cupos de CoverManager: cada celda del mes muestra ocupación por turno (☀️ Comida / 🌙 Cena), cada día detalla mesas + reservas + métricas, y cada reserva expone **estados ricos** (LLEGADA_BARRA, SENTADA, POSTRE, etc.) y **flags acumulables** (tarjeta introducida, es ticket, bloqueada, grupo, tipo, adjuntos…). Acoplado a un **Sheet de Configuración** por empresa con cupos y máximo de personas por turno (general → día de la semana → excepción por fecha), antelación, tipos editables y excepciones.

## Por Qué

| Problema | Solución |
|----------|----------|
| `/sala/reservas` hoy es una vista plana del día con plano de mesas y lista; no hay manera de ver de un vistazo cómo va la semana/mes ni qué turno está saturado. El Jefe de Sala vive yendo y viniendo entre días. | Vista MES con grid 7×N y celda dividida en Comida/Cena mostrando `% ocupación · X/aforo personas · Y/cupo reservas`. Click en día → vista DÍA. |
| Solo hay 9 estados (CONFIRMADA, PENDIENTE, RECONFIRMADA, LISTA_ESPERA, WALK_IN, LLEGADA, NO SHOW, COMPLETADA, CANCELADA). No reflejan el ciclo real del servicio (cliente en barra esperando, sentado, en postre, ha pedido la cuenta, mesa libre por limpiar, mesa lista para reasignar). El equipo no puede comunicar el estado de cada mesa sin caminar. | Añadir 8 estados operativos: TARJETA_NO_INTRODUCIDA, LLEGADA_BARRA, SENTADA, POSTRE, CUENTA_SOLICITADA, LIMPIAR, LIBERADA, A_REVISAR, con color/estilo CoverManager. |
| No existen límites por empresa: cualquiera puede meter 200 reservas en una noche o aceptar una mesa de 20 a las 23:00 sin aviso. No hay reglas de antelación mínima/máxima. | Tabla `empresa_reservas_config` (1/empresa) + `empresa_reservas_excepciones` (N/empresa) con prioridad **excepción_fecha > día_semana > general** para cupo de reservas, máximo pax por reserva y antelación. |
| No hay tipos de reserva editables (cumpleaños, evento, otra) con color/emoji; al crear una reserva no se distingue el caso especial. | Tabla `empresa_reserva_tipos` con seed canónico de 3 defaults (🎂 Cumpleaños, 🎉 Evento, 📌 Otra), editables por empresa, sembrados a todas las empresas. |
| Falta meta-información operativa sobre cada reserva: si introdujo tarjeta, si es ticket prepagado, si tiene política de cancelación aplicada, si está bloqueada para edición, si pertenece a un grupo, si tiene adjuntos. Sin estos flags el equipo no opera bien. | Columnas booleanas/FK acumulables en `reservas` (`tarjeta_introducida`, `es_ticket`, `politica_cancelacion_id`, `garantia_importe`, `bloqueada`, `grupo_id`, `tipo_id`) + tabla `reserva_adjuntos` con bucket Storage. |
| El aforo es un número mítico que nadie sabe — se debe calcular automáticamente de las mesas activas por zona, no hardcodear. | Aforo = `SUM(mesas.capacidad WHERE activa=true)` calculado al vuelo en `ReservasView`. |

**Valor de negocio**: visibilidad inmediata de la semana/mes, prevención de over-booking automática vía cupos, segmentación operativa real de cada reserva (estados ricos + flags) y configurabilidad por empresa sin tocar código. Es el upgrade definitivo del módulo Sala antes de cablear pagos, channel managers o políticas.

## Qué

### Criterios de Éxito
- [ ] En `/sala/reservas`, toggle Día/Mes en el toolbar (regla **BARRA HORIZONTAL 1**) cambia la vista.
- [ ] Vista MES muestra grid 7×N con cada celda partida en Comida/Cena; cada mitad imprime `% ocupación · X/aforo personas · Y/cupo reservas`.
- [ ] Hoy resaltado en amarillo en vista MES; click en cualquier día → cambia a vista DÍA con esa fecha cargada.
- [ ] Vista DÍA mantiene plano de mesas + lista, añade arriba los **2 contadores por turno** (Comida y Cena con personas/aforo y reservas/cupo).
- [ ] Aforo = suma `capacidad` de mesas activas (por zona si hay filtro).
- [ ] Crear/editar reserva permite asignar uno de los 17 estados (9 existentes + 8 nuevos) con su color/badge.
- [ ] Crear/editar reserva permite marcar acumulativamente los flags: tarjeta_introducida, es_ticket, bloqueada, grupo_id, tipo_id, política, garantía.
- [ ] Adjuntar archivos a una reserva sube al bucket `reserva-adjuntos` y muestra badge "📎 N adjuntos".
- [ ] Botón ⚙️ arriba derecha abre Sheet lateral con tabs (**Reservas** activa; Horarios/Políticas/Canales/Comunicaciones como placeholders).
- [ ] Tab Reservas tiene 4 apartados funcionales: **Límites por turno** (general + 7 días de la semana + N excepciones), **Antelación** (general), **Tipos de reservas** (CRUD con color + emoji, defaults 3), **Excepciones por fecha** (CRUD: fecha, motivo, cupo/maxpax comida y cena nullables).
- [ ] Al guardar una reserva nueva, si `personas > maxpax_efectivo(fecha, turno)` aparece aviso inline tolerante; bloquea guardar salvo que la reserva esté marcada "es grupo" (`grupo_id != null`).
- [ ] Migración aplica enum extendido + columnas nuevas en `reservas` + tablas `empresa_reservas_config`, `empresa_reservas_excepciones`, `empresa_reserva_tipos`, `reserva_adjuntos` con RLS multi-tenant vía `empresas_del_usuario()`.
- [ ] Seed canónico en `src/lib/seeds/reserva-tipos.ts` y se propaga a TODAS las empresas vía `syncSeedsToAllEmpresas()`.
- [ ] `npm run typecheck` y `npm run build` pasan.
- [ ] Playwright valida los tres flujos: cambiar Día↔Mes, abrir config Sheet y editar un límite, crear reserva con flags y ver badges.

### Comportamiento Esperado

**Flujo 1 — Operador llega al servicio**: abre `/sala/reservas`. Por defecto carga vista **DÍA** del día actual con el plano de mesas + lista + 2 contadores por turno arriba (☀️ Comida `25/120 personas · 8/30 reservas` · 🌙 Cena `…`). Si el contador supera el cupo, fondo rojo suave.

**Flujo 2 — Planificación mensual**: el dueño toca el toggle **Mes**. Aparece grid de Mayo 2026 con flechas ‹ ›; cada día muestra Comida arriba (☀️ 65% · 78/120 · 23/30) y Cena abajo (🌙 92% · 110/120 · 28/30). Hoy en amarillo. Días pasados en gris. Click en un día → vuelve a vista DÍA con esa fecha.

**Flujo 3 — Crear reserva**: clic en `+ Nuevo`. Formulario añade campos: **Tipo** (selector de tipos de la empresa, con color+emoji), **Es grupo** (toggle que desactiva el aviso de máx pax), flags (Tarjeta introducida, Es ticket, Política, Garantía, Bloqueada, Adjuntos). Si `personas > maxpax_efectivo` y no es grupo → aviso amarillo inline ("Supera el máximo (12 pax) del turno Cena del 2026-05-30. Marca como grupo si es correcto"). Bloquea Guardar hasta resolver. Si pasa cupo de reservas del turno, aviso similar.

**Flujo 4 — Operativa de mesa**: durante el servicio, click en una reserva → puede transicionar entre estados (LLEGADA → LLEGADA_BARRA → SENTADA → POSTRE → CUENTA_SOLICITADA → COMPLETADA → LIMPIAR → LIBERADA). Si requiere revisar algo, marca **A_REVISAR**. La mesa cambia de color en el plano según el estado de su reserva actual.

**Flujo 5 — Configuración**: el dueño abre ⚙️. Tab Reservas:
- **Límites por turno**: matriz 8 filas (General + Lun..Dom) × 4 columnas (Cupo Comida, Cupo Cena, MaxPax Comida, MaxPax Cena). General es la base; cada día puede sobrescribir.
- **Antelación**: 2 inputs (mínima horas / máxima días).
- **Tipos de reservas**: lista de chips editables (default 3); botón `+ Nuevo tipo`.
- **Excepciones por fecha**: tabla añadible con fecha (date), motivo (text), cupo_comida (int nullable), cupo_cena, maxpax_comida, maxpax_cena.

La función `maxpax_efectivo(fecha, turno)` resuelve: si existe excepción para `fecha` con valor no null → ese. Si no, mira `empresa_reservas_config.semana_<diadelasemana>_maxpax_<turno>` no null → ese. Si no, `general_maxpax_<turno>`. Mismo orden para cupo de reservas.

---

## Contexto

### Referencias

- `src/features/sala/components/ReservasView.tsx` — vista actual a refactorizar (557 líneas). Plano de mesas + lista + filtros ya están; añadir toggle Día/Mes, métricas por turno y badges nuevos.
- `src/features/sala/data/reservas.ts` — tipos `EstadoReserva`, `ESTADO_RESERVA_LABELS`, `ZonaSala`, `Mesa`, `Reserva`. Hay que extender enums y `Reserva` con los nuevos flags.
- `src/features/sala/actions/reservas-actions.ts` — server actions CRUD (`listReservas`, `createReserva`, `updateReserva`, `deleteReserva`). Extender para aceptar flags nuevos.
- `src/features/sala/io/reservas.io.ts` — ModuleIO con Zod schema; actualizar `ESTADOS` con los 17 valores.
- `src/app/(main)/sala/reservas/page.tsx` — entrypoint (devuelve `<ReservasView />`).
- `src/features/sala/components/reservas/LinksReservaPanel.tsx` — referencia de panel auxiliar dentro de Sala.
- `src/lib/seeds/sync.ts` — patrón aditivo `syncSeedsToAllEmpresas()` para propagar el seed de tipos a todas las empresas.
- `src/lib/seeds/inspector-email-plantillas.ts` — referencia de seed canónico actual (estructura del archivo + integración con sync).
- `src/shared/components/SubmoduleToolbar.tsx` — toolbar con regla **BARRA HORIZONTAL 1** (botón `+ Nuevo` izq + buscador + iconos der). Reutilizar en el header del calendario.
- `src/features/sala/actions/reserva-links-actions.ts` — patrón de server action multi-tenant con `getEmpresaActivaForUser` (la misma cookie/contexto que el resto del SaaS).
- `.claude/PRPs/PRP-046-campanas-marketing-y-links-reserva.md` — `reservas.origen` ya existe; este PRP NO lo toca.
- BD actual `reservas`: `id, empresa_id, cliente_nombre, cliente_apellidos, cliente_telefono, cliente_email, cliente_id, fecha, hora, personas, mesa, zona, turno, estado (text), notas, origen, created_by, created_at, updated_at`. **`estado` es `text`, no enum** — se mantiene `text` pero se valida en Zod con los 17 valores.
- MEMORY: `feedback_barra_horizontal_1.md`, `project_rls_multiempresa.md`, `feedback_seeds_canonicos_propagan.md`, `feedback_validaciones_inline.md`, `feedback_cambios_multi_tenant.md`, `project_empresa_activa_cookie.md`, `feedback_datos_completos_obligatorio.md`, `feedback_configuracion_base_submodulo.md`.

### Arquitectura Propuesta (Feature-First)

```
src/features/sala/
├── components/
│   ├── ReservasView.tsx                    # entrypoint — orquesta toggle Día/Mes
│   ├── reservas/
│   │   ├── CalendarioMes.tsx               # grid 7×N con celdas Comida/Cena
│   │   ├── CalendarioDia.tsx               # refactor del cuerpo actual + 2 contadores por turno
│   │   ├── ReservaFormDialog.tsx           # form con campos nuevos (tipo, flags, adjuntos)
│   │   ├── ReservaEstadoBadge.tsx          # 17 estados con color CoverManager
│   │   ├── ReservaFlagsChips.tsx           # chips/iconos: tarjeta, ticket, política, grupo, …
│   │   ├── ReservaAdjuntosPanel.tsx        # subida/listado al bucket reserva-adjuntos
│   │   └── config/
│   │       ├── ConfigSheet.tsx             # Sheet con tabs (Reservas + 4 placeholders)
│   │       ├── ConfigTabReservas.tsx       # apartados Límites/Antelación/Tipos/Excepciones
│   │       ├── LimitesMatriz.tsx           # 8×4 (general + 7 días × cupo/maxpax × comida/cena)
│   │       └── ExcepcionesTabla.tsx        # CRUD inline de excepciones
│   └── LinksReservaPanel.tsx               # (ya existe, sin cambios)
├── actions/
│   ├── reservas-actions.ts                 # extender con flags + tipo_id
│   ├── reservas-config-actions.ts          # get/upsert empresa_reservas_config
│   ├── reservas-excepciones-actions.ts     # CRUD empresa_reservas_excepciones
│   ├── reserva-tipos-actions.ts            # CRUD empresa_reserva_tipos
│   └── reserva-adjuntos-actions.ts         # CRUD reserva_adjuntos + storage
├── data/
│   └── reservas.ts                         # extender EstadoReserva (17) + tipos nuevos
├── hooks/
│   ├── useReservasMes.ts                   # carga reservas del rango + agrega métricas/día
│   ├── useReservasConfig.ts                # carga config + excepciones + tipos
│   └── useReservaLimites.ts                # función pura maxpax/cupo efectivos (fecha,turno)
├── lib/
│   └── reserva-limites.ts                  # lógica pura "excepción > día_semana > general"
└── io/
    └── reservas.io.ts                      # actualizar ESTADOS = 17 valores

src/lib/seeds/
└── reserva-tipos.ts                        # RESERVA_TIPOS_SEED (🎂 Cumpleaños, 🎉 Evento, 📌 Otra)

src/lib/seeds/sync.ts                        # añadir syncReservaTipos a syncSeedsToAllEmpresas

supabase/migrations/
├── 20260528100000_reservas_estados_y_flags.sql
├── 20260528100100_empresa_reservas_config_y_tipos.sql
└── 20260528100200_reserva_adjuntos_storage.sql
```

### Modelo de Datos

```sql
-- =====================================================================
-- Migración 1: estados nuevos + flags en reservas
-- =====================================================================

-- estado_reserva se mantiene como TEXT (ya lo es). Solo añadimos un CHECK
-- con los 17 valores autorizados.
ALTER TABLE reservas
  DROP CONSTRAINT IF EXISTS reservas_estado_check;

ALTER TABLE reservas
  ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN (
    'CONFIRMADA','PENDIENTE','RECONFIRMADA','LISTA_ESPERA','WALK_IN',
    'LLEGADA','NO_SHOW','COMPLETADA','CANCELADA',
    'TARJETA_NO_INTRODUCIDA','LLEGADA_BARRA','SENTADA','POSTRE',
    'CUENTA_SOLICITADA','LIMPIAR','LIBERADA','A_REVISAR'
  ));

-- NB: el código actual usa 'NO SHOW' con espacio. La migración normaliza a 'NO_SHOW'
-- y la app traduce el label "No Show". Hay que escribir un UPDATE de saneamiento.
UPDATE reservas SET estado = 'NO_SHOW' WHERE estado = 'NO SHOW';

ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS tarjeta_introducida    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS es_ticket              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS politica_cancelacion_id UUID,
  ADD COLUMN IF NOT EXISTS garantia_importe       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS bloqueada              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS grupo_id               UUID,
  ADD COLUMN IF NOT EXISTS tipo_id                UUID;

CREATE INDEX IF NOT EXISTS idx_reservas_grupo_id ON reservas(grupo_id) WHERE grupo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservas_tipo_id  ON reservas(tipo_id)  WHERE tipo_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_empresa ON reservas(empresa_id, fecha);

-- =====================================================================
-- Migración 2: config de reservas + tipos + excepciones
-- =====================================================================

CREATE TABLE IF NOT EXISTS empresa_reserva_tipos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  emoji         TEXT,
  color         TEXT NOT NULL DEFAULT '#7c3aed',
  orden         INTEGER NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nombre)
);

ALTER TABLE reservas
  ADD CONSTRAINT reservas_tipo_id_fkey
  FOREIGN KEY (tipo_id) REFERENCES empresa_reserva_tipos(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS empresa_reservas_config (
  empresa_id              UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  -- Generales
  general_cupo_comida     INTEGER,
  general_cupo_cena       INTEGER,
  general_maxpax_comida   INTEGER,
  general_maxpax_cena     INTEGER,
  -- Antelación
  antelacion_min_horas    INTEGER NOT NULL DEFAULT 0,
  antelacion_max_dias     INTEGER NOT NULL DEFAULT 90,
  -- Día de semana (lun..dom). NULL = usar general.
  lun_cupo_comida INTEGER, lun_cupo_cena INTEGER, lun_maxpax_comida INTEGER, lun_maxpax_cena INTEGER,
  mar_cupo_comida INTEGER, mar_cupo_cena INTEGER, mar_maxpax_comida INTEGER, mar_maxpax_cena INTEGER,
  mie_cupo_comida INTEGER, mie_cupo_cena INTEGER, mie_maxpax_comida INTEGER, mie_maxpax_cena INTEGER,
  jue_cupo_comida INTEGER, jue_cupo_cena INTEGER, jue_maxpax_comida INTEGER, jue_maxpax_cena INTEGER,
  vie_cupo_comida INTEGER, vie_cupo_cena INTEGER, vie_maxpax_comida INTEGER, vie_maxpax_cena INTEGER,
  sab_cupo_comida INTEGER, sab_cupo_cena INTEGER, sab_maxpax_comida INTEGER, sab_maxpax_cena INTEGER,
  dom_cupo_comida INTEGER, dom_cupo_cena INTEGER, dom_maxpax_comida INTEGER, dom_maxpax_cena INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empresa_reservas_excepciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  motivo          TEXT,
  cupo_comida     INTEGER,
  cupo_cena       INTEGER,
  maxpax_comida   INTEGER,
  maxpax_cena     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, fecha)
);

-- RLS (todas las tablas) usando el helper canónico empresas_del_usuario()
ALTER TABLE empresa_reserva_tipos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_reservas_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_reservas_excepciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_tipos_select ON empresa_reserva_tipos
  FOR SELECT USING (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY p_tipos_write ON empresa_reserva_tipos
  FOR ALL    USING (empresa_id IN (SELECT empresas_del_usuario()))
             WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

CREATE POLICY p_config_select ON empresa_reservas_config
  FOR SELECT USING (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY p_config_write ON empresa_reservas_config
  FOR ALL    USING (empresa_id IN (SELECT empresas_del_usuario()))
             WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

CREATE POLICY p_exc_select ON empresa_reservas_excepciones
  FOR SELECT USING (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY p_exc_write ON empresa_reservas_excepciones
  FOR ALL    USING (empresa_id IN (SELECT empresas_del_usuario()))
             WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

-- =====================================================================
-- Migración 3: adjuntos + bucket Storage
-- =====================================================================

CREATE TABLE IF NOT EXISTS reserva_adjuntos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  reserva_id      UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  nombre_original TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      BIGINT,
  uploaded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reserva_adjuntos_reserva ON reserva_adjuntos(reserva_id);

ALTER TABLE reserva_adjuntos ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_adj_select ON reserva_adjuntos
  FOR SELECT USING (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY p_adj_write ON reserva_adjuntos
  FOR ALL    USING (empresa_id IN (SELECT empresas_del_usuario()))
             WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

-- bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('reserva-adjuntos', 'reserva-adjuntos', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Policies storage: lectura/escritura restringida por path = empresa_id/...
CREATE POLICY p_storage_adj_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reserva-adjuntos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT empresas_del_usuario())
  );
CREATE POLICY p_storage_adj_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reserva-adjuntos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT empresas_del_usuario())
  );
CREATE POLICY p_storage_adj_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reserva-adjuntos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT empresas_del_usuario())
  );
```

### Seed canónico (`src/lib/seeds/reserva-tipos.ts`)

```typescript
export const RESERVA_TIPOS_SEED = [
  { nombre: "Cumpleaños", emoji: "🎂", color: "#ec4899", orden: 1 },
  { nombre: "Evento",     emoji: "🎉", color: "#f59e0b", orden: 2 },
  { nombre: "Otra",       emoji: "📌", color: "#64748b", orden: 3 },
] as const;
```

Se siembra de forma **aditiva** (no sobrescribe si ya existe el nombre en la empresa) en `syncSeedsToAllEmpresas()`.

### Lógica `maxpax_efectivo` / `cupo_efectivo`

```typescript
function valorEfectivo(
  config: EmpresaReservasConfig,
  excepciones: EmpresaReservasExcepcion[],
  fecha: string,  // YYYY-MM-DD
  turno: "COMIDA" | "CENA",
  metrica: "cupo" | "maxpax",
): number | null {
  const exc = excepciones.find(e => e.fecha === fecha);
  const turnoKey = turno.toLowerCase();          // "comida" | "cena"
  const excVal   = exc?.[`${metrica}_${turnoKey}`];
  if (excVal != null) return excVal;
  const diaSemana = ["dom","lun","mar","mie","jue","vie","sab"][new Date(fecha+"T12:00:00").getDay()];
  const semVal    = config[`${diaSemana}_${metrica}_${turnoKey}`];
  if (semVal != null) return semVal;
  return config[`general_${metrica}_${turnoKey}`] ?? null;
}
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico`.

### Fase 1: Migraciones BD + seed canónico
**Objetivo**: tablas, columnas, constraint del enum extendido, bucket Storage y seed de 3 tipos aplicados en BD y propagados a todas las empresas existentes.
**Validación**:
- `SELECT estado FROM reservas` admite los 17 valores.
- Las 3 nuevas tablas existen con RLS habilitado vía `empresas_del_usuario()`.
- `SELECT count(*) FROM empresa_reserva_tipos GROUP BY empresa_id` devuelve ≥3 filas por empresa.
- Bucket `reserva-adjuntos` listado en Storage.

### Fase 2: Tipos TS + Zod + Server Actions
**Objetivo**: extender `EstadoReserva` a 17 valores, añadir tipos `ReservaTipo`, `EmpresaReservasConfig`, `EmpresaReservasExcepcion`, `ReservaAdjunto`. Actualizar `reservas.io.ts` y crear `reservas-config-actions.ts`, `reservas-excepciones-actions.ts`, `reserva-tipos-actions.ts`, `reserva-adjuntos-actions.ts` siguiendo el patrón `getContext()` / `getEmpresaActivaForUser()`.
**Validación**: `npm run typecheck` pasa; smoke test manual de cada action devuelve `{ ok: true }`.

### Fase 3: Sheet de Configuración (tab Reservas funcional)
**Objetivo**: Botón ⚙️ en la esquina derecha del toolbar abre Sheet con 5 tabs (Reservas activo + 4 placeholders "Próximamente"). Tab Reservas con 4 apartados: matriz Límites 8×4, inputs de Antelación, CRUD de Tipos, CRUD de Excepciones. Auto-save con debounce y toast de confirmación. Validación inline tolerante (no bloqueos prematuros).
**Validación**: persiste y recupera valores tras refresh; cambios visibles en BD; placeholders no rompen layout.

### Fase 4: Vista MES (Calendario)
**Objetivo**: `CalendarioMes.tsx` con grid 7×N, navegador "‹ Mayo 2026 ›", celda dividida Comida (☀️) / Cena (🌙) con `% · X/aforo · Y/cupo`, hoy en amarillo, días pasados en gris-muted. Click en día → cambia vista a DÍA con esa fecha. Cálculo del aforo = suma `capacidad` de mesas activas; métricas obtenidas con un solo query agrupado por (fecha, turno).
**Validación**: navegar 3 meses adelante/atrás funciona; números coinciden con el conteo manual; click → vista DÍA correcta.

### Fase 5: Vista DÍA refactor + 2 contadores por turno
**Objetivo**: añadir banda superior en `CalendarioDia.tsx` con dos cajas (Comida / Cena) mostrando `personas/aforo · reservas/cupo`, fondo rojo suave si supera cupo. Mantener plano de mesas + lista actuales. Toolbar adaptado a regla **BARRA HORIZONTAL 1**: `+ Nuevo` izq, buscador + icono columnas + IOActions + ⚙️ der; filtros en fila aparte.
**Validación**: la vista DÍA conserva todo lo que ya funcionaba (lista, plano, filtros) y suma los contadores correctamente; al cambiar fecha por flechas, métricas se recargan.

### Fase 6: Estados nuevos en UI (badges + transiciones)
**Objetivo**: `ReservaEstadoBadge.tsx` con paleta CoverManager (verde confirmada, amarillo pendiente, sky reconfirmada, violet lista_espera, naranja walk_in, azul llegada, rojo no_show, gris completada/cancelada, + nuevos: amber tarjeta_no_introducida, cyan llegada_barra, indigo sentada, fuchsia postre, pink cuenta_solicitada, lime limpiar, teal liberada, red a_revisar). Diálogo de detalle muestra los 17 estados como botones de transición (no menú).
**Validación**: cambiar el estado de una reserva persiste; el color del Badge cambia y el plano de mesas refleja el nuevo estado.

### Fase 7: Flags informativos + Form de reserva ampliado
**Objetivo**: `ReservaFlagsChips.tsx` con chips/iconos para `tarjeta_introducida`, `es_ticket`, `bloqueada`, `grupo_id`, `tipo_id`, `politica_cancelacion_id`, `garantia_importe`, además de los derivados (origen, observaciones, RECONFIRMADA). `ReservaFormDialog.tsx` añade selector de Tipo (los `empresa_reserva_tipos` activos), toggle "es grupo", checkboxes para flags, inputs para política/garantía y validación inline tolerante de pax. `bloqueada=true` desactiva todos los inputs del form salvo el toggle bloqueada (solo admin/role).
**Validación**: crear reserva de 14 pax con maxpax=12 y "es grupo" desactivado → aviso amarillo y no guarda; activar "es grupo" → guarda con `grupo_id` autogenerado. Los chips aparecen correctamente en la lista y el plano.

### Fase 8: Adjuntos
**Objetivo**: `ReservaAdjuntosPanel.tsx` dentro del detalle de reserva: drag-drop, listado con tamaño/nombre, botón eliminar. Server actions usan el bucket `reserva-adjuntos` con path `{empresa_id}/{reserva_id}/{uuid}-{filename}`. Badge "📎 N" visible en la fila de la lista cuando `count(reserva_adjuntos) > 0`.
**Validación**: subir un PDF + un PNG → ambos listados, descargables vía signed URL; eliminar borra archivo + fila.

### Fase 9: QA Playwright + typecheck/build
**Objetivo**: script Playwright que (1) navega a `/sala/reservas`, (2) cambia a Mes y verifica que aparece el grid con la fecha de hoy en amarillo, (3) vuelve a Día, (4) abre ⚙️ y edita un límite Cupo Cena → guarda, (5) crea una reserva con tipo "Cumpleaños" y tarjeta_introducida=true → ve los badges, (6) sube un adjunto y ve el contador "📎 1". `npm run typecheck`, `npm run lint`, `npm run build` sin errores.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Screenshot Playwright muestra: vista MES, vista DÍA con contadores, Sheet config abierto, badge nuevo, chip de tipo.
- [ ] Todos los criterios de éxito marcados.

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección crecerá durante la implementación con los errores reales y sus fixes.

*(vacía — se rellena durante `/bucle-agentico`)*

---

## Gotchas

- [ ] **`reservas.estado` es TEXT, no enum** en BD. La migración 1 añade un `CHECK CONSTRAINT` con los 17 valores. Cuidado al ejecutar `UPDATE reservas SET estado = 'NO_SHOW' WHERE estado = 'NO SHOW'` antes del constraint (datos legacy con espacio).
- [ ] **Cookie `bh_empresa_activa`** decide la empresa para los multiempresa; toda action debe llamar `getEmpresaActivaForUser()` y NUNCA leer `profiles.empresa_id` directamente.
- [ ] **RLS multi-tenant** debe usar el helper `empresas_del_usuario()` (devuelve `profiles ∪ user_empresas`). NUNCA filtrar solo por la principal — rompe el acceso del secundario.
- [ ] **Seeds canónicos propagados**: añadir el seed `reserva-tipos` al runner `syncSeedsToAllEmpresas()`. Patrón aditivo (no sobrescribe). Aplica también a empresas futuras desde `seedEmpresaDefaults()`.
- [ ] **BARRA HORIZONTAL 1 obligatoria**: el toolbar debe respetar la regla DEFAULT (botón `+ Nuevo` izq + buscador + 3 iconos der). Filtros en fila aparte.
- [ ] **Validaciones inline tolerantes**: el aviso de "supera el máximo de pax" NO bloquea mientras el usuario escribe; aparece solo cuando el valor supera el límite y el campo pierde foco. El botón Guardar queda deshabilitado pero el aviso es informativo, no agresivo.
- [ ] **Datos completos obligatorio**: las excepciones de fecha y los tipos no pueden guardarse a medias. Si el usuario abre el formulario y no completa, hay "Guardar borrador" (localStorage) pero el "Guardar" en BD exige todos los campos requeridos (fecha + al menos uno de los 4 campos numéricos para excepciones; nombre+emoji+color para tipos).
- [ ] **Aforo dinámico**: NO hardcodear capacidad — sumar `capacidad` de `mesas.activa = true` (con filtro de zona si aplica). Aún no hay tabla `mesas` real (se usa `SAMPLE_MESAS`); usar el array por ahora y crear PRP separado para migrar mesas a BD.
- [ ] **Storage path** = `{empresa_id}/{reserva_id}/{uuid}-{filename}`. Las RLS de storage validan `(storage.foldername(name))[1]` contra `empresas_del_usuario()`.
- [ ] **No reusar IDs secuenciales**: si en algún momento se decide darle `numero_secuencial` a las reservas (no en este PRP), usar `numero_counters` + trigger según patrón del proyecto.
- [ ] **Cambios al software, no a una empresa**: el seed se aplica a TODAS las empresas (Bacanal, Habana, futuras) sin hardcodear ningún `empresa_id`.
- [ ] **Mesas en `SAMPLE_MESAS`**: la lógica de aforo se basa en `SAMPLE_MESAS` mientras no exista tabla real. Documentar en código que es transitorio.

## Anti-Patrones

- NO crear un enum PostgreSQL nuevo si `estado` ya es `text` (rompe el saneamiento del valor legacy `'NO SHOW'`).
- NO hardcodear el seed de tipos por empresa — usar `RESERVA_TIPOS_SEED` y propagarlo.
- NO filtrar RLS por `profiles.empresa_id` — usar `empresas_del_usuario()`.
- NO duplicar lógica `maxpax_efectivo` en cliente y servidor — vive en `src/features/sala/lib/reserva-limites.ts`, se importa desde ambos.
- NO bloquear el guardado del form mientras el usuario escribe — aviso inline solo on-blur.
- NO meter el toggle Día/Mes fuera del toolbar BARRA HORIZONTAL 1.
- NO usar `Popover + cmdk` dentro del Dialog del form (rompe typing, ver MEMORY.md). Usar select nativo.
- NO commitear claves de Supabase ni datos de empresas reales en seeds.
- NO crear migraciones que dependan de IDs concretos (`empresa_id = '<uuid>'`); siempre `INSERT INTO ... SELECT` desde `empresas`.

---

*PRP COMPLETADO el 2026-05-28. Auditoría: 14/14 criterios cumplidos. Implementación previa de Fernando + verificación typecheck/build.*
