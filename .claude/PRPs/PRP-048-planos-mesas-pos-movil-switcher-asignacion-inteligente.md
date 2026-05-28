# PRP-048: Planos de Mesas + POS Comandera Móvil + Switcher Paneles/Departamentos + Reservas con Asignación Inteligente

> **Estado**: PENDIENTE (depende de PRP-047 completado)
> **Fecha**: 2026-05-28
> **Última actualización**: 2026-05-28 — añadido bloque "Combinaciones de Mesas" (Fase 1.5 + tablas `mesa_combinaciones` y `mesa_combinacion_componentes` + gotchas + anti-patrones)
> **Proyecto**: Balles-Hosteleros (multi-tenant, mismo repo)

---

## Objetivo

Construir un sistema integral de gestión visual de mesas — planos drag-and-drop por local (verano/invierno/eventos) con programación temporal recurrente, modo operativo de Reservas con mapa interactivo (desktop y móvil), POS móvil tipo comandera que arranca por selección de mesa sobre el mismo mapa, asignación inteligente de mesa al guardar una reserva pública con filtros opcionales (sala/zona/tipo), y promoción del toggle Paneles ↔ Departamentos a pills permanentes del header con capacidades móviles por rol. Un único modelo de planos comparte estado entre Reservas y POS para el rol SALA.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy `mesas` y `zonas` son listas planas sin coordenadas — el Jefe de Sala no puede "ver" su salón en pantalla y los nuevos empleados memorizan a ciegas qué mesa está dónde. | Editor visual drag-and-drop por plano: lienzo con zoom/pan, mesas como cuadraditos colocados en (x, y, rotation), agrupadas por zona con color pastel y por sala. |
| El restaurante cambia de plano según la época (terraza en verano, comedor cerrado en invierno, montaje especial para eventos) pero no hay manera de versionar layouts ni programar su activación; cada cambio implica editar mesas manualmente. | Tabla `planos` con `es_principal` + programación temporal (fechas sueltas, rangos, días de semana, franjas horarias, comidas/cenas, repetición indefinida o 1 año) reusando el patrón de "ventana temporal recurrente" de la Carta digital. Un helper `resolverPlanoActivo(local_id, ts)` devuelve el plano vigente AHORA. |
| `ReservasView` desktop usa un grid plano sin mapa; la reserva pública `/reservar/[slug]` pide al cliente elegir mesa concreta de una lista; el POS `/sala/pos` abre `ModalMesas` con un grid sin posición espacial. Tres lugares, tres UIs distintas, cero consistencia. | Único componente `<MapaMesas>` (desktop) y `<SelectorMesaMobile>` (mapa+lista con toggle, pinch-zoom) reusados por: Reservas desktop (popover operativo), Reservas móvil, POS móvil. La pública NO ve mapa — solo filtros sala/zona/tipo opcionales y el sistema asigna mesa internamente. |
| Las mesas no tienen `capacidad_min` ni `tipo` (BARRA, BAJA, MEDIA, ALTA), por lo que la asignación automática es imposible y el cliente externo no puede filtrar "quiero barra para 2". | Schema extendido: `capacidad_min` / `capacidad_max` (1..100, min<=max), `tipo` enum, `codigo` con regex `^[A-Z]{1,2}-(?:[1-9]|[1-9][0-9])$`. Filtros públicos cruzados — si el cliente pide tipo BARRA solo se muestran salas/zonas con BARRA disponible. |
| Asignar mesa a una reserva pública es ad-hoc: el responsable abre la reserva y elige a ojo. En picos de tráfico se pierde tiempo y se sobre-asignan zonas favoritas. | Tabla `plano_orden_asignacion (plano_id, comensales, mesa_id, posicion)` configurable por arrastre. Al guardar reserva pública: el sistema toma el plano activo, busca la primera mesa libre del orden manual para esos pax; si no hay orden definido, fallback ordenando por la parte numérica del `codigo` entre mesas con `capacidad_min ≤ pax ≤ capacidad_max` libres; si tampoco, reserva queda sin mesa y la asigna manualmente el responsable. |
| Cliente externo ve nombres internos de zonas ("Cocina caliente", "Reservado familia X") aunque deba verlos. Necesita visibilidad granular: visible tal cual, oculto bajo un nombre público compartido (mapear varias zonas internas a una etiqueta cliente), o totalmente oculto. | Columnas `visible_cliente`, `zona_publica_id NULLABLE`, `oculta_total` en zonas (y simétrico en `tipos_mesa_config` para BARRA/BAJA/MEDIA/ALTA). Decisión: salas/zonas SIN `nombre_publico` propio — cliente ve el mismo nombre que staff cuando es visible; si se quiere agrupar, se usa `zona_publica_id`. |
| El POS de sala existe en escritorio (`POSShell` + `ModalMesas`) pero no tiene shell móvil; el SALA con tablet 10" o teléfono no puede arrancar un ticket desde la mesa. | `/sala/pos` con detección `useIsMobile()`: shell móvil de 2 pantallas — (1) selector mapa/lista compartido, (2) ticket existente. Reusa `mesas-pos-actions.ts` y `POSShell.tsx`. |
| El switcher Paneles ↔ Departamentos está enterrado en el dropdown del avatar — el usuario no descubre que existen dos vistas y los desarrolladores tampoco supieron expresar "qué acciones tiene un rol disponibles en móvil". | Promover el toggle a **pills permanentes del header** (desktop y móvil); crear `MOBILE_CAPABILITIES: Record<Rol, AccionMobil[]>` (SALA → `["pos-comandera"]`, COCINA → `["kds"]`, RRHH → `["fichajes-validar"]`, …) consumido por `mis-departamentos` en móvil para filtrar tiles a las que tienen versión móvil real. |
| Migración crítica: `mesas` y `zonas` en producción ya tienen datos (HABANA, BACANAL, futuros). Hay que migrar in-place añadiendo `local_id`, `sala_id`, `tipo`, `capacidad_min/max` sin perder histórico ni romper FKs (`reservas.mesa_id`, `pos_tickets.mesa_id`, `aperturas`). | Migración por pasos: (a) crear `salas` con una sala default por local existente, (b) backfill `mesas.local_id` desde `empresa_id → locales` (un local por empresa por defecto), (c) backfill `mesas.zona_id → sala_default`, (d) backfill `capacidad_min=1`, `capacidad_max=capacidad`, `tipo='BAJA'` por defecto, (e) generar `codigo` a partir de `numero` validando regex (si no matchea, prefijo `M-`), (f) sembrar plano principal por local con `plano_mesas` recogiendo todas, posiciones grid auto. |
| Grupos grandes piden mesas juntas (8, 10, 16 pax) que físicamente se forman uniendo 2-3 mesas existentes. Hoy no hay forma de declarar esa combinación como "recurso reservable" — el responsable apunta a mano qué mesas une y pierde visibilidad de conflictos. | Nueva entidad `mesa_combinaciones` con código autogenerado (`T-5+T-6+T-7`), capacidad auto-suma con override manual, zona/tipo propios (mezclables entre componentes), color de marca visual rotatorio. Sub-apartado "Combinaciones" en Configuración → Estructura. Cuando una combinación está reservada en una franja, sus mesas componentes quedan bloqueadas individualmente en esa franja (resolución automática de conflicto). No entra en asignación automática por defecto — se asigna manualmente. |

