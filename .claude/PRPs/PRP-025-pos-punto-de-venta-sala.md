# PRP-025: POS (Punto de Venta) — submódulo de Sala

> **Estado**: PENDIENTE
> **Fecha**: 2026-04-17
> **Proyecto**: Balles-Hosteleros
> **Ruta propuesta**: `/sala/pos`
> **Feature dir**: `src/features/sala/pos/`

---

## Objetivo

Construir un **TPV táctil integrado** dentro del submódulo Sala que permita al personal de establecimiento abrir comandas, cobrar tickets con múltiples formas de pago, dividir cuenta, aplicar descuentos ya configurados en Gerencia, gestionar mesas/salas, arquear caja e **integrarse con el stock de Logística** (descuento automático vía escandallos al cerrar ticket), replicando la lógica que ya opera con Ágora pero nativa en el SaaS.

## Por Qué

| Problema | Solución |
|----------|----------|
| El restaurante depende de Ágora (externo) para cobrar. Cualquier fallo de Ágora paraliza la venta. | POS propio nativo que vive en el SaaS, online y con fallback local. |
| El catálogo de venta, los escandallos, los descuentos y los permisos ya existen en el SaaS pero viven aislados. | POS reutiliza `productos` (tipo=venta) + `escandallos` + `descuentos` + `profiles/user_roles`. |
| El descuento de stock hoy sólo ocurre post-sync Ágora; no hay venta "en vivo" cuando Ágora cae. | Al cerrar ticket en POS se descuenta stock inmediatamente vía la misma función de escandallo. |
| División de cuenta, bizum, mixto y arqueo son flujos que los TPV comerciales cobran aparte. | Sistema integrado sin coste adicional para el restaurante. |

**Valor de negocio**:
- Autonomía operativa: el restaurante puede vender sin Ágora.
- Unificación de datos: ventas, stock, caja, descuentos y permisos en un único modelo.
- Base para analítica cruzada (ratios de Gerencia, food cost real, márgenes por ticket).
- Sustituye licencia de TPV externo (ahorro mensual estimado por establecimiento).

## Qué

### Criterios de Éxito

- [ ] Usuario autenticado con rol habilitado entra a `/sala/pos` desde el mismo login del SaaS y selecciona establecimiento/turno.
- [ ] Se puede abrir sesión de caja con fondo inicial y cerrarla con arqueo (diferencia teórico vs real).
- [ ] Se crea comanda sobre mesa (o "barra/mostrador") y se añaden productos por tap desde rejilla paginada por categoría/subcategoría.
- [ ] El ticket en vivo muestra líneas, cantidades, modificadores, subtotal, IVA desglosado y total, con numpad para cantidad/precio manual.
- [ ] Se envían comandas a cocina/barra (estado "enviado a cocina") generando tickets de comanda imprimibles agrupados por destino.
- [ ] División de cuenta funcional: por artículo, por partes iguales (N comensales), mitades arbitrarias.
- [ ] Cobro con efectivo, tarjeta, bizum o mixto; se registran todos los medios y cambio.
- [ ] Aplicación de descuentos del módulo Gerencia (porcentaje o fijo, vigentes por fecha).
- [ ] Al **cerrar ticket** se descuenta stock reutilizando la lógica de escandallos (misma función que Ágora tickets → stock).
- [ ] Gestión de mesas: cambiar mesa, fusionar mesas, estado (libre / ocupada / reservada) reflejado en la tabla `mesas`.
- [ ] Historial de tickets del día con reimpresión y anulación (con motivo, quedando auditado).
- [ ] UI optimizada para pantalla táctil 10"+ landscape: botones mínimo 64px, navegación sin hover, feedback inmediato.

### Comportamiento Esperado (Happy Path)

