import type { ArticuloManual } from "./tipos";

/** GERENCIA: el día a día del negocio — ventas, cierres, mantenimiento. */
export const MANUAL_GERENCIA: ArticuloManual[] = [
  {
    ref: "sw:gerencia-ventas",
    modulo: "GERENCIA",
    titulo: "Ventas",
    contenido: `En Gerencia, Ventas se ve lo que se ha vendido: por día, por servicio y por producto.

Los datos vienen del TPV del local, no se teclean.`,
    ruta: "/gerencia/ventas",
    rutaTitulo: "Ventas",
  },
  {
    ref: "sw:gerencia-cierres",
    modulo: "GERENCIA",
    titulo: "Cierres de caja",
    contenido: `En Gerencia, Cierres se cuadra la caja de cada día: lo que dice el TPV contra lo que hay de verdad.

El descuadre es la diferencia entre lo retirado y lo que tocaba. Se apunta tal cual, no se maquilla.

Al cierre se le adjuntan sus documentos justificativos.`,
    ruta: "/gerencia/cierres",
    rutaTitulo: "Cierres",
  },
  {
    ref: "sw:gerencia-mantenimiento",
    modulo: "GERENCIA",
    titulo: "Mantenimiento y averías",
    contenido: `En Gerencia, Mantenimiento se apuntan las averías y las revisiones de cada local, con quién lo apuntó y en qué estado está.

Sirve para no perder de vista lo que se avisó y nadie arregló.`,
    ruta: "/gerencia/mantenimiento",
    rutaTitulo: "Mantenimiento",
  },
  {
    ref: "sw:gerencia-vencimientos",
    modulo: "GERENCIA",
    titulo: "Vencimientos",
    contenido: `En Gerencia, Vencimientos se controla lo que caduca: contratos, seguros, licencias, revisiones obligatorias.

El software avisa antes de que venza, no el día después.`,
    ruta: "/gerencia/vencimientos",
    rutaTitulo: "Vencimientos",
  },
  {
    ref: "sw:gerencia-informes",
    modulo: "GERENCIA",
    titulo: "Informes",
    contenido: `En Gerencia, Informes se sacan los resúmenes del negocio a partir de los datos reales del software.`,
    ruta: "/gerencia/informes",
    rutaTitulo: "Informes",
  },
  {
    ref: "sw:gerencia-ratios",
    modulo: "GERENCIA",
    titulo: "Ratios",
    contenido: `En Gerencia, Ratios se miran las proporciones que dicen si el negocio va bien: coste de personal sobre ventas, coste de materia prima, ticket medio.`,
    ruta: "/gerencia/ratios",
    rutaTitulo: "Ratios",
  },
  {
    ref: "sw:gerencia-comunicados",
    modulo: "GERENCIA",
    titulo: "Mandar un comunicado a la plantilla",
    contenido: `En Gerencia, Comunicados se escribe lo que hay que decirle a la plantilla y se elige a quién le llega.

Se puede pedir que confirmen la lectura. A quien no lo haya leído se le sigue recordando.`,
    ruta: "/gerencia/comunicados",
    rutaTitulo: "Comunicados",
  },
];
