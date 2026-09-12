---
name: carta_agotados_y_menu_del_dia
description: La carta se lee distinto desde el QR de la mesa que desde la web (?web=1), y cocina apaga productos agotados por día de servicio
type: project
---

Dos reglas que decidió Iván el 07-09-2026 y que gobiernan la carta digital.

## 1. La misma carta se lee distinto en la mesa y en la web

`fetchCartaPorSlug(slug, modo)` con `modo: "local" | "web"`:

- **`local`** (por defecto) — el QR de la mesa. Las categorías con ventana horaria
  (el menú del día: L-V 12:30–16:30 en BACANAL) **desaparecen** fuera de su franja.
  Sentado en la mesa solo se puede pedir lo que la cocina sirve ahora.
- **`web`** — se activa con `?web=1`. La categoría **se enseña siempre**, con una
  píldora encima: *"Se sirve de lunes a viernes, de 12:30 a 16:30"*. Quien mira la
  web un domingo está decidiendo si viene el martes, y el menú del día es justo lo
  que busca.

**Por qué así y no al revés:** el QR impreso y el botón "Ver la carta" de la web
apuntan HOY al mismo enlace (`bacanalmadrid.com/carta`). La marca la pone la web
(`/carta?web=1` en el collage, el nav, la plantilla y el prototipo), nunca el QR:
así **no hay que reimprimir ningún QR de mesa**.

## 2. "Agotado" lo marca cocina y vuelve solo

- Se guarda en **`productos.agotado_at`** (+ `agotado_por`), NO en `carta_items`,
  porque el producto es lo único que comparten la carta del QR, la tecla del TPV y
  la futura comanda del camarero. `carta_items` conserva las mismas columnas solo
  para los ~20 platos escritos a mano que no tienen producto detrás.
- Dura un **plazo en HORAS** desde el marcado: **12 por defecto**, configurable por
  empresa en **Cocina → Comandas → engranaje** (`cocina_alarmas_config.horas_apagado_producto`,
  1–72). Se guarda CUÁNDO se marcó, no cuándo caduca: así, si se cambia el plazo, lo
  ya marcado se rige por el plazo nuevo sin recalcular nada. Cálculo único en
  `features/cocina/apagados/lib/caducidad.ts` (`apagadoVigente`) — no duplicarlo.
- **Por qué horas y no "hasta mañana"** (cambio del 12-09-2026): con el corte del día
  de servicio (06:00), apagar algo a las 05:50 duraba diez minutos y a las 06:10
  duraba casi un día. Un plazo en horas dura lo mismo se marque cuando se marque.
- En la carta el plato **NO desaparece**: sale en gris/nublado con el rótulo
  "Agotado" (decisión literal de Iván; sin "hoy", porque el plazo es en horas). Borrarlo genera la pregunta "¿y el de
  la foto?"; verlo agotado evita que se pida.
- Se opera desde **Cocina → Comandas → "Apagar productos"**: catálogo de venta por
  categorías, se marca lo que falte y se pulsa **Guardar** una vez (no una llamada
  por toque: cocina marca cinco cosas seguidas). En móvil ese panel va a **pantalla
  completa y anclado a los cuatro bordes**: el diálogo normal se centra con
  porcentajes y trae scroll propio, así que al abrirse el teclado del buscador el
  panel entero saltaba de sitio.
- Comandas en móvil: las 4 columnas del kanban **no caben**; se pasan con el dedo
  (`snap-x`, 86vw cada una). En ordenador siguen siendo un grid de 4.

## Bug arreglado de paso

`fetchCartaPorSlug` usa **service-role** (para poder leer `empresas`), y eso
**se salta la RLS**. La policy `carta_items_public_read` ya filtraba `oculto` y
`productos.visible_carta`, pero esa carga no: un plato retirado seguía saliendo en
la carta pública. Ahora el filtro está también en el código. Si alguien añade otra
condición a la policy, hay que replicarla ahí.

## Pendiente: apagar también la tecla del TPV

Ágora expone `SaleableAsMain` en `/api/export-master/?filter=Products`. Poniéndolo
a `false` y reenviando por `POST /api/import/` + `generate-data` la tecla dejaría
de vender (mismo circuito ya validado para precios, ver
[[envio_precios_agora_validado]]). **No implementado**: escribe en la caja en
producción y necesita aprobación explícita de Iván (Regla de Seguridad Ágora).
