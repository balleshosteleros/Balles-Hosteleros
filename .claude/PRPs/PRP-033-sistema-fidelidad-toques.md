# PRP-033: Sistema de Fidelidad TOQUES — Gamificación Integral de Empleados

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-02
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Construir un sistema de gamificación interno llamado **TOQUES** (moneda virtual en homenaje al gorro del chef) integrado en MI PORTAL, que premie comportamientos virtuosos diarios de los empleados, genere rankings periódicos (día / semana / mes / trimestre / año), permita canjear toques por recompensas tangibles aprobadas por RRHH, y consolide un sistema paralelo de niveles (Aprendiz → Leyenda Balles) visible en el perfil de cada empleado.

## Por Qué

| Problema | Solución |
|----------|----------|
| Falta de motivación intrínseca y reconocimiento del esfuerzo diario en hostelería (sector con alta rotación) | Sistema visible de puntos + ranking público que convierte el cumplimiento operativo en juego cooperativo |
| Comportamientos virtuosos (puntualidad, APPCC al día, cierre de incidencias) no se premian de forma sistemática | Reglas automáticas de devengo evaluadas por cron nocturno sobre datos ya existentes (fichajes, APPCC, comunicados, tareas) |
| RRHH no tiene una palanca barata para retener talento y reducir absentismo | Recompensas reales (horas libres, días extra, semanas) canjeables previa aprobación que protege el cuadrante |
| El "Empleado del Mes/Trimestre/Año" se decide a dedo, sin métricas | Snapshots automáticos con criterio objetivo (toques acumulados) y desempate (antigüedad → alfabético) |

**Valor de negocio**: reducir rotación de personal (objetivo -15% anual), reducir retrasos/olvidos de fichaje (objetivo -30%), aumentar cumplimiento APPCC al 100%, crear cultura de empresa medible y diferenciada vs competencia local.

## Qué

### Criterios de Éxito

- [ ] Empleado entra en `MI PORTAL > Toques` y ve su balance, nivel, barra de progreso, ranking del periodo seleccionado y recompensas disponibles
- [ ] Cron nocturno evalúa todas las reglas activas del día y crea movimientos en `toques_movimientos` con contexto de cada otorgamiento
- [ ] Cron de cierre (domingo / fin de mes / fin de trimestre / fin de año) crea snapshot de ganador y aplica bonus + título correspondiente
- [ ] Empleado puede canjear toques por una recompensa con toques suficientes; se crea `toques_canjes` en estado `pendiente`
- [ ] RRHH/Gerencia aprueba o rechaza canjes desde un panel admin con motivo opcional
- [ ] RRHH/Gerencia configura reglas, recompensas y niveles desde Ajustes (no requiere migración para ajustar puntos)
- [ ] RRHH/Gerencia otorga toques manuales con motivo (ej. mérito discrecional)
- [ ] Niveles (Aprendiz, Camarero, Maître, Chef, Chef Estrella, Maestro Hostelero, Leyenda Balles) calculados sobre `toques_acumulados` (no decrementan al canjear)
- [ ] Multi-tenant: todo `empresa_id` aislado por RLS; un empleado solo ve datos de su empresa
- [ ] Notificación toast en sesión cuando el empleado gana un toque (Realtime opcional)
- [ ] `npm run typecheck` y `npm run build` pasan sin errores

### Comportamiento Esperado

**Happy Path empleado:**
1. Juan ficha entrada a las 08:55 (su horario es 09:00) y es el primero del día → al cierre de día, cron evalúa la regla `puntualidad_elite` y le otorga +1 toque.
2. Durante el día completa todas sus tareas asignadas en cronograma → cron otorga +1 toque por `cumplidor_dia`.
3. Marca como leído un comunicado importante antes que nadie → cron otorga +1 toque por `comunicado_leido_primero`.
4. Al final del día Juan suma 3 toques. Es el más alto del día → cron de cierre del día otorga +5 toques bonus por `ganador_dia`.
5. Juan abre `MI PORTAL > Toques` y ve: balance 8 toques canjeables, 8 toques acumulados, nivel "Aprendiz" con barra al 8% de "Camarero" (100 toques).
6. A los 50 toques canjeables, Juan pulsa "Canjear" en "1 hora libre" → se crea solicitud `pendiente`.
7. RRHH ve la solicitud, valida que no rompe cuadrante, aprueba → estado pasa a `aprobada`, toques canjeables -50 (acumulados se mantienen).
8. Juan disfruta el día, RRHH marca canje como `disfrutado`.

