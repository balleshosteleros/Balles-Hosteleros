# PRP-091: Empresas vinculadas — compartir productos y escandallos entre empresas del grupo

> **Estado**: PENDIENTE
> **Fecha**: 2026-09-08
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Permitir que dos empresas del mismo grupo (BACANAL y HABANA) se **vinculen desde Ajustes** y compartan platos y escandallos: el escandallo se escribe **una sola vez** en la empresa de origen y el plato aparece en la carta digital, en el TPV y en la cocina de la empresa vinculada **con su propio precio y descontando su propio stock**, sin que nadie vuelva a teclear el escandallo.

## Por Qué

| Problema | Solución |
|----------|----------|
| BACANAL y HABANA venden 130 platos con el mismo nombre y cada uno está dado de alta dos veces a mano; cambiar un escandallo obliga a hacerlo dos veces y acaban diciendo cosas distintas | Un plato tiene **un escandallo vivo** en la empresa de origen y un **espejo** en la vinculada que se actualiza solo |
| BACANAL tiene 22 escandallos; **HABANA tiene cero**. El trabajo de cocina hecho en una casa no llega a la otra | El escandallo de BACANAL alimenta el plato de HABANA sin copiarlo a mano |
| Copiar el producto "a pelo" mezclaría los almacenes: el escandallo apunta a los productos de compra de BACANAL y el descuento saldría del stock equivocado | Cada ingrediente se **traduce** al producto de compra propio de la empresa destino; el kardex nunca cruza sociedades |
| Un plato nuevo tarda días en llegar a la segunda casa porque hay que repetir ficha, foto, alérgenos y carta | Compartir un plato es un clic; la carta digital de la vinculada lo recoge en la siguiente sincronización |

**Valor de negocio**: el trabajo de cocina y de ficha de producto se hace **una vez para todo el grupo**. Sobre el catálogo actual son ~130 platos de venta y 186 productos de compra equivalentes que hoy se mantienen por duplicado. Además abre la puerta comercial a los grupos con varios locales, que hoy tienen que gestionar cada restaurante como si no se conocieran.

## Qué

### Criterios de Éxito

- [ ] Desde **Ajustes → Empresa → Empresas vinculadas** se crea el vínculo BACANAL → HABANA, se elige qué se comparte y se puede pausar o cortar sin borrar nada.
- [ ] Sin vínculo activo, el software se comporta **exactamente igual que hoy**: ninguna empresa ve ni un dato de la otra.
- [ ] Un plato de BACANAL compartido aparece en la carta digital pública de HABANA (`/carta/habana`) con **el precio de HABANA**, su foto y sus alérgenos correctos.
- [ ] El escandallo **no está duplicado**: se edita solo en la cocina de BACANAL; en HABANA el escandallo se ve en modo lectura con el rótulo de dónde viene.
- [ ] Al cambiar un ingrediente en BACANAL, el plato de HABANA queda actualizado sin que nadie toque nada en HABANA.
- [ ] Vender ese plato en HABANA descuenta **stock de HABANA**: cero movimientos de kardex sobre productos de BACANAL (comprobable en `stock_movimientos`).
- [ ] El coste y el % de coste del plato en HABANA se calculan con **los precios de compra de HABANA**, no con los de BACANAL.
- [ ] No se puede compartir un plato cuyos ingredientes no tengan equivalencia en la empresa destino: el software lo bloquea y dice cuáles faltan.
- [ ] Al cortar el vínculo, el plato de HABANA **no desaparece**: se queda como producto propio, congelado en su última versión.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**1. El pacto (una vez).** Dirección entra en Ajustes → Empresa → Empresas vinculadas y ve las empresas del grupo a las que tiene acceso. Crea el vínculo: «BACANAL comparte con HABANA» y marca qué se comparte (hoy: productos de venta y sus escandallos). El vínculo tiene sentido y dirección: BACANAL es el origen, HABANA la que recibe. Queda registrado quién lo creó y cuándo.

**2. El diccionario de ingredientes (una vez, se amplía sola).** Antes de compartir nada, el software empareja los productos de compra de las dos casas: primero por `agora_id` (161 de los 186 posibles), después por nombre normalizado. Lo que no case sale en una pantalla de traducción — «Nata 35% (BACANAL) → ¿cuál de HABANA?» — y se resuelve a mano una vez. Ese diccionario es lo que impide que se mezcle el almacén.

