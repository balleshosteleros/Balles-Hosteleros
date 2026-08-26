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
 * horas, días libres y vacaciones; las observaciones son opcionales). Un puesto
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
  },
  {
    departamento: "GERENCIA", nombre: "GERENTE",
    descripcion: "Gestiona el día a día del local: equipo, servicio, compras y cierres de caja.",
    salarioBruto: 2200, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Reporta a Dirección. Alterna turnos de comida y cena.",
  },
  {
    departamento: "RECURSOS HUMANOS", nombre: "RECURSOS HUMANOS",
    descripcion: "Lleva altas, bajas, contratos, nóminas, cuadrantes y toda la relación con la gestoría.",
    salarioBruto: 1900, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trata datos personales: confidencialidad obligatoria.",
  },
  {
    departamento: "CALIDAD", nombre: "CALIDAD",
    descripcion: "Vela por el APPCC, las temperaturas, la limpieza y las auditorías de seguridad alimentaria.",
    salarioBruto: 1800, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Requiere formación en manipulación de alimentos y APPCC.",
  },
  {
    departamento: "CONTABILIDAD", nombre: "CONTABLE",
    descripcion: "Registra facturas, concilia bancos y prepara la información contable y fiscal del negocio.",
    salarioBruto: 1900, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Coordinación continua con gestoría.",
  },
  {
    departamento: "LOGÍSTICA", nombre: "LOGISTICA",
    descripcion: "Gestiona proveedores, pedidos, albaranes, inventarios y el stock del local.",
    salarioBruto: 1700, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Recepción de mercancía a primera hora.",
  },
  {
    departamento: "MARKETING", nombre: "COMMUNITY",
    descripcion: "Lleva las redes sociales del local: contenido, publicaciones, comunidad y reseñas.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trabajo con picos en campañas y eventos.",
  },
  {
    departamento: "MARKETING", nombre: "FILMMAKER",
    descripcion: "Graba y edita el material audiovisual del local para redes, web y campañas.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Aporta o usa equipo propio según acuerdo.",
  },
  {
    departamento: "MARKETING", nombre: "TRAFFIQER",
    descripcion: "Gestiona la publicidad de pago y la captación: campañas, presupuesto y resultados.",
    salarioBruto: 1700, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Maneja presupuesto publicitario: requiere reporte semanal.",
  },
  {
    departamento: "GESTORÍA", nombre: "GESTOR",
    descripcion: "Enlace con la gestoría: contratos, nóminas, seguros sociales y documentación laboral.",
    salarioBruto: 1800, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trata datos personales: confidencialidad obligatoria.",
  },
  {
    departamento: "JURÍDICO", nombre: "ABOGADO",
    descripcion: "Asesora en materia legal: contratos, licencias, reclamaciones y procesos del negocio.",
    salarioBruto: 2000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Puesto de asesoramiento, sin turno de sala.",
  },

  // ── OPERATIVA ───────────────────────────────────────────────
  // Catálogo oficial = plantilla de BACANAL (la empresa más completa).
  {
    departamento: "SALA", nombre: "JEFE DE SALA",
    descripcion: "Dirige el servicio de sala: organiza al equipo, atiende al cliente y cierra el turno.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Turno partido según servicio de comidas y cenas.",
  },
  {
    departamento: "SALA", nombre: "CAMAREROS",
    descripcion: "Atiende a los clientes en sala: toma comandas, sirve, cobra y mantiene su rango.",
    salarioBruto: 1400, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Turnos rotativos, incluidos fines de semana y festivos.",
  },
  {
    departamento: "SALA", nombre: "HOSTESS",
    descripcion: "Recibe y acomoda a los clientes, gestiona las reservas y controla la entrada del local.",
    salarioBruto: 1350, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Imagen y trato al cliente en la puerta del local.",
  },
  {
    departamento: "SALA", nombre: "LIMPIEZA",
    descripcion: "Mantiene limpias e higienizadas las zonas del local, incluidos aseos y áreas comunes.",
    salarioBruto: 1250, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Uso obligatorio de EPI y productos homologados.",
  },
  {
    departamento: "COCINA", nombre: "JEFE DE COCINA",
    descripcion: "Dirige la cocina: carta, escandallos, pedidos, equipo y control de mermas.",
    salarioBruto: 2000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Responsable del APPCC de cocina.",
  },
  {
    departamento: "COCINA", nombre: "COCINERO",
    descripcion: "Elabora los platos de su partida siguiendo las fichas técnicas y las normas de higiene.",
    salarioBruto: 1500, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Requiere carné de manipulador de alimentos.",
  },
  {
    departamento: "COCINA", nombre: "OFFICE",
    descripcion: "Se encarga del lavado de menaje y de la limpieza de la cocina durante y tras el servicio.",
    salarioBruto: 1250, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Uso obligatorio de EPI y productos homologados.",
  },
  {
    departamento: "ARTISTAS", nombre: "CANTANTE",
    descripcion: "Actuación musical en directo en el local según la programación de sala.",
    salarioBruto: 1400, jornada: "Partida", horasSemanales: 20, diasLibres: 4,
    observaciones: "Actuaciones según programación: fines de semana y eventos.",
  },
  {
    departamento: "ARTISTAS", nombre: "MUSICO",
    descripcion: "Acompañamiento musical en directo según la programación del local.",
    salarioBruto: 1400, jornada: "Partida", horasSemanales: 20, diasLibres: 4,
    observaciones: "Actuaciones según programación: fines de semana y eventos.",
  },
  {
    departamento: "MANTENIMIENTO", nombre: "TECNICO",
    descripcion: "Mantiene las instalaciones y equipos del local: averías, revisiones y preventivo.",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Disponibilidad para averías urgentes.",
  },
];

export function normalizePuestoNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}