**Happy Path admin:**
1. Director de RRHH entra a `Ajustes > Toques` y desactiva la regla `velocidad_chat` por baja relevancia.
2. Cambia el bonus del Empleado del Mes de 50 a 75.
3. Otorga manualmente +10 toques a Maite por ayudar a un compañero un domingo, motivo "Cobertura voluntaria".
4. Aprueba un canje pendiente.

---

## Contexto

### Referencias

- `src/features/mi-panel/` — patrón de feature de MI PORTAL (componentes, page wrappers, actions)
- `src/features/mi-panel/components/MiPanelView.tsx` — composición de cabecera + grid + widgets
- `src/features/mi-panel/components/MisSolicitudesList.tsx` — patrón de list+state que se replica para `MisCanjesList`
- `src/features/ajustes/components/` — patrón de tabs (`DepartamentosTab`, `RolesTab`, `PuestosEmpresaTab`) para añadir las pestañas `ReglasToquesTab`, `RecompensasToquesTab`, `NivelesToquesTab`
- `src/features/gerencia/components/ComunicadosView.tsx` — patrón admin con filtros por departamento (replicar para `RankingAdminView`)
- `supabase/migrations/050_mi_panel_solicitudes.sql` — modelo correcto para tabla con `user_id auth.users`, `empresa_id uuid`, RLS y trigger de `updated_at`
- `supabase/migrations/035_pos.sql` — modelo correcto para módulo con varias tablas relacionadas (enums + tablas + índices + RLS coherente)
- `supabase/migrations/038_carta_digital.sql` — modelo correcto multi-tabla con RLS por `empresa_id`
- `supabase/migrations/052_comunicados_destinatarios.sql` — fuente de verdad para "comunicados dirigidos al empleado" (regla de devengo)
- `supabase/migrations/009_operativa_diaria.sql` — fuente de verdad de `fichajes` (puntualidad y cero olvidos)
- `.claude/memory/feedback/protocolo_guardado_supabase.md` — try/catch + logs en TODA escritura
- `.claude/memory/feedback/ui_standard_buttons.md` — `<Button variant="primary" size="lg">` con icono, `top-4 right-4`
- `.claude/memory/feedback/supabase_tipos_reales.md` — `profiles.empresa_id uuid`, `profiles.user_id` sin UNIQUE → modelar como 035/038/050
- `.claude/memory/feedback/supabase_realtime.md` — patrón publication + channel + RLS para notificación de toque ganado
- `.claude/memory/feedback/sidebar_acordeon.md` — solo un módulo de DEPARTAMENTOS abierto a la vez

### Arquitectura Propuesta (Feature-First)