**3. Compartir un plato.** En Logística → Productos (o en la ficha del escandallo en Cocina) de BACANAL, el plato tiene la acción «Compartir con HABANA». El software comprueba que todos los ingredientes de su escandallo tienen equivalencia; si falta alguno, lo dice por su nombre y no crea nada. Si están todos, crea en HABANA un **producto espejo**: mismo nombre, misma foto, mismos textos de carta, mismo escandallo **traducido** a los productos de compra de HABANA, y su `producto_composicion` propia. El espejo nace **sin precio**: lo pone el gerente de HABANA, porque el precio es de cada casa.

**4. En HABANA.** El plato aparece en Productos con una píldora «Viene de BACANAL». Su nombre, escandallo y alérgenos son de solo lectura; su precio, su visibilidad en carta, su orden, su «agotado hoy» y sus likes son suyos. En Cocina, el escandallo se ve entero (foto, elaboración, pasos) pero no se puede editar: el botón lleva a pedirlo a BACANAL, nunca abre el editor.

**5. En la carta.** La sincronización de la carta digital de HABANA ya lee `productos` tipo venta con `visible_carta`; el espejo entra por ahí sin código nuevo. El comensal de HABANA ve el plato con el precio de HABANA y sus alérgenos derivados de los ingredientes de HABANA.

**6. Un cambio en el escandallo.** El jefe de cocina de BACANAL añade un ingrediente al escandallo y guarda. Al guardar, además de reescribir su propia `producto_composicion`, el software reescribe la de cada espejo traduciendo los ingredientes, recalcula el coste con los precios de la casa destino y refresca los alérgenos. Si algún ingrediente nuevo no tiene equivalencia, el espejo **no se rompe**: se queda en su última versión buena y salta un aviso a Dirección de HABANA y de BACANAL pidiendo la traducción que falta.

**7. Cortar.** Se puede **pausar** el vínculo (deja de propagarse, todo sigue donde está) o **cortarlo**. Al cortarlo, cada espejo se convierte en producto propio de HABANA, editable, con su escandallo congelado tal cual estaba. No se borra ni un plato ni un movimiento de stock.

---

## Contexto

### ⚠️ Esto modifica una regla que hoy es sagrada

`project_empresa_ecosistema_aislado` recoge la regla literal de Iván:

> «cada empresa es un ente independiente; cuando cambias arriba de empresa en el selector, cambias de ecosistema por completo — y de ajustes, y de normas, y de todo. **No hay NADA que quede vinculado a otra empresa**».

Este PRP abre la **primera excepción** a esa regla, y por eso el vínculo es **explícito, con nombre, con dirección y apagable**: nada se comparte hasta que alguien firma el pacto en Ajustes, y el pacto se ve escrito. Aprobar este PRP significa aprobar también la enmienda de esa memoria. **Si Iván no quiere tocar esa regla, este PRP no debe ejecutarse.**

Dos límites que **no** se tocan, pase lo que pase:

- **El almacén nunca se comparte.** Ni stock, ni kardex, ni inventarios, ni albaranes, ni precios de compra.
- **El dinero nunca se comparte.** Precio de venta, ventas, nóminas, cierres y contabilidad siguen siendo de cada sociedad.

### Estado real del catálogo (consultado en la BD, 08-09-2026)

| | BACANAL | HABANA |
|---|---|---|
| Productos de compra | 406 | 291 |
| Productos de venta | 230 | 198 |
| Productos de elaboración | 22 | 0 |
| Escandallos de cocina | **22** | **0** |
| Ítems de carta publicados | 213 | 182 |

- **130 productos de venta** tienen el **mismo nombre** en las dos empresas: hoy son dos altas manuales que hay que mantener en paralelo.
- **186 productos de compra** casan por nombre; **161** casan por `agora_id`. El diccionario de ingredientes arranca con ~86 % de cobertura automática.
- Los 22 escandallos de BACANAL usan **62 productos de compra distintos** en 87 líneas de ingrediente: el emparejamiento manual que quedaría por hacer es pequeño y acotado.
- `empresas`: BACANAL `fe2ea3c4-aa28-41ce-a135-bf196ab5dc47`, HABANA `00000000-0000-0000-0000-000000000001`, BALLES `eb99bddd-9f49-4348-96ee-37f930c0d5d0` (`es_matriz = true`, no participa: no es un restaurante).

### Referencias

