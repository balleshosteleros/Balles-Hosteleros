import type { ArticuloManual } from "./tipos";

/** SALA: lo que pasa de la puerta hacia dentro — reservas, clientes, venta. */
export const MANUAL_SALA: ArticuloManual[] = [
  {
    ref: "sw:sala-reservas",
    modulo: "SALA",
    titulo: "Reservas: cómo funcionan",
    contenido: `En Sala, Reservas está el libro de reservas del restaurante. Entran por el portal de reservas propio, por Google, por teléfono o las apunta alguien de sala a mano.

Cada reserva necesita sí o sí de dónde viene y un teléfono. Sin eso no se guarda: sin teléfono no se puede avisar a nadie de nada.

El día de una reserva es el DÍA DE NEGOCIO, no el del calendario: la madrugada pertenece a la noche anterior hasta las seis de la mañana. Una reserva de la una de la madrugada del domingo es del servicio del sábado.

Una reserva pasa por varios estados a lo largo del día (pendiente, confirmada, sentada, terminada, no presentada, cancelada). La lista abre sin enseñar las caídas, para que no estorben.

Si alguien llega sin reservar se apunta como walk-in: entra directamente como sentada y con la hora de ese momento.

Las mesas se pueden unir para grupos, y hay un cupo por franja para no aceptar más gente de la que cabe.`,
    ruta: "/sala/reservas",
    rutaTitulo: "Reservas",
  },
  {
    ref: "sw:sala-reservas-confirmar",
    modulo: "SALA",
    titulo: "Confirmar, reconfirmar y cancelar una reserva",
    contenido: `Al crear una reserva desde dentro puedes elegir entre confirmarla directamente o notificar al cliente para que la confirme él.

La reconfirmación se pide el mismo día de la reserva, no antes. El cliente recibe el aviso y responde; si no responde, la reserva se queda como está y hay que llamar.

El cliente puede cancelar él mismo desde el enlace que se le manda, dentro del horario permitido.

Todo lo que se le manda al cliente (confirmación, recordatorio, cancelación) sale por correo desde la propia empresa.`,
    ruta: "/sala/reservas",
    rutaTitulo: "Reservas",
  },
  {
    ref: "sw:sala-clientes",
    modulo: "SALA",
    titulo: "Clientes: la ficha de quien viene a comer",
    contenido: `En Sala, Clientes está la gente que ha pasado por el restaurante, con sus visitas, sus valoraciones y sus etiquetas.

Las visitas salen de las reservas más las visitas sueltas que se apuntan sin reserva.

Un cliente puede no tener nombre: hay reservas que llegan solo con un teléfono, y eso es válido. Lo que no vale es un contacto inventado.

Si dos fichas son la misma persona se unen, pero cuando los datos no coinciden del todo el software pide revisarlo antes de juntarlas.

Las etiquetas de la reserva y las del cliente son cosas distintas: una es de esa noche concreta, la otra es de la persona siempre.`,
    ruta: "/sala/clientes",
    rutaTitulo: "Clientes",
  },
  {
    ref: "sw:sala-pos",
    modulo: "SALA",
    titulo: "Punto de venta",
    contenido: `En Sala, Punto de venta se ven las ventas del local.

Las ventas del TPV entran en el software y son las que mueven el stock: lo que se vende descuenta de lo que hay.`,
    ruta: "/sala/pos",
    rutaTitulo: "Punto de venta",
  },
  {
    ref: "sw:sala-tarifas",
    modulo: "SALA",
    titulo: "Tarifas",
    contenido: `En Sala, Tarifas se fijan los precios de venta que se aplican en el local.`,
    ruta: "/sala/tarifas",
    rutaTitulo: "Tarifas",
  },
  {
    ref: "sw:sala-descuentos",
    modulo: "SALA",
    titulo: "Descuentos",
    contenido: `En Sala, Descuentos se definen los descuentos que se pueden aplicar y quién puede aplicarlos.`,
    ruta: "/sala/descuentos",
    rutaTitulo: "Descuentos",
  },
  {
    ref: "sw:sala-cupones",
    modulo: "SALA",
    titulo: "Cupones",
    contenido: `En Sala, Cupones se crean los cupones que se le dan al cliente: de cumpleaños, de campaña o sueltos.

Un cupón puede ser de un solo uso y para una persona concreta. Al canjearlo queda gastado.`,
    ruta: "/sala/cupones",
    rutaTitulo: "Cupones",
  },
  {
    ref: "sw:sala-musica",
    modulo: "SALA",
    titulo: "Música",
    contenido: `En Sala, Música se lleva la música del local.`,
    ruta: "/sala/musica",
    rutaTitulo: "Música",
  },
];