```
src/features/toques/
├── components/
│   ├── ToquesView.tsx                # contenedor MI PORTAL > Toques
│   ├── MiBalanceCard.tsx             # balance + nivel + barra progreso
│   ├── MisLogrosTimeline.tsx         # últimos 30 días de movimientos del usuario
│   ├── RankingTabs.tsx               # tabs HOY · SEMANA · MES · TRIMESTRE · AÑO · HISTÓRICO
│   ├── RankingTable.tsx              # top 10 con avatar, departamento, toques, nivel
│   ├── HallOfFame.tsx                # galería últimos ganadores
│   ├── RecompensasGrid.tsx           # cards de recompensas con CTA Canjear
│   ├── CanjeConfirmDialog.tsx        # confirma canje
│   ├── MisCanjesList.tsx             # histórico canjes del usuario
│   ├── ToqueGanadoToast.tsx          # toast realtime cuando se inserta movimiento
│   └── admin/
│       ├── RankingAdminView.tsx      # ranking global filtrable por departamento
│       ├── CanjesAdminView.tsx       # bandeja aprobación canjes
│       └── OtorgarToqueDialog.tsx    # bonus manual con motivo
├── actions/
│   ├── toques-actions.ts             # canjearRecompensa, otorgarToqueManual, aprobarCanje, rechazarCanje
│   └── toques-admin-actions.ts       # CRUD reglas / recompensas / niveles
├── services/
│   ├── toques.service.ts             # lectura: balance, ranking, hall of fame, timeline
│   └── reglas-runner.service.ts      # evaluador de reglas (usado por cron)
├── hooks/
│   ├── useToquesRealtime.ts          # suscripción a inserts en toques_movimientos del usuario
│   └── useRanking.ts                 # query con filtro periodo
├── types/
│   └── toques.types.ts               # tipos compartidos (Movimiento, Regla, Recompensa, Nivel, Canje, Ganador, RankingRow)
└── data/
    └── reglas-defaults.ts            # seed inicial de reglas (puntualidad_elite, etc.)

src/app/(main)/mi-panel/toques/
└── page.tsx                          # render <ToquesView />

src/app/(main)/ajustes/  (tabs existentes)
└── (añadir tabs nuevos en page.tsx) ReglasToquesTab, RecompensasToquesTab, NivelesToquesTab

src/app/api/toques/cron/
├── devengo-diario/route.ts           # invocado por cron Vercel diario 23:55
└── snapshot-periodos/route.ts        # invocado por cron Vercel diario 00:05 (decide si cierra día/sem/mes/trim/año)
```

### Modelo de Datos

