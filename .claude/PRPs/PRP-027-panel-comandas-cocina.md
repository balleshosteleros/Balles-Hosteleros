# PRP-027: Panel Comandas — submódulo de Cocina (KDS)

> **Estado**: PENDIENTE
> **Fecha**: 2026-04-17
> **Proyecto**: Balles-Hosteleros
> **Ruta propuesta**: `/cocina/comandas`
> **Feature dir**: `src/features/cocina/comandas/`
> **Depende de**: PRP-025 (POS) · migración `035_pos.sql` ya aplicada

---

## Objetivo

Construir un **Kitchen Display System (KDS)** dentro del submódulo Cocina: un panel tipo pipeline/kanban en **tiempo real** que muestra las comandas enviadas desde el POS (`pos_ticket_lineas` con `enviada_at` not null), organizadas en columnas por estado (**Pendiente → Preparando → Listo → Servido**), agrupadas por mesa, con tiempos transcurridos y alarmas de retraso. Optimizado para monitor de cocina en **landscape** y real-time vía Supabase Realtime.

## Por Qué

| Problema | Solución |
|----------|----------|
| La cocina hoy depende del ticket de impresora; si se pierde o no se ve, la comanda se retrasa y no hay trazabilidad del tiempo de preparación. | Panel digital siempre visible, con tiempos en vivo y estado por línea. |
| No existe feedback desde cocina a sala: el camarero no sabe qué platos están listos hasta ir físicamente. | Acción "Marcar listo" dispara aviso a sala (badge + sonido/toast en POS) sobre esa misma línea del ticket. |
| Los retrasos de preparación no se miden ni se detectan hasta que llega la queja del cliente. | Alarmas visuales por umbrales configurables (ámbar >8 min, rojo >15 min) y métricas base para analítica. |
| Falta una vista consolidada por mesa: la cocina lee líneas sueltas sin saber el orden de envío. | Agrupación por mesa (o ticket) con hora de envío y nº de comensales; prioriza la mesa más antigua. |
| Las comandas enviadas desde POS (PRP-025 F7) no tienen consumidor — sólo imprimen. | Consumidor digital real-time que reemplaza (o acompaña) al tiquet de impresora. |

**Valor de negocio**:
- Reducción de tiempo medio de servicio (target -20%).
- Cero comandas "perdidas" entre sala y cocina.
- Base de datos de tiempos por plato/partida para optimizar escandallos y staffing.
- Cocina sin papel (ticket de comanda pasa a ser respaldo, no canal principal).

## Qué

### Criterios de Éxito

- [ ] Al pulsar "Enviar a cocina" en POS (PRP-025 Fase 7), la comanda aparece en `/cocina/comandas` en <2 s sin refrescar la página.
- [ ] Columnas **Pendiente / Preparando / Listo / Servido** visibles en landscape 1920×1080 sin scroll horizontal para ≥6 tarjetas por columna.
- [ ] Cada tarjeta muestra: nº mesa (o "Barra"), nº comensales, nº ticket, hora de envío, líneas pendientes agrupadas por destino (COCINA/BARRA), nota por línea, y **cronómetro vivo** desde `enviada_at`.
- [ ] Acciones por tarjeta: **Empezar** (Pendiente→Preparando), **Marcar listo** (Preparando→Listo), **Servido** (Listo→Servido, desaparece tras 60 s). Acciones también disponibles por **línea individual**.
- [ ] "Marcar listo" dispara evento que aparece como badge/toast en POS sobre el ticket origen (campana "comanda lista para recoger").
- [ ] Alarma visual (borde ámbar ≥8 min, rojo ≥15 min, parpadeo ≥20 min) con umbrales configurables en ajustes (defaults globales).
- [ ] Filtro rápido por **destino** (TODOS / COCINA / BARRA) y por **partida** (si está asignada a la línea) para separar pantallas por puesto.
- [ ] Agrupación por mesa con resumen: "Mesa 5 · 4 comensales · enviada 18:32 · 3/5 listos".
- [ ] Usuario con rol `COCINA` / `JEFE_COCINA` / `GERENTE` accede; otros roles reciben redirect a `/cocina`.
- [ ] RLS confirma que sólo se ven líneas de la empresa del usuario.
- [ ] Landscape 1920×1080 y 2560×1440 validados con Playwright screenshot.

