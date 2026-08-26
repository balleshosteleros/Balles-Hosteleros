/**
 * Seed canónico de PUESTOS del software (hijos de cada departamento).
 *
 * Fuente de verdad: se replica a TODAS las empresas existentes vía
 * `syncSeedsToAllEmpresas()` (aditivo) y se aplica a las empresas nuevas vía
 * `seedEmpresaDefaults()`. Cada puesto se enlaza a su departamento por NOMBRE.
 *
 * PUESTO ≠ ROL: el puesto es el nombre del trabajo (con salario), hijo del
 * departamento; el rol es el perfil de accesos al software.
 *
 * NORMA: cada puesto del seed nace COMPLETO (descripción, salario, jornada,
 * horas, días libres, vacaciones, observaciones y objetivos). Un puesto
 * incompleto da de alta empleados con datos incompletos, porque al contratar
 * sus condiciones se copian al empleado y de ahí viajan al contrato y a la
 * gestoría. Los importes son la referencia de partida: cada empresa los ajusta
 * desde RRHH → Puestos.
 *
 * NO añadir aquí puestos específicos de un cliente — esos los crea el cliente
 * desde RRHH → Puestos / Ajustes y NO se replican a otras empresas.
 */

export interface PuestoSeed {
  /** Nombre del departamento al que pertenece (debe existir en DEPARTAMENTOS_SEED). */
  departamento: string;
  nombre: string;
  descripcion: string;
  /** Salario BRUTO mensual de referencia. */
  salarioBruto: number;
  /** "Completa" o "Partida". */
  jornada: string;
  horasSemanales: number;
  diasLibres: number;
  observaciones: string;
  objetivos: string[];
}

/** Convenio de referencia de los puestos del seed. */
export const CONVENIO_SEED = "Hostelería de Madrid";

/** Vacaciones de referencia de los puestos del seed. */
export const VACACIONES_SEED = "30 días";

