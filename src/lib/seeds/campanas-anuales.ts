/**
 * Seed canónico del CALENDARIO ANUAL DE CAMPAÑAS DE EMAIL.
 *
 * Doce correos, uno por mes, cada uno colgado de un pico real de la hostelería
 * en Madrid. Uno al mes y solo uno: con nueve mil direcciones, el segundo correo
 * de un mes no vende más, solo gasta reputación de envío y provoca bajas.
 *
 * ── Por qué cada mes está escrito de cero ──────────────────────────────────
 * La tentación es una plantilla única con el nombre del mes cambiado. No sirve:
 * el cliente que recibe doce correos al año reconoce la plantilla al tercero y
 * deja de abrirla. Aquí cada mes tiene su propio titular, su propia entradilla y
 * su propio cuerpo. Lo único que se repite —a propósito— es la mecánica: el
 * concurso del día sorpresa y el botón de reservar.
 *
 * ── El gancho: concurso del día sorpresa ───────────────────────────────────
 * Un día al azar del mes sale el correo. Los tres primeros que acierten las
 * cinco preguntas se llevan cena para dos. La gracia es que nadie sabe qué día
 * llega, así que el correo se abre en cuanto entra. Las preguntas se responden
 * mirando la carta y la web —no hace falta ser cliente veterano— y de paso llevan
 * tráfico a la carta digital.
 *
 * ── La foto ────────────────────────────────────────────────────────────────
 * No se guarda una URL fija: cada mes trae `fotoPistas`, y al propagar el seed a
 * una empresa se busca en SU carta digital el plato que mejor encaje. Así el
 * correo de Semana Santa de un local sale con sus torrijas y el de otro con lo
 * que ese otro tenga, sin fotos prestadas ni huecos rotos.
 */

export interface CampanaAnualSeed {
  /** Identificador estable del mes. No cambiar: se usa para no duplicar filas. */
  clave: string;
  /** 1 = enero … 12 = diciembre. */
  mes: number;
  /** Nombre interno de la campaña, el que se ve en el listado de Marketing. */
  nombre: string;
  /** Gancho del asunto. Máximo 50 caracteres: lo que cabe en un móvil. */
  asunto: string;
  /** Línea de vista previa que Gmail enseña junto al asunto. */
  preheader: string;
  /** Etiqueta pequeña sobre el titular. */
  badge: string;
  /** Titular grande. Distinto en los doce. */
  titular: string;
  /** Frase bajo el titular. */
  subtitulo: string;
  /** Gancho de entrada: la primera frase que se lee del cuerpo. */
  entradilla: string;
  /** Desarrollo. Dos párrafos cortos como mucho: esto se lee de pie. */
  cuerpo: string[];
  /** Texto del botón. */
  ctaTexto: string;
  /** Palabras con las que se busca la foto en la carta de cada empresa. */
  fotoPistas: string[];
}