### Comportamiento Esperado (Happy Path)

1. Camarero en POS añade líneas a ticket de Mesa 5 y pulsa **Enviar a cocina** (PRP-025 F7).
2. Acción `enviarACocina()` marca `pos_ticket_lineas.enviada_at = now()` y `pos_tickets.estado = 'ENVIADO'`.
3. Pantalla de cocina está suscrita a canal Supabase Realtime `postgres_changes` de `pos_ticket_lineas` (UPDATE donde `enviada_at IS NOT NULL`) → recibe evento.
4. En <2 s aparece nueva **tarjeta de comanda** en columna **Pendiente**, agrupada por mesa, con líneas y cronómetro arrancado.
5. Cocinero pulsa **Empezar** en la tarjeta (o en una línea) → pasa a **Preparando**, se guarda `estado_cocina = 'PREPARANDO'` + `preparando_at`.
6. Al terminar, pulsa **Marcar listo** → columna **Listo**, `estado_cocina = 'LISTO'` + `listo_at`. Un badge aparece en el POS del camarero sobre ese ticket.
7. Camarero recoge el plato y marca **Servido** desde POS o desde la propia pantalla (tablet en pase) → `estado_cocina = 'SERVIDO'` + `servido_at`. La tarjeta desaparece a los 60 s.
8. Si una línea lleva >8 min sin pasar a Listo, borde ámbar; >15 min rojo; >20 min parpadeo. Visible también en el POS.
9. Al final del turno, la información de `preparando_at`/`listo_at`/`servido_at` queda para reporting (tiempos medios por plato, por partida, por turno).

---

## Contexto

### Referencias (patrones existentes)

- **POS y comandas origen**: `src/features/sala/pos/actions/tickets-actions.ts` → función `enviarACocina(ticketId)` ya marca `enviada_at` y actualiza ticket. **No se modifica**, se consume.
- **Modelo de datos POS**: migración `supabase/migrations/035_pos.sql` (tablas `pos_tickets`, `pos_ticket_lineas` con campo `destino` enum `COCINA|BARRA|NINGUNO` y `nota_cocina`).
- **Feature-first Cocina**: `src/features/cocina/` (actions, components, data, hooks, services, types). Añadir subcarpeta `comandas/`.
- **Partidas existentes**: `src/features/cocina/actions/partidas-actions.ts` + tabla `partidas` (nombre, responsable). Se usará como dimensión opcional para filtrado/asignación.
- **Sidebar**: `src/features/layout/components/app-sidebar.tsx` → constante `cocinaSubs`. Añadir entrada "COMANDAS" con icono (Utensils o Timer).
- **App layout títulos**: `src/features/layout/components/app-layout.tsx` → añadir ruta `/cocina/comandas` al mapa `SECTION_TITLES` y `SECTION_ICONS`.
- **Get context**: `src/lib/supabase/get-context.ts` — patrón `getAppContext()` usado en todos los actions.
- **Realtime**: actualmente no hay uso de Supabase Realtime en el repo. Se introduce por primera vez. Usar `supabase.channel()` del client-side browser client (no service client).
- **Estándar UI**: shadcn `Button` + `Card` + `Badge`. Tipografía táctil grande (no hover-dependent). Colores de alarma Tailwind: `border-amber-500`, `border-red-500`, `animate-pulse`.
- **MEMORY.md**: sin `localStorage` como fuente de verdad, estándar botones primary con icono.

### Arquitectura Propuesta

