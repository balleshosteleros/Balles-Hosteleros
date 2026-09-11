import type { ArticuloManual } from "./tipos";

/** RECURSOS HUMANOS: personas, contratos, horarios, fichajes y pagos. */
export const MANUAL_RRHH: ArticuloManual[] = [
  {
    ref: "sw:rrhh-empleados",
    modulo: "RECURSOS HUMANOS",
    titulo: "Empleados: la ficha de cada trabajador",
    contenido: `En Recursos humanos, Empleados está la plantilla de la empresa activa, con la ficha de cada uno: datos personales, documentación, puesto, horario, condiciones, fichajes y entregas.

Un empleado y un usuario no son lo mismo. El empleado es la persona con su contrato; el usuario es el acceso al software. Puede haber un usuario sin ficha de empleado (un gestor externo, por ejemplo).

El puesto tampoco es el rol. El puesto es lo que hace (camarero, jefe de cocina); el rol es lo que ve en el software. Una persona puede tener varios puestos.

Si alguien trabaja en dos empresas del grupo tiene una ficha en cada una, y los datos personales se reflejan en las dos: cambias el teléfono en una y queda cambiado en la otra.

Los empleados no se borran. Cuando alguien se va se marca como inactivo y deja de tener acceso, pero su historial se conserva.`,
    ruta: "/rrhh/empleados",
    rutaTitulo: "Empleados",
  },
  {
    ref: "sw:rrhh-alta-empleado",
    modulo: "RECURSOS HUMANOS",
    titulo: "Dar de alta a alguien nuevo",
    contenido: `Las altas entran por el portal de empleo y el proceso de reclutamiento, no creando una ficha a mano. Así queda de dónde vino cada persona.

El candidato pasa por las fases del reclutamiento y, al contratarlo, el software crea su ficha de empleado, le pasa su documentación y le manda la invitación para que elija su contraseña.

Al contratar hereda el horario y las condiciones del puesto, que funcionan como plantilla. A partir de ahí sus condiciones son suyas: cambiar el puesto luego no le cambia el sueldo.

Si la persona ya estaba activa en la empresa, contratarla de nuevo no machaca sus datos.`,
    ruta: "/rrhh/reclutamiento",
    rutaTitulo: "Reclutamiento",
  },
  {
    ref: "sw:rrhh-fichajes",
    modulo: "RECURSOS HUMANOS",
    titulo: "Fichajes: revisar y corregir",
    contenido: `En Recursos humanos, Fichajes se ve lo que ha fichado la plantilla, con su línea de tiempo por día y por persona.

Una salida nunca puede ir antes de la entrada. Si aparece algo así, es que hay un fichaje mal cerrado que hay que corregir.

Los fichajes sin salida se cierran solos pasadas unas horas y quedan marcados como pendientes de revisar. Conviene mirarlos a menudo: de ahí salen las horas que luego se pagan.

La medianoche no corta el turno: un turno de noche cuenta entero en el día en que empezó.

El margen de cortesía y los tipos de fichaje se configuran por empresa, y toda empresa tiene que tenerlo configurado.`,
    ruta: "/rrhh/fichajes",
    rutaTitulo: "Fichajes",
  },
  {
    ref: "sw:rrhh-horarios",
    modulo: "RECURSOS HUMANOS",
    titulo: "Horarios y cuadrantes",
    contenido: `En Recursos humanos, Horarios se montan los cuadrantes. Cada puesto tiene un patrón de horario y los turnos se pintan por color de departamento.

Los patrones rotativos van por semanas: el software sabe qué semana toca en cada momento.

Un horario tiene vigencia: cuando alguien causa baja, su horario se recorta hasta su último día y deja de contar.

La jornada, las horas y los días libres SALEN DEL HORARIO. No se escriben aparte: lo que marca el cuadrante es lo que se comunica.

Los festivos son los de la comunidad autónoma de cada empresa.`,
    ruta: "/rrhh/horarios",
    rutaTitulo: "Horarios",
  },
  {
    ref: "sw:rrhh-solicitudes",
    modulo: "RECURSOS HUMANOS",
    titulo: "Solicitudes de vacaciones y ausencias",
    contenido: `En Recursos humanos, Solicitudes llegan las peticiones de la plantilla: vacaciones, días libres, cambios de turno, ausencias.

Quien las aprueba es el validador configurado para esa persona. Se pueden tener validadores distintos para trabajo y para ausencias.

Aprobar o denegar avisa siempre al trabajador. Para denegar hay que poner un motivo, y el motivo se le enseña.

Una solicitud ya aprobada se deshace pidiendo la anulación, no borrándola.`,
    ruta: "/rrhh/solicitudes",
    rutaTitulo: "Solicitudes",
  },
  {
    ref: "sw:rrhh-calendarios",
    modulo: "RECURSOS HUMANOS",
    titulo: "Calendarios y vacaciones del equipo",
    contenido: `En Recursos humanos, Calendarios se ve de un vistazo quién está y quién no: vacaciones concedidas, ausencias y festivos.

Sirve para no dejar un servicio sin gente antes de aprobar unas vacaciones.`,
    ruta: "/rrhh/calendarios",
    rutaTitulo: "Calendarios",
  },
  {
    ref: "sw:rrhh-puestos",
    modulo: "RECURSOS HUMANOS",
    titulo: "Puestos: la plantilla de cada trabajo",
    contenido: `En Recursos humanos, Puestos se define cada trabajo de la empresa: nombre, departamento, condiciones, horario, cronograma y formación.

El puesto es una PLANTILLA. Cuando se contrata a alguien, sus condiciones se copian del puesto a su ficha y a partir de ahí son suyas. El sueldo de una persona sale siempre de sus condiciones, nunca del puesto.

El nombre del puesto va siempre en singular: "Camarero", no "Camareros". Si hacen falta tres camareros, eso son tres plazas del mismo puesto, no tres puestos distintos.

El salario que se define en el puesto es BRUTO.

Un puesto sin los datos completos no se puede usar para contratar: el software lo bloquea a propósito, porque esos datos son los que van a la gestoría.`,
    ruta: "/rrhh/puestos",
    rutaTitulo: "Puestos",
  },
  {
    ref: "sw:rrhh-reclutamiento",
    modulo: "RECURSOS HUMANOS",
    titulo: "Reclutamiento: de candidato a empleado",
    contenido: `El reclutamiento es un tablero por fases, y las fases tienen un orden fijo: no se salta ninguna ni se va hacia atrás.

Cada candidato llega por una vacante. Sin vacante no aparece en el tablero.

Por el camino se le piden documentos (se pueden subir como foto y el software los lee), se le pasan cuestionarios y se le mandan correos con plantillas.

Cuando se contrata, el candidato queda cerrado: ya no se toca. Su documentación pasa a su ficha de empleado.

El correo y el teléfono de un candidato son únicos: no se puede apuntar dos veces a la misma persona.`,
    ruta: "/rrhh/reclutamiento",
    rutaTitulo: "Reclutamiento",
  },
  {
    ref: "sw:rrhh-firmas",
    modulo: "RECURSOS HUMANOS",
    titulo: "Firmas de documentos",
    contenido: `En Recursos humanos, Firmas se manda a firmar y se sigue quién ha firmado ya.

Al trabajador le llega un aviso y un correo. Firma con un código que se le manda al correo y que vale 15 minutos.

La firma se coloca automáticamente en el sitio del documento. Un documento firmado queda cerrado.`,
    ruta: "/rrhh/firmas",
    rutaTitulo: "Firmas",
  },
  {
    ref: "sw:rrhh-pagos",
    modulo: "RECURSOS HUMANOS",
    titulo: "Pagos y nóminas",
    contenido: `En Recursos humanos, Pagos se lleva lo que se paga cada mes: el salario, las horas trabajadas (normales y extra, que salen de los fichajes), los bonus y la seguridad social.

Hay UNA sola línea por empleado y mes. No se apunta dos veces lo mismo.

Las nóminas las sube la gestoría por un enlace permanente, el software las lee y se reparten a cada trabajador. Hasta que no se validan, el empleado no las ve.

Si una nómina está mal, se rechaza y la gestoría la vuelve a subir corregida.

Cada empresa lleva sus nóminas por separado: dos contratos de la misma persona no se suman.`,
    ruta: "/rrhh/pagos",
    rutaTitulo: "Pagos",
  },
  {
    ref: "sw:rrhh-bonus",
    modulo: "RECURSOS HUMANOS",
    titulo: "Bonus",
    contenido: `En Recursos humanos, Bonus se definen los incentivos y a qué puestos van ligados.

Lo que se acaba pagando es el bonus real conseguido, y entra en el pago del mes.`,
    ruta: "/rrhh/bonus",
    rutaTitulo: "Bonus",
  },
  {
    ref: "sw:rrhh-entregas",
    modulo: "RECURSOS HUMANOS",
    titulo: "Entregas de material y uniforme",
    contenido: `En Recursos humanos, Entregas se lleva el material que tiene cada trabajador: uniforme, llaves, herramientas.

Cada persona tiene un acta viva, una sola, con lo que tiene ahora, más el historial de entregas y devoluciones. Se firma al entregar y al devolver.

Lo que no se devuelve se marca como no devuelto: cuenta como pérdida, resta del total y no lleva firma.

El almacén de material propio es una cosa y el de cocina otra: no se mezclan.`,
    ruta: "/rrhh/entregas",
    rutaTitulo: "Entregas",
  },
  {
    ref: "sw:rrhh-formacion",
    modulo: "RECURSOS HUMANOS",
    titulo: "Formación de la plantilla",
    contenido: `En Recursos humanos, Formación se montan los cursos, con sus secciones, lecciones y vídeos, y se decide a qué puestos les toca cada uno.

Lo que se escribe aquí lo aprende también el asistente de ayuda: si explicas algo en una lección, el asistente sabrá contestarlo.

La formación inicial es la que se hace al entrar, y el trabajador puede volver a verla cuando quiera.`,
    ruta: "/rrhh/formacion",
    rutaTitulo: "Formación",
  },
  {
    ref: "sw:rrhh-points",
    modulo: "RECURSOS HUMANOS",
    titulo: "Points",
    contenido: `Points es el juego interno de la plantilla: se acumulan puntos y se sube de nivel.

El nivel y el saldo se ven en la píldora de arriba, y desde ahí se entra a la pantalla completa.`,
    ruta: "/rrhh/points",
    rutaTitulo: "Points",
  },
];
