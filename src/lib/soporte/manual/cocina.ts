import type { ArticuloManual } from "./tipos";

/** COCINA: producción, escandallos, seguridad alimentaria. */
export const MANUAL_COCINA: ArticuloManual[] = [
  {
    ref: "sw:cocina-comandas",
    modulo: "COCINA",
    titulo: "Comandas",
    contenido: `En Cocina, Comandas se ve lo que está pedido y en marcha durante el servicio, con sus tiempos.`,
    ruta: "/cocina/comandas",
    rutaTitulo: "Comandas",
  },
  {
    ref: "sw:cocina-escandallos",
    modulo: "COCINA",
    titulo: "Escandallos: qué lleva y cuánto cuesta cada plato",
    contenido: `Un escandallo es el desglose de un plato: qué ingredientes lleva, en qué cantidad y cuánto cuesta hacerlo.

Cada ingrediente del escandallo tiene que ser un producto de compra real, con su precio. Si no hay producto de compra, no se puede escandallar.

Del escandallo salen dos cosas: el coste del plato y sus alérgenos, que se calculan solos a partir de los ingredientes.

Los precios de compra y los escandallos van por separado: cambiar un precio no reescribe el escandallo, actualiza su coste.

Cada escandallo tiene un número que no cambia nunca, aunque se le cambie el nombre.`,
    ruta: "/cocina/escandallos",
    rutaTitulo: "Escandallos",
  },
  {
    ref: "sw:cocina-alergenos",
    modulo: "COCINA",
    titulo: "Alérgenos",
    contenido: `Los alérgenos de un plato no se escriben a mano: se heredan de los ingredientes y de las elaboraciones que lleva.

Ojo con la freidora: si se fríe en el mismo aceite que algo con gluten, lo frito arrastra gluten. Eso se marca en la ELABORACIÓN (el frito), no en el producto crudo.

Si un plato sale sin alérgenos y debería tener alguno, casi siempre es que a un ingrediente de la base le falta la información.`,
    ruta: "/cocina/escandallos",
    rutaTitulo: "Escandallos",
  },
  {
    ref: "sw:cocina-elaboraciones",
    modulo: "COCINA",
    titulo: "Elaboraciones",
    contenido: `Una elaboración es algo que se hace en cocina y luego entra en otros platos: una salsa, un fondo, un frito.

Se escandalla igual que un plato, y su coste y sus alérgenos pasan a todo lo que la use.`,
    ruta: "/cocina/elaboraciones",
    rutaTitulo: "Elaboraciones",
  },
  {
    ref: "sw:cocina-partidas",
    modulo: "COCINA",
    titulo: "Partidas",
    contenido: `Las partidas son las zonas de trabajo de la cocina. Cada plato y cada elaboración pertenece a una.

Es la misma lista en todo el software: no hay una lista de partidas para cocina y otra para logística.`,
    ruta: "/cocina/partidas",
    rutaTitulo: "Partidas",
  },
  {
    ref: "sw:cocina-mermas",
    modulo: "COCINA",
    titulo: "Mermas",
    contenido: `En Cocina, Mermas se apunta lo que se tira o se estropea, con su motivo.

Es lo que explica la diferencia entre lo que se compró y lo que se vendió.`,
    ruta: "/cocina/mermas",
    rutaTitulo: "Mermas",
  },
  {
    ref: "sw:cocina-temperaturas",
    modulo: "COCINA",
    titulo: "Temperaturas y control sanitario",
    contenido: `En Cocina, Temperaturas se registran los controles de cámaras y neveras que exige el plan de higiene.

Cada registro queda con su hora y con quién lo hizo. Es lo que se enseña en una inspección.`,
    ruta: "/cocina/temperaturas",
    rutaTitulo: "Temperaturas",
  },
  {
    ref: "sw:cocina-nuevas-recetas",
    modulo: "COCINA",
    titulo: "Nuevas recetas",
    contenido: `En Cocina, Nuevas recetas se trabajan los platos que todavía no están en carta: se prueban, se escandallan y, cuando cuadran, pasan a producción.`,
    ruta: "/cocina/nuevas-recetas",
    rutaTitulo: "Nuevas recetas",
  },
];
