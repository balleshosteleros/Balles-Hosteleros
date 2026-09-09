# PRP-089: Inventario de uniforme y material (almacén propio de RRHH)

> **Estado**: IMPLEMENTADO salvo la Fase 8 (carga de las 28 piezas), bloqueada a la espera de decidir firma y fecha
> **Fecha**: 2026-09-07
> **Proyecto**: Balles-Hosteleros
> **Módulo**: RRHH → Entregas

---

## Objetivo

Dar a RRHH un **almacén propio de uniforme y material**, separado del stock de cocina, donde en todo momento se sepa cuántas unidades hay **en almacén**, cuántas están **en manos de los trabajadores** y cuántas tiene **la empresa en total**, con un libro de movimientos con signo que explique cada variación y un recuento físico que revele el descuadre entre lo teórico y lo real.

## Por Qué

| Problema | Solución |
|----------|----------|
| Nadie sabe cuántas camisetas M hay en el almacén ni cuántas están puestas: se compra a ciegas | Tres saldos vivos por tipo + talla, calculados del libro de movimientos |
| Las entregas ya registran lo que tiene cada trabajador, pero no de dónde salió ni qué queda | Cada entrega firmada **mueve** una unidad de almacén a manos del trabajador; no crea material de la nada |
| El uniforme que se pierde cuando alguien se va no se resta de ningún sitio: la empresa cree que lo sigue teniendo | Desenlace **No devuelta**: sale de la ficha del empleado y se resta del total de la empresa como pérdida |
| Meter el uniforme en el kardex de logística ensuciaría escandallos, albaranes y Ágora | Almacén propio en RRHH, tablas propias, sin tocar `productos` ni `stock_movimientos` |
| Lo que dice el sistema y lo que hay en la estantería se separa con el tiempo y no hay forma de saberlo | Recuento físico que congela el teórico, guarda el contado y genera el ajuste con su motivo |

**Valor de negocio**: se deja de comprar uniforme "por si acaso" y se recupera el material que hoy se pierde en cada baja. Con 28 piezas reales entre HABANA y BACANAL el volumen es pequeño; el valor es que a partir de aquí **nada entra ni sale sin dejar rastro**, y el ratio de coste de uniforme por empleado deja de ser una estimación.

---

## Qué

### Criterios de Éxito

- [ ] La pantalla muestra, por **tipo de material + talla**, tres columnas: en almacén, en manos de trabajadores y total empresa; y tres tarjetas con esos mismos totales agregados de toda la empresa.
- [ ] Cada uno de los 8 movimientos existe, tiene signo y deja fila en el libro: **compra/entrada** (+almacén), **entrega** (−almacén, +manos), **devolución** (+almacén, −manos), **deterioro con el trabajador** (−manos), **deterioro en almacén** (−almacén), **no devuelta** (−manos, pérdida), **ajuste de recuento** (± cualquiera de los dos) y **saldo inicial** (carga de partida).
- [ ] Es **imposible** que una entrega cree o destruya unidades: entregar y devolver mueven de un sitio a otro y el total de la empresa no cambia.
- [ ] Un empleado que se va sin devolver una pieza se marca **No devuelta**: la pieza sale de su ficha y baja el total de la empresa. Queda en su histórico con motivo y fecha.
- [ ] El recuento físico enfrenta el saldo teórico con el contado, muestra el **descuadre** por línea y al confirmarlo genera un ajuste por cada diferencia distinta de cero.
- [ ] Las **28 piezas reales** de HABANA y BACANAL están cargadas como saldo inicial, cada una en su empresa, sin inventar movimientos falsos.
- [ ] Ni una sola escritura en `stock_movimientos`, `productos`, `inventarios` ni ninguna tabla de logística o cocina.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Comprar.** RRHH abre Almacén → "Entrada", elige tipo (Camiseta) y talla (M), pone 10 unidades, la fecha, opcionalmente proveedor, nº de documento y coste unitario. Se graban 10 unidades: `+10 almacén`. El total de la empresa sube 10.