```sql
-- ============================================================
-- 056_toques_fidelidad.sql — Sistema TOQUES (PRP-033)
-- ============================================================

-- ─── 0. ENUMS ────────────────────────────────────────────────
do $$ begin
  create type public.toque_periodo as enum ('dia','semana','mes','trimestre','ano');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.canje_estado as enum ('pendiente','aprobada','rechazada','disfrutada','anulada');
exception when duplicate_object then null; end $$;

-- ─── 1. REGLAS configurables ─────────────────────────────────
create table if not exists public.toques_reglas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  codigo          text not null,           -- p.ej. 'puntualidad_elite' (estable, usado por el runner)
  nombre          text not null,
  descripcion     text not null default '',
  toques          integer not null default 1,
  periodicidad    text not null default 'diario'  -- 'diario' | 'semanal' | 'trimestral'
                    check (periodicidad in ('diario','semanal','trimestral')),
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, codigo)
);

-- ─── 2. NIVELES configurables ────────────────────────────────
create table if not exists public.toques_niveles (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  orden           smallint not null,        -- 1, 2, 3, ...
  nombre          text not null,            -- 'Aprendiz', 'Camarero', ...
  toques_min      integer not null,         -- umbral acumulados
  badge_color     text not null default '#6b7280',
  badge_icon      text,                     -- nombre lucide
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, orden)
);

-- ─── 3. RECOMPENSAS configurables ────────────────────────────
create table if not exists public.toques_recompensas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,           -- '1 hora libre'
  descripcion     text not null default '',
  coste_toques    integer not null,
  tipo            text not null check (tipo in ('hora_libre','dia_vacaciones','fin_semana','semana_vacaciones','custom')),
  activa          boolean not null default true,
  orden           smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── 4. MOVIMIENTOS (ledger inmutable) ───────────────────────
create table if not exists public.toques_movimientos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',
  toques          integer not null,        -- positivo = gana, negativo = canje
  origen          text not null check (origen in ('regla','bonus_periodo','manual','canje','ajuste')),
  regla_id        uuid references public.toques_reglas(id) on delete set null,
  recompensa_id   uuid references public.toques_recompensas(id) on delete set null,
  canje_id        uuid,                    -- FK soft a toques_canjes
  periodo         public.toque_periodo,    -- solo para origen='bonus_periodo'
  fecha           date not null default current_date,
  motivo          text not null default '',
  contexto        jsonb not null default '{}'::jsonb,  -- ej: { fichaje_id, comunicado_id }
  otorgado_por    uuid references auth.users(id) on delete set null, -- null si automatico
  created_at      timestamptz not null default now()
);

create index if not exists idx_toques_mov_user_fecha
  on public.toques_movimientos(user_id, fecha desc);
create index if not exists idx_toques_mov_empresa_fecha
  on public.toques_movimientos(empresa_id, fecha desc);
create index if not exists idx_toques_mov_origen
  on public.toques_movimientos(empresa_id, origen, fecha desc);

-- Idempotencia: un usuario no puede ganar dos veces la misma regla diaria el mismo día
create unique index if not exists uniq_toques_mov_regla_diaria
  on public.toques_movimientos(user_id, regla_id, fecha)
  where origen = 'regla' and regla_id is not null;

-- ─── 5. CANJES (solicitudes de recompensa) ───────────────────
create table if not exists public.toques_canjes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',
  recompensa_id   uuid not null references public.toques_recompensas(id) on delete restrict,
  coste_toques    integer not null,        -- snapshot en el momento del canje
  estado          public.canje_estado not null default 'pendiente',
  solicitado_at   timestamptz not null default now(),
  resuelto_at     timestamptz,
  resuelto_por    uuid references auth.users(id) on delete set null,
  fecha_disfrute  date,                    -- si aprobado
  notas_solicitud text not null default '',
  notas_revision  text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_toques_canjes_empresa_estado
  on public.toques_canjes(empresa_id, estado, solicitado_at desc);
create index if not exists idx_toques_canjes_user
  on public.toques_canjes(user_id, solicitado_at desc);

-- ─── 6. GANADORES (snapshots por periodo) ────────────────────
create table if not exists public.toques_ganadores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  periodo         public.toque_periodo not null,
  periodo_inicio  date not null,
  periodo_fin     date not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',
  total_toques    integer not null,
  bonus_otorgado  integer not null,
  titulo          text,                    -- 'Empleado del Mes', etc.
  created_at      timestamptz not null default now(),
  unique (empresa_id, periodo, periodo_inicio)
);

create index if not exists idx_toques_ganadores_empresa
  on public.toques_ganadores(empresa_id, periodo, periodo_inicio desc);

-- ─── 7. VISTA agregada de balance ────────────────────────────
create or replace view public.toques_balance as
select
  m.empresa_id,
  m.user_id,
  sum(case when m.toques > 0 then m.toques else 0 end)                       as toques_acumulados,
  sum(m.toques)                                                              as toques_canjeables,
  max(m.created_at)                                                          as ultimo_movimiento_at
from public.toques_movimientos m
group by m.empresa_id, m.user_id;

-- ─── 8. FUNCIÓN ranking por periodo ──────────────────────────
create or replace function public.toques_ranking(
  p_empresa_id uuid,
  p_inicio     date,
  p_fin        date
) returns table (
  user_id uuid,
  empleado_nombre text,
  total integer
) language sql stable as $$
  select
    m.user_id,
    max(m.empleado_nombre) as empleado_nombre,
    sum(case when m.toques > 0 then m.toques else 0 end)::int as total
  from public.toques_movimientos m
  where m.empresa_id = p_empresa_id
    and m.fecha between p_inicio and p_fin
  group by m.user_id
  order by total desc;
$$;

-- ─── 9. TRIGGERS de updated_at (uno por tabla) ───────────────
create or replace function public.set_toques_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists toques_reglas_updated on public.toques_reglas;
create trigger toques_reglas_updated before update on public.toques_reglas
  for each row execute function public.set_toques_updated_at();
-- (repetir para niveles, recompensas, canjes)

-- ─── 10. RLS ─────────────────────────────────────────────────
alter table public.toques_movimientos enable row level security;
alter table public.toques_canjes      enable row level security;
alter table public.toques_reglas      enable row level security;
alter table public.toques_recompensas enable row level security;
alter table public.toques_niveles     enable row level security;
alter table public.toques_ganadores   enable row level security;

-- READ: cualquier empleado de la empresa lee todo (ranking público)
create policy "toques_mov_read" on public.toques_movimientos for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
-- (repetir pattern para canjes, reglas, recompensas, niveles, ganadores)

-- INSERT movimientos: solo service-role (cron + actions del servidor)
-- El cliente NUNCA inserta directo en toques_movimientos.

-- INSERT canjes: el propio usuario crea su solicitud
create policy "toques_canjes_insert_own" on public.toques_canjes for insert to authenticated
  with check (
    user_id = auth.uid()
    and empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

-- UPDATE canjes: solo admin RRHH/gerencia (vía Server Action con check de rol)
-- Reglas/recompensas/niveles: solo admin (vía Server Action)
```

