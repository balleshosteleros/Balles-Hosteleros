import type { ArticuloManual } from "./tipos";

/** LOGÍSTICA: proveedores, compras, stock. */
export const MANUAL_LOGISTICA: ArticuloManual[] = [
  {
    ref: "sw:logistica-proveedores",
    modulo: "LOGÍSTICA",
    titulo: "Proveedores",
    contenido: `En Logística, Proveedores está la lista de a quién se le compra, con sus datos de contacto, sus condiciones y sus productos.

Una marca no es un proveedor: la marca es de quién es el producto, el proveedor es quien te lo trae. El mismo proveedor puede traerte varias marcas.`,
    ruta: "/logistica/proveedores",
    rutaTitulo: "Proveedores",
  },
  {
    ref: "sw:logistica-productos",
    modulo: "LOGÍSTICA",
    titulo: "Productos de compra y de venta",
    contenido: `Los productos de COMPRA son lo que se le compra al proveedor. Los de VENTA son lo que se le vende al cliente. Son dos cosas separadas a propósito.

Un producto de compra tiene su proveedor, su formato, su precio y sus alérgenos. Es lo que se usa como ingrediente en los escandallos.

Sin producto de compra no se puede escandallar nada.`,
    ruta: "/logistica/productos",
    rutaTitulo: "Productos",
  },
  {
    ref: "sw:logistica-precios",
    modulo: "LOGÍSTICA",
    titulo: "Precios de compra y subidas de proveedor",
    contenido: `Cada producto de compra guarda su precio y su histórico, así que se ve cuándo subió y cuánto.

Si un proveedor sube un precio, se actualiza en su producto. El escandallo no se reescribe: recalcula el coste del plato con el precio nuevo, y ahí se ve si el plato deja de salir a cuenta.`,
    ruta: "/logistica/productos",
    rutaTitulo: "Productos",
  },
  {
    ref: "sw:logistica-pedidos",
    modulo: "LOGÍSTICA",
    titulo: "Pedidos y albaranes",
    contenido: `En Logística, Pedidos se hacen los pedidos a proveedor y se reciben los albaranes.

Un albarán se puede subir como foto o PDF y el software lee sus líneas. Si alguna línea no la reconoce, la deja marcada para que alguien la asocie a mano.

Si lo que llega no es lo que se pidió (falta género, viene roto, el precio no es el pactado), se abre una incidencia sobre ese albarán.

Los documentos de logística, una vez cerrados, no se modifican: se corrigen con otro documento.`,
    ruta: "/logistica/pedidos",
    rutaTitulo: "Pedidos",
  },
  {
    ref: "sw:logistica-stock",
    modulo: "LOGÍSTICA",
    titulo: "Stock",
    contenido: `En Logística, Stock se ve lo que hay de cada producto.

El stock se mueve solo: entra con los albaranes y sale con las ventas y las mermas. Cada movimiento queda registrado, con lo que había antes y después.`,
    ruta: "/logistica/stock",
    rutaTitulo: "Stock",
  },
  {
    ref: "sw:logistica-inventarios",
    modulo: "LOGÍSTICA",
    titulo: "Inventarios",
    contenido: `En Logística, Inventarios se cuenta lo que hay de verdad y se compara con lo que dice el software.

La diferencia entre lo contado y lo teórico es lo que se ha perdido, roto o no se ha apuntado. Al cerrar el inventario, el stock pasa a ser el contado.`,
    ruta: "/logistica/inventarios",
    rutaTitulo: "Inventarios",
  },
  {
    ref: "sw:logistica-acuerdos",
    modulo: "LOGÍSTICA",
    titulo: "Acuerdos con marcas y proveedores",
    contenido: `En Logística, Acuerdos se guardan los acuerdos comerciales: rappels, aportaciones, exclusividades.

Se distingue entre el acuerdo con la MARCA y el acuerdo con el PROVEEDOR: no son lo mismo y pueden convivir.`,
    ruta: "/logistica/acuerdos",
    rutaTitulo: "Acuerdos",
  },
  {
    ref: "sw:logistica-importar-catalogo",
    modulo: "LOGÍSTICA",
    titulo: "Importar el catálogo de un proveedor",
    contenido: `En Logística, Importar catálogo se sube la lista de productos de un proveedor de una vez, en vez de meterlos uno a uno.

El software lee el archivo y propone los productos. Se revisan antes de darlos por buenos.`,
    ruta: "/logistica/importar-catalogo",
    rutaTitulo: "Importar catálogo",
  },
];