**Entregar.** Nada cambia en el flujo actual: RRHH crea la entrega de una unidad, el trabajador firma el acta. **Al firmar** se graba el movimiento `−1 almacén, +1 manos`. El total de la empresa no se mueve. Mientras el acta está pendiente de firma la pieza sigue contando en almacén.

**Devolver.** El trabajador firma el acta de devolución → `+1 almacén, −1 manos`. La pieza vuelve a estar disponible.

**Se le rompe al trabajador.** Merma con el flujo que ya existe (acta de baja por deterioro firmada) → `−1 manos`. El total de la empresa baja 1.

**Se estropea en el almacén.** RRHH da de baja unidades directamente desde Almacén con un motivo → `−n almacén`. No hay acta: no hay trabajador que firme.

**Se va y no la devuelve.** En la ficha del empleado (o en el offboarding) RRHH marca la entrega como **No devuelta**, con motivo. → `−1 manos`. Sale de "lo que tiene" y el total de la empresa baja. No se firma nada: el trabajador ya no está.

**Contar.** RRHH abre un recuento, el sistema lista cada tipo + talla con su saldo teórico de almacén congelado, RRHH escribe lo que hay realmente en la estantería. Al confirmar: por cada línea con diferencia se graba un ajuste `± almacén` con la referencia del recuento. La fecha del último recuento y el último descuadre quedan visibles en la tabla de saldos.

---

## Contexto

### Referencias

**Lo que ya existe y NO se rehace** (0 entregas grabadas, 30 tipos sembrados en HABANA y BACANAL):

- `supabase/migrations/20260820100000_entregas_material_uniforme.sql` — `entregas_tipos_material` (catálogo por empresa: nombre, categoría uniforme/material, `requiere_talla`, `requiere_devolucion`), `entregas_material` (cabecera con firma), `entregas_material_items` (la pieza, nombre y categoría congelados).
- `supabase/migrations/20260820160000_entregas_individuales_y_devolucion_firmada.sql` — **una entrega = una unidad, sin cantidad** (índice único `entregas_material_items_una_por_entrega`), y devolución firmada.
- `supabase/migrations/20260821090000_entregas_todo_se_devuelve_y_merma.sql` — todo se devuelve por defecto; merma como desenlace dentro de `devolucion_estado`.
- `src/features/rrhh/data/entregas.ts` — tipos, `resumirMaterial()`, `sePuedePedirDevolucion()`, `sePuedeDarDeBajaPorMerma()`, `pendientesDeDevolucion()`.
- `src/features/rrhh/actions/entregas-actions.ts` (874 líneas) — `crearEntrega`, `reenviarEntregaAFirma`, `pedirDevolucion`, `darDeBajaPorMerma`, `cancelarDevolucion`, `borrarEntrega`, `getHistorialEntrega`.
- `src/features/rrhh/components/entregas/EntregasView.tsx` — lista, `SubmoduleToolbar`, engranaje → `TiposMaterialConfig`.
- `src/app/(main)/rrhh/entregas/page.tsx`, `src/app/(main)/mi-panel/entregas/page.tsx`, `src/app/(mobile)/m/entregas/page.tsx`.

**Patrón de libro mayor a imitar en forma, no a reutilizar**:
- `supabase/migrations/20260616120000_stock_movimientos_kardex.sql` — kardex de logística: `signo`, `documento_tipo`, idempotencia por `origen_linea_id`, escritura solo desde server actions (sin policy de INSERT para usuarios). **Está atado a `productos` y alimenta escandallos, albaranes y Ágora: no se toca.**
- `supabase/migrations/20260627220000_inventarios_backend_real.sql` — patrón de recuento (cabecera + líneas + confirmación).

**Memoria aplicable**: `project_entregas_acta_unica_e_historial`, `project_empresa_ecosistema_aislado`, `project_rls_helper_empresas_del_usuario`, `project_supabase_tope_1000_filas`, `project_zona_horaria_empresa`, `feedback_estado_activo_inactivo`, `feedback_no_confirm_nativo_hook`, `project_musica_sin_permiso_propio` (submódulo sin permiso propio).

### Arquitectura Propuesta