**Notas de modelado:**
- `toques_movimientos` es un **ledger inmutable** (append-only). El balance se deriva de la suma. Esto garantiza auditoría perfecta.
- `toques_acumulados` (para nivel) suma SOLO los positivos. `toques_canjeables` suma todos (positivos y canjes negativos). Un canje aprobado inserta un movimiento negativo.
- El índice único `uniq_toques_mov_regla_diaria` evita duplicados si el cron se reintenta el mismo día.
- `toques_ganadores` se rellena por cron con desempate `antigüedad → nombre`.
- `view toques_balance` reemplaza tabla cacheada → siempre coherente con el ledger.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: BD + Migración + Seed
**Objetivo**: Crear migración `056_toques_fidelidad.sql` con las 6 tablas, enums, vista, función ranking, triggers y RLS. Insertar seed de reglas, niveles y recompensas por defecto para cada empresa existente. Aplicar manualmente desde Supabase SQL Editor.
**Validación**:
- `select count(*) from toques_reglas where empresa_id = <X>` ≥ 9
- `select count(*) from toques_niveles where empresa_id = <X>` = 7
- `select count(*) from toques_recompensas where empresa_id = <X>` = 5
- `select * from toques_balance limit 1` no falla
- `select * from toques_ranking('<empresa_uuid>', current_date - 7, current_date)` retorna vacío sin error

### Fase 2: Types + Services lectura
**Objetivo**: Crear `src/features/toques/types/toques.types.ts` con todos los tipos. Crear `toques.service.ts` con funciones de lectura: `getMiBalance`, `getMiTimeline`, `getRanking(periodo)`, `getHallOfFame`, `getRecompensas`, `getMisCanjes`, `getNiveles`, `calcularNivel(toques, niveles)`. Toda lectura usa el cliente Supabase del navegador con RLS.
**Validación**:
- `npm run typecheck` pasa
- Test manual: importar `getMiBalance` en una página dummy y ver datos de ejemplo

### Fase 3: Reglas Runner (motor de devengo)
**Objetivo**: Crear `reglas-runner.service.ts` ejecutable desde un Route Handler con service-role. Implementar evaluadores idempotentes para las 9 reglas iniciales: `puntualidad_elite`, `cumplidor_dia`, `velocidad_chat`, `cero_olvidos_fichaje`, `sin_vacaciones_trimestre`, `appcc_al_dia`, `comunicado_leido_primero`, `asistencia_perfecta_semanal`, `resolucion_incidencias`. Cada evaluador devuelve un array `{ user_id, regla_id, contexto, fecha }` y el runner los inserta en batch en `toques_movimientos` aprovechando el índice único para idempotencia.
**Validación**:
- Llamar `/api/toques/cron/devengo-diario` con `?fecha=YYYY-MM-DD` retorna `{ inserted, skipped }`
- Re-ejecutar la misma fecha NO crea duplicados (skipped > 0)
- Verificar en `toques_movimientos` que aparecen movimientos con `origen='regla'` y `contexto` poblado

### Fase 4: UI MI PORTAL > Toques (lectura)
**Objetivo**: Crear ruta `/mi-panel/toques`, `ToquesView.tsx` y subcomponentes (MiBalanceCard, MisLogrosTimeline, RankingTabs, RankingTable, HallOfFame, RecompensasGrid, MisCanjesList). Añadir entrada en sidebar bajo MI PORTAL: `{ title: "TOQUES", url: "/mi-panel/toques", icon: Trophy }`. Sin acción de canjear todavía (botón disabled o que abre dialog dummy).
**Validación**:
- Playwright: navegar a `/mi-panel/toques` con usuario test, capturar screenshot, validar que muestra balance, ranking y recompensas
- Cambiar tabs HOY/SEMANA/MES recarga ranking
- `npm run build` pasa