export const CAMPANAS_ANUALES_SEED: CampanaAnualSeed[] = [
  {
    clave: "ENERO_REACTIVACION",
    mes: 1,
    nombre: "Enero · La cuesta se baja mejor sentado",
    asunto: "Empieza el año y ya hay tres cenas en juego",
    preheader: "Enero es largo. La mesa está puesta y el sorteo, abierto.",
    badge: "Enero",
    titular: "Estrenamos año con tres cenas de regalo",
    subtitulo: "La cuesta de enero se baja mejor sentado",
    entradilla:
      "Enero tiene fama de mes en el que no se hace nada, así que lo abrimos como toca: con el sorteo del mes en marcha y tres cenas para dos sobre la mesa.",
    cuerpo: [
      "Después de las fiestas apetece justo lo contrario de las fiestas: mesa tranquila, sin cuñados, sin brindis obligatorios y sin sobremesa de cuatro horas. Eso lo tenemos.",
      "Reserva cuando quieras: entre semana hay sitio de sobra y se cena mucho mejor.",
    ],
    ctaTexto: "Reservar mesa",
    fotoPistas: ["croqueta", "guiso", "risotto", "costilla", "curry"],
  },
  {
    clave: "FEBRERO_SAN_VALENTIN",
    mes: 2,
    nombre: "Febrero · San Valentín",
    asunto: "Ha llegado San Valentín: hay cena de regalo",
    preheader: "El mejor día del año para que te toque. Y el 14 se llena.",
    badge: "San Valentín",
    titular: "San Valentín con cena invitada",
    subtitulo: "14 de febrero",
    entradilla:
      "Qué mejor día del año para que te toque una cena gratis que este. Ha llegado San Valentín y el sorteo del mes cae justo hoy: tres cenas para dos, para los tres primeros que acierten.",
    cuerpo: [
      "Y si no hay suerte, la mesa te la guardamos igual. Todos los años pasa lo mismo: el día 12 ya no queda sitio a las nueve y hay que cenar a las once o no cenar.",
      "Este año te lo decimos con tiempo. Elige tú la hora y el rincón, en vez de coger lo último que quede.",
    ],
    ctaTexto: "Coger mesa para el 14",
    fotoPistas: ["coulant", "chocolate", "postre", "tarta", "cóctel"],
  },
  {
    clave: "MARZO_DIA_DEL_PADRE",
    mes: 3,
    nombre: "Marzo · Día del Padre",
    asunto: "Día del Padre: invita la casa a tres de vosotros",
    preheader: "Otra corbata no, por favor. El 19 se come en familia.",
    badge: "19 de marzo",
    titular: "Este Día del Padre puede salir gratis",
    subtitulo: "Regálale una comida, no un objeto",
    entradilla:
      "Tiene calcetines, tiene corbatas y tiene una taza con una frase graciosa. Lo que no tiene es una comida con toda la familia sentada a la misma mesa, y este mes tres de vosotros os la lleváis de regalo.",
    cuerpo: [
      "El 19 es festivo en Madrid, así que da tiempo a comer sin prisa y a alargar la sobremesa hasta que alguien pida la cuenta.",
      "Venís los que seáis: decidnos cuántos y os colocamos.",
    ],
    ctaTexto: "Reservar para el 19",
    fotoPistas: ["entrecot", "entraña", "tomahawk", "arroz", "jamón"],
  },
  {
    clave: "ABRIL_SEMANA_SANTA",
    mes: 4,
    nombre: "Abril · Semana Santa y terraza",
    asunto: "Semana Santa: terraza abierta y cena en juego",
    preheader: "Madrid en Semana Santa, sin colas y sin maleta.",
    badge: "Semana Santa",
    titular: "Estrenamos terraza y sorteamos la primera cena",
    subtitulo: "Los que se quedan comen mejor",
    entradilla:
      "Media ciudad se va y la otra media descubre que Madrid en Semana Santa está tranquilo, hace bueno y se aparca. Para celebrarlo, este mes hay tres cenas en la terraza a cuenta de la casa.",
    cuerpo: [
      "Ya hemos sacado las mesas de fuera. Primeros días de sol, primera caña en la calle y esa sensación de que empieza lo bueno del año.",
      "Si te quedas, ven a comer. Si te vas, guárdanos el sitio para la vuelta.",
    ],
    ctaTexto: "Reservar en la terraza",
    fotoPistas: ["torrija", "ensaladilla", "alcachofa", "burrata", "tortilla"],
  },
  {
    clave: "MAYO_MADRE_Y_SAN_ISIDRO",
    mes: 5,
    nombre: "Mayo · Día de la Madre y San Isidro",
    asunto: "Día de la Madre: la comida puede correr de casa",
    preheader: "Comuniones y San Isidro también. Y el sorteo, en marcha.",
    badge: "Mayo",
    titular: "Mayo trae tres motivos y tres cenas de regalo",
    subtitulo: "Día de la Madre · Comuniones · San Isidro",
    entradilla:
      "Mayo es el mes con más comidas de compromiso del año, así que este mes el sorteo viene redondo: tres cenas para dos y una de ellas puede acabar siendo la de tu madre.",
    cuerpo: [
      "Da igual si es la comida de la madre, la de la comunión del sobrino o la de San Isidro con los de siempre: si sois muchos, avísanos con margen y os montamos la mesa como toca.",
      "Cuantos más seáis, antes conviene reservar: todo cae en los mismos cuatro fines de semana.",
    ],
    ctaTexto: "Reservar mesa grande",
    fotoPistas: ["arroz", "paella", "cachopo", "vieira", "tarta"],
  },
  {
    clave: "JUNIO_SAN_JUAN_FIN_DE_CURSO",
    mes: 6,
    nombre: "Junio · San Juan y fin de curso",
    asunto: "Llega San Juan y la primera cena la pagamos nosotros",
    preheader: "Fin de curso, noches largas y tres cenas sorteadas.",
    badge: "San Juan · Fin de curso",
    titular: "El curso se acaba con cena invitada",
    subtitulo: "Junio es cuando Madrid cena en la calle",
    entradilla:
      "Anochece a las diez, ya no hace falta chaqueta y de repente todo el mundo tiene una cena pendiente con alguien. Empezamos el mes sorteando tres, por si la tuya sale gratis.",
    cuerpo: [
      "Cenas de fin de curso, de equipo, de los del gimnasio o de esos amigos a los que llevas desde enero diciendo «tenemos que vernos». Junio es el mes de saldar esas cuentas.",
      "Dinos día y cuántos sois. De lo demás nos ocupamos.",
    ],
    ctaTexto: "Reservar cena de grupo",
    fotoPistas: ["mojito", "cóctel", "daiquiri", "ceviche", "torrezno"],
  },
  {
    clave: "JULIO_VERANO",
    mes: 7,
    nombre: "Julio · Cenas de verano",
    asunto: "Julio en la terraza, y tres cenas de verano gratis",
    preheader: "A las diez todavía se está bien fuera.",
    badge: "Julio",
    titular: "Empieza el verano con cena de regalo",
    subtitulo: "Cenar tarde es lo único bueno del calor",
    entradilla:
      "En julio nadie cena a las nueve: se espera a que baje el sol y se sale a las diez y media. Antes de que te vayas de vacaciones, aquí van tres cenas de verano a cuenta de la casa.",
    cuerpo: [
      "Tenemos la terraza puesta y la carta de verano lista: cosas frescas, para picar, y algo bien frío para acompañar.",
      "Antes de irte una cena, y otra a la vuelta.",
    ],
    ctaTexto: "Reservar para cenar",
    fotoPistas: ["ceviche", "tartar", "cóctel", "mojito", "ensalada"],
  },
  {
    clave: "AGOSTO_MADRID_VACIO",
    mes: 8,
    nombre: "Agosto · Los que se quedan en Madrid",
    asunto: "Agosto en Madrid: abiertos y con cena en juego",
    preheader: "Verbenas de La Paloma y San Cayetano. Y sitio de sobra.",
    badge: "Agosto",
    titular: "A los que os quedáis, cena de regalo",
    subtitulo: "Verbenas de La Paloma y San Cayetano",
    entradilla:
      "Agosto en Madrid tiene algo: se aparca a la puerta, no hay cola en ningún sitio y la ciudad parece de quien se queda. Y este mes, tres de los que os quedáis cenáis gratis.",
    cuerpo: [
      "Nosotros seguimos aquí, con las verbenas a la vuelta de la esquina y la terraza a pleno rendimiento.",
      "Si este año te toca quedarte, que al menos se cene bien.",
    ],
    ctaTexto: "Ver disponibilidad",
    fotoPistas: ["torrezno", "alita", "gyoza", "bao", "batido"],
  },
  {
    clave: "SEPTIEMBRE_VUELTA",
    mes: 9,
    nombre: "Septiembre · Vuelta a la rutina",
    asunto: "Carta nueva de otoño y tres cenas para estrenarla",
    preheader: "Ya has vuelto. Nosotros también, y con sorteo.",
    badge: "Septiembre",
    titular: "Estrenamos carta, y tres de vosotros la estrenáis gratis",
    subtitulo: "Se acabó agosto, empieza lo bueno",
    entradilla:
      "Septiembre es enero pero con mejor tiempo: todo el mundo vuelve con propósitos, agenda nueva y ganas de contarse el verano. Hemos cambiado la carta y sorteamos tres cenas para estrenarla.",
    cuerpo: [
      "Han entrado platos de temporada y se han quedado los que no nos dejáis quitar.",
      "Reúne a los de siempre y venid a probarla.",
    ],
    ctaTexto: "Ver la carta nueva",
    fotoPistas: ["setas", "risotto", "guiso", "brioche", "arroz"],
  },
  {
    clave: "OCTUBRE_HALLOWEEN",
    mes: 10,
    nombre: "Octubre · Halloween",
    asunto: "Llega Halloween: el truco es que la cena sale gratis",
    preheader: "Noche del 31, y tres cenas para dos en juego.",
    badge: "31 de octubre",
    titular: "Halloween con truco: tres cenas invitadas",
    subtitulo: "La noche más larga de octubre",
    entradilla:
      "Puedes quedarte en casa repartiendo caramelos o puedes salir a cenar y dejar que la puerta la abra otro. Este mes, además, tres cenas de Halloween corren de nuestra cuenta.",
    cuerpo: [
      "El 31 montamos la noche a nuestra manera: cena, ambiente y una copa después sin tener que cambiar de sitio.",
      "Es la última noche del año que se sale sin excusa. Aprovéchala.",
    ],
    ctaTexto: "Reservar para el 31",
    fotoPistas: ["cóctel", "lado oscuro", "danza", "hamburguesa", "costilla"],
  },
  {
    clave: "NOVIEMBRE_CENAS_EMPRESA",
    mes: 11,
    nombre: "Noviembre · Cenas de empresa",
    asunto: "Cenas de empresa (y una cena gratis para ti)",
    preheader: "Las fechas buenas de diciembre se cierran este mes.",
    badge: "Cenas de empresa",
    titular: "Cierra la de la oficina y llévate la tuya",
    subtitulo: "En diciembre ya no quedará hueco",
    entradilla:
      "Todos los años hay alguien en la oficina al que le cae el marrón de buscar sitio. Si este año eres tú, esto te lo resuelve, y encima el sorteo del mes reparte tres cenas para dos.",
    cuerpo: [
      "Las fechas buenas de diciembre —los jueves y viernes— se cierran ahora, en noviembre. En cuanto entra diciembre solo quedan lunes y comidas a las cuatro.",
      "Dinos cuántos sois y qué semana os viene bien y te pasamos propuesta de menú para el grupo.",
    ],
    ctaTexto: "Pedir fecha para el grupo",
    fotoPistas: ["jamón", "arroz", "entraña", "tomahawk", "croqueta"],
  },
  {
    clave: "DICIEMBRE_NAVIDAD",
    mes: 12,
    nombre: "Diciembre · Navidad y Nochevieja",
    asunto: "Ya es Navidad: brindis, mesa y cena de regalo",
    preheader: "Cinco comidas en un mes. Una puede salir gratis.",
    badge: "Navidad · Nochevieja",
    titular: "Esta Navidad invitamos a tres mesas",
    subtitulo: "Nochebuena · Navidad · Nochevieja",
    entradilla:
      "La de la oficina, la de los amigos del colegio, la de la familia y la del día 31: diciembre no es una comida, son cinco. Y este mes tres de ellas las paga la casa.",
    cuerpo: [
      "Nos encargamos de todas las que quieras: menús para grupo, mesas largas y cocina abierta hasta tarde los días señalados.",
      "Coge sitio antes de que empiecen a llamarte para preguntarte dónde.",
    ],
    ctaTexto: "Reservar en diciembre",
    fotoPistas: ["vieira", "jamón", "tomahawk", "tarta", "cóctel"],
  },
];

/** Busca el mes en el calendario. `null` si el mes no está (no debería pasar). */
export function campanaDelMes(mes: number): CampanaAnualSeed | null {
  return CAMPANAS_ANUALES_SEED.find((c) => c.mes === mes) ?? null;
}
