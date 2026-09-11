import type { ArticuloManual } from "./tipos";

/**
 * GENERAL: lo que necesita cualquiera, sea cual sea su puesto.
 *
 * Este módulo se añade SIEMPRE a los módulos visibles de cualquier rol, así que
 * todo lo que hay aquí lo puede recuperar hasta el último recién llegado. Por
 * eso aquí NO va nada que dependa del departamento: ni sueldos, ni proveedores,
 * ni datos de clientes. Solo cómo moverse por el software y lo que cada
 * trabajador hace con lo suyo.
 */
export const MANUAL_GENERAL: ArticuloManual[] = [
  {
    ref: "sw:general-entrar",
    modulo: "GENERAL",
    titulo: "Cómo entrar en el software",
    contenido: `Se entra con el correo que la empresa te dio de alta y una contraseña que eliges tú la primera vez.

Cuando te dan de alta recibes un correo de invitación con un enlace. Ese enlace es el que te deja elegir tu contraseña: no te la manda nadie hecha. Si el enlace ha caducado, pide que te lo reenvíen.

También puedes entrar con el botón de Google si tu correo de acceso es una cuenta de Gmail.

Si trabajas en más de una empresa del grupo entras una sola vez: con el mismo correo y la misma contraseña ves todas, y cambias de una a otra desde el selector de arriba.

La sesión se cierra sola a las 8 horas. Es normal que te pida entrar otra vez al día siguiente.`,
  },
  {
    ref: "sw:general-cambiar-empresa",
    modulo: "GENERAL",
    titulo: "Cambiar de empresa",
    contenido: `Arriba del todo hay un selector con el nombre de la empresa en la que estás trabajando ahora mismo.

Todo lo que ves en pantalla es de esa empresa y solo de esa: empleados, horarios, facturas, reservas. Nada se mezcla entre empresas.

Al cambiar de empresa el software te deja en la misma pantalla si ahí también tienes acceso. Si en la nueva empresa no tienes ese departamento, te lleva a tus departamentos.

Si abres una ficha concreta (un empleado, una factura) y cambias de empresa, te saca a la lista: ese registro no existe en la otra empresa.`,
  },
  {
    ref: "sw:general-no-veo-menu",
    modulo: "GENERAL",
    titulo: "No veo un departamento o una pantalla en el menú",
    contenido: `Lo que ves en el menú no depende de quién seas, sino de dos cosas: el rol que te han asignado y los departamentos que tiene montados tu empresa.

Si te falta un departamento entero, es que tu rol no tiene permiso para verlo. Eso se cambia en Ajustes, y solo lo puede tocar quien tenga permiso de Ajustes.

Si el menú te sale prácticamente vacío, lo normal es que tu usuario se haya quedado sin rol asignado. Avisa a tu responsable: es cosa de un momento.

Un departamento que existe en una empresa puede no existir en otra. No es un fallo.`,
  },
  {
    ref: "sw:general-fichar",
    modulo: "GENERAL",
    titulo: "Cómo fichar la entrada y la salida",
    contenido: `Se ficha desde el propio software, con el botón de fichaje. Entras al empezar y sales al terminar.

Hay un margen de cortesía configurado por la empresa: si fichas unos minutos antes o después de tu hora, el fichaje se ajusta a la hora del turno. Ese margen lo decide la empresa, no tú.

Si tu turno es partido tienes que fichar cada tramo por separado: entrada y salida de la mañana, y entrada y salida de la tarde. No vale fichar una entrada por la mañana y una salida por la noche.

Los turnos de noche que terminan de madrugada cuentan como el día en que empezaron. Aunque salgas a las tres de la mañana, esas horas son del día anterior.

Si se te olvida fichar la salida, el software cierra el fichaje solo pasadas unas horas y queda marcado para que tu responsable lo revise. No lo dejes pasar: avísale.`,
    ruta: "/mi-panel/fichajes",
    rutaTitulo: "Mis fichajes",
  },
  {
    ref: "sw:general-mi-panel",
    modulo: "GENERAL",
    titulo: "Qué hay en Mis paneles",
    contenido: `Mis paneles es tu zona personal. Ahí está todo lo tuyo y nada de nadie más.

Encuentras tu perfil y tus datos, tu calendario, tu cronograma de tareas, tu horario, tus fichajes, tu formación, tus condiciones de trabajo, tus pagos y nóminas, los cuestionarios que te toca responder, tus solicitudes de vacaciones y ausencias, los comunicados de la empresa, el material que te han entregado, tus documentos y tu equipo.

Nadie más ve tu panel. Tu responsable ve los datos de su equipo desde el departamento correspondiente, pero esto de aquí es tuyo.`,
    ruta: "/mi-panel/datos-personales",
    rutaTitulo: "Mis paneles",
  },
  {
    ref: "sw:general-pedir-vacaciones",
    modulo: "GENERAL",
    titulo: "Pedir vacaciones, un día libre o un cambio de turno",
    contenido: `Las solicitudes se piden desde Mis paneles, en Solicitudes. Eliges el tipo, las fechas y lo mandas.

La solicitud le llega a quien tenga que aprobarla. Cuando la resuelven te avisa el software, tanto si te la aprueban como si te la deniegan. Si te la deniegan, siempre viene el motivo.

Mientras esté pendiente puedes pedir que se anule. Una vez aprobada, para cambiarla hay que solicitar la anulación.

En tu calendario ves lo que ya tienes concedido junto con tus turnos.`,
    ruta: "/mi-panel/ausencias",
    rutaTitulo: "Mis solicitudes",
  },
  {
    ref: "sw:general-mi-horario",
    modulo: "GENERAL",
    titulo: "Ver mi horario y mis turnos",
    contenido: `Tu horario está en Mis paneles, en Horario, y tus turnos concretos salen también en tu calendario.

El cuadrante va por colores según el departamento, para que se vea de un vistazo quién entra a qué.

Un día libre no es lo mismo que un día sin horario: el día libre está puesto a propósito y se ve como tal.

Si trabajas en dos empresas del grupo, cada una tiene su horario y sus turnos. Míralos cambiando de empresa arriba.`,
    ruta: "/mi-panel/horario",
    rutaTitulo: "Mi horario",
  },
  {
    ref: "sw:general-mis-nominas",
    modulo: "GENERAL",
    titulo: "Ver mis nóminas y mis pagos",
    contenido: `Tus nóminas están en Mis paneles, en Pagos. Ahí ves lo que se te ha abonado y puedes descargar el documento de cada mes.

Cada nómina aparece cuando la gestoría la sube y alguien de la empresa la valida. Hasta que no está validada no la ves.

Si trabajas en dos empresas del grupo, cada una lleva sus nóminas por separado: son contratos distintos y no se suman.

Si echas en falta un mes o algo no cuadra, díselo a tu responsable antes que a nadie.`,
    ruta: "/mi-panel/pagos",
    rutaTitulo: "Mis pagos",
  },
  {
    ref: "sw:general-firmar",
    modulo: "GENERAL",
    titulo: "Firmar un documento",
    contenido: `Cuando te toca firmar algo te llega un aviso en el software y un correo con el enlace.

Al abrirlo lees el documento y, para firmar, el software te manda un código al correo. Metes ese código y queda firmado. El código vale 15 minutos; si se te pasa, pide otro desde la misma pantalla.

La firma se coloca sola en el sitio que le toca del documento: no tienes que buscar dónde poner nada.

Una vez firmado, el documento queda guardado en tus documentos y ya no se puede modificar.`,
  },
  {
    ref: "sw:general-mis-documentos",
    modulo: "GENERAL",
    titulo: "Mis documentos y subir los que me piden",
    contenido: `En Mis paneles, en Documentos, tienes tu documentación: contrato, nóminas, lo que hayas firmado y lo que hayas entregado.

Cuando la empresa te pide un documento que falta (el DNI, el número de la Seguridad Social, un certificado bancario) te llega un enlace propio para subirlo. Ese enlace va directo a tu ficha: no tienes ni que entrar en el software.

Se puede subir una foto hecha con el móvil. Cada archivo admite hasta 50 MB.`,
    ruta: "/mi-panel/documentos",
    rutaTitulo: "Mis documentos",
  },
  {
    ref: "sw:general-avisos",
    modulo: "GENERAL",
    titulo: "Avisos y notificaciones",
    contenido: `La campana de arriba te avisa de lo que te afecta: solicitudes resueltas, documentos por firmar, comunicados nuevos, tareas de tu cronograma.

Algunos avisos no se pueden silenciar, a propósito: los que obligan a hacer algo.

Si tienes el software instalado en el móvil también te llegan como notificación del teléfono. Se instala desde el propio navegador, con la opción de añadir a la pantalla de inicio.`,
  },
  {
    ref: "sw:general-comunicados",
    modulo: "GENERAL",
    titulo: "Comunicados de la empresa",
    contenido: `Los comunicados son los avisos que la empresa manda a la plantilla: cambios de normas, cierres, novedades.

Los tienes en Mis paneles, en Comunicados. Algunos piden que confirmes que los has leído, y hasta que no lo confirmes te los va a seguir recordando.`,
    ruta: "/mi-panel/comunicados",
    rutaTitulo: "Mis comunicados",
  },
  {
    ref: "sw:general-entregas",
    modulo: "GENERAL",
    titulo: "El material y el uniforme que me han entregado",
    contenido: `En Mis paneles, en Entregas, ves lo que la empresa te ha dado: uniforme, llaves, herramientas, un teléfono.

Es un acta viva: siempre hay una sola, con todo lo que tienes ahora mismo, y el historial de lo que se ha entregado y devuelto.

Al entregarte algo firmas que lo has recibido. Al devolverlo firmas la devolución. Si algo no se devuelve, se anota como no devuelto.`,
    ruta: "/mi-panel/entregas",
    rutaTitulo: "Mis entregas",
  },
  {
    ref: "sw:general-formacion",
    modulo: "GENERAL",
    titulo: "La formación que me toca",
    contenido: `En Mis paneles, en Formación, tienes los cursos que te corresponden por tu puesto, con sus vídeos y sus lecciones.

La formación inicial es la que se hace al entrar. La puedes volver a ver cuantas veces quieras desde Ayuda.

Si tu puesto cambia, cambia también la formación que te aparece.`,
    ruta: "/mi-panel/formacion",
    rutaTitulo: "Mi formación",
  },
  {
    ref: "sw:general-cronograma",
    modulo: "GENERAL",
    titulo: "Mis tareas y mi cronograma",
    contenido: `El cronograma es la lista de tareas que lleva tu puesto: lo que hay que hacer al abrir, durante el servicio y al cerrar.

Lo tienes en Mis paneles, en Cronograma. Vas marcando lo que haces y queda registrado.

Las tareas no las eliges tú: van con el puesto. Cada puesto tiene su cronograma.`,
    ruta: "/mi-panel/cronograma",
    rutaTitulo: "Mi cronograma",
  },
  {
    ref: "sw:general-formatos",
    modulo: "GENERAL",
    titulo: "Cómo se escriben las fechas y los números",
    contenido: `Las fechas van siempre en día, mes y año: 05-09-2026 es 5 de septiembre.

Los decimales van con coma: 12,50 € son doce euros con cincuenta.

Las horas son las de la empresa en la que estás, no las de tu teléfono. Si la empresa está en Canarias, verás la hora de Canarias aunque tú estés en otro sitio.`,
  },
  {
    ref: "sw:general-ayuda",
    modulo: "GENERAL",
    titulo: "Dónde pedir ayuda si me atasco",
    contenido: `En Ayuda tienes las preguntas frecuentes y este mismo asistente.

El asistente solo sabe lo que hay escrito en el software, y solo te cuenta lo de tu puesto. Si te responde que no tiene esa información, es que todavía no está escrito: queda apuntado y alguien de dirección lo añade.

Si necesitas hablar con una persona, pídelo y se avisa a tu responsable.`,
    ruta: "/ayuda",
    rutaTitulo: "Ayuda",
  },
];
