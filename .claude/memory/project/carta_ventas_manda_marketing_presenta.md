---
name: carta_ventas_manda_marketing_presenta
description: REGLA LITERAL — ventas define lo que el producto ES; marketing solo lo que el cliente VE, y nunca escribe en la ficha del producto
type: project
---

**Regla literal de Iván (10-09-2026). No reformular ni negociar.**

> "TODO lo del producto de venta nunca se modifica por nada que se toque en
> marketing. En marketing se puede tocar lo que se ve en la carta digital.
> SOLO se pueden cambiar esas cosas de momento en la carta digital, todo lo
> demás vive en el producto y no se puede editar desde carta digital, **ya que
> no es tarea de marketing**."

## Qué se toca en cada sitio

**Logística → Productos (ficha del producto de venta) — la verdad:**
nombre real, precio, alérgenos, la estrella de destacado, y el interruptor
`visible_carta`.

`visible_carta` **solo** sirve para que el producto EXISTA en la carta digital y
se pueda gestionar desde Marketing. **No** decide si el cliente lo ve: eso es el
estado, y vive en la carta.

**Marketing → Carta digital — lo que ve el cliente:**
- **Nombre en la carta** — arranca copiando el del producto y se puede cambiar.
- **Texto** — debajo del nombre, nace vacío.
- **Estado**, tres y excluyentes: **Visible** / **Agotado** (gris + etiqueta,
  vuelve solo mañana) / **Invisible** (desaparece).
- Y lo que solo existe aquí: foto, orden, categoría, «me gusta» de arranque.

Un plato **sin producto detrás** (escrito a mano en la carta) sí lleva aquí su
precio y sus alérgenos, porque no los tiene de dónde heredar.

## Cómo se implementó

- `productos.carta_nombre` y `carta_texto` **se eliminaron** (migración
  `20260910100000`). Antes vivían en la ficha del producto y **pisaban** a los de
  la carta al pintarla: lo que se escribía en Marketing no se veía nunca. Los 61
  nombres y 151 textos se copiaron a `carta_items` antes de borrarlas.
- `sincronizarCartaDesdeProductos` ya **no pisa el nombre** de un item existente;
  solo refresca precio, alérgenos y categoría. Al CREAR un plato, el nombre
  arranca copiando el del producto.
- `carta-fetch` ya no aplica overrides de nombre/texto desde el producto. Sí
  sigue leyendo del producto lo que es suyo: `carta_destacado` (la estrella),
  `visible_carta` y `agotado_dia`.
- **Excepción consciente:** marcar "Agotado" desde Marketing SÍ escribe
  `productos.agotado_dia`. No es editar la ficha —es el estado del servicio de
  hoy, caduca solo— y tiene que llegar a la tecla del TPV y a la comanda del
  camarero, no solo a la carta. Ver [[carta_agotados_y_menu_del_dia]].