**Valor de negocio**: profesionalización visual del módulo Sala (parity con CoverManager / Restoo), asignación automática que ahorra ~30s/reserva en picos, base sólida para POS móvil en tableta (estándar de la industria), y un switcher visible que finalmente comunica al usuario que tiene dos modos de trabajo. La asignación inteligente reduce conflictos de doble reserva y libera al responsable para vender, no para colocar.

## Qué

### Criterios de Éxito

**Modelo de datos y migración**
- [ ] Existen tablas `salas`, `zonas` (refactor), `mesas` (refactor), `planos`, `plano_salas`, `plano_mesas`, `plano_orden_asignacion`, `tipos_mesa_config`, `mesa_combinaciones`, `mesa_combinacion_componentes` con `local_id` y RLS multi-tenant vía `empresas_del_usuario()`.
- [ ] Constraint `mesas.codigo ~ '^[A-Z]{1,2}-(?:[1-9]|[1-9][0-9])$'` y `CHECK 1<=capacidad_min<=capacidad_max<=100`.
- [ ] Constraint que impide insertar en `plano_mesas` una `mesa_id` cuya `zona_id.sala_id` no esté en `plano_salas` del mismo `plano_id` (función trigger).
- [ ] Trigger en `plano_mesas` DELETE limpia `plano_orden_asignacion` huérfano (mismo plano + mesa).
- [ ] Migración de datos existentes: cada empresa con ≥1 mesa obtiene una sala default y todas sus mesas viven en `local_id` resuelto, sin pérdida de FKs (`reservas.mesa_id`, `pos_tickets.mesa_id`).
- [ ] Helper SQL `public.plano_activo(local_id uuid, ts timestamptz) returns uuid` devuelve el plano vigente en ese momento (excepción por fecha > rango > día semana + franja > principal).
- [ ] Tipos TS Supabase regenerados (`mcp__supabase__generate_typescript_types`) y consumidos en `src/features/sala/types/planos.ts`.

**Configuración → Reservas (desktop, dentro de `/sala/reservas`)**
- [ ] Nuevo Sheet de Configuración (o ampliación del de PRP-047) con 5 tabs nuevas: **Estructura**, **Planos**, **Programación de Planos**, **Orden de Asignación**, **Opciones públicas**.
- [ ] Tab Estructura: CRUD de salas (input nombre), zonas (selector color pastel + sala), mesas (codigo, capacidad_min, capacidad_max, tipo, zona) y **Combinaciones** (sub-apartado: multi-selector de mesas componentes — chips —, capacidad auto-suma con toggle de override manual, zona/tipo propios preseleccionados si todas las componentes coinciden, selector de color con paleta rotatoria + override). Validaciones inline tolerantes (regla MEMORY) — el error no aparece mientras el código es prefijo válido.
- [ ] Tab Planos: lista de planos con `+ Nuevo plano` y editor por plano. Editor = lienzo de canvas con zoom/pan + panel lateral con salas activadas, zonas y mesas disponibles (drag desde panel al lienzo, drag dentro del lienzo para mover, ctrl+arrastre o handle para rotar). Botón "Guardar layout".
- [ ] Solo se permite colocar mesas cuya `zona.sala_id ∈ plano_salas`. Si el usuario intenta arrastrar una mesa de sala no activada, toast bloquea + sugiere activar la sala.
- [ ] Tab Programación de Planos: por plano, formulario tipo "ventana temporal recurrente" de carta (fechas sueltas, rango, días de semana, franja horaria, marcar comidas/cenas, repetición indefinida o 1 año). Marca uno como principal (UNIQUE constraint `WHERE es_principal=true` por local).
- [ ] Tab Orden de Asignación: por plano y por número de pax (1..20), lista DnD ordenable de mesas con capacidad suficiente para fallback de asignación.
- [ ] Tab Opciones públicas: por sala, zona y tipo (BARRA/BAJA/MEDIA/ALTA): radio `visible | oculto mapeado a otra | oculto total`. Selector de "zona pública" si elige mapeado.
- [ ] Regla BARRA HORIZONTAL 1 aplicada al toolbar de cada tab.

**Modo operativo Reservas (`/sala/reservas` día)**
- [ ] Componente `<MapaMesas>` desktop renderiza el plano activo en la franja actual con: fondo de cada zona en su color pastel, mesas como cuadraditos uniformes, código + capacidad encima, estado por color: libre (blanco con borde), reservada (verde con nombre + hora), bloqueada operativa (gris oscuro), bloqueada-web (gris claro), walk-in (tono dedicado, p.ej. naranja).
- [ ] Cuando una `mesa_combinacion` está reservada en la franja actual, sus mesas componentes se renderizan con un **borde grueso del color de marca** de la combinación + un chip/etiqueta agrupador (`[T-5+T-6+T-7]` en una de ellas) — todas las componentes quedan visualmente vinculadas y simultáneamente bloqueadas para reservas individuales en esa franja.
- [ ] Click/tap en mesa → popover con 5 acciones: **Nueva reserva**, **Walk in**, **Bloquear web**, **Bloquear**, **Modificar**.
- [ ] "Modificar" abre el mismo modal usado en Configuración → Estructura (Nombre/codigo, capacidad_min, capacidad_max, zona, tipo, Borrar/Actualizar).
- [ ] "Walk in" = modal de reserva normal pre-rellenado (turno actual + mesa + fecha hoy) con solo campo nombre opcional (default `Walk-in HH:MM`), sin teléfono ni email obligatorios.
- [ ] Botón en el header de la vista alterna entre "Vista plano" (default si hay plano activo) y "Vista lista" (la actual de PRP-047).

**Selector móvil compartido**
- [ ] Componente `<SelectorMesaMobile>` con toggle Mapa ↔ Lista persistido en localStorage por usuario.
- [ ] Vista Mapa: pinch-zoom + pan con gesture handling robusto (sin scroll del body cuando hay pinch); lienzo más ancho que pantalla; colores de zona.
- [ ] Vista Lista: secciones por zona (header con color pastel + nombre), mesas como cuadraditos apilados verticalmente con su código + capacidad + chip de estado.
- [ ] La acción al pulsar mesa es inyectada por prop `onMesaTap(mesaId)` — en Reservas móvil abre popover operativo; en POS móvil abre el ticket.