1. Camarero inicia sesión en el SaaS y entra a **Sala → POS**.
2. Si no hay **sesión de caja abierta**, sistema pide fondo inicial y abre arqueo.
3. Selecciona **mesa** (o modo "barra rápida" sin mesa).
4. Navega categorías → subcategorías → toca productos. Cada tap añade línea al ticket en vivo.
5. Usa numpad para cambiar cantidad, precio, o añadir nota de cocina por línea.
6. Pulsa **"Enviar a cocina"** → la comanda queda bloqueada para edición de líneas ya enviadas; se imprime ticket de comanda en impresoras por destino (cocina, barra).
7. Puede **añadir líneas adicionales** (segunda ronda) y volver a enviar.
8. En el momento de cobrar, elige **descuento** (de Gerencia) si aplica.
9. Si el cliente pide dividir: abre modal **"Dividir cuenta"** (por persona / por artículo / mitades) → genera subtickets.
10. Selecciona **medio de pago(s)**: efectivo (abre numpad, calcula cambio), tarjeta, bizum, o mixto (reparte importes).
11. Al **cerrar ticket**: (a) se persiste `ticket` + `ticket_lineas` + `ticket_pagos`, (b) se descuenta stock vía `descontarStockPorTicket()` (misma lógica que `agora-ventas-sync`), (c) mesa vuelve a LIBRE (salvo cambio manual), (d) se imprime ticket final.
12. Ticket queda en **historial del día**, disponible para reimprimir o anular (con motivo, reversión de stock).
13. Al fin de turno, **Cerrar caja** → el sistema calcula teórico (suma de pagos en efectivo + apertura − retiradas) vs conteo real, guarda diferencia y marca arqueo cerrado.

---

## Contexto

### Referencias (patrones existentes)

- **Arquitectura feature-first**: `src/features/logistica/` (actions + services + types + components + data). Usar misma estructura en `src/features/sala/pos/`.
- **Descuento de stock por escandallos**: `src/features/logistica/services/agora-ventas-sync.ts` — contiene la función que descuenta por ingredientes respetando merma. **Se refactoriza** a un servicio `descontar-stock-por-ventas.ts` reutilizable tanto desde Ágora como desde POS.
- **Productos de venta**: `src/features/logistica/actions/producto-actions.ts` con filtro `tipo='venta'`. Campos relevantes: `nombre`, `categoria`, `familia`, `precio_venta`, `agora_id`, escandallo asociado.
- **Descuentos Gerencia**: `src/features/gerencia/actions/descuentos-actions.ts` — tabla `descuentos` con `tipo`, `valor`, `fecha_inicio`, `fecha_fin`, `activo`.
- **Mesas existentes**: tabla `public.mesas` (migración `006_sala.sql`) — ya modela zona, capacidad, estado, posición, combinable. **Se reutiliza**, no se duplica.
- **Auth + empresa_id**: patrón `getContext()` presente en todos los actions (supabase server + lookup `profiles.empresa_id`).
- **Permisos por rol**: `user_roles` / `profiles.role` según `src/features/ajustes/components/UsuariosTab.tsx`. Se añade un permiso lógico `POS` al mapa de permisos.
- **Estándar UI**: `@/shared/components/ui/*` shadcn + `<Button variant="primary" size="lg">` con icono ([MEMORY.md](../memory/MEMORY.md)). Para el POS se creará `size="touch"` adicional (80px alto mínimo).
- **Protocolo de guardado**: try/catch + logs en toda escritura, nada en localStorage crítico ([MEMORY.md](../memory/MEMORY.md)).

### Arquitectura Propuesta