**Aislamiento por empresa (lo que hay que respetar):**
- `supabase/migrations/20260829120000_aislamiento_empresa_activa.sql` — `empresas_del_usuario()`. **Devuelve SOLO la empresa activa** (`bh_empresa_activa()` desde la cabecera `x-bh-empresa`). 448+ políticas RLS dependen de ella.
- `src/lib/supabase/get-context.ts` → `getAppContext()` — cliente de usuario, ya acotado a la empresa activa.
- `src/lib/supabase/admin.ts` → `createAdminClient()` — el único camino para escribir en la empresa vecina.
- `src/features/empresa/lib/empresa-server.ts` → `getEmpresaActivaForUser()`, `getCatalogoEmpresa()`.

**Producto, escandallo y stock:**
- `productos` (45 columnas): `empresa_id`, `tipo` (compra/venta/elaboracion), `nombre`, `categoria`, `precio_venta`, `coste`, `agora_id`, `alergenos`, `alergenos_modo`, `carta_nombre`, `carta_texto`, `carta_destacado`, `visible_carta`, `estilo_imagen_url`, `numero_secuencial`, `agotado_dia`, `factor_conversion`, `controla_stock`.
- `escandallos` (33 col.) + `escandallo_ingredientes` (14 col.) — el escandallo que edita Cocina; `escandallos.producto_id` es obligatorio y único.
- **`producto_composicion`** (`producto_venta_id`, `ingrediente_id`, `cantidad`, `merma_pct`) — **no tiene `empresa_id`**: hereda el aislamiento del producto padre. Es la fuente única del descuento de stock.
- `src/features/cocina/actions/escandallos-actions.ts` → `syncProductoComposicion()` (línea 165) y `fijarCosteAutoritativo()` (línea 202). **Este es el punto exacto donde engancha la propagación.**
- `src/features/sala/pos/services/descontar-stock-por-ventas.ts` — expande `producto_composicion` y llama al kardex. No se toca.
- `src/features/logistica/services/kardex.ts` → `registrarMovimiento()`; `stock` es `(empresa_id, producto_id)`.
- `supabase/migrations/20260627220000_alergenos_backfill_versionado.sql` → RPC recursiva `alergenos_derivados(uuid)`.
- `.claude/PRPs/PRP-080-escandallos-fuente-unica-y-stock-unificado.md` — **pendiente de aprobación**; decide que la unidad del escandallo la manda el producto (sin conversiones) y fija el lenguaje «Escandallos, nunca Recetas». Si se ejecuta antes, condiciona la Fase 2 de este PRP.

**Carta digital (lo que hace que esto salga gratis):**
- `src/features/marketing/carta-digital/services/sincronizar-desde-productos.ts` — «PRODUCTOS MANDA en precio, nombre base y alérgenos»; lo editorial de la carta no se pisa. Lo que entra lo decide `productos.visible_carta`.
- `src/features/marketing/carta-digital/actions/sincronizar-actions.ts` — llama a `alergenos_derivados` producto a producto.
- `src/features/marketing/carta-digital/services/carta-fetch.ts` → `fetchCartaPorSlug(slug, modo)` con service-role; `src/app/carta/[slug]/page.tsx`.
- **Consecuencia**: en cuanto el espejo existe como `productos` tipo venta de HABANA con `visible_carta`, la carta lo recoge **sin código nuevo**.

**Ajustes (dónde va el interruptor):**
- `src/app/(main)/ajustes/page.tsx` — 7 pestañas; comentario en el código: *«Todas las pestañas configuran ÚNICAMENTE la empresa activa del selector. El catálogo del grupo (crear/borrar/cambiar de empresa) vive en /empresas»* → hoy ese catálogo vive dentro de `EmpresaTab`.
- `src/features/ajustes/components/EmpresaTab.tsx` — editor de la empresa activa + crear/borrar empresa. **Aquí va «Empresas vinculadas»**: es la identidad de la empresa dentro del grupo, no un ajuste de departamento (ver `feedback_reglas_ajustes_configuracion_diseno`: si no pertenece a un departamento, no se cuelga de uno a la fuerza).
- `supabase/migrations/20260908010000_empresa_matriz.sql` — patrón de migración idempotente a copiar.

### Arquitectura Propuesta (Feature-First)

**Decisión central: espejo materializado, no lectura cruzada.**

Se descartan dos alternativas:

- **Producto compartido sin `empresa_id`** — 35 archivos consultan `productos` filtrando por empresa; un producto sin dueño se cuela en inventarios, pedidos, kardex y Ágora. Radio de explosión inasumible.
- **Leer el escandallo de la empresa vecina en caliente** — imposible sin romper el candado: `empresas_del_usuario()` devuelve solo la empresa activa, así que desde HABANA la fila de BACANAL sencillamente no existe. Ensanchar esa función para que devuelva las vinculadas afectaría a 448 políticas de golpe.