**POS comandera móvil (`/sala/pos` con `useIsMobile()`)**
- [ ] Si `useIsMobile()=true` y el usuario tiene `puedeVer("SALA")`, se renderiza un shell de 2 pantallas: (1) `<SelectorMesaMobile>` con plano activo; (2) `<POSShellMobile>` que envuelve la lógica de ticket existente (productos, modificadores, enviar a cocina, cobrar). Botón "← Mesas" en (2) vuelve a (1).
- [ ] La selección de mesa en (1) carga el ticket abierto de esa mesa (mismo flujo que `ModalMesas` actual usa, vía `mesas-pos-actions`).
- [ ] Desktop sigue mostrando el `POSShell` actual sin regresión.

**Switcher Paneles/Departamentos en header**
- [ ] Los items "Paneles" y "Departamentos" del dropdown del avatar (`app-layout.tsx`) salen del dropdown y aparecen como **pills permanentes** en la fila superior del header, en desktop (centro) y móvil (debajo del logo o como segmenta superior).
- [ ] Persistencia via cookie `bh_view_mode` + `localStorage` se mantiene (no se cambia `view-mode-context.tsx` salvo añadir el componente `<ViewModePills>`).
- [ ] Existe constante `MOBILE_CAPABILITIES: Record<AppRole, string[]>` en `src/features/layout/data/mobile-capabilities.ts` con mapeo inicial: `responsable → ["pos-comandera","fichajes-validar"]`, `empleado → []` (todo via Mi Panel), `admin/director/gerencia → todas`.
- [ ] `mis-departamentos` en móvil + Departamentos solo muestra tiles cuyo módulo tenga al menos una acción listada en `MOBILE_CAPABILITIES[rolActivo]` con versión móvil real; el resto pinta un badge "Solo desktop" o se oculta. Desktop conserva todos los tiles.

**Reservas pública (`/reservar/[slug]`)**
- [ ] El formulario añade 3 selectores opcionales — Sala, Zona, Tipo de mesa — poblados con SOLO las entidades marcadas como visibles para el cliente.
- [ ] Los selectores se cruzan: elegir tipo BARRA filtra zonas/salas a las que tienen al menos una mesa BARRA con disponibilidad en la franja pedida. Cambio en uno re-filtra los otros.
- [ ] El cliente **nunca** ve mapa ni elige mesa concreta.
- [ ] Al guardar la reserva: server action `asignarMesaAutomatica({ local_id, fecha, hora, personas, sala_id?, zona_id?, tipo? })` ejecuta:
  1. `plano_activo(local_id, fecha+hora)`.
  2. Filtra mesas del plano por capacidad (`capacidad_min ≤ pax ≤ capacidad_max`) y filtros opcionales (sala/zona/tipo).
  3. Filtra mesas libres en esa franja (cruza con `reservas` y `mesas_bloqueadas`).
  4. Si existe `plano_orden_asignacion(plano_id, comensales=pax)` no vacío → primera mesa libre del orden manual.
  5. Si no, ordena por parte numérica del `codigo` ASC (`T-5` → 5) y elige la primera.
  6. Si no hay ninguna libre → reserva se guarda con `mesa_id=null` y badge "Pendiente de asignar"; aparece en una bandeja del Jefe de Sala.
- [ ] Sin regresiones en `reservas.origen` (PRP-046).

**Validación cross**
- [ ] `npm run typecheck` y `npm run build` pasan.
- [ ] Playwright valida (a) editor de planos coloca y mueve mesa, (b) crear reserva pública con filtro BARRA asigna mesa BARRA real, (c) POS móvil arranca ticket desde mapa, (d) pills del switcher visibles en header desktop y móvil.

### Comportamiento Esperado

**Flujo 1 — Setup de planos del local**: Pepe abre `/sala/reservas` → ⚙️ → tab **Estructura**. Crea sala "Interior", sala "Terraza". En tab **Estructura** crea zonas "Sala Principal" (color verde claro, sala Interior), "Barra" (azul claro, Interior), "Terraza arboleda" (amarillo, Terraza). Crea mesas T-1..T-20 (BAJA, cap 2-4), B-1..B-6 (BARRA, cap 1-2), TE-1..TE-12 (MEDIA, cap 2-6). En tab **Planos** crea "Verano 2026" con salas Interior+Terraza activadas; arrastra todas las mesas al lienzo y las posiciona. Crea "Invierno 2026" solo con Interior. En **Programación** marca Verano `2026-06-01` a `2026-09-30` recurrente diario y lo marca **principal** mientras esté vigente; Invierno cubre el resto. En **Orden** para Verano + 2 pax: T-1, T-2, B-1, B-2, TE-1… En **Opciones públicas** marca Barra como `visible`, Terraza arboleda como `mapeado a "Terraza"`, una zona privada del personal como `oculta total`. Tipo BARRA visible al cliente.

**Flujo 2 — Operativa Jefe de Sala (desktop)**: María abre `/sala/reservas` un sábado a las 13:00. Ve por defecto el mapa de "Verano 2026" (plano activo). T-4 está reservada (cuadrito verde con "García · 14:00"), B-2 bloqueada para web (gris claro), T-7 walk-in en curso (naranja). Llega un cliente sin reserva: clic en T-12 libre → popover → "Walk in" → modal con nombre default "Walk-in 13:42", guarda. T-12 pasa a naranja. Recibe llamada: clic en T-3 → "Nueva reserva" → modal completo pre-relleno con mesa T-3 + turno comida. Guarda.

**Flujo 3 — Reserva pública con filtros**: Lucía abre `/reservar/grupohabana-madrid`. Elige fecha sábado y 2 personas, hora 14:30. Despliega "Preferencia": elige **Tipo: BARRA**. El selector Sala/Zona se filtra automáticamente a las que tienen BARRA disponible esa franja. Confirma con email. Al guardar, sistema resuelve plano activo (Verano), busca orden manual de 2 pax: T-1 (no es BARRA, descartada por filtro), T-2 (descartada), **B-1** → libre → asigna. Reserva queda con `mesa_id=B-1`, `origen='WEB'` (o el que venga por `?o=`).

**Flujo 4 — Camarero con teléfono (POS móvil)**: Carlos (rol responsable, `puedeVer("SALA")`) abre `https://sistema.balleshosteleros.com/sala/pos` en su iPhone. El shell móvil arranca con `<SelectorMesaMobile>` en vista Mapa, plano activo. Pinch-zoom para acercar a la terraza, tap en TE-5 → carga `POSShellMobile` con el ticket abierto de esa mesa (vacío). Añade 2 cervezas, 1 ración bravas → enviar a cocina. Botón "← Mesas" vuelve al mapa. Tap en B-2 → ticket nuevo.

