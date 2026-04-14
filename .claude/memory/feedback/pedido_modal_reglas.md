---
name: Reglas PedidoModal — búsqueda, IVA y validaciones
description: Reglas fijas del modal de pedidos: selector de productos, IVA desde ficha, resumen con IVA diferenciado y campos obligatorios
type: feedback
---

Estas reglas aplican siempre que se modifique `PedidoModal.tsx` o cualquier modal de pedidos/albaranes en logística.

## 1. Selector de producto — solo existentes (Combobox Popover)

Usar **`Popover` + `Command`** de shadcn (NO un `<input>` con dropdown `absolute`).

**Por qué:** Un dropdown `absolute` dentro de `<DialogContent className="overflow-y-auto">` queda recortado por el contenedor. El `Popover` de shadcn usa un portal que renderiza fuera del DOM del modal y nunca se recorta.

**Cómo aplicar:**
- `PopoverTrigger` es un `<button>` que muestra el nombre del producto o "Seleccionar producto..."
- `PopoverContent` contiene `Command > CommandInput + CommandList`
- `shouldFilter={false}` en `<Command>` — el filtrado lo hace un `useMemo` propio
- Al seleccionar un `CommandItem`, se cierra el Popover y se rellenan los campos de la línea
- Botón "Quitar producto" en la parte inferior del popover para limpiar la selección
- Borde verde + ícono `<Check>` cuando hay `productoId` válido

**Nunca** usar `<Input>` de texto libre para el nombre del producto en un pedido. No se puede inventar un producto.

---

## 2. IVA — viene de la ficha del producto, NO editable en la tabla

Al seleccionar un producto, leer `p.iva` y asignarlo al campo `impuesto` de la línea:

```ts
const iva = parseFloat(p.iva ?? "10") || 10;
onSelectProduct(p.nombre, p.unidad, precio, p.id, iva);
```

El campo `% Imp.` en la tabla **no es un `<Input>`**, es un badge de solo lectura:

```tsx
<span className="inline-flex h-8 w-14 items-center justify-center rounded-md bg-muted/50 text-xs font-medium text-muted-foreground border border-border">
  {l.impuesto}%
</span>
```

**Por qué:** El IVA lo determina la ficha de compra del producto. El usuario no puede modificarlo en el pedido.

---

## 3. Resumen con IVA diferenciado (panel inferior derecho)

El modal debe mostrar siempre un bloque resumen con:
- **Base imponible** (suma de totales de línea, sin IVA)
- **Descuentos globales** (si `dtoPct > 0` o `dtoEur > 0`)
- **IVA desglosado por tipo** — un renglón por cada tasa distinta que aparezca en las líneas (4%, 10%, 21%)
- **TOTAL** (base con dto + todas las cuotas IVA)

Calcular con `useMemo` sobre `form.lineas`, `form.dtoPct`, `form.dtoEur`. El total se acumula solo para líneas con `productoId` no vacío.

---

## 4. Proveedor obligatorio

El pedido **no se puede guardar** sin proveedor. Validar en `handleSave` antes que cualquier otra validación:

```ts
if (!form.proveedor) {
  setSaveError("Debes seleccionar un proveedor antes de guardar el pedido.");
  return;
}
```

El selector de proveedor muestra borde rojo mientras esté vacío (`border-destructive`) y etiqueta con asterisco rojo `*`.

---

## 5. Columna `notas` en tabla `pedidos` — NOT NULL

La columna `notas` tiene restricción `NOT NULL`. Siempre enviar string vacío como fallback:

```ts
notas: input.notas ?? "",
```

**Never:** `notas: input.notas ?? null` — rompe con constraint violation.

---

## 6. Backfill de productoId al editar pedidos existentes

Al cargar la lista de productos (`listProductos`), cruzar con las líneas del form para rellenar `productoId` en líneas que tengan nombre pero no id (datos migrados o anteriores):

```ts
listProductos().then((list) => {
  setProductosList(list);
  setForm((prev) => ({
    ...prev,
    lineas: prev.lineas.map((l) => {
      if (l.productoId) return l;
      const match = list.find((p) => p.nombre.toLowerCase() === l.producto.toLowerCase());
      return match ? { ...l, productoId: match.id } : l;
    }),
  }));
});
```

---

## 7. Solo productos del catálogo — validación en tres capas

**Por qué:** Se detectó que `createPedido` guardaba líneas con nombre libre sin verificar existencia. Prohibido en todos los niveles.

**Capa 1 — Modal (cliente):** `handleSave` filtra líneas sin `productoId` y muestra error antes de enviar.

**Capa 2 — Server action:** `createPedido` recibe `productoId` obligatorio por línea y hace un `SELECT id FROM productos WHERE id IN (...)` antes de insertar. Si algún ID no existe → `{ ok: false, error: "..." }`, nada se guarda.

**Capa 3 — Base de datos:** `lineas_pedido.producto_id` es FK a `productos(id) ON DELETE RESTRICT`. Migración `022_lineas_pedido_producto_id.sql`.

**Nunca** guardar una línea de pedido solo con `producto_nombre` sin el `producto_id` validado.

---

## 8. Detalle de pedido — cargar líneas desde BD al abrir

`listPedidos()` solo trae la cabecera del pedido (tabla `pedidos`), **no las líneas**. Al hacer click en una fila para ver el detalle, llamar `getPedido(id)` que hace el JOIN con `lineas_pedido`.

```ts
onClick={async () => {
  const res = await getPedido(p.id);
  setDetallePedido(res.ok && res.data ? mapDbToPedido(res.data) : p);
}}
```

Las columnas de `lineas_pedido` en BD son snake_case (`producto_nombre`, `precio_unitario`, `producto_id`). Usar `mapDbLinea()` para traducirlas a `LineaPedido` (`producto`, `precioUC`, `productoId`). Sin este mapeo las líneas aparecen vacías al abrir el detalle.