Por tanto: **el escandallo se edita en un solo sitio (origen) y se materializa traducido en el destino.** Una fuente de verdad para el humano, filas propias para la máquina. Ningún módulo existente cambia de comportamiento; el aislamiento de la RLS queda intacto; la propagación es un servidor con `createAdminClient()` que valida el vínculo antes de escribir.

```
src/features/empresa/vinculos/
├── actions/          # crear/pausar/cortar vínculo; compartir plato; propagar
├── components/       # tarjeta de Ajustes; pantalla de traducción de ingredientes; píldora "Viene de X"
├── services/         # emparejador automático, traductor de escandallos, propagador
└── types/
```

Puntos de enganche en código existente (mínimos y localizados):
- `cocina/actions/escandallos-actions.ts` → tras `syncProductoComposicion` + `fijarCosteAutoritativo`, llamar a `propagarAEspejos(productoId)`.
- `logistica/actions/producto-actions.ts` → bloquear la edición de los campos heredados si el producto es espejo.
- `cocina/components/escandallos/EscandallosView.tsx` → modo lectura + píldora de origen.

### Modelo de Datos

```sql
-- 1) EL PACTO. Con dirección: origen comparte, destino recibe.
create table if not exists public.empresa_vinculos (
  id uuid primary key default gen_random_uuid(),
  empresa_origen_id uuid not null references public.empresas(id) on delete cascade,
  empresa_destino_id uuid not null references public.empresas(id) on delete cascade,
  -- Qué se comparte. Hoy solo 'productos_venta'; deja sitio a futuro sin migración.
  ambitos text[] not null default array['productos_venta'],
  estado text not null default 'activo' check (estado in ('activo','pausado')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint empresa_vinculos_no_consigo_misma check (empresa_origen_id <> empresa_destino_id)
);
create unique index if not exists empresa_vinculos_par_unico
  on public.empresa_vinculos (empresa_origen_id, empresa_destino_id);

-- 2) EL DICCIONARIO DE INGREDIENTES. Vive en la empresa DESTINO.
--    Es lo único que impide que se mezclen los almacenes.
create table if not exists public.producto_equivalencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,  -- la destino
  producto_origen_id uuid not null references public.productos(id) on delete cascade,
  producto_local_id  uuid not null references public.productos(id) on delete cascade,
  origen text not null default 'manual' check (origen in ('agora_id','nombre','manual')),
  created_at timestamptz not null default now()
);
create unique index if not exists producto_equivalencias_unica
  on public.producto_equivalencias (empresa_id, producto_origen_id);

-- 3) EL ESPEJO. Una columna en productos: de quién soy copia viva.
alter table public.productos
  add column if not exists origen_producto_id uuid references public.productos(id) on delete set null,
  add column if not exists origen_empresa_id  uuid references public.empresas(id)  on delete set null;
create unique index if not exists productos_espejo_unico
  on public.productos (empresa_id, origen_producto_id)
  where origen_producto_id is not null;

-- RLS: el patrón de siempre, sin ensanchar el candado.
--   empresa_id in (select public.empresas_del_usuario())
-- El cruce entre empresas lo hace SOLO el servidor con service-role,
-- tras comprobar que existe un vínculo activo.
```

**Qué se hereda y qué es propio de cada casa** (la tabla que decide todo lo demás):

| Campo | Manda |
|---|---|
| `nombre`, `categoria`, `carta_texto`, `estilo_imagen_url`, foto | **Origen** (heredado, lectura en destino) |
| Escandallo: `escandallos`, `escandallo_ingredientes`, `producto_composicion` | **Origen** (traducida al guardar) |
| `alergenos` / `alergenos_modo` | **Origen** el modo; los derivados se recalculan con los ingredientes del **destino** |
| `precio_venta`, `iva` | **Destino** — nunca se copia |
| `coste`, `coste_total` del escandallo | **Destino** — se recalcula con sus precios de compra |
| `visible_carta`, `orden_carta`, `carta_destacado`, `agotado_dia`, likes | **Destino** |
| `agora_id`, `numero_secuencial`, stock, kardex, inventarios | **Destino** — jamás se copian |

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar en cada fase (bucle agéntico).