```
src/features/cocina/comandas/
├── components/
│   ├── ComandasBoard.tsx          # Kanban principal (4 columnas) + header filtros
│   ├── ColumnaEstado.tsx          # Columna virtualizada (Pendiente/Preparando/Listo/Servido)
│   ├── ComandaCard.tsx            # Tarjeta por mesa+ticket con líneas y cronómetro
│   ├── LineaItem.tsx              # Línea individual con nota, cantidad y acción
│   ├── CronometroVivo.tsx         # Timer que re-renderiza cada segundo sin re-fetch
│   ├── FiltrosBar.tsx             # Filtros destino/partida + ajustes de umbrales
│   ├── AlertaRetraso.tsx          # Wrapper que aplica clases de borde según umbral
│   └── HistorialComandas.tsx      # (opcional, F8) vista del día con tiempos
├── hooks/
│   ├── useComandasRealtime.ts     # Suscripción Supabase Realtime + reducer
│   ├── useCronometroGlobal.ts     # Tick único 1s que actualiza todas las tarjetas
│   └── useUmbralesAlarma.ts       # Lectura de umbrales (default globales, override empresa)
├── services/
│   ├── fetch-comandas-abiertas.ts # Carga inicial: líneas enviadas no servidas del día
│   ├── clasificador-estados.ts    # Deriva columna a partir de estado_cocina
│   └── avisar-sala.ts             # Dispara notificación a POS (evento realtime / canal)
├── actions/
│   ├── comandas-actions.ts        # updateEstadoCocinaLinea, updateEstadoCocinaTicket
│   └── umbrales-actions.ts        # leer/guardar umbrales por empresa
├── types/
│   └── index.ts                   # ComandaAgrupada, EstadoCocina, UmbralesAlarma
└── data/
    └── mock-comandas.ts           # Seed de desarrollo
```

Rutas App Router:
```
src/app/(main)/cocina/comandas/page.tsx          # Entry: valida rol + carga inicial server-side
src/app/(main)/cocina/comandas/historial/page.tsx # (F8 opcional) histórico del día
```

Integración con POS (bidireccional):
- `src/features/sala/pos/components/TicketEnVivo.tsx` recibe badge de "línea lista" via hook nuevo `useAvisosCocina` que escucha cambios de `estado_cocina` sobre sus tickets abiertos.

### Modelo de Datos — migración `037_cocina_comandas.sql`

Extiende `pos_ticket_lineas` con estado de cocina y timestamps, sin tabla nueva (el kanban se deriva del estado de cada línea). Se añade una tabla de configuración de umbrales por empresa.

```sql
-- ─── 0. ENUM estado_cocina ───────────────────────────────────
do $$ begin
  create type public.linea_estado_cocina as enum (
    'PENDIENTE','PREPARANDO','LISTO','SERVIDO','CANCELADA'
  );
exception when duplicate_object then null; end $$;

-- ─── 1. Columnas nuevas en pos_ticket_lineas ─────────────────
alter table public.pos_ticket_lineas
  add column if not exists estado_cocina public.linea_estado_cocina not null default 'PENDIENTE',
  add column if not exists preparando_at timestamptz,
  add column if not exists listo_at      timestamptz,
  add column if not exists servido_at    timestamptz,
  add column if not exists partida_id    uuid,
  add column if not exists prioridad     smallint not null default 0;

-- FK opcional a partidas (si existe la tabla)
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='partidas')
     and not exists (select 1 from information_schema.table_constraints
                     where constraint_name='pos_lineas_partida_fkey' and table_name='pos_ticket_lineas') then
    alter table public.pos_ticket_lineas
      add constraint pos_lineas_partida_fkey
      foreign key (partida_id) references public.partidas(id) on delete set null;
  end if;
end $$;

-- Índice para el board: sólo líneas activas del día
create index if not exists idx_pos_lineas_kds_activas
  on public.pos_ticket_lineas(ticket_id, estado_cocina)
  where enviada_at is not null and estado_cocina <> 'SERVIDO';

-- ─── 2. Tabla de umbrales de alarma por empresa ──────────────
create table if not exists public.cocina_alarmas_config (
  empresa_id        uuid primary key references public.empresas(id) on delete cascade,
  umbral_ambar_min  smallint not null default 8,
  umbral_rojo_min   smallint not null default 15,
  umbral_parpadeo_min smallint not null default 20,
  sonido_activo     boolean  not null default true,
  updated_at        timestamptz not null default now()
);

alter table public.cocina_alarmas_config enable row level security;
drop policy if exists "cocina_alarmas_empresa" on public.cocina_alarmas_config;
create policy "cocina_alarmas_empresa" on public.cocina_alarmas_config
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- ─── 3. Realtime publication ─────────────────────────────────
-- Asegurar que Supabase Realtime emite UPDATEs de líneas:
alter publication supabase_realtime add table public.pos_ticket_lineas;
alter publication supabase_realtime add table public.pos_tickets;

-- ─── 4. Trigger: al marcar SERVIDO todas las líneas de un ticket ENVIADO → estado COBRADO sin tocar (lo hace POS al cobrar). No auto-cerramos ticket desde cocina.
-- Sólo sincronizamos campos de timestamps:
create or replace function public.pos_linea_sync_timestamps()
returns trigger language plpgsql as $$
begin
  if new.estado_cocina = 'PREPARANDO' and old.estado_cocina <> 'PREPARANDO' then
    new.preparando_at := coalesce(new.preparando_at, now());
  end if;
  if new.estado_cocina = 'LISTO' and old.estado_cocina <> 'LISTO' then
    new.listo_at := coalesce(new.listo_at, now());
  end if;
  if new.estado_cocina = 'SERVIDO' and old.estado_cocina <> 'SERVIDO' then
    new.servido_at := coalesce(new.servido_at, now());
  end if;
  return new;
end $$;

drop trigger if exists trg_pos_linea_sync_ts on public.pos_ticket_lineas;
create trigger trg_pos_linea_sync_ts
  before update on public.pos_ticket_lineas
  for each row execute function public.pos_linea_sync_timestamps();
```