**Flujo 5 — Switcher**: Carlos ve en el header arriba dos pills: `[ Paneles ] [ Departamentos ]`. Está en "Departamentos" (default). En su móvil, los tiles visibles son: Sala (porque `responsable` tiene `pos-comandera`), RRHH (porque tiene `fichajes-validar`). Tiles como Logística, Contabilidad están ocultos en móvil (sin acciones móviles). Tap "Paneles" → va a `/mi-panel`.

---

## Contexto

### Referencias

**Modelo y migraciones**
- `supabase/migrations/_DEMO_BUNDLE.sql` líneas 3293-3343 — schema actual de `zonas`, `mesas`, FK `reservas.mesa_id`/`zona_id`. Es lo que hay que refactorizar in-place.
- `supabase/migrations/20260515100000_rename_centros_to_locales.sql` — patrón de rename + FK locales que ya existe; el nuevo `local_id` en mesas/zonas/salas/planos se enlaza a `public.locales(id)`.
- `src/lib/seeds/sync.ts` — `syncSeedsToAllEmpresas()` aditivo para sembrar `tipos_mesa_config` por defecto (BARRA/BAJA/MEDIA/ALTA visibles).
- `src/lib/seeds/inspeccion-presentacion.ts` — ejemplo de seed canónico con propagación.
- `.claude/memory/project_rls_helper_empresas_del_usuario.md` (vía MEMORY.md) — todas las RLS usan `empresas_del_usuario()` / `_text()`.
- `.claude/memory/project_locales_fichaje.md` — `locales` (antes `centros`) es la unidad geográfica; añadir `local_id` a salas/zonas/mesas/planos.
- `.claude/memory/project_carta_blueprint.md` — patrón "ventana temporal recurrente única + recurrente semanal" a reusar en Programación de Planos.

**Reservas**
- `src/features/sala/components/ReservasView.tsx` (758 líneas) — vista del módulo Reservas. Hay que añadir botón "Vista plano" y embeber `<MapaMesas>`.
- `src/features/sala/components/reservas/` — subcomponentes (CalendarioMes, ContadoresDia, LinksReservaPanel, ReservaAdjuntosPanel, ReservaEstadoBadge, ReservaFlagsChips). Patrón a seguir para `MapaMesas`, `MesaPopover`, `MesaConfigModal`.
- `src/features/sala/data/reservas.ts` — tipos `Reserva`, `EstadoReserva`, `ZonaSala`, `Mesa`. Extender `Mesa` con `local_id`, `sala_id`, `capacidad_min`, `capacidad_max`, `tipo`, `codigo`.
- `src/features/sala/actions/reservas-actions.ts` — CRUD reservas. Añadir server action `asignarMesaAutomatica()` y wire desde `/reservar/[slug]`.
- `src/app/(main)/sala/reservas/page.tsx` — entrypoint.
- `src/app/reservar/[slug]/page.tsx` — reserva pública; añadir 3 selectores opcionales + cableado de filtros cruzados.
- `.claude/PRPs/PRP-046-campanas-marketing-y-links-reserva.md` — `reservas.origen` ya existe.
- `.claude/PRPs/PRP-047-calendario-reservas-covermanager-configuracion.md` (PENDIENTE) — comparte Sheet de Configuración. Si PRP-047 se aprueba antes, PRP-048 añade tabs al mismo Sheet; si no, este PRP crea el Sheet. **Riesgo de merge — gestionar orden de ejecución.**

**POS**
- `src/features/sala/pos/components/POSShell.tsx` — shell desktop a NO tocar.
- `src/features/sala/pos/components/ModalMesas.tsx` — implementación de referencia para colores por estado y agrupación por zona; en móvil se reemplaza por `<SelectorMesaMobile>`.
- `src/features/sala/pos/actions/mesas-pos-actions.ts` — `listMesasPOS()`. Hay que extender para devolver coordenadas del plano activo.
- `src/app/(main)/sala/pos/page.tsx` — entrypoint POS; añadir detección `useIsMobile()` y render condicional.

**Layout / Switcher**
- `src/features/layout/components/app-layout.tsx` (líneas 158-548) — `activarVista`, dropdown actual con paneles/departamentos. Extraer pills a `<ViewModePills>` y montar en header.
- `src/features/layout/contexts/view-mode-context.tsx` — `ViewMode = "paneles" | "departamentos"`, cookie + localStorage. NO romper API.
- `src/features/mis-departamentos/components/` — vista departamentos. Filtrar tiles por `MOBILE_CAPABILITIES[rol]` si `useIsMobile()`.
- `src/shared/hooks/use-mobile.tsx` — `useIsMobile()` con breakpoint 768.

**Auth**
- `src/features/auth/hooks/useAuth.ts` (existente) — `roles[]`, `puedeVer(modulo)`, `hasRole(rol)`. AppRole = admin|director|gerencia|responsable|empleado|solo_lectura. POS móvil exige `puedeVer("SALA")`.

### Arquitectura Propuesta (Feature-First)

```
src/features/sala/
├── planos/                          # NUEVO submódulo
│   ├── components/
│   │   ├── MapaMesas.tsx           # Render desktop del plano (svg/canvas)
│   │   ├── MesaPopover.tsx         # Popover 5 acciones (operativo)
│   │   ├── MesaConfigModal.tsx     # Modal compartido (Estructura + Modificar)
│   │   ├── SelectorMesaMobile.tsx  # Toggle Mapa/Lista con pinch-zoom
│   │   ├── PlanoEditor.tsx         # Editor drag-and-drop (Estructura → Planos)
│   │   ├── EstructuraTab.tsx       # CRUD salas/zonas/mesas (incluye sub-apartado Combinaciones)
│   │   ├── CombinacionesPanel.tsx  # Sub-apartado dentro de EstructuraTab: CRUD combinaciones
│   │   ├── MesaCombinacionModal.tsx # Modal de alta/edición de combinación
│   │   ├── PlanosTab.tsx           # Lista + editor por plano
│   │   ├── ProgramacionPlanosTab.tsx
│   │   ├── OrdenAsignacionTab.tsx  # DnD por (plano, pax)
│   │   └── OpcionesPublicasTab.tsx # Visibilidad salas/zonas/tipos
│   ├── hooks/
│   │   ├── usePlanoActivo.ts       # Llama a helper SQL + cachea
│   │   └── useEstadoMesas.ts       # Estado en tiempo real (reservas+bloqueos+tickets)
│   ├── services/
│   │   ├── asignacion.ts           # asignarMesaAutomatica server-side
│   │   ├── gestures.ts             # pinch-zoom + pan helpers
│   │   └── codigo-mesa.ts          # parse "T-5" → 5, validación regex
│   ├── actions/
│   │   ├── salas-actions.ts
│   │   ├── zonas-actions.ts
│   │   ├── mesas-actions.ts        # CRUD + integra mesas-pos-actions
│   │   ├── combinaciones-actions.ts # CRUD mesa_combinaciones + componentes
│   │   ├── planos-actions.ts
│   │   ├── plano-orden-actions.ts
│   │   └── tipos-mesa-actions.ts
│   ├── data/
│   │   ├── plano.ts                # Tipos Plano, PlanoMesa, etc.
│   │   └── colores-pastel.ts       # Paleta UI
│   └── types/
│       └── index.ts

src/features/sala/pos/
├── components/
│   └── POSShellMobile.tsx          # NUEVO shell móvil

src/features/layout/
├── components/
│   └── ViewModePills.tsx           # NUEVO (extraído de app-layout)
├── data/
│   └── mobile-capabilities.ts      # NUEVO MOBILE_CAPABILITIES

src/lib/seeds/
└── tipos-mesa.ts                   # NUEVO seed canónico (4 tipos visibles default)
```

