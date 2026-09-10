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
 * NORMA DE NOMBRE: el puesto va SIEMPRE en SINGULAR. Nombra el trabajo de UNA
 * persona («Javier · CAMARERO»), no al grupo, y el mismo nombre viaja a la
 * vacante, al contrato y a la gestoría.
 *
 * NO añadir aquí puestos específicos de un cliente — esos los crea el cliente
 * desde RRHH → Puestos / Ajustes y NO se replican a otras empresas.
 */

export interface PuestoSeed {
  /** Nombre del departamento al que pertenece (debe existir en DEPARTAMENTOS_SEED). */
  departamento: string;
  nombre: string;
  /** Salario BRUTO mensual de referencia. */
  salarioBruto: number;
  /** "Completa" o "Parcial": lo deduce el horario, ver `jornadaDesdeHorario`. */
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
    salarioBruto: 3000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Puesto de confianza con disponibilidad. Reporta a propiedad.",
  },
  {
    departamento: "GERENCIA", nombre: "GERENTE",
    salarioBruto: 2200, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Reporta a Dirección. Alterna turnos de comida y cena.",
  },
  {
    departamento: "RECURSOS HUMANOS", nombre: "RECURSOS HUMANOS",
    salarioBruto: 1900, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trata datos personales: confidencialidad obligatoria.",
  },
  {
    departamento: "CALIDAD", nombre: "CALIDAD",
    salarioBruto: 1800, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Requiere formación en manipulación de alimentos y APPCC.",
  },
  {
    departamento: "CONTABILIDAD", nombre: "CONTABLE",
    salarioBruto: 1900, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Coordinación continua con gestoría.",
  },
  {
    departamento: "LOGÍSTICA", nombre: "LOGISTICA",
    salarioBruto: 1700, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Recepción de mercancía a primera hora.",
  },
  {
    departamento: "MARKETING", nombre: "COMMUNITY",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trabajo con picos en campañas y eventos.",
  },
  {
    departamento: "MARKETING", nombre: "FILMMAKER",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Aporta o usa equipo propio según acuerdo.",
  },
  {
    departamento: "MARKETING", nombre: "TRAFFIQER",
    salarioBruto: 1700, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Maneja presupuesto publicitario: requiere reporte semanal.",
  },
  {
    departamento: "GESTORÍA", nombre: "GESTOR",
    salarioBruto: 1800, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Trata datos personales: confidencialidad obligatoria.",
  },
  {
    departamento: "JURÍDICO", nombre: "ABOGADO",
    salarioBruto: 2000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Puesto de asesoramiento, sin turno de sala.",
  },

  // ── OPERATIVA ───────────────────────────────────────────────
  // Catálogo oficial = plantilla de BACANAL (la empresa más completa).
  {
    departamento: "SALA", nombre: "JEFE DE SALA",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Turno partido según servicio de comidas y cenas.",
  },
  {
    departamento: "SALA", nombre: "CAMARERO",
    salarioBruto: 1400, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Turnos rotativos, incluidos fines de semana y festivos.",
  },
  {
    departamento: "SALA", nombre: "HOSTESS",
    salarioBruto: 1350, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Imagen y trato al cliente en la puerta del local.",
  },
  {
    departamento: "SALA", nombre: "LIMPIEZA",
    salarioBruto: 1250, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Uso obligatorio de EPI y productos homologados.",
  },
  {
    departamento: "COCINA", nombre: "JEFE DE COCINA",
    salarioBruto: 2000, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Responsable del APPCC de cocina.",
  },
  {
    departamento: "COCINA", nombre: "COCINERO",
    salarioBruto: 1500, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Requiere carné de manipulador de alimentos.",
  },
  {
    departamento: "COCINA", nombre: "OFFICE",
    salarioBruto: 1250, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Uso obligatorio de EPI y productos homologados.",
  },
  {
    departamento: "ARTISTAS", nombre: "CANTANTE",
    salarioBruto: 1400, jornada: "Parcial", horasSemanales: 20, diasLibres: 4,
    observaciones: "Actuaciones según programación: fines de semana y eventos.",
  },
  {
    departamento: "ARTISTAS", nombre: "MUSICO",
    salarioBruto: 1400, jornada: "Parcial", horasSemanales: 20, diasLibres: 4,
    observaciones: "Actuaciones según programación: fines de semana y eventos.",
  },
  {
    departamento: "MANTENIMIENTO", nombre: "TECNICO",
    salarioBruto: 1600, jornada: "Completa", horasSemanales: 40, diasLibres: 2,
    observaciones: "Disponibilidad para averías urgentes.",
  },
];

export function normalizePuestoNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}