**Dónde vive** (confirmado por Iván, 08-09-2026): dentro del submódulo **ENTREGAS** de RRHH (`/rrhh/entregas`), como pestañas — no se añade entrada al menú ni permiso nuevo. Precedente en el propio módulo: `FichajesModulo.tsx` y `SolicitudesView.tsx`.

```
/rrhh/entregas
  ├── Entregas   (lo que ya hay: histórico por trabajador, actas, devoluciones)
  ├── Almacén    (nuevo: tres totales + tabla por tipo·talla + libro de movimientos)
  └── Recuentos  (nuevo: recuento físico y descuadre)
  engranaje → catálogo de tipos (ya existe, TiposMaterialConfig)
```

```
src/features/rrhh/
├── actions/
│   ├── entregas-actions.ts          # (existente) se le engancha el movimiento al firmar
│   ├── material-almacen-actions.ts  # entradas, bajas en almacén, listado de saldos y libro
│   └── material-recuentos-actions.ts
├── data/
│   ├── entregas.ts                  # (existente) + estado 'no_devuelta'
│   └── material-stock.ts            # tipos, TIPOS_MOVIMIENTO, deltas por tipo, formateo
├── services/
│   └── material/movimientos.ts      # única puerta de escritura del libro (+ reversión)
└── components/entregas/
    ├── AlmacenTab.tsx / RecuentosTab.tsx
    ├── EntradaMaterialDialog.tsx / BajaAlmacenDialog.tsx / NoDevueltaDialog.tsx
    └── RecuentoDialog.tsx
```

**Decisión de arquitectura clave — el movimiento lleva DOS deltas, no una ubicación.**
Cada fila del libro guarda `delta_almacen` y `delta_manos` (enteros con signo). Una entrega es **una sola fila** con `−1 / +1`, atómica: no puede quedar media entrega ni puede una entrega crear material de la nada. Con dos filas (una salida y una entrada) el saldo se podría partir por un fallo entre las dos escrituras.

| Tipo de movimiento | delta_almacen | delta_manos | Total empresa | ¿Lleva `entrega_id`? |
|---|---|---|---|---|
| `inicial` (saldo de partida) | +n | +n (si ya está puesto) | sube | no |
| `compra` | +n | 0 | sube | no |
| `entrega` | −1 | +1 | igual | sí |
| `devolucion` | +1 | −1 | igual | sí |
| `deterioro_trabajador` | 0 | −1 | baja | sí |
| `deterioro_almacen` | −n | 0 | baja | no |
| `no_devuelta` | 0 | −1 | baja (pérdida) | sí |
| `ajuste_recuento` | ±n | ±n | cambia | no |

**Segunda decisión — no hay columna de saldo.** El saldo se calcula con `SUM()` en una vista (`material_saldos`), agrupando por empresa + tipo + talla. Con este volumen (decenas de piezas) es instantáneo y **el saldo nunca puede desincronizarse del libro**, que es justo el fallo que se quiere evitar. El kardex de logística guarda `saldo_resultante` porque procesa miles de líneas de Ágora; aquí no hace falta.

**Tercera decisión — la unidad de stock es `tipo_id` + `talla`.** Los tipos sin talla (`requiere_talla = false`) usan `talla = NULL`, y para agrupar y para el índice único se normaliza con `coalesce(talla, '')`.

**Cuándo se graba el movimiento de una entrega**: al **firmar** el acta, no al crearla — coherente con `resumirMaterial()`, que solo cuenta las firmadas. Mientras el acta está pendiente, la pieza cuenta en almacén. Borrar una entrega ya firmada **revierte** su movimiento (fila inversa con `revierte_a`), nunca borra la fila original.

### Modelo de Datos

