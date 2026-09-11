import type { ArticuloManual } from "./tipos";

/** CONTABILIDAD: el dinero que entra y sale. */
export const MANUAL_CONTABILIDAD: ArticuloManual[] = [
  {
    ref: "sw:contabilidad-facturas",
    modulo: "CONTABILIDAD",
    titulo: "Facturas",
    contenido: `En Contabilidad, Facturas están las facturas recibidas y emitidas, con su base, su IVA y su total.

Una factura se puede subir como foto o PDF y el software lee sus datos. Siempre se revisa antes de darla por buena.

El IVA que se propone por defecto se puede configurar.`,
    ruta: "/contabilidad/facturas",
    rutaTitulo: "Facturas",
  },
  {
    ref: "sw:contabilidad-contactos",
    modulo: "CONTABILIDAD",
    titulo: "Contactos",
    contenido: `En Contabilidad, Contactos están las empresas y personas con las que hay movimiento de dinero: proveedores, clientes, organismos.`,
    ruta: "/contabilidad/contactos",
    rutaTitulo: "Contactos",
  },
  {
    ref: "sw:contabilidad-transacciones",
    modulo: "CONTABILIDAD",
    titulo: "Transacciones",
    contenido: `En Contabilidad, Transacciones están los movimientos de dinero: cobros y pagos, con su fecha, su importe y su etiqueta.`,
    ruta: "/contabilidad/transacciones",
    rutaTitulo: "Transacciones",
  },
  {
    ref: "sw:contabilidad-bancos",
    modulo: "CONTABILIDAD",
    titulo: "Bancos",
    contenido: `En Contabilidad, Bancos están las cuentas de la empresa y sus movimientos.

Los movimientos se pueden traer del banco automáticamente, sin teclearlos.`,
    ruta: "/contabilidad/bancos",
    rutaTitulo: "Bancos",
  },
  {
    ref: "sw:contabilidad-conciliacion",
    modulo: "CONTABILIDAD",
    titulo: "Conciliación",
    contenido: `Conciliar es emparejar cada movimiento del banco con su factura o su transacción.

Lo que queda sin emparejar es lo que hay que mirar: un cobro que no sabemos de qué es, o una factura que no se ha pagado.`,
    ruta: "/contabilidad/conciliacion",
    rutaTitulo: "Conciliación",
  },
  {
    ref: "sw:contabilidad-reglas",
    modulo: "CONTABILIDAD",
    titulo: "Reglas automáticas",
    contenido: `En Contabilidad, Reglas automáticas se le enseña al software a clasificar solo lo que se repite: un recibo que siempre es del mismo proveedor y de la misma etiqueta.

Así no hay que clasificar a mano todos los meses lo mismo.`,
    ruta: "/contabilidad/reglas",
    rutaTitulo: "Reglas automáticas",
  },
  {
    ref: "sw:contabilidad-etiquetas",
    modulo: "CONTABILIDAD",
    titulo: "Etiquetas",
    contenido: `Las etiquetas son la forma de agrupar el gasto y el ingreso por conceptos propios de la casa, para luego poder mirarlo por partidas.`,
    ruta: "/contabilidad/etiquetas",
    rutaTitulo: "Etiquetas",
  },
  {
    ref: "sw:contabilidad-impuestos",
    modulo: "CONTABILIDAD",
    titulo: "Impuestos",
    contenido: `En Contabilidad, Impuestos se lleva lo que hay que declarar y cuándo.`,
    ruta: "/contabilidad/impuestos",
    rutaTitulo: "Impuestos",
  },
  {
    ref: "sw:contabilidad-calendario",
    modulo: "CONTABILIDAD",
    titulo: "Calendario contable",
    contenido: `En Contabilidad, Calendario están las fechas que no se pueden pasar: presentaciones, pagos y cierres.`,
    ruta: "/contabilidad/calendario",
    rutaTitulo: "Calendario",
  },
  {
    ref: "sw:contabilidad-escenarios",
    modulo: "CONTABILIDAD",
    titulo: "Escenarios",
    contenido: `En Contabilidad, Escenarios se simula cómo quedarían las cuentas cambiando supuestos, para decidir con números delante.`,
    ruta: "/contabilidad/escenarios",
    rutaTitulo: "Escenarios",
  },
];