```
src/features/sala/pos/
├── components/
│   ├── POSShell.tsx              # Layout táctil: ticket-izq | grid-prods | acciones-der
│   ├── TicketEnVivo.tsx          # Columna izquierda: líneas, totales, acciones
│   ├── ProductoGrid.tsx          # Rejilla paginada de productos por categoría
│   ├── CategoriaTabs.tsx         # Nav categorías/subcategorías (desde logistica)
│   ├── Numpad.tsx                # Numpad táctil (cantidad, precio, efectivo)
│   ├── AccionesLaterales.tsx     # Botones der: descuento, dividir, enviar, cobrar
│   ├── ModalMesas.tsx            # Selector de mesa/sala + fusionar/cambiar
│   ├── ModalDividir.tsx          # Por artículo / partes iguales / mitades
│   ├── ModalCobro.tsx            # Medios de pago (efectivo/tarjeta/bizum/mixto)
│   ├── ModalDescuento.tsx        # Lista descuentos vigentes de Gerencia
│   ├── ModalArqueoApertura.tsx   # Fondo inicial de caja
│   ├── ModalArqueoCierre.tsx     # Conteo + diferencia teórico/real
│   ├── HistorialTickets.tsx      # Tickets del día + reimprimir + anular
│   └── ImpresionTicket.tsx       # Render HTML 80mm + hook a QZ Tray / window.print
├── hooks/
│   ├── useTicketStore.ts         # Zustand: ticket en curso, líneas, estado
│   ├── useSesionCaja.ts          # Estado de apertura/cierre de caja
│   └── usePOSPermisos.ts         # Guard de rol + establecimiento
├── services/
│   ├── descontar-stock-por-ventas.ts   # ← refactor de agora-ventas-sync, reutilizable
│   ├── calculo-ticket.ts               # Totales, IVA, descuentos, redondeos
│   ├── division-cuenta.ts              # Algoritmos (por artículo / N partes / mitades)
│   └── impresion.ts                    # Format ESC/POS 80mm + fallback HTML
├── actions/
│   ├── sesion-caja-actions.ts    # abrir/cerrar/listar arqueos
│   ├── tickets-actions.ts        # crear, actualizar, cerrar, anular, historial
│   ├── lineas-ticket-actions.ts  # añadir/quitar/editar/enviar-cocina
│   ├── pagos-actions.ts          # registrar pagos de un ticket
│   └── mesas-pos-actions.ts      # cambiar/fusionar/liberar mesa (reutiliza mesas)
├── data/
│   └── pos-mock.ts               # Datos seed para desarrollo sin BD real
└── types/
    └── index.ts                  # Tipos UI en camelCase
```

Rutas App Router:
```
src/app/(main)/sala/pos/page.tsx         # Entry point POS (servidor: valida sesión + permiso)
src/app/(main)/sala/pos/arqueos/page.tsx # Histórico de arqueos
```

### Modelo de Datos (nuevo: migración `012_pos.sql`)