**Reutilizados (sin modificación)**: `pos_tickets`, `pos_ticket_lineas` (base), `mesas`, `partidas`, `profiles`, `empresas`.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Sólo se definen las FASES. Las subtareas se generan al entrar a cada fase siguiendo el bucle agéntico.

### Fase 1: Migración BD + tipos + realtime publication
**Objetivo**: Aplicar `037_cocina_comandas.sql`, generar tipos espejo en `types/index.ts`, verificar que `pos_ticket_lineas` está en la publication `supabase_realtime`.
**Validación**:
- Migración corre idempotente en Supabase.
- `select estado_cocina from pos_ticket_lineas limit 1` funciona.
- Test manual: UPDATE de una fila emite evento en `supabase.channel('test').on('postgres_changes', ...)`.
- `npm run typecheck` verde.

### Fase 2: Action de cambio de estado cocina + servicio de carga inicial
**Objetivo**: `comandas-actions.ts` con `updateEstadoCocinaLinea(lineaId, estado)` y `updateEstadoCocinaTicket(ticketId, estado)` (bulk). `fetch-comandas-abiertas.ts` retorna líneas enviadas no servidas del día agrupadas por ticket/mesa.
**Validación**:
- Cambiar estado respeta RLS (otra empresa → error).
- Transición inválida (SERVIDO→PENDIENTE) bloqueada por validación Zod.
- Fetch inicial devuelve <100 ms con 200 líneas.

### Fase 3: Hook de Realtime + reducer local
**Objetivo**: `useComandasRealtime` suscribe a `postgres_changes` de `pos_ticket_lineas` filtrado por `empresa_id` (join vía `pos_tickets`). Reducer aplica INSERT / UPDATE / DELETE sobre estado cliente.
**Validación**:
- Al hacer UPDATE remoto, el hook re-renderiza en <2 s sin polling.
- Desconexión de red → hook intenta reconectar (backoff exponencial) y hace re-fetch al volver.
- 100 updates/min no degradan UI (throttle/dedupe).

### Fase 4: UI Kanban — ComandasBoard + ColumnaEstado + ComandaCard
**Objetivo**: Layout 4 columnas full-viewport, responsive landscape. `ComandaCard` con mesa, ticket, hora envío, líneas agrupadas por destino, notas. Botones grandes táctiles.
**Validación**:
- Playwright screenshot 1920×1080: 4 columnas visibles, tarjetas legibles a 2 m de distancia.
- Touch target mínimo 64 px.
- Sin scroll horizontal.