### Modelo de Datos

```sql
-- =====================================================================
-- SALAS (nuevo)
-- =====================================================================
create table public.salas (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references public.locales(id) on delete cascade,
  nombre      text not null,
  orden       integer default 0,
  created_at  timestamptz not null default now(),
  unique (local_id, nombre)
);

-- =====================================================================
-- ZONAS (refactor: añadir local_id, sala_id, color_pastel, visibilidad)
-- =====================================================================
alter table public.zonas
  add column local_id uuid references public.locales(id) on delete cascade,
  add column sala_id uuid references public.salas(id) on delete restrict,
  add column color_pastel text default '#FDE68A',
  add column visible_cliente boolean not null default true,
  add column zona_publica_id uuid references public.zonas(id) on delete set null,
  add column oculta_total boolean not null default false;
-- backfill local_id desde empresa_id (un local por empresa por defecto)
-- crear sala "Principal" por local y asignar sala_id a todas las zonas
-- después: alter column local_id set not null; alter column sala_id set not null;
alter table public.zonas drop constraint zonas_empresa_id_nombre_key;
alter table public.zonas add constraint zonas_local_nombre_unique unique (local_id, nombre);

-- =====================================================================
-- MESAS (refactor: añadir local_id, codigo, capacidad_min/max, tipo)
-- =====================================================================
create type tipo_mesa as enum ('BARRA', 'BAJA', 'MEDIA', 'ALTA');

alter table public.mesas
  add column local_id uuid references public.locales(id) on delete cascade,
  add column codigo text,
  add column capacidad_min integer not null default 1,
  add column capacidad_max integer not null default 100,
  add column tipo tipo_mesa not null default 'BAJA';
-- backfill local_id, codigo (desde numero validando regex; fallback 'M-N')
-- backfill capacidad_max = capacidad
-- después:
alter table public.mesas
  add constraint mesas_codigo_regex check (codigo ~ '^[A-Z]{1,2}-(?:[1-9]|[1-9][0-9])$'),
  add constraint mesas_capacidad_check check (1 <= capacidad_min and capacidad_min <= capacidad_max and capacidad_max <= 100),
  drop constraint mesas_empresa_id_numero_key,
  add constraint mesas_local_codigo_unique unique (local_id, codigo);
alter table public.mesas alter column local_id set not null;
alter table public.mesas alter column zona_id set not null;
-- Conserva 'numero' y 'capacidad' como columnas legacy mientras hay consumidores

-- =====================================================================
-- TIPOS DE MESA CONFIG (visibilidad pública por local)
-- =====================================================================
create table public.tipos_mesa_config (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references public.locales(id) on delete cascade,
  tipo            tipo_mesa not null,
  visible_cliente boolean not null default true,
  tipo_publico    tipo_mesa,         -- mapeo opcional
  oculta_total    boolean not null default false,
  unique (local_id, tipo)
);

-- =====================================================================
-- MESA_COMBINACIONES (nuevo): mesas virtuales que agrupan 2+ mesas físicas
-- =====================================================================
create table public.mesa_combinaciones (
  id                uuid primary key default gen_random_uuid(),
  local_id          uuid not null references public.locales(id) on delete cascade,
  codigo            text not null,                  -- "T-5+T-6+T-7" (autogenerado por trigger)
  capacidad_auto    boolean not null default true,  -- true: suma componentes; false: usa los valores manuales
  capacidad_min     integer not null default 1,
  capacidad_max     integer not null default 100,
  zona_id           uuid references public.zonas(id) on delete restrict,
  tipo              tipo_mesa,
  color_marca       text not null,                  -- pastel rotatorio (ver data/colores-combinaciones.ts)
  activa            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (local_id, codigo),
  constraint mesa_comb_capacidad_check
    check (1 <= capacidad_min and capacidad_min <= capacidad_max and capacidad_max <= 100)
);

create table public.mesa_combinacion_componentes (
  combinacion_id uuid not null references public.mesa_combinaciones(id) on delete cascade,
  mesa_id        uuid not null references public.mesas(id) on delete cascade,
  orden          integer not null,
  primary key (combinacion_id, mesa_id)
);

-- Trigger: todos los componentes deben ser del mismo local que la combinación + ≥2 componentes
create or replace function check_combinacion_local_y_min_componentes()
returns trigger language plpgsql as $$
declare v_local_comb uuid; v_local_mesa uuid; v_count int;
begin
  select local_id into v_local_comb from public.mesa_combinaciones where id = new.combinacion_id;
  select local_id into v_local_mesa from public.mesas where id = new.mesa_id;
  if v_local_comb is null or v_local_mesa is null or v_local_comb <> v_local_mesa then
    raise exception 'Componente de combinación debe ser del mismo local';
  end if;
  return new;
end; $$;
create trigger trg_combinacion_local
  before insert or update on public.mesa_combinacion_componentes
  for each row execute function check_combinacion_local_y_min_componentes();

-- Trigger: recalcular `codigo` y capacidades auto al INSERT/UPDATE/DELETE de componentes
create or replace function recalc_combinacion_codigo_y_cap()
returns trigger language plpgsql as $$
declare v_comb uuid; v_codigo text; v_min int; v_max int; v_auto boolean;
begin
  v_comb := coalesce(new.combinacion_id, old.combinacion_id);
  select string_agg(m.codigo, '+' order by c.orden),
         sum(m.capacidad_min), sum(m.capacidad_max)
    into v_codigo, v_min, v_max
    from public.mesa_combinacion_componentes c
    join public.mesas m on m.id = c.mesa_id
    where c.combinacion_id = v_comb;
  select capacidad_auto into v_auto from public.mesa_combinaciones where id = v_comb;
  update public.mesa_combinaciones
    set codigo = coalesce(v_codigo, ''),
        capacidad_min = case when v_auto then coalesce(v_min, 1) else capacidad_min end,
        capacidad_max = case when v_auto then coalesce(v_max, 100) else capacidad_max end
    where id = v_comb;
  return null;
end; $$;
create trigger trg_recalc_combinacion
  after insert or update or delete on public.mesa_combinacion_componentes
  for each row execute function recalc_combinacion_codigo_y_cap();

-- Validación a nivel app (no DB): al crear/editar una combinación debe tener ≥2 componentes.

-- =====================================================================
-- PLANOS (nuevo): un layout completo del local
-- =====================================================================
create table public.planos (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references public.locales(id) on delete cascade,
  nombre          text not null,
  es_principal    boolean not null default false,
  -- Programación recurrente (patrón ventana temporal carta):
  fecha_desde     date,
  fecha_hasta     date,
  dias_semana     integer[],          -- 1..7 (lun..dom), null = todos
  hora_inicio     time,
  hora_fin        time,
  cubre_comidas   boolean not null default true,
  cubre_cenas     boolean not null default true,
  fechas_extra    date[],              -- fechas sueltas adicionales
  repetir_anual   boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (local_id, nombre)
);
create unique index uniq_plano_principal_por_local
  on public.planos (local_id) where es_principal;

-- =====================================================================
-- PLANO_SALAS (nuevo): qué salas activa este plano
-- =====================================================================
create table public.plano_salas (
  plano_id uuid not null references public.planos(id) on delete cascade,
  sala_id  uuid not null references public.salas(id)  on delete cascade,
  primary key (plano_id, sala_id)
);

-- =====================================================================
-- PLANO_MESAS (nuevo): posición de cada mesa en el lienzo del plano
-- =====================================================================
create table public.plano_mesas (
  plano_id  uuid not null references public.planos(id) on delete cascade,
  mesa_id   uuid not null references public.mesas(id)  on delete cascade,
  x         numeric(8,2) not null,
  y         numeric(8,2) not null,
  rotation  numeric(5,2) not null default 0,
  primary key (plano_id, mesa_id)
);

-- Trigger: solo mesas cuya zona.sala_id ∈ plano_salas del plano
create or replace function check_plano_mesa_sala_activa()
returns trigger language plpgsql as $$
declare v_sala uuid;
begin
  select z.sala_id into v_sala from public.mesas m
    join public.zonas z on z.id = m.zona_id where m.id = new.mesa_id;
  if not exists (select 1 from public.plano_salas
                 where plano_id = new.plano_id and sala_id = v_sala) then
    raise exception 'La sala de la mesa % no está activa en el plano %', new.mesa_id, new.plano_id;
  end if;
  return new;
end; $$;
create trigger trg_plano_mesa_sala_activa
  before insert or update on public.plano_mesas
  for each row execute function check_plano_mesa_sala_activa();

-- =====================================================================
-- PLANO_ORDEN_ASIGNACION (nuevo): orden manual por plano y pax
-- =====================================================================
create table public.plano_orden_asignacion (
  id          uuid primary key default gen_random_uuid(),
  plano_id    uuid not null references public.planos(id) on delete cascade,
  comensales  integer not null check (comensales between 1 and 20),
  mesa_id     uuid not null references public.mesas(id) on delete cascade,
  posicion    integer not null,
  unique (plano_id, comensales, mesa_id)
);

-- Trigger: al borrar de plano_mesas limpia orden_asignacion del mismo plano+mesa
create or replace function clean_orden_on_plano_mesa_delete()
returns trigger language plpgsql as $$
begin
  delete from public.plano_orden_asignacion
    where plano_id = old.plano_id and mesa_id = old.mesa_id;
  return old;
end; $$;
create trigger trg_clean_orden_plano_mesa
  after delete on public.plano_mesas
  for each row execute function clean_orden_on_plano_mesa_delete();

-- =====================================================================
-- HELPER: plano_activo(local_id, ts) → uuid
-- =====================================================================
create or replace function public.plano_activo(p_local uuid, p_ts timestamptz)
returns uuid language sql stable as $$
  with candidatos as (
    select id, es_principal,
           (fecha_desde is not null or fecha_hasta is not null or
            dias_semana is not null or hora_inicio is not null or
            fechas_extra is not null) as tiene_programacion
    from public.planos
    where local_id = p_local
      and (fechas_extra is not null and p_ts::date = any(fechas_extra)
           or (fecha_desde is null or p_ts::date >= fecha_desde)
              and (fecha_hasta is null or p_ts::date <= fecha_hasta)
              and (dias_semana is null
                   or extract(isodow from p_ts)::int = any(dias_semana))
              and (hora_inicio is null or p_ts::time >= hora_inicio)
              and (hora_fin    is null or p_ts::time <= hora_fin))
  )
  select id from candidatos
  order by tiene_programacion desc, es_principal desc
  limit 1;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.salas                 enable row level security;
alter table public.planos                enable row level security;
alter table public.plano_salas           enable row level security;
alter table public.plano_mesas           enable row level security;
alter table public.plano_orden_asignacion enable row level security;
alter table public.tipos_mesa_config     enable row level security;
alter table public.mesa_combinaciones    enable row level security;
alter table public.mesa_combinacion_componentes enable row level security;
-- Políticas usan helper empresas_del_usuario() resuelto via local_id → locales.empresa_id
-- Detalle de cada política se desarrolla en Fase 0.
```