```sql
-- Libro de movimientos. Fuente única de verdad del almacén de RRHH.
create table if not exists public.material_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,

  -- Unidad de stock: tipo del catálogo + talla. Nombre y talla congelados para
  -- que el libro siga legible si se borra o renombra el tipo (igual que el acta).
  tipo_id uuid references public.entregas_tipos_material(id) on delete set null,
  tipo_nombre text not null,
  categoria text not null check (categoria in ('uniforme', 'material')),
  talla text,

  fecha date not null default current_date,
  tipo_movimiento text not null check (tipo_movimiento in (
    'inicial', 'compra', 'entrega', 'devolucion',
    'deterioro_trabajador', 'deterioro_almacen', 'no_devuelta', 'ajuste_recuento'
  )),

  -- Los dos deltas con signo. Un movimiento = una fila = un hecho atómico.
  delta_almacen integer not null default 0,
  delta_manos   integer not null default 0,
  constraint material_mov_no_vacio check (delta_almacen <> 0 or delta_manos <> 0),

  -- De dónde viene
  entrega_id  uuid references public.entregas_material(id) on delete set null,
  empleado_id uuid references public.empleados(id) on delete set null,
  recuento_id uuid,                    -- FK añadida tras crear la tabla de recuentos
  revierte_a  uuid references public.material_movimientos(id) on delete set null,

  motivo text,                         -- obligatorio en bajas, pérdidas y ajustes
  proveedor text,                      -- solo compras
  documento_referencia text,           -- nº albarán/factura del proveedor
  coste_unitario numeric(10,2),        -- opcional: permite valorar la pérdida

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_por_nombre text
);

-- Idempotencia: una entrega no puede generar dos veces el mismo movimiento.
create unique index if not exists material_mov_entrega_uk
  on public.material_movimientos (entrega_id, tipo_movimiento)
  where entrega_id is not null and revierte_a is null;

create index if not exists material_mov_saldo_idx
  on public.material_movimientos (empresa_id, tipo_id, coalesce(talla, ''));
create index if not exists material_mov_fecha_idx
  on public.material_movimientos (empresa_id, fecha desc, created_at desc);

alter table public.material_movimientos enable row level security;
-- Lectura multi-tenant; escritura SOLO desde server actions (sin policy de escritura).
create policy material_mov_select on public.material_movimientos for select
  using (empresa_id in (select public.empresas_del_usuario()));

-- Los tres totales, derivados. Sin columna de saldo = sin desincronización posible.
create or replace view public.material_saldos as
select
  empresa_id,
  tipo_id,
  max(tipo_nombre) as tipo_nombre,
  max(categoria)   as categoria,
  talla,
  sum(delta_almacen)::int                     as en_almacen,
  sum(delta_manos)::int                       as en_manos,
  (sum(delta_almacen) + sum(delta_manos))::int as total_empresa
from public.material_movimientos
group by empresa_id, tipo_id, talla;

-- Recuento físico
create table if not exists public.material_recuentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fecha date not null default current_date,
  nombre text,
  estado text not null default 'abierto' check (estado in ('abierto', 'confirmado', 'anulado')),
  nota text,
  confirmado_en timestamptz,
  confirmado_por uuid references auth.users(id) on delete set null,
  confirmado_por_nombre text,
  created_at timestamptz not null default now()
);

create table if not exists public.material_recuentos_lineas (
  id uuid primary key default gen_random_uuid(),
  recuento_id uuid not null references public.material_recuentos(id) on delete cascade,
  tipo_id uuid references public.entregas_tipos_material(id) on delete set null,
  tipo_nombre text not null,
  talla text,
  teorico_almacen integer not null,     -- congelado al abrir el recuento
  contado_almacen integer,              -- NULL = aún sin contar
  diferencia integer generated always as (coalesce(contado_almacen, 0) - teorico_almacen) stored,
  nota text
);

-- Nuevo desenlace: se fue y no la devolvió. Único que NO se firma.
alter table public.entregas_material drop constraint if exists entregas_material_devolucion_estado_check;
alter table public.entregas_material add constraint entregas_material_devolucion_estado_check
  check (devolucion_estado in (
    'no_procede', 'pendiente_firma', 'devuelta', 'rechazada',
    'merma_pendiente_firma', 'merma',
    'no_devuelta'
  ));
alter table public.entregas_material
  add column if not exists no_devuelta_motivo text,
  add column if not exists no_devuelta_en timestamptz;
```

---

## Blueprint (Assembly Line)