### Fase 1: El pacto
**Objetivo**: existe la tabla `empresa_vinculos` con su RLS y la tarjeta «Empresas vinculadas» en Ajustes → Empresa, donde se crea, se pausa y se corta el vínculo. Nada se comparte todavía.
**Validación**: con el vínculo creado y sin ninguna otra fase hecha, el software se comporta igual que hoy en las tres empresas; el vínculo se ve escrito en Ajustes y sobrevive a cambiar de empresa en el selector.

### Fase 2: El diccionario de ingredientes
**Objetivo**: `producto_equivalencias` poblada automáticamente (por `agora_id`, luego por nombre normalizado) y una pantalla donde se resuelven a mano las que falten.
**Validación**: sobre BACANAL→HABANA el emparejador automático cubre ≥160 productos de compra; la pantalla lista los que faltan y permite cerrarlos uno a uno; ninguna equivalencia apunta a un producto de otra empresa que no sea la suya.

### Fase 3: El espejo
**Objetivo**: la acción «Compartir con [empresa]» crea el producto espejo en el destino con su `producto_composicion` traducida, y el destino lo muestra como heredado (píldora de origen, campos de solo lectura).
**Validación**: un plato de BACANAL con escandallo aparece en Productos de HABANA con su ficha completa, sin precio, sin `agora_id`, con su propio `numero_secuencial`, y sus líneas de `producto_composicion` apuntan **solo** a productos de compra de HABANA. Compartir un plato con un ingrediente sin equivalencia se bloquea y dice cuál falta.

### Fase 4: El escandallo vivo
**Objetivo**: guardar el escandallo en la cocina de origen actualiza todos sus espejos (escandallo traducido, coste recalculado con los precios del destino, alérgenos refrescados), y un ingrediente sin traducción deja el espejo intacto y levanta un aviso.
**Validación**: cambiar un ingrediente en BACANAL cambia la composición del espejo de HABANA sin tocar HABANA; el coste del espejo sale de los precios de compra de HABANA y difiere del de BACANAL cuando los precios difieren; el caso de traducción ausente no rompe nada y avisa.

### Fase 5: El plato en la carta de HABANA
**Objetivo**: el espejo sale en `/carta/habana` con el precio de HABANA, su foto y sus alérgenos; ventana horaria, agotado del día y likes siguen siendo de HABANA.
**Validación**: captura de la carta pública de HABANA con el plato de BACANAL dentro; su precio es el de HABANA; marcarlo agotado en Cocina → Comandas de HABANA lo nubla solo allí.

### Fase 6: El almacén no se mezcla (prueba explícita)
**Objetivo**: demostrar que vender el plato espejo en HABANA no genera ni un movimiento sobre productos de BACANAL.
**Validación**: tras un ticket de prueba con el plato, `stock_movimientos` tiene salidas solo con `empresa_id` de HABANA sobre productos de HABANA; consulta de auditoría documentada en el propio PRP.

### Fase 7: Cortar el vínculo sin daños
**Objetivo**: pausar detiene la propagación; cortar convierte cada espejo en producto propio del destino (editable, escandallo congelado), sin borrar nada.
**Validación**: tras cortar, el plato sigue en la carta de HABANA, su escandallo es editable allí, y ningún cambio posterior en BACANAL le afecta.

### Fase 8: Validación Final
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: Ajustes → Empresa → Empresas vinculadas, ficha del espejo en HABANA y carta pública
- [ ] Los 10 criterios de éxito cumplidos
- [ ] Memoria actualizada: enmienda a `project_empresa_ecosistema_aislado` + nota nueva de empresas vinculadas

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

*(vacía — se rellena al ejecutar)*

---

## Gotchas