```sql
-- ─── 0. ENUMS ──────────────────────────────────────────────
do $$ begin
  create type public.ticket_estado as enum ('ABIERTO','ENVIADO','COBRADO','ANULADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pago_medio as enum ('EFECTIVO','TARJETA','BIZUM','VALE','OTROS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.caja_estado as enum ('ABIERTA','CERRADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.linea_destino as enum ('COCINA','BARRA','NINGUNO');
exception when duplicate_object then null; end $$;

-- ─── 1. SESIÓN DE CAJA (ARQUEO) ───────────────────────────
create table if not exists public.pos_sesiones_caja (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  empleado_id    uuid references public.profiles(id) on delete set null,
  abierta_at     timestamptz not null default now(),
  cerrada_at     timestamptz,
  fondo_inicial  numeric(10,2) not null default 0,
  teorico_cierre numeric(10,2),
  real_cierre    numeric(10,2),
  diferencia     numeric(10,2),
  estado         public.caja_estado not null default 'ABIERTA',
  notas          text not null default '',
  created_at     timestamptz not null default now()
);

-- ─── 2. TICKETS ───────────────────────────────────────────
create table if not exists public.pos_tickets (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  sesion_caja_id uuid references public.pos_sesiones_caja(id) on delete set null,
  numero         text not null,                          -- correlativo por día/caja
  mesa_id        uuid references public.mesas(id) on delete set null,
  comensales     integer not null default 1,
  empleado_id    uuid references public.profiles(id) on delete set null,
  estado         public.ticket_estado not null default 'ABIERTO',
  subtotal       numeric(10,2) not null default 0,
  descuento_id   uuid references public.descuentos(id) on delete set null,
  descuento_valor numeric(10,2) not null default 0,
  iva_total      numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  abierto_at     timestamptz not null default now(),
  enviado_at     timestamptz,
  cerrado_at     timestamptz,
  anulado_at     timestamptz,
  anulado_motivo text,
  notas          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.pos_tickets(empresa_id, abierto_at desc);
create index on public.pos_tickets(empresa_id, estado);
create unique index on public.pos_tickets(empresa_id, numero);

-- ─── 3. LÍNEAS DE TICKET ──────────────────────────────────
create table if not exists public.pos_ticket_lineas (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.pos_tickets(id) on delete cascade,
  producto_id    uuid references public.productos(id) on delete set null,
  nombre         text not null,     -- snapshot por si se borra el producto
  cantidad       numeric(10,3) not null default 1,
  precio_unitario numeric(10,2) not null default 0,
  iva_pct        numeric(5,2) not null default 10,
  descuento_pct  numeric(5,2) not null default 0,
  destino        public.linea_destino not null default 'COCINA',
  enviada_at     timestamptz,
  nota_cocina    text not null default '',
  comensal_idx   smallint,          -- para dividir por persona
  created_at     timestamptz not null default now()
);
create index on public.pos_ticket_lineas(ticket_id);

-- ─── 4. PAGOS ─────────────────────────────────────────────
create table if not exists public.pos_pagos (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.pos_tickets(id) on delete cascade,
  medio          public.pago_medio not null,
  importe        numeric(10,2) not null,
  referencia     text,              -- id de operación tarjeta, bizum, etc.
  creado_at      timestamptz not null default now()
);
create index on public.pos_pagos(ticket_id);

-- ─── 5. MOVIMIENTOS DE CAJA (retiradas/aportes) ───────────
create table if not exists public.pos_movimientos_caja (
  id             uuid primary key default gen_random_uuid(),
  sesion_caja_id uuid not null references public.pos_sesiones_caja(id) on delete cascade,
  tipo           text not null check (tipo in ('APORTE','RETIRADA')),
  importe        numeric(10,2) not null,
  motivo         text not null default '',
  creado_at      timestamptz not null default now()
);

-- ─── 6. RLS POR empresa_id ────────────────────────────────
alter table public.pos_sesiones_caja    enable row level security;
alter table public.pos_tickets          enable row level security;
alter table public.pos_ticket_lineas    enable row level security;
alter table public.pos_pagos            enable row level security;
alter table public.pos_movimientos_caja enable row level security;

create policy "pos_caja_empresa" on public.pos_sesiones_caja
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "pos_tickets_empresa" on public.pos_tickets
  for all using (empresa_id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "pos_lineas_via_ticket" on public.pos_ticket_lineas
  for all using (ticket_id in (select id from public.pos_tickets
                               where empresa_id in (select empresa_id from public.profiles where id = auth.uid())));

create policy "pos_pagos_via_ticket" on public.pos_pagos
  for all using (ticket_id in (select id from public.pos_tickets
                               where empresa_id in (select empresa_id from public.profiles where id = auth.uid())));

create policy "pos_mov_via_caja" on public.pos_movimientos_caja
  for all using (sesion_caja_id in (select id from public.pos_sesiones_caja
                                   where empresa_id in (select empresa_id from public.profiles where id = auth.uid())));

-- ─── 7. TRIGGERS updated_at ───────────────────────────────
create trigger pos_tickets_updated_at
  before update on public.pos_tickets
  for each row execute function public.set_updated_at();
```

**Reutilizados (sin modificación)**: `mesas`, `productos`, `escandallos`, `stock`, `descuentos`, `profiles`, `user_roles`, `empresas`.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Sólo se definen las FASES. Las subtareas se generan al entrar a cada fase siguiendo el bucle agéntico.

