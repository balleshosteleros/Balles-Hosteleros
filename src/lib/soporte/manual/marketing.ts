import type { ArticuloManual } from "./tipos";

/** MARKETING: traer gente y que vuelva. */
export const MANUAL_MARKETING: ArticuloManual[] = [
  {
    ref: "sw:marketing-campanas",
    modulo: "MARKETING",
    titulo: "Campañas",
    contenido: `En Marketing, Campañas se mandan las comunicaciones a los clientes: correo, SMS, WhatsApp y anuncios de Meta.

Se elige a quién va con filtros sobre la base de clientes (cuándo vino, cuántas veces, qué gastó, qué etiquetas tiene) y se programa a qué hora sale, en la hora de la empresa.

Antes de mandar nada se mira el permiso de publicidad de cada persona, canal por canal. Quien se ha dado de baja de un canal NO entra en una campaña de ese canal, nunca.

Una campaña se prepara y se revisa; ponerla en marcha es un paso aparte, a propósito.`,
    ruta: "/marketing/campanas",
    rutaTitulo: "Campañas",
  },
  {
    ref: "sw:marketing-permiso-publicidad",
    modulo: "MARKETING",
    titulo: "Permiso de publicidad de un cliente",
    contenido: `Cada cliente tiene un permiso por cada canal: correo, SMS y WhatsApp, por separado.

Hay tres situaciones y no se confunden: que haya dicho que sí, que haya dicho que no, y que todavía no se le haya preguntado. "No se le ha preguntado" no es lo mismo que "se ha dado de baja".

Quien se da de baja de un canal queda fuera de las campañas de ese canal para siempre, hasta que él mismo vuelva a decir que sí.`,
    ruta: "/sala/clientes",
    rutaTitulo: "Clientes",
  },
  {
    ref: "sw:marketing-automatizaciones",
    modulo: "MARKETING",
    titulo: "Automatizaciones",
    contenido: `En Marketing, Automatizaciones se montan las cosas que se mandan solas: un disparador (algo que pasa) y unos pasos (lo que se hace después).

El motor las revisa cada pocos minutos. Una automatización nueva nace en modo pruebas: hasta que no se activa de verdad no le llega nada a ningún cliente.`,
    ruta: "/marketing/automatizaciones",
    rutaTitulo: "Automatizaciones",
  },
  {
    ref: "sw:marketing-carta-digital",
    modulo: "MARKETING",
    titulo: "Carta digital",
    contenido: `En Marketing, Carta digital se monta la carta que ve el cliente con el móvil, con sus categorías, sus platos, sus fotos y sus alérgenos.

Se puede sincronizar desde los productos de venta para no escribir dos veces lo mismo.

Se llega a ella con un código QR.`,
    ruta: "/marketing/carta-digital",
    rutaTitulo: "Carta digital",
  },
  {
    ref: "sw:marketing-qr",
    modulo: "MARKETING",
    titulo: "Códigos QR",
    contenido: `En Marketing, Códigos QR se crean los QR que se ponen en mesas, carteles o flyers.

Cada QR lleva a donde tú decidas y se puede cambiar el destino sin reimprimir nada. Además se cuenta cuánta gente lo escanea, así se sabe qué cartel funciona.`,
    ruta: "/marketing/qr",
    rutaTitulo: "Códigos QR",
  },
  {
    ref: "sw:marketing-calendario",
    modulo: "MARKETING",
    titulo: "Calendario de marketing",
    contenido: `En Marketing, Calendario se planifica qué se publica y qué se manda cada mes.`,
    ruta: "/marketing/calendario",
    rutaTitulo: "Calendario",
  },
  {
    ref: "sw:marketing-contenido",
    modulo: "MARKETING",
    titulo: "Contenido",
    contenido: `En Marketing, Contenido se guardan las fotos, vídeos y textos que se usan en redes y campañas.`,
    ruta: "/marketing/contenido",
    rutaTitulo: "Contenido",
  },
  {
    ref: "sw:marketing-fidelizacion",
    modulo: "MARKETING",
    titulo: "Fidelización",
    contenido: `En Marketing, Fidelización se trabaja que el cliente vuelva: cupones, cumpleaños y detalles con los de siempre.`,
    ruta: "/marketing/fidelizacion",
    rutaTitulo: "Fidelización",
  },
  {
    ref: "sw:marketing-captacion",
    modulo: "MARKETING",
    titulo: "Captación",
    contenido: `En Marketing, Captación se trabaja traer clientes nuevos y se mide por dónde entran.`,
    ruta: "/marketing/captacion",
    rutaTitulo: "Captación",
  },
  {
    ref: "sw:marketing-pagina-web",
    modulo: "MARKETING",
    titulo: "Página web",
    contenido: `En Marketing, Página web se lleva la web del restaurante desde el propio software.`,
    ruta: "/marketing/pagina-web",
    rutaTitulo: "Página web",
  },
  {
    ref: "sw:marketing-app-clientes",
    modulo: "MARKETING",
    titulo: "App de clientes",
    contenido: `En Marketing, App clientes se lleva la aplicación que usan los clientes del restaurante.`,
    ruta: "/marketing/app-clientes",
    rutaTitulo: "App clientes",
  },
];