---

## Blueprint (Assembly Line)

> Cada fase puede subdividirse en `/bucle-agentico` al entrar. Riesgo crítico: la Fase 0 toca BD producción → testear en branch Supabase antes de mergear.

### Fase 0: Migración BD + helpers + tipos TS + RLS
**Objetivo**: schema nuevo en producción sin perder datos, con RLS multi-tenant correcta y `plano_activo()` operativa.
**Validación**: `mcp__supabase__execute_sql` sobre cada empresa real (HABANA, BACANAL) confirma que (a) todas las mesas existentes tienen `local_id`, `codigo`, `capacidad_min`, `capacidad_max`, `tipo`, (b) existe ≥1 sala default por local, (c) `plano_activo(local_id, now())` devuelve el plano principal sembrado, (d) RLS bloquea acceso cross-empresa, (e) `get_advisors` sin warnings de RLS críticos.

### Fase 1: Configuración → Estructura (CRUD salas, zonas, mesas)
**Objetivo**: usuario puede dar de alta/editar/borrar salas, zonas (con color pastel), mesas (con código validado, capacidad_min/max, tipo) en `/sala/reservas` ⚙️ tab Estructura.
**Validación**: Playwright crea 1 sala + 2 zonas + 5 mesas (T-1..T-5), edita capacidades, borra una. `npm run typecheck` y `build` pasan.