### Fase 5: Canjes (acción usuario + aprobación admin)
**Objetivo**: Crear `toques-actions.ts` con `canjearRecompensa(recompensaId)` (verifica balance ≥ coste, crea `toques_canjes` pendiente — el descuento del balance se materializa al aprobar mediante un movimiento negativo). Crear `aprobarCanje(canjeId, fechaDisfrute)` y `rechazarCanje(canjeId, motivo)` (solo rol admin/rrhh/gerencia, validan sesión vía service-role). Crear `CanjesAdminView` en panel RRHH/Gerencia con tabla y dialogs.
**Validación**:
- Empleado con 100 toques canjea "1 día vacaciones" → aparece en Mis Canjes pendiente
- Admin aprueba → balance canjeable del empleado pasa de 100 a 0
- Empleado con 30 toques no puede canjear "1 hora libre" (50) — botón disabled o action lanza error
- Doble-click en canjear no crea dos canjes (idempotencia básica con disable + spinner)

### Fase 6: Cron snapshots + bonus periódicos
**Objetivo**: Crear `/api/toques/cron/snapshot-periodos` que cada noche detecta si toca cerrar día (siempre), semana (domingo), mes (último día), trimestre (31-mar / 30-jun / 30-sep / 31-dic) y año (31-dic). Para cada cierre: calcula ganador con `toques_ranking` + desempate antigüedad/alfabético, inserta fila en `toques_ganadores`, inserta movimiento `bonus_periodo` con los toques bonus correspondientes (5/15/50/150/500). Configurar cron en Vercel: diario 23:55 y diario 00:05.
**Validación**:
- Llamar manualmente con `?simular=ano&fecha=2026-12-31` crea snapshot año + bonus 500 al líder
- `select * from toques_ganadores order by created_at desc limit 5` muestra entradas correctas
- Hall of Fame en UI muestra los snapshots

### Fase 7: Admin Ajustes — configuración (reglas/recompensas/niveles)
**Objetivo**: Añadir 3 tabs en `Ajustes` (visible solo para roles admin/rrhh/gerencia): `ReglasToquesTab`, `RecompensasToquesTab`, `NivelesToquesTab`. Cada tab CRUD básico con tabla + dialog edit. Crear `OtorgarToqueDialog` accesible desde `RankingAdminView` o desde ficha de empleado en RRHH para bonus manual con motivo.
**Validación**:
- Cambiar `toques` de regla `puntualidad_elite` de 1 a 2 → próxima ejecución de cron otorga 2 toques
- Desactivar regla → no se evalúa en próximo cron
- Otorgar +10 manual a empleado X → aparece en su timeline con motivo

### Fase 8: Realtime + notificación toast
**Objetivo**: Crear `useToquesRealtime` que se suscribe a `INSERT` en `toques_movimientos` filtrado por `user_id = current`. Mostrar toast "¡Has ganado N toques por <regla>!" usando shadcn `useToast`. Habilitar publication realtime para la tabla en Supabase. Documentar el setup en `.claude/memory/project/toques.md`.
**Validación**:
- Insertar manualmente un movimiento desde Supabase para usuario logueado → aparece toast inmediatamente
- Verificar que otros usuarios no reciben el toast (RLS filtra)

### Fase 9: Validación Final
**Objetivo**: Sistema funcionando end-to-end con datos reales y todas las pantallas operativas.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: flujo completo empleado (ver balance → ver ranking → canjear → ver pendiente)
- [ ] Playwright: flujo completo admin (configurar regla → aprobar canje → otorgar manual)
- [ ] Cron diario simulado en BD test: 5 días seguidos, ganador del día rota correctamente
- [ ] Snapshot semanal funciona, bonus +15 aplicado, título visible en Hall of Fame
- [ ] RLS verificado: usuario empresa A no ve datos de empresa B
- [ ] Documentar en `.claude/memory/project/toques.md`
- [ ] Actualizar `MEMORY.md` con entrada al nuevo módulo

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