- [ ] **`empresas_del_usuario()` devuelve SOLO la empresa activa.** Desde HABANA, las filas de BACANAL no existen: cualquier `select` cruzado devuelve vacío **sin error**. Todo cruce va por servidor con `createAdminClient()` y comprobando antes el vínculo. Nunca ensanchar esa función: 448 políticas cuelgan de ella.
- [ ] **`producto_composicion` no tiene `empresa_id`.** Su aislamiento lo hereda del `producto_venta_id`. Si un espejo apuntara a ingredientes de la otra empresa, el descuento de stock cruzaría sociedades **sin que ninguna policy lo frene**. La traducción de ingredientes no es una comodidad: es el candado.
- [ ] **`precio_venta` no se copia jamás.** Copiarlo una sola vez «para arrancar» convierte el precio de una casa en el de la otra y nadie se entera hasta que cuadran caja.
- [ ] **`agora_id` no se copia.** Es el identificador del producto en el TPV de cada local; copiarlo cruzaría las ventas de Ágora entre empresas (`idx_productos_agora` es `(empresa_id, agora_id, tipo)`).
- [ ] **El coste se recalcula, no se hereda.** `fijarCosteAutoritativo()` usa `coste_escandallo()` con los precios de compra de la empresa; heredar el coste de BACANAL falsearía el food-cost de HABANA.
- [ ] **Alérgenos**: `alergenos_derivados()` es recursiva sobre `producto_composicion`. Con el escandallo traducido sale solo; con el escandallo sin traducir, sale vacía y el plato se publica **sin alérgenos** — riesgo sanitario, no cosmético. Bloquear la publicación del espejo si el escandallo no está completo.
- [ ] **Las unidades no viajan solas.** La cantidad de un ingrediente está expresada en la `medida` / `unidad_uso` / `factor_conversion` del producto de compra **de origen**. Si el equivalente de HABANA se compra en otro formato (litro vs. botella de 70 cl), copiar el número descuadra el consumo y el coste. La traducción debe convertir, o negarse y pedir que se iguale el formato. PRP-080 (pendiente de aprobación) decide justamente que *«la unidad del escandallo la manda el producto, sin conversiones»*: si se aprueba antes, la equivalencia debe exigir **misma unidad**.
- [ ] **Lenguaje**: el módulo se llama **Escandallos**, nunca «Recetas» (regla de PRP-080). En toda la UI de esta feature, «escandallo».
- [ ] **`numero_secuencial` es inmutable y por empresa** (`project_id_secuencial_inmutable`): el espejo recibe el suyo, nunca el del origen.
- [ ] **Sincronización de carta**: la carta se genera desde `productos` y respeta lo editorial ya escrito. Un espejo con `visible_carta = true` entra solo; conviene que **nazca oculto** y lo publique el gerente del destino cuando le ponga precio.
- [ ] **`agotado_dia`** es del destino: si se heredara, apagar un plato en BACANAL lo apagaría en HABANA. No se propaga.
- [ ] **HABANA tiene 0 escandallos y 0 productos de elaboración.** Si un escandallo de BACANAL usa una elaboración, hay que decidir si la elaboración también se comparte (se convierte en otro espejo) o si se bloquea. Resolver en la Fase 3.
- [ ] **BALLES (`es_matriz`) no participa.** No es un restaurante y está fuera de `syncSeedsToAllEmpresas()`; el selector de empresas vinculadas no debe ofrecerla.
- [ ] **El selector de empresas usa `empresas_del_usuario_todas()`**, no la acotada. Reutilizar ese camino para listar candidatas al vínculo, no inventar otro.
- [ ] **Ajustes es una barrera de seguridad**: nada de enlaces desde Logística o Cocina hacia Ajustes → Empresas vinculadas (`feedback_configuracion_vs_ajustes_niveles`).

## Anti-Patrones

- NO quitar `empresa_id` a `productos` ni crear productos "del grupo": 35 archivos consultan esa tabla por empresa.
- NO ensanchar `empresas_del_usuario()` ni las políticas RLS para que vean la empresa vinculada.
- NO copiar el escandallo como alta manual en el destino: eso es exactamente el problema que se quiere eliminar.
- NO usar `if (empresa_id === ...)`: el vínculo es un dato, no una excepción cableada (`feedback_cambios_multi_tenant`).
- NO borrar nada al cortar el vínculo.
- NO crear patrones visuales nuevos: tarjeta de Ajustes y píldoras como las existentes.
- NO omitir Zod en los formularios ni el `try/catch` + log en cada escritura.

---

## Preguntas abiertas para Iván (antes de aprobar)

1. **La regla de aislamiento**: ¿se acepta esta primera excepción, siempre explícita y apagable desde Ajustes?
2. **Dirección del vínculo**: ¿BACANAL manda y HABANA recibe, o quieres que ambas puedan compartir hacia la otra (dos vínculos)?
3. **El nombre en la casa destino**: ¿HABANA puede llamar al plato de otra forma en su carta, o el nombre lo manda siempre el origen?
4. **Elaboraciones**: si un escandallo compartido lleva una elaboración de BACANAL, ¿se comparte también la elaboración o se bloquea?
5. **Quién puede compartir**: ¿solo Dirección (permiso de Ajustes), o también el jefe de cocina desde su módulo?

---

*PRP pendiente aprobación. No se ha modificado código.*