### Fase 1.5: Combinaciones de Mesas (sub-apartado dentro de Estructura)
**Objetivo**: dentro de tab Estructura aparece sub-apartado "Combinaciones" con CRUD: multi-selector de mesas componentes (≥2), capacidad auto-suma con toggle de override manual, zona/tipo propios (preseleccionados si todas las componentes coinciden — exigidos a mano si difieren), color de marca con paleta rotatoria + override. `codigo` se autogenera y se actualiza vía trigger SQL al añadir/quitar componentes.
**Validación**: Playwright crea combinación `T-1+T-2+T-3` (capacidad auto = 3-12), edita a override manual con capacidad 8, cambia color. SQL confirma trigger recalcula `codigo` cuando se reordenan componentes. Validación bloquea guardado si <2 componentes o si componentes son de distinto local. La combinación NO entra automáticamente en `plano_orden_asignacion` — requiere alta explícita en tab Orden.

### Fase 2: Configuración → Planos (lista + editor drag-and-drop)
**Objetivo**: tab Planos lista planos del local, `+ Nuevo plano` crea uno; editor abre lienzo zoom/pan + panel lateral con mesas disponibles agrupadas por zona (de las salas activadas); drag desde panel al lienzo crea `plano_mesas (x,y,0)`; drag dentro del lienzo actualiza posición; control de rotación; constraint sala-zona se respeta y muestra toast bloqueante si se intenta romper.
**Validación**: Playwright crea plano "Verano", activa sala Interior, arrastra 3 mesas, mueve una y guarda. SQL confirma 3 filas `plano_mesas` con coordenadas correctas.

### Fase 3: Configuración → Programación de Planos
**Objetivo**: por plano, formulario con fechas sueltas + rango + días de semana + franja horaria + cubre_comidas/cenas + repetir_anual + es_principal. `plano_activo(now())` refleja cambios al instante.
**Validación**: crea "Verano" (rango Jun-Sep) y "Invierno" (resto, principal). En SQL, `plano_activo(local, '2026-07-15')` devuelve Verano; `plano_activo(local, '2026-12-15')` devuelve Invierno.

### Fase 4: Configuración → Orden de Asignación
**Objetivo**: tab con selector (plano, comensales 1..20) y lista DnD reordenable de mesas con capacidad suficiente; guarda `plano_orden_asignacion.posicion`.
**Validación**: drag reordena, guarda, recarga y se mantiene. SQL muestra `posicion` actualizada.

### Fase 5: Configuración → Opciones públicas (visibilidad)
**Objetivo**: por sala, zona y tipo definir `visible_cliente`/`zona_publica_id`/`oculta_total` (y simétrico en `tipos_mesa_config`). Seed canónico inicial via `syncSeedsToAllEmpresas()`.
**Validación**: SQL confirma que toda empresa tiene 4 filas en `tipos_mesa_config` y los flags se persisten al togglear.

### Fase 6: Modo operativo Reservas desktop con mapa + popover
**Objetivo**: en `/sala/reservas` se añade botón "Vista plano" que renderiza `<MapaMesas>` con plano activo, colores de zona, estados por color de mesa; popover 5 acciones con modales (Nueva reserva, Walk in, Bloquear web, Bloquear, Modificar). Plano se refresca al cambiar fecha/turno.
**Validación**: Playwright clic en T-3 libre → Walk in → guarda → T-3 pasa a naranja con "Walk-in HH:MM". Clic en T-3 → Modificar → cambia capacidad_max → guarda → modal cierra.

### Fase 7: Selector móvil compartido (mapa zoom/pan + lista)
**Objetivo**: `<SelectorMesaMobile>` reutilizable con toggle Mapa/Lista (persistido en localStorage), pinch-zoom + pan que no rompe scroll global, secciones por zona en lista.
**Validación**: en viewport móvil (Playwright `setViewportSize`), toggle alterna, pinch-zoom acerca/aleja el lienzo, lista muestra zonas con su color y mesas apiladas. Cero scroll global durante pinch.

### Fase 8: Reservas móvil (envuelve selector)
**Objetivo**: `/sala/reservas` con `useIsMobile()=true` reemplaza la vista actual por `<SelectorMesaMobile onMesaTap={popoverOperativo}>`; popover y modales adaptan a fullscreen.
**Validación**: Playwright móvil — abre `/sala/reservas`, ve mapa, tap T-5 libre → popover fullscreen → Walk in → guarda → mapa actualizado.

### Fase 9: POS comandera móvil
**Objetivo**: `/sala/pos` con `useIsMobile()=true` renderiza shell de 2 pantallas: selector móvil + `<POSShellMobile>`. Selección de mesa carga ticket abierto (vía `mesas-pos-actions.ts`).
**Validación**: Playwright móvil — abre `/sala/pos`, tap mesa, abre ticket, añade producto, envía. Botón ← vuelve al mapa.

### Fase 10: Switcher Paneles/Departamentos en header + MOBILE_CAPABILITIES
**Objetivo**: pills permanentes en header desktop y móvil; constante `MOBILE_CAPABILITIES` consumida por `mis-departamentos` en móvil para filtrar tiles.
**Validación**: Playwright desktop ve pills en header, móvil ve pills + Departamentos solo muestra tiles permitidos para `responsable`.

### Fase 11: Reservas pública con filtros + asignación automática
**Objetivo**: `/reservar/[slug]` añade 3 selectores opcionales (Sala/Zona/Tipo) filtrados por visibilidad y por disponibilidad cruzada. `asignarMesaAutomatica()` ejecuta el algoritmo (orden manual → fallback numérico por código → null).
**Validación**: Playwright — reserva con filtro BARRA asigna B-X (mesa BARRA); reserva con plano sin mesas libres queda con `mesa_id=null` y aparece en bandeja de pendientes del responsable.

### Fase 12: Validación Final E2E
**Objetivo**: sistema funcionando end-to-end + sin regresiones en PRP-046 (origen) ni PRP-047 (calendario + config).
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright cubre los 5 flujos del "Comportamiento Esperado".
- [ ] `mcp__supabase__get_advisors` sin nuevas alertas críticas.
- [ ] Todos los criterios de éxito marcados.
- [ ] PRP marcado COMPLETADO.

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Se completa durante la ejecución con `/bucle-agentico`. El mismo error nunca ocurre dos veces.

_(Pendiente)_

---

## Gotchas

