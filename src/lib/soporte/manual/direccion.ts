import type { ArticuloManual } from "./tipos";

/** DIRECCIÓN: estructura, control y la propia ayuda del software. */
export const MANUAL_DIRECCION: ArticuloManual[] = [
  {
    ref: "sw:direccion-estructura",
    modulo: "DIRECCIÓN",
    titulo: "Organigrama",
    contenido: `En Dirección, Organigrama se ve cómo está montada la empresa: departamentos, puestos y de quién depende cada uno.`,
    ruta: "/direccion/estructura",
    rutaTitulo: "Organigrama",
  },
  {
    ref: "sw:direccion-cronogramas",
    modulo: "DIRECCIÓN",
    titulo: "Cronogramas de tareas",
    contenido: `En Dirección, Cronogramas se define qué tareas lleva cada puesto y cuándo se hacen.

Cada cronograma va con UN puesto real, uno a uno. El trabajador ve en su panel las tareas del puesto que tiene.

Desde aquí se ve también la productividad: qué se está haciendo y qué no.`,
    ruta: "/direccion/cronogramas",
    rutaTitulo: "Cronogramas",
  },
  {
    ref: "sw:direccion-aperturas",
    modulo: "DIRECCIÓN",
    titulo: "Aperturas",
    contenido: `En Dirección, Aperturas se lleva la puesta en marcha de un local nuevo: lo que hay que tener listo y cómo va.`,
    ruta: "/direccion/aperturas",
    rutaTitulo: "Aperturas",
  },
  {
    ref: "sw:direccion-auditorias",
    modulo: "DIRECCIÓN",
    titulo: "Auditorías de dirección",
    contenido: `En Dirección, Auditorías se revisa cómo funciona la empresa por dentro.

Incluye la auditoría de correo, que mide con quién habla cada buzón de la empresa y cuánto, sin leer el contenido.`,
    ruta: "/direccion/auditorias",
    rutaTitulo: "Auditorías",
  },
  {
    ref: "sw:direccion-presentaciones",
    modulo: "DIRECCIÓN",
    titulo: "Presentaciones",
    contenido: `En Dirección, Presentaciones se guardan las presentaciones de la empresa, incluida la de marca.`,
    ruta: "/direccion/presentaciones",
    rutaTitulo: "Presentaciones",
  },
  {
    ref: "sw:direccion-notificaciones",
    modulo: "DIRECCIÓN",
    titulo: "Notificaciones del sistema",
    contenido: `En Dirección, Notificaciones se controla qué avisos manda el software y a quién.

Algunos avisos no se pueden silenciar a propósito: los que obligan a hacer algo.`,
    ruta: "/direccion/notificaciones",
    rutaTitulo: "Notificaciones",
  },
  {
    ref: "sw:direccion-ayuda",
    modulo: "DIRECCIÓN",
    titulo: "Ayuda: cómo se mantiene sola",
    contenido: `En Dirección, Ayuda se gestiona todo lo que sabe el asistente y lo que ve la plantilla en Ayuda.

Hay tres cosas:

Preguntas frecuentes. No se escriben a mano. El software agrupa lo que la gente pregunta de verdad al asistente y, cuando algo se repite lo suficiente, redacta la pregunta y su respuesta usando SOLO el conocimiento que ya tiene. Se ordenan por cuántas veces se ha preguntado. Cada pregunta nace etiquetada con un módulo, así que la de nóminas no la ve un camarero.

Base del asistente. Los artículos que sabe el asistente. Aquí se escriben los que falten y se corrigen los que no estén finos.

Huecos. Lo que la gente pregunta y el software NO sabe contestar. Es la lista de trabajo: se escribe el artículo una vez y a partir de ahí el asistente ya lo sabe y la pregunta se publica sola.

Las preguntas frecuentes son de cada empresa: nacen de lo que pregunta su gente y no se cruzan entre empresas.`,
    ruta: "/direccion/ayuda",
    rutaTitulo: "Ayuda",
  },
];