### Fase 1: El libro y los tres saldos ✅
**Objetivo**: migración idempotente con `material_movimientos`, la vista `material_saldos`, las dos tablas de recuento, el estado `no_devuelta` y las RLS (lectura por `empresas_del_usuario()`, escritura solo server). Seed del catálogo de tipos completado también en la empresa que hoy no lo tiene.
**Validación**: `material_saldos` devuelve 0 filas sin romper; insertar a mano una compra y una entrega deja el total de la empresa igual; una fila con los dos deltas a 0 la rechaza el CHECK.

### Fase 2: Puerta única de escritura del libro ✅
**Objetivo**: `services/material/movimientos.ts` como **único** punto que escribe movimientos, con la tabla de deltas por tipo de movimiento, congelado de nombre/talla, idempotencia y reversión.
**Validación**: llamar dos veces al mismo movimiento de entrega no duplica; revertir deja el saldo como estaba.

### Fase 3: Enganchar las entregas que ya existen ✅
**Objetivo**: firmar entrega → `−1/+1`; firmar devolución → `+1/−1`; firmar merma → `−1 manos`. Sin cambiar el flujo de actas ni la UI de Entregas. (La reversión al borrar se descartó: ver Aprendizajes.)
**Validación**: ciclo completo entrega → firma → devolución → firma sobre una unidad; el total de la empresa no varía en ningún paso y el libro tiene 2 filas.

### Fase 4: No devuelta (la pérdida) ✅
**Objetivo**: acción y diálogo con motivo obligatorio para marcar una entrega como no devuelta; `−1 manos`; sale de `resumirMaterial()` y de `pendientesDeDevolucion()`; aparece en el histórico de la ficha del empleado y en el offboarding.
**Validación**: marcada la pieza, desaparece de "lo que tiene" el empleado y el total de la empresa baja 1; la fila sigue en su histórico con motivo y fecha.

### Fase 5: Entradas y bajas de almacén ✅
**Objetivo**: diálogo de entrada (tipo, talla, unidades, fecha, proveedor, documento, coste unitario opcional) y de baja por deterioro en almacén con motivo obligatorio. Validación Zod en ambos.
**Validación**: 10 camisetas M entran y suben `en_almacen` y `total_empresa`; 2 rotas los bajan; el libro lo explica.

### Fase 6: Pantalla de Almacén ✅
**Objetivo**: pestaña con tres tarjetas (en almacén / en manos / total empresa), tabla por tipo·talla con esas tres columnas más último recuento y descuadre, filtro por columna, y libro de movimientos con su signo. Fechas en la zona de la empresa, formato día-mes-año.
**Validación**: los tres totales de las tarjetas cuadran con la suma de la tabla; screenshot Playwright.

### Fase 7: Recuento y descuadre ✅
**Objetivo**: abrir recuento (congela el teórico), contar, ver diferencia por línea, confirmar → un `ajuste_recuento` por cada diferencia ≠ 0 con la referencia del recuento. Confirmación no destructiva con botón Aceptar, sin `confirm()` nativo.
**Validación**: teórico 10, contado 8 → tras confirmar el saldo es 8 y hay un ajuste de −2 en el libro con su motivo.

### Fase 8: Carga de las 28 piezas reales ⏳ BLOQUEADA: falta decidir firma y fecha
**Objetivo**: movimientos `inicial` para HABANA y BACANAL, cada pieza en su empresa, con tipo y talla reales, distinguiendo lo que está en el almacén de lo que ya está en manos de alguien. Migración versionada e idempotente.
**Validación**: `material_saldos` cuadra pieza a pieza con el listado real; ejecutar la migración dos veces no duplica nada.

### Fase 9: Validación Final ✅ typecheck 0 errores, build en verde, kardex de cocina intacto
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: los tres totales y el descuadre se ven en pantalla
- [ ] `select count(*) from stock_movimientos` no ha variado
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