*(vacío — se rellena durante `bucle-agentico`)*

---

## Gotchas

- [ ] **Idempotencia del cron**: el índice único `uniq_toques_mov_regla_diaria` es la red de seguridad — al insertar usar `on conflict do nothing` para no fallar el batch entero si una regla ya se otorgó.
- [ ] **Ranking vs balance**: NO confundir `toques_acumulados` (para nivel, solo positivos) con `toques_canjeables` (balance vivo, suma de todos). Documentar en types con JSDoc.
- [ ] **Canje no descuenta hasta aprobación**: si descuentas al solicitar y rechazas hay que devolver — más simple es crear el movimiento negativo SOLO al aprobar. La UI debe mostrar "saldo reservado" calculado en cliente para evitar doble canje.
- [ ] **Service-role para cron**: las inserts del runner deben usar el cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY` (no anon), porque el cron corre sin sesión de usuario.
- [ ] **Vercel Cron**: configurar `vercel.json` con dos crons (`23:55` y `00:05`); proteger los endpoints con header `Authorization: Bearer ${CRON_SECRET}`.
- [ ] **Profiles tipos reales**: `profiles.empresa_id uuid`, `profiles.user_id` sin UNIQUE → modelar como 035/038/050, NUNCA copiar 008/009 (ver `.claude/memory/feedback/supabase_tipos_reales.md`).
- [ ] **RLS join anon**: si una policy hace `where empresa_id in (select empresa_id from profiles)` y el rol no puede leer profiles → falla silenciosamente. Verificar policy de `profiles` antes de probar (ver `.claude/memory/feedback/rls_join_anon.md`).
- [ ] **Realtime**: requiere `alter publication supabase_realtime add table public.toques_movimientos`. Sin esto el toast nunca dispara.
- [ ] **Desempate ganador**: orden `total desc, antiguedad asc, nombre asc`. Antigüedad sale de `profiles.fecha_alta` o `created_at` — verificar qué campo existe antes de implementar.
- [ ] **Reglas que dependen de datos no siempre presentes**: `velocidad_chat` requiere tabla de mensajes con timestamps; `appcc_al_dia` requiere tabla de temperaturas. Si la fuente no existe, la regla debe devolver `[]` (skip silencioso) — no fallar el cron.
- [ ] **Tabla solicitudes_personal existente**: la regla `sin_vacaciones_trimestre` lee de `solicitudes_personal` (subtipo='vacaciones'). Confirmar campos antes de implementar.
- [ ] **Multi-tenant en cron**: el cron itera sobre TODAS las empresas — separar por empresa al evaluar reglas y otorgar.
- [ ] **Botones**: usar `<Button variant="primary" size="lg">` con icono. Posición `top-4 right-4` en headers de pantallas admin (ver `.claude/memory/feedback/ui_standard_buttons.md`).
- [ ] **Protocolo guardado**: TODA escritura con try/catch + `console.error('[tabla:op] ...')` + throw. NO localStorage para canjes ni movimientos.

## Anti-Patrones

- NO crear una tabla `toques_balance` cacheada — usar la `view`. Cachear es bug-magnet (drift entre ledger y caché).
- NO permitir que el cliente inserte en `toques_movimientos` directamente (siempre vía Server Action o cron con service-role).
- NO consumir toques al solicitar canje — solo al aprobar (con movimiento negativo).
- NO hardcodear las reglas en código — siempre leer de `toques_reglas` (configurable desde Ajustes).
- NO usar `any`. Tipos completos en `toques.types.ts`.
- NO omitir validación Zod en `canjearRecompensa`, `otorgarToqueManual`, `aprobarCanje`.
- NO replicar componentes existentes — reusar shadcn (`Card`, `Tabs`, `Dialog`, `Avatar`, `Badge`, `Progress`, `Button`).
- NO crear nueva entrada en sidebar fuera del grupo MI PORTAL.

---

*PRP pendiente aprobación. No se ha modificado código.*