export const PUESTOS_SEED: PuestoSeed[] = [
  // ── ADMINISTRATIVA ──────────────────────────────────────────
  {
    departamento: "DIRECCIÓN", nombre: "DIRECTOR",
    descripcion: "Dirige el negocio: marca los objetivos, aprueba el presupuesto y responde de la cuenta de resultados del local.",
    salarioBruto: 3000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Puesto de confianza con disponibilidad. Reporta a propiedad.",
    objetivos: ["Cumplir el presupuesto anual de ventas y margen", "Mantener el equipo completo y formado", "Revisar los cuadros de mando cada semana"],
  },
  {
    departamento: "GERENCIA", nombre: "GERENTE",
    descripcion: "Gestiona el día a día del local: equipo, servicio, compras y cierres de caja.",
    salarioBruto: 2200, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Reporta a Dirección. Alterna turnos de comida y cena.",
    objetivos: ["Cuadrar la caja todos los días", "Mantener el escandallo dentro del objetivo", "Cubrir el cuadrante semanal sin descubiertos"],
  },
  {
    departamento: "RECURSOS HUMANOS", nombre: "RECURSOS HUMANOS",
    descripcion: "Lleva altas, bajas, contratos, nóminas, cuadrantes y toda la relación con la gestoría.",
    salarioBruto: 1900, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trata datos personales: confidencialidad obligatoria.",
    objetivos: ["Tramitar altas y bajas dentro de plazo legal", "Cerrar las nóminas antes del día 25", "Mantener la documentación de cada empleado al día"],
  },
  {
    departamento: "CALIDAD", nombre: "CALIDAD",
    descripcion: "Vela por el APPCC, las temperaturas, la limpieza y las auditorías de seguridad alimentaria.",
    salarioBruto: 1800, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Requiere formación en manipulación de alimentos y APPCC.",
    objetivos: ["Cerrar los registros de APPCC cada día", "Superar las auditorías sin no conformidades graves", "Formar al equipo en seguridad alimentaria"],
  },
  {
    departamento: "CONTABILIDAD", nombre: "CONTABLE",
    descripcion: "Registra facturas, concilia bancos y prepara la información contable y fiscal del negocio.",
    salarioBruto: 1900, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Coordinación continua con gestoría.",
    objetivos: ["Conciliar los bancos cada mes", "Registrar las facturas dentro del mes en curso", "Entregar los modelos fiscales en plazo"],
  },
  {
    departamento: "LOGÍSTICA", nombre: "LOGISTICA",
    descripcion: "Gestiona proveedores, pedidos, albaranes, inventarios y el stock del local.",
    salarioBruto: 1700, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Recepción de mercancía a primera hora.",
    objetivos: ["Evitar roturas de stock en producto clave", "Cerrar el inventario cada mes", "Revisar los precios de compra frente a escandallo"],
  },
  {
    departamento: "MARKETING", nombre: "COMMUNITY",
    descripcion: "Lleva las redes sociales del local: contenido, publicaciones, comunidad y reseñas.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trabajo con picos en campañas y eventos.",
    objetivos: ["Publicar según el calendario de contenidos", "Responder las reseñas y mensajes en 24 h", "Hacer crecer la comunidad cada mes"],
  },
  {
    departamento: "MARKETING", nombre: "FILMMAKER",
    descripcion: "Graba y edita el material audiovisual del local para redes, web y campañas.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Aporta o usa equipo propio según acuerdo.",
    objetivos: ["Entregar el material editado en el plazo acordado", "Cubrir los eventos del local", "Mantener el archivo audiovisual ordenado"],
  },
  {
    departamento: "MARKETING", nombre: "TRAFFIQER",
    descripcion: "Gestiona la publicidad de pago y la captación: campañas, presupuesto y resultados.",
    salarioBruto: 1700, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Maneja presupuesto publicitario: requiere reporte semanal.",
    objetivos: ["Mantener el coste por reserva dentro del objetivo", "Revisar las campañas activas cada semana", "Reportar resultados a Dirección"],
  },
  {
    departamento: "GESTORÍA", nombre: "GESTOR",
    descripcion: "Enlace con la gestoría: contratos, nóminas, seguros sociales y documentación laboral.",
    salarioBruto: 1800, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trata datos personales: confidencialidad obligatoria.",
    objetivos: ["Presentar la documentación laboral en plazo", "Resolver las incidencias de nómina", "Mantener actualizada la información de la empresa"],
  },
  {
    departamento: "JURÍDICO", nombre: "ABOGADO",
    descripcion: "Asesora en materia legal: contratos, licencias, reclamaciones y procesos del negocio.",
    salarioBruto: 2000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Puesto de asesoramiento, sin turno de sala.",
    objetivos: ["Revisar los contratos antes de firma", "Mantener las licencias del local vigentes", "Atender los procesos abiertos en plazo"],
  },

  // ── OPERATIVA ───────────────────────────────────────────────
  // Catálogo oficial = plantilla de BACANAL (la empresa más completa).
  {
    departamento: "SALA", nombre: "JEFE DE SALA",
    descripcion: "Dirige el servicio de sala: organiza al equipo, atiende al cliente y cierra el turno.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Turno partido según servicio de comidas y cenas.",
    objetivos: ["Mantener el servicio dentro de los tiempos", "Cuadrar la caja del turno", "Formar al equipo de sala"],
  },
  {
    departamento: "SALA", nombre: "CAMAREROS",
    descripcion: "Atiende a los clientes en sala: toma comandas, sirve, cobra y mantiene su rango.",
    salarioBruto: 1400, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Turnos rotativos, incluidos fines de semana y festivos.",
    objetivos: ["Atender el rango asignado sin esperas", "Conocer la carta y sus alérgenos", "Dejar el rango montado para el siguiente turno"],
  },
  {
    departamento: "SALA", nombre: "HOSTESS",
    descripcion: "Recibe y acomoda a los clientes, gestiona las reservas y controla la entrada del local.",
    salarioBruto: 1350, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Imagen y trato al cliente en la puerta del local.",
    objetivos: ["Gestionar las reservas sin solapes", "Recibir a todo cliente en menos de un minuto", "Mantener actualizado el estado de las mesas"],
  },
  {
    departamento: "SALA", nombre: "LIMPIEZA",
    descripcion: "Mantiene limpias e higienizadas las zonas del local, incluidos aseos y áreas comunes.",
    salarioBruto: 1250, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Uso obligatorio de EPI y productos homologados.",
    objetivos: ["Completar el parte de limpieza de cada turno", "Mantener los aseos revisados durante el servicio", "Cumplir el protocolo de productos e higiene"],
  },
  {
    departamento: "COCINA", nombre: "JEFE DE COCINA",
    descripcion: "Dirige la cocina: carta, escandallos, pedidos, equipo y control de mermas.",
    salarioBruto: 2000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Responsable del APPCC de cocina.",
    objetivos: ["Mantener el coste de materia prima en objetivo", "Cerrar los registros de temperaturas cada día", "Sacar el servicio dentro de los tiempos de pase"],
  },
  {
    departamento: "COCINA", nombre: "COCINERO",
    descripcion: "Elabora los platos de su partida siguiendo las fichas técnicas y las normas de higiene.",
    salarioBruto: 1500, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Requiere carné de manipulador de alimentos.",
    objetivos: ["Respetar las fichas técnicas de cada plato", "Mantener la partida limpia y ordenada", "Controlar las mermas de su partida"],
  },
  {
    departamento: "COCINA", nombre: "OFFICE",
    descripcion: "Se encarga del lavado de menaje y de la limpieza de la cocina durante y tras el servicio.",
    salarioBruto: 1250, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Uso obligatorio de EPI y productos homologados.",
    objetivos: ["Mantener el menaje disponible durante todo el servicio", "Dejar la cocina limpia al cierre", "Cumplir el protocolo de residuos"],
  },
  {
    departamento: "ARTISTAS", nombre: "CANTANTE",
    descripcion: "Actuación musical en directo en el local según la programación de sala.",
    salarioBruto: 1400, jornada: "Partida", horasSemanales: 20, diasLibres: 4,
    observaciones: "Actuaciones según programación: fines de semana y eventos.",
    objetivos: ["Cumplir la programación de actuaciones", "Ajustar el repertorio al ambiente del local", "Coordinarse con sala en cada pase"],
  },
  {
    departamento: "ARTISTAS", nombre: "MUSICO",
    descripcion: "Acompañamiento musical en directo según la programación del local.",
    salarioBruto: 1400, jornada: "Partida", horasSemanales: 20, diasLibres: 4,
    observaciones: "Actuaciones según programación: fines de semana y eventos.",
    objetivos: ["Cumplir la programación de actuaciones", "Mantener el equipo en buen estado", "Coordinarse con sala en cada pase"],
  },
  {
    departamento: "MANTENIMIENTO", nombre: "TECNICO",
    descripcion: "Mantiene las instalaciones y equipos del local: averías, revisiones y preventivo.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Disponibilidad para averías urgentes.",
    objetivos: ["Resolver las averías dentro del plazo acordado", "Cumplir el plan de mantenimiento preventivo", "Mantener el registro de incidencias al día"],
  },
];

export function normalizePuestoNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}