**La reversión no hacía falta y se quitó.** El plan preveía revertir el
movimiento al borrar una entrega firmada. Al implementarlo se vio que el módulo
lo impide en tres sitios: `borrarEntrega` rechaza las firmadas, y
`cancelarDevolucion` rechaza tanto `devuelta` como `merma`. Y lo no firmado
todavía no ha movido nada, porque el movimiento se graba al firmar. No había
ningún camino que llegara a esa función, así que se eliminó en vez de dejar
código muerto. La columna `revierte_a` se queda en la tabla: si algún día se
permite deshacer algo firmado, la corrección se escribe como línea contraria.

**El catálogo estaba peor de lo que decía el PRP.** No era solo que una empresa
no tuviera tipos: además "Camisa" no distinguía manga, y faltaban Americana y
Ordenador para poder cargar las piezas reales. Se resolvió en la misma
migración; la "Camisa" antigua se desactiva en vez de borrarse.

**`talla` NULL en la vista.** `group by ... talla` no agrupa los NULL entre sí de
forma utilizable desde el cliente, así que la vista expone `talla_clave`
(`coalesce(talla,'')`) para filtrar y `talla` real para mostrar.

---

## Gotchas

- [ ] **No tocar el kardex de logística.** `stock_movimientos` está atado a `productos` y alimenta escandallos, albaranes y Ágora. Una camiseta ahí ensucia costes de cocina.
- [ ] **Punto de partida limpio**: hay **0 entregas** grabadas. No hay histórico que reconciliar — pero el enganche debe ser correcto desde la primera firma, porque después ya no lo será.
- [ ] **El catálogo de tipos no está sembrado en las 3 empresas**: hay 30 tipos (15 en HABANA, 15 en BACANAL) y una empresa sin ninguno. El seed debe cubrirlas todas, idempotente.
- [ ] **Cada empresa es un ecosistema aislado**: el almacén es por empresa. Las 28 piezas se reparten entre HABANA y BACANAL, no se mezclan. Un empleado espejo en dos empresas tiene dos fichas: su uniforme cuenta en la empresa que se lo dio.
- [ ] **`talla` NULL rompe los `group by` ingenuos**: normalizar siempre con `coalesce(talla, '')` para agrupar y para el índice.
- [ ] **Los nombres van congelados** en cada movimiento (`tipo_nombre`, `talla`), igual que en el acta: si se borra el tipo, el libro debe seguir siendo legible.
- [ ] **Borrar una entrega firmada revierte, no borra**: fila inversa con `revierte_a`. Borrar la fila original dejaría el libro mintiendo.
- [ ] **Una sola acta viva por firma** (memoria `project_entregas_acta_unica_e_historial`): el nuevo desenlace "No devuelta" **no manda acta ninguna** — el trabajador ya no está. Es la única salida sin firma, y por eso exige motivo escrito.
- [ ] **Supabase corta en 1000 filas**: el libro crece sin techo; paginar el listado de movimientos.
- [ ] **Fechas en la zona de la empresa** (`formatFechaEnZona`), formato día-mes-año. Nunca `toLocale*` a pelo.
- [ ] **Sin permiso propio**: va dentro del permiso de Entregas de RRHH. No añadir entrada al menú ni permiso nuevo.
- [ ] **Confirmaciones**: `useConfirmDelete` / diálogo con botón Aceptar. Nunca `confirm()` ni `alert()` del navegador.
- [ ] **Inputs numéricos sin cero colgado**; unidades siempre enteras y > 0 en compras.
- [ ] **Móvil**: la pestaña de Almacén es de gestión, no lleva botones de configuración en móvil.

## Anti-Patrones

- NO escribir en `stock_movimientos`, `productos`, `inventarios` ni ninguna tabla de logística o cocina
- NO guardar una columna de saldo que haya que mantener sincronizada: el saldo se deriva del libro
- NO partir un movimiento en dos filas (salida + entrada): una entrega es una fila con dos deltas
- NO permitir editar ni borrar filas del libro: se corrige con un movimiento de signo contrario
- NO reintroducir cantidades en `entregas_material`: una entrega sigue siendo una unidad
- NO usar `any`, NO omitir Zod en los inputs, NO omitir RLS
- NO crear un permiso ni una entrada de menú nueva para el almacén

---

*Implementado el 10-09-2026 salvo la Fase 8.*