### Fase 1: BD + tipos + RLS
**Objetivo**: Migración `012_pos.sql` aplicada, tipos `types/index.ts` en código, RLS validada.
**Validación**:
- Migración ejecuta sin error en Supabase.
- `select` con otra empresa devuelve 0 filas.
- `npm run typecheck` verde.

### Fase 2: Refactor del servicio de descuento de stock (reutilizable Ágora + POS)
**Objetivo**: Extraer de `agora-ventas-sync.ts` el core de descuento por escandallo → `services/descontar-stock-por-ventas.ts`. Ágora sigue funcionando usándolo.
**Validación**:
- Sync Ágora manual descuenta stock exactamente igual que antes (regresión 0).
- Nuevo servicio expone `descontarStockPorTicket(ticketId)`.

### Fase 3: Sesión de caja (arqueo)
**Objetivo**: Abrir y cerrar caja con fondo, movimientos, diferencia teórica vs real. `ModalArqueoApertura/Cierre`, `sesion-caja-actions`, `useSesionCaja`.
**Validación**:
- Abrir caja crea fila `ABIERTA` con fondo.
- Cerrar calcula teórico = fondo + ∑ pagos efectivo + aportes − retiradas y guarda diferencia.

### Fase 4: Shell POS + rejilla de productos + ticket en vivo (sin persistencia)
**Objetivo**: `POSShell`, `CategoriaTabs`, `ProductoGrid` paginado, `TicketEnVivo`, `Numpad`. Estado Zustand en memoria.
**Validación**:
- Al tocar un producto se añade línea, se ve subtotal + IVA + total correcto.
- Responsive táctil 10" landscape validado con Playwright screenshot.

### Fase 5: Persistencia de ticket (CRUD real)
**Objetivo**: Acciones `tickets-actions` + `lineas-ticket-actions`. Abrir ticket sobre mesa, guardar líneas, recuperar al refrescar.
**Validación**:
- Crear ticket → refrescar → líneas persisten.
- RLS: usuario de otra empresa no ve tickets.

### Fase 6: Gestión de mesas desde POS
**Objetivo**: `ModalMesas`: listar mesas por zona, ver estado, **cambiar mesa**, **fusionar** (un ticket padre + mesas hijas), liberar.
**Validación**:
- Fusionar dos mesas agrupa sus tickets en uno; mesa libre vuelve a LIBRE al cerrar.

### Fase 7: Envío a cocina/barra + impresión de comandas
**Objetivo**: Marcar líneas como enviadas, agrupar por destino, generar `ImpresionTicket` (HTML 80mm) — fallback `window.print`. Líneas enviadas se bloquean para edición.
**Validación**:
- Enviar comanda imprime un ticket por destino con sólo las líneas nuevas.
- Reenvío sólo imprime las líneas añadidas después.

### Fase 8: Descuentos de Gerencia
**Objetivo**: `ModalDescuento` lista descuentos vigentes (fecha + `activo`), aplica porcentaje o fijo, actualiza totales en tiempo real y persiste `descuento_id` + `descuento_valor`.
**Validación**:
- Descuento caducado no aparece.
- Total refleja descuento antes de IVA (configurable).

### Fase 9: División de cuenta
**Objetivo**: `ModalDividir`: por artículo (drag/tap), por partes iguales (N comensales), mitades arbitrarias. Genera subtickets visuales para cobro.
**Validación**:
- Suma de subtickets == total del ticket padre (±0,01€).
- Cada subticket puede cobrarse con medio de pago propio.