### Fase 5: Cronómetro vivo + alarmas visuales
**Objetivo**: `useCronometroGlobal` emite tick cada 1 s sin re-fetch. `AlertaRetraso` aplica clases según umbral leído de `cocina_alarmas_config`. Ajustes de umbral editables (modal simple en F8 o directamente).
**Validación**:
- Tarjeta con `enviada_at` = hace 9 min muestra borde ámbar.
- 16 min → rojo. 21 min → rojo + `animate-pulse`.
- Cambio de umbrales en ajustes recarga el board.

### Fase 6: Filtros (destino, partida) + agrupación por mesa
**Objetivo**: `FiltrosBar` con chips TODOS/COCINA/BARRA y dropdown de partida. La agrupación por mesa se hace en el selector/service; mesas con más antigüedad arriba.
**Validación**:
- Filtro COCINA oculta líneas `destino='BARRA'`.
- Mesa con 5 líneas de las cuales 3 son LISTO se ve como "3/5 listos" en el header de la card.

### Fase 7: Acciones: Empezar / Marcar listo / Servido (línea y ticket)
**Objetivo**: Botones en card y línea llaman a `updateEstadoCocina*`. Transiciones permitidas: PENDIENTE→PREPARANDO→LISTO→SERVIDO (+ CANCELADA desde cualquiera). Card salta de columna en realtime. Servido desaparece a los 60 s (animación fade-out).
**Validación**:
- Click en "Marcar listo" de una línea → estado cambia, cronómetro "listo_at" se fija.
- Marcar listo a nivel ticket actualiza todas las líneas en `PREPARANDO` a `LISTO` (bulk).
- Undo accidental: botón "Volver" en los primeros 10 s tras cambio (toast con acción).

### Fase 8: Aviso a sala (bidireccional POS ↔ Cocina)
**Objetivo**: Cuando línea pasa a LISTO, el POS muestra badge "Comanda lista — Mesa X" en `TicketEnVivo` y en lista de mesas. Hook `useAvisosCocina` reutiliza misma suscripción realtime filtrada por tickets del usuario.
**Validación**:
- En dos ventanas (POS y KDS) misma empresa: al marcar listo en KDS, POS muestra badge en <2 s.
- El badge se limpia cuando el camarero marca SERVIDO desde POS.

### Fase 9: Permisos, ruta, sidebar, layout
**Objetivo**: Guard `usePermisoCocina` (roles `COCINA`, `JEFE_COCINA`, `GERENTE`, `ENCARGADO`). Añadir `/cocina/comandas` a `app-sidebar.tsx` (`cocinaSubs`) con icono Timer/Utensils y a `app-layout.tsx` (`SECTION_TITLES`/`SECTION_ICONS`).
**Validación**:
- Usuario sin permiso redirigido a `/cocina` con toast.
- Entrada "COMANDAS" visible en sidebar colapsado y expandido.

### Fase 10: (Opcional) Historial del día + métricas base
**Objetivo**: Página `/cocina/comandas/historial` con tabla de líneas SERVIDAS/CANCELADAS del día: plato, mesa, enviada_at, listo_at, servido_at, duración preparación, duración pase.
**Validación**:
- Filtro por partida y rango horario.
- Export CSV opcional.

### Fase 11: QA + Playwright + validación final
**Objetivo**: Test E2E que ejecuta: crear ticket en POS → enviar a cocina → verificar aparición en KDS en otra pestaña → cambiar estados → verificar badge en POS → marcar servido.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright screenshot 1920×1080 y 2560×1440.
- [ ] Todos los criterios de éxito marcados.
- [ ] RLS cross-empresa comprobado (usuario B no ve líneas de empresa A).

---

## Aprendizajes (Self-Annealing)