- [ ] **Migración destructiva**: `mesas.numero` y `mesas.capacidad` se conservan como legacy mientras existan consumidores. NO drop hasta auditar `src/features/sala/pos/actions/mesas-pos-actions.ts`, `reservas.mesa_id`, `pos_tickets.mesa_id`, `aperturas` y vistas SQL. Aplicar migración en branch Supabase primero.
- [ ] **RLS cross-local**: políticas usan `empresas_del_usuario()` resolviendo `local_id → locales.empresa_id`. Verificar con `get_advisors` que no queda ninguna policy que filtre solo por `empresa_id` directo sin pasar por locales.
- [ ] **Multi-tenant cookie**: respetar `bh_empresa_activa` (MEMORY: `project_empresa_activa_cookie`). El selector de local en Configuración debe filtrar por empresa activa.
- [ ] **Performance del lienzo**: si un local tiene >200 mesas en un plano, render SVG ingenuo es lento. Plan: virtualizar fuera del viewport visible + memorizar paths por zona. Probar primero con SVG simple; si FPS < 30, migrar a canvas.
- [ ] **Gesture handling móvil**: pinch-zoom propio (NO `touch-action: pinch-zoom` del navegador, porque rompe pan del lienzo). Usar `pointer events` + previene default. Bloquear `body.scroll` solo durante gestos activos en el lienzo, no globalmente.
- [ ] **Constraint trigger sala-plano**: si se borra una `plano_salas` row sin que se borren primero las `plano_mesas` de mesas de esa sala, queda inconsistente. Trigger ON DELETE plano_salas debe cascade-borrar `plano_mesas` afectadas.
- [ ] **Validación inline tolerante código de mesa** (MEMORY `feedback_validaciones_inline`): el error de regex NO aparece mientras `codigo` sea un prefijo válido (`T`, `T-`, `T-5`). Solo al `onBlur` o al introducir char inválido.
- [ ] **Colisión con PRP-047**: ambos PRPs amplían el Sheet de Configuración de `/sala/reservas`. Coordinación obligatoria: si PRP-047 se aprueba/ejecuta primero, este PRP **añade** tabs al mismo Sheet, no lo recrea. Si va primero PRP-048, dejar Sheet preparado para que PRP-047 enchufe sus 4 apartados.
- [ ] **`plano_activo()` con SET-OF**: si dos planos coinciden en ventana (excepción + recurrente), priorizamos el que tiene `fechas_extra` que matchea, luego el de programación específica, finalmente `es_principal`. La query del helper SQL lo refleja en el `ORDER BY`.
- [ ] **Asignación cuando NO hay plano activo**: si `plano_activo(local, ts)` devuelve NULL (no hay programación que matchee ni principal), `asignarMesaAutomatica` debe fallar limpio con error `SIN_PLANO_ACTIVO` y la reserva pública guarda con `mesa_id=null`.
- [ ] **`reservas.zona_id` legacy**: actualmente existe (PRP demo). Mantener como denormalización (cache del zona_id de la mesa asignada) para queries rápidas; actualizar via trigger cuando cambie `reservas.mesa_id`.
- [ ] **POS móvil y plan activo**: en POS, mostramos siempre el plano activo en `now()`, no permitimos elegir otro plano (es operativa, no edición). Si el responsable quiere ver/editar mesas fuera del plano principal, va por `/sala/reservas` → ⚙️.
- [ ] **`MOBILE_CAPABILITIES` no oculta tiles en desktop**: el filtro solo aplica si `useIsMobile()=true && viewMode==='departamentos'`. Desktop sigue mostrando todos los módulos.
- [ ] **Switcher en móvil**: las pills deben caber en una fila sin romper layout en viewport 320px. Si no, usar `Segmented Control` shadcn de 40px alto compacto.
- [ ] **Constraint regex codigo**: si una mesa ya tiene `numero='Mesa exterior 4'` (texto libre), la backfill genera `codigo='M-N'` autoincremental (N = orden alfabético en la zona). El usuario verá su mesa renombrada y puede ajustarla en Configuración. Avisar en CHANGELOG.
- [ ] **Combinaciones y conflictos de disponibilidad**: cuando una `mesa_combinaciones` está reservada en una franja, sus mesas componentes quedan **automáticamente bloqueadas** para reservas individuales en esa franja. El query de disponibilidad debe expandir cada combinación reservada a sus componentes vía LEFT JOIN con `mesa_combinacion_componentes`. A la inversa: si una mesa componente está individualmente reservada, la combinación que la incluye queda no disponible en esa franja.
- [ ] **Combinaciones y auto-asignación**: por decisión de producto NO entran en `plano_orden_asignacion` automáticamente — el responsable debe añadirlas a mano por (plano, comensales). Razón: requieren mover mesas físicamente; auto-asignar sin supervisión humana causa caos operativo.
- [ ] **Trigger recalcula `codigo`**: el código de la combinación se calcula por trigger (`string_agg` ordenado por `orden`). NO permitir edición manual del campo — solo reordenar/añadir/quitar componentes. Reordenar dentro del modal cambia el código (`T-5+T-6` vs `T-6+T-5`); el `UNIQUE (local_id, codigo)` lo prohibirá si ya existe la otra orientación.
- [ ] **Borrar mesa con combinación activa**: si una mesa pertenece a combinaciones y se borra (`ON DELETE CASCADE` quita componentes), las combinaciones quedan con <2 componentes. Trigger `AFTER DELETE` en `mesa_combinacion_componentes` debe marcar `mesa_combinaciones.activa = false` si quedan <2 componentes (no borra, conserva histórico). Aviso al usuario antes de borrar mesa.

## Anti-Patrones

- NO crear un componente de mapa por cada consumidor — UN solo `<MapaMesas>` desktop y UN solo `<SelectorMesaMobile>` reusados.
- NO duplicar el modal "Modificar mesa" entre Configuración y popover operativo — UN solo `<MesaConfigModal>`.
- NO hardcodear paleta de colores pastel; vive en `src/features/sala/planos/data/colores-pastel.ts`.
- NO permitir que el cliente externo elija mesa concreta — viola la premisa del producto.
- NO romper `view-mode-context.tsx`: solo añadir consumidor `<ViewModePills>`.
- NO migrar `mesas` con `DROP COLUMN numero/capacidad` en esta iteración — mantener legacy hasta sweep posterior.
- NO usar `any` en tipos de geometría (`x`, `y`, `rotation`) — typed con `number` estricto.
- NO omitir Zod en server actions de planos/asignación.
- NO hacer fetch de mesas desde Sala/POS sin pasar por `useEstadoMesas()` — evita races con bloqueos y tickets.
- NO usar `touch-action: pinch-zoom` del navegador en el lienzo móvil — rompe pan custom.
- NO confundir `plano principal` con `plano activo`: principal es el fallback cuando ninguna programación matchea; activo es el resultado de `plano_activo(local, ts)`.
- NO ejecutar la migración de Fase 0 en producción sin branch Supabase + revisión humana (MEMORY `feedback_filter_repo_force_destruye_wip` — destructivo exige working tree limpio + backup).
- NO permitir editar manualmente el `codigo` de una combinación — siempre derivado de componentes (trigger SQL).
- NO meter combinaciones en `plano_orden_asignacion` automáticamente — alta explícita por el responsable.
- NO renderizar las mesas componentes de una combinación reservada como independientes — siempre con el borde de color de marca de la combinación.

---

*PRP pendiente aprobación. No se ha modificado código.*