### Fase 10: Cobro multi-medio + cierre de ticket + descuento de stock
**Objetivo**: `ModalCobro`: efectivo (con cambio), tarjeta, bizum, mixto. Al confirmar: inserta `pos_pagos[]`, marca ticket `COBRADO`, libera mesa, y **llama `descontarStockPorTicket()`** (servicio Fase 2).
**Validación**:
- Stock de ingredientes disminuye según escandallo × cantidad × (1+merma%).
- Productos sin escandallo tipo `venta` registran la venta sin tocar stock; tipo `compra` descuentan directo.
- Suma de pagos == total; si no, bloquea cierre.

### Fase 11: Historial de tickets + reimprimir + anular
**Objetivo**: `HistorialTickets` lista tickets del día con filtro (estado, mesa, empleado). Reimprimir llama `impresion.ts`. Anular pide motivo, marca `ANULADO`, **revierte stock** y registra auditoría.
**Validación**:
- Anular revierte el stock exactamente (delta contrario al del cierre).
- Reimprimir no modifica datos.

### Fase 12: Integración de acceso (login unificado + permisos)
**Objetivo**: Guard `usePOSPermisos` + ruta `/sala/pos` protegida. Rol con permiso `POS` (Gerente, Encargado, Camarero) puede entrar. Selector de establecimiento si el usuario pertenece a varias empresas.
**Validación**:
- Usuario sin permiso → redirige a `/sala` con toast.
- Usuario multi-empresa ve selector antes de entrar.

### Fase 13: QA + Playwright + validación final
**Objetivo**: Tests E2E del happy path completo (abrir caja → comanda → dividir → cobrar mixto → cerrar caja).
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright screenshot POS en viewport táctil 1280×800.
- [ ] Todos los criterios de éxito marcados.

---

## Aprendizajes (Self-Annealing)

> Esta sección crece durante la implementación. Vacía al aprobar el PRP.

---

## Gotchas

- [ ] **Precisión decimal**: todos los cálculos de precio/IVA deben usar `numeric(10,2)` en BD y redondeo bancario en cliente. Nunca `parseFloat` ingenuo.
- [ ] **Concurrencia de numeración de ticket**: el correlativo `numero` debe generarse server-side con secuencia o `select max + 1 for update` dentro de transacción para evitar duplicados.
- [ ] **RLS por join**: `pos_ticket_lineas` y `pos_pagos` no tienen `empresa_id` directo; la policy hace subselect a `pos_tickets`. Verificar en QA que no hay leaks.
- [ ] **Pantalla táctil sin hover**: nada de tooltips dependientes de hover; feedback siempre con press-state y haptic/sound opcional.
- [ ] **Impresión**: QZ Tray requiere instalación local; diseñar servicio `impresion.ts` con interfaz y dos implementaciones (QZ, window.print).
- [ ] **Descuento de stock**: si Ágora está activa y también opera, hay que decidir por empresa si el descuento proviene del POS o del sync Ágora — un flag por empresa para evitar descuento doble.
- [ ] **Anulación post-cierre de caja**: si el ticket se anula después de cerrar la caja, requiere flujo de "nota de crédito" sin tocar arqueo cerrado.
- [ ] **Offline**: fuera de alcance en este PRP. Requiere colas locales — se planifica en PRP posterior.
- [ ] **Ventana móvil**: aunque es táctil, priorizar landscape 10"+; móvil 6" vertical queda fuera.

## Anti-Patrones

- NO duplicar tabla de mesas ni de productos: reutilizar las existentes.
- NO persistir líneas del ticket en `localStorage` como fuente de verdad (prohibido por MEMORY.md).
- NO poner lógica de negocio de totales/IVA en componentes React: vive en `services/calculo-ticket.ts`.
- NO hacer fetch directo a Supabase desde componentes: sólo vía actions server-side.
- NO usar `any` ni omitir Zod en inputs (numpad, montos, motivos).
- NO reinventar el botón: usar el `Button` shadcn con variante `primary` y añadir `size="touch"` al sistema.
- NO descontar stock desde el cliente: siempre en action server-side tras cerrar ticket.

---

*PRP pendiente aprobación. No se ha modificado código.*