### 2026-04-17: Aplicación de migraciones
- **Error**: `scripts/apply-migration-NNN.ts` falla con "Could not find the function public.exec_sql". La RPC `exec_sql` no está creada en el proyecto Supabase.
- **Fix**: Aplicar el SQL manualmente en Supabase Studio → SQL Editor. El script de aplicación sirve como envoltorio que muestra el link y el path. No es bloqueante para continuar con código TS.
- **Aplicar en**: todos los PRPs con migración nueva — no esperar a que el script corra; asumir aplicación manual y avisar al usuario al final.

### 2026-04-17: Publication supabase_realtime idempotente
- **Error**: `alter publication supabase_realtime add table` falla si la tabla ya está añadida.
- **Fix**: Envolver en `do $$ if not exists (select 1 from pg_publication_tables where ...) then execute '...' end if; end $$`.
- **Aplicar en**: futuras migraciones que añadan tablas a Realtime.

---

## Gotchas

- [ ] **Supabase Realtime necesita publication**: si `pos_ticket_lineas` no está añadido a `supabase_realtime`, no llegan eventos. La migración lo hace, verificar en dashboard que sigue activo tras deploys.
- [ ] **RLS en canales Realtime**: los filtros server-side de RLS se aplican también a eventos en vivo. Ideal, pero verificar que `auth.uid()` está disponible en la sesión del cliente cuando se suscribe (cliente browser, no server client).
- [ ] **Filtrado por empresa_id en suscripción**: `pos_ticket_lineas` no tiene `empresa_id` directo; el filtro debe hacerse post-fetch en cliente o mediante un segundo canal que oyente cambios en `pos_tickets` y haga join. Alternativa: crear view materializada o RPC que acepte subscription.
- [ ] **Cronómetro vivo sin re-render masivo**: usar `useCronometroGlobal` con un único `setInterval(1000)` que pasa `now` por context; NO un timer por tarjeta (re-renderiza todo cada segundo).
- [ ] **Undo de transiciones**: al revertir (p.ej. `LISTO` → `PREPARANDO`) hay que limpiar `listo_at` para que la métrica sea correcta; decidir política (limpiar o mantener).
- [ ] **Cancelada vs Anulada**: línea CANCELADA en cocina no anula el ticket; es responsabilidad del POS recalcular totales si se elimina. No tocar stock aquí.
- [ ] **Mesa "Barra"**: tickets sin `mesa_id` deben mostrarse como "Barra/Mostrador" agrupados por nº ticket, no por mesa.
- [ ] **Monitor fijo sin auth interactivo**: si el monitor de cocina queda logueado 24/7, contemplar refresh de token (Supabase ya maneja auto-refresh, pero probar tras >8 h).
- [ ] **Performance a 200+ líneas día**: la query inicial filtra por `enviada_at IS NOT NULL AND estado_cocina <> 'SERVIDO'` y `abierto_at >= today`. Mantener índice parcial creado en la migración.
- [ ] **Imprimir ticket físico sigue existiendo**: el KDS complementa, no reemplaza obligatoriamente. Hacer flag por empresa `cocina_imprime_ticket` (fuera de alcance PRP, futuro).
- [ ] **Doble click / re-entrada**: deshabilitar botones 500 ms tras acción para evitar transiciones dobles en táctil.

## Anti-Patrones

- NO duplicar tabla de comandas: las comandas SON las líneas de `pos_ticket_lineas` con `enviada_at`.
- NO hacer polling de la BD cada X segundos: usar Realtime + fetch inicial únicamente.
- NO poner lógica de transición de estado en el componente: vive en `services/clasificador-estados.ts` + action server-side.
- NO lanzar re-fetch completo en cada evento realtime: aplicar patch sobre estado local (reducer).
- NO confiar sólo en el cliente para validar transiciones: el action server-side debe validarlas (Zod + whitelist).
- NO usar `any` en payloads de Realtime: tipar con `RealtimePostgresChangesPayload<Row>` del SDK.
- NO meter sonido/notificación en cada render: efecto único disparado al pasar de `PREPARANDO` a `LISTO`.
- NO bloquear la UI por auditoría: log de transiciones fire-and-forget.

---

*PRP pendiente aprobación. No se ha modificado código.*
