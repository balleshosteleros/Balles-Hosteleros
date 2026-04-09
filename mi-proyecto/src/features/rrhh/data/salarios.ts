// ─── Interfaces ───────────────────────────────────────────────

export interface HorarioDia {
  dia: string;
  turno: string; // e.g. "10:00 - 18:00" or "LIBRE"
}

export interface PuestoSalarial {
  id: string;
  departamento: string;
  puesto: string;
  vacaciones: string;
  nominaNeta: number;
  efectivoExtra: number;
  salarioNeto: number;
  jornadaContrato: string;
  horasSemanales: number;
  diasLibres: number;
  horarioSemanal: HorarioDia[];
  observaciones: string;
  objetivos: string[];
  estado: "activo" | "borrador" | "inactivo";
  updatedAt: string;
}

export interface NormaSalarial {
  id: string;
  titulo: string;
  descripcion: string;
}

export interface SalariosEmpresa {
  puestos: PuestoSalarial[];
  normas: NormaSalarial[];
}

// ─── Helpers ──────────────────────────────────────────────────

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function horario(turnos: string[]): HorarioDia[] {
  return DIAS.map((dia, i) => ({ dia, turno: turnos[i] ?? "LIBRE" }));
}

// ─── Normas comunes ───────────────────────────────────────────

const NORMAS_BASE: NormaSalarial[] = [
  {
    id: "n1",
    titulo: "Modificación de condiciones",
    descripcion:
      "La empresa podrá modificar tablas y condiciones salariales por razones organizativas o económicas internas, comunicándolo con antelación suficiente al trabajador.",
  },
  {
    id: "n2",
    titulo: "Manual Operativo",
    descripcion:
      "Es requisito seguir las normas de empresa y del Manual Operativo para la correcta aplicación de las condiciones salariales y beneficios asociados al puesto.",
  },
  {
    id: "n3",
    titulo: "Confidencialidad",
    descripcion:
      "La información salarial es estrictamente confidencial. Compartir datos salariales con compañeros u otras personas podrá acarrear medidas disciplinarias.",
  },
  {
    id: "n4",
    titulo: "Periodo de prueba",
    descripcion:
      "Durante el periodo de prueba, las condiciones podrán ajustarse al desempeño del trabajador antes de consolidar las cifras definitivas.",
  },
];

// ─── Datos BACANAL ────────────────────────────────────────────

const PUESTOS_BACANAL: PuestoSalarial[] = [
  {
    id: "bac-office",
    departamento: "Operaciones",
    puesto: "Office / Limpieza",
    vacaciones: "30 días naturales",
    nominaNeta: 1250,
    efectivoExtra: 0,
    salarioNeto: 1250,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["10:00 - 18:00", "10:00 - 18:00", "LIBRE", "10:00 - 18:00", "10:00 - 18:00", "10:00 - 18:00", "LIBRE"]),
    observaciones: "Puesto base de operaciones. Turno estable de mañana.",
    objetivos: ["Mantener estándares de limpieza al 100%", "Cumplir protocolo de higiene diario"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "bac-hostess",
    departamento: "Sala",
    puesto: "Hostess",
    vacaciones: "30 días naturales",
    nominaNeta: 1300,
    efectivoExtra: 100,
    salarioNeto: 1400,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["18:00 - 02:00", "18:00 - 02:00", "LIBRE", "18:00 - 02:00", "18:00 - 02:00", "18:00 - 03:00", "LIBRE"]),
    observaciones: "Turno de noche. Gestión de reservas y recepción.",
    objetivos: ["Gestionar reservas con 0 errores", "Mantener ratio de satisfacción cliente > 90%"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "bac-1jefe-sala",
    departamento: "Sala",
    puesto: "1º Jefe de Sala",
    vacaciones: "30 días naturales",
    nominaNeta: 1700,
    efectivoExtra: 300,
    salarioNeto: 2000,
    jornadaContrato: "Completa",
    horasSemanales: 45,
    diasLibres: 2,
    horarioSemanal: horario(["12:00 - 01:00", "12:00 - 01:00", "LIBRE", "12:00 - 01:00", "12:00 - 01:00", "12:00 - 02:00", "LIBRE"]),
    observaciones: "Máximo responsable de sala. Gestión de equipo y estándares.",
    objetivos: ["Supervisar servicio completo", "Formar al equipo de sala", "Alcanzar objetivos de venta mensual"],
    estado: "activo",
    updatedAt: "2025-02-01",
  },
  {
    id: "bac-2jefe-sala",
    departamento: "Sala",
    puesto: "2º Jefe de Sala",
    vacaciones: "30 días naturales",
    nominaNeta: 1500,
    efectivoExtra: 200,
    salarioNeto: 1700,
    jornadaContrato: "Completa",
    horasSemanales: 45,
    diasLibres: 2,
    horarioSemanal: horario(["12:00 - 01:00", "12:00 - 01:00", "LIBRE", "12:00 - 01:00", "12:00 - 01:00", "12:00 - 02:00", "LIBRE"]),
    observaciones: "Soporte directo al 1º Jefe de Sala.",
    objetivos: ["Supervisar turnos asignados", "Garantizar estándares de calidad"],
    estado: "activo",
    updatedAt: "2025-02-01",
  },
  {
    id: "bac-3jefe-sala",
    departamento: "Sala",
    puesto: "3º Jefe de Sala",
    vacaciones: "30 días naturales",
    nominaNeta: 1400,
    efectivoExtra: 150,
    salarioNeto: 1550,
    jornadaContrato: "Completa",
    horasSemanales: 42,
    diasLibres: 2,
    horarioSemanal: horario(["16:00 - 01:00", "16:00 - 01:00", "LIBRE", "16:00 - 01:00", "16:00 - 01:00", "16:00 - 02:00", "LIBRE"]),
    observaciones: "Turno de tarde-noche. Apoyo a jefes de sala.",
    objetivos: ["Controlar cierre de caja", "Supervisar limpieza de cierre"],
    estado: "activo",
    updatedAt: "2025-02-01",
  },
  {
    id: "bac-camarero",
    departamento: "Sala",
    puesto: "1º Camarero",
    vacaciones: "30 días naturales",
    nominaNeta: 1350,
    efectivoExtra: 100,
    salarioNeto: 1450,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["16:00 - 00:00", "16:00 - 00:00", "LIBRE", "16:00 - 00:00", "16:00 - 00:00", "16:00 - 01:00", "LIBRE"]),
    observaciones: "Camarero de referencia. Experiencia mínima requerida.",
    objetivos: ["Dominar carta y cocktails", "Venta sugerida efectiva"],
    estado: "activo",
    updatedAt: "2025-01-20",
  },
  {
    id: "bac-cachimbero",
    departamento: "Sala",
    puesto: "Cachimbero",
    vacaciones: "30 días naturales",
    nominaNeta: 1250,
    efectivoExtra: 100,
    salarioNeto: 1350,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["18:00 - 02:00", "18:00 - 02:00", "LIBRE", "18:00 - 02:00", "18:00 - 02:00", "18:00 - 03:00", "LIBRE"]),
    observaciones: "Gestión exclusiva de cachimbas y zona fumadores.",
    objetivos: ["Mantener stock de sabores", "Limpieza y mantenimiento de equipos"],
    estado: "activo",
    updatedAt: "2025-01-20",
  },
  {
    id: "bac-1jefe-cocina",
    departamento: "Cocina",
    puesto: "1º Jefe de Cocina",
    vacaciones: "30 días naturales",
    nominaNeta: 1700,
    efectivoExtra: 300,
    salarioNeto: 2000,
    jornadaContrato: "Completa",
    horasSemanales: 45,
    diasLibres: 2,
    horarioSemanal: horario(["10:00 - 00:00", "10:00 - 00:00", "LIBRE", "10:00 - 00:00", "10:00 - 00:00", "10:00 - 01:00", "LIBRE"]),
    observaciones: "Máximo responsable de cocina. Escandallos, pedidos y equipo.",
    objetivos: ["Control de costes de materia prima < 30%", "Cumplir fichas técnicas al 100%", "Formación continua del equipo"],
    estado: "activo",
    updatedAt: "2025-02-01",
  },
  {
    id: "bac-2jefe-cocina",
    departamento: "Cocina",
    puesto: "2º Jefe de Cocina",
    vacaciones: "30 días naturales",
    nominaNeta: 1500,
    efectivoExtra: 200,
    salarioNeto: 1700,
    jornadaContrato: "Completa",
    horasSemanales: 45,
    diasLibres: 2,
    horarioSemanal: horario(["10:00 - 00:00", "10:00 - 00:00", "LIBRE", "10:00 - 00:00", "10:00 - 00:00", "10:00 - 01:00", "LIBRE"]),
    observaciones: "Soporte al Jefe de Cocina. Responsable en su ausencia.",
    objetivos: ["Supervisar mise en place", "Controlar inventarios semanales"],
    estado: "activo",
    updatedAt: "2025-02-01",
  },
  {
    id: "bac-cocinero",
    departamento: "Cocina",
    puesto: "1º Cocinero",
    vacaciones: "30 días naturales",
    nominaNeta: 1350,
    efectivoExtra: 100,
    salarioNeto: 1450,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["12:00 - 22:00", "12:00 - 22:00", "LIBRE", "12:00 - 22:00", "12:00 - 22:00", "12:00 - 23:00", "LIBRE"]),
    observaciones: "Cocinero de partida. Experiencia mínima requerida.",
    objetivos: ["Dominar todas las partidas", "Mantener limpieza y orden"],
    estado: "activo",
    updatedAt: "2025-01-20",
  },
  {
    id: "bac-seguridad",
    departamento: "Operaciones",
    puesto: "Seguridad",
    vacaciones: "30 días naturales",
    nominaNeta: 1400,
    efectivoExtra: 0,
    salarioNeto: 1400,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["20:00 - 04:00", "20:00 - 04:00", "LIBRE", "20:00 - 04:00", "20:00 - 04:00", "20:00 - 05:00", "LIBRE"]),
    observaciones: "Control de acceso y seguridad del local.",
    objetivos: ["Cumplir protocolo de seguridad", "Gestión de incidencias"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "bac-mantenimiento",
    departamento: "Operaciones",
    puesto: "Mantenimiento",
    vacaciones: "30 días naturales",
    nominaNeta: 1300,
    efectivoExtra: 0,
    salarioNeto: 1300,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["08:00 - 16:00", "08:00 - 16:00", "LIBRE", "08:00 - 16:00", "08:00 - 16:00", "08:00 - 16:00", "LIBRE"]),
    observaciones: "Mantenimiento preventivo y correctivo de instalaciones.",
    objetivos: ["Reducir incidencias recurrentes", "Cumplir plan de mantenimiento preventivo"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "bac-artista",
    departamento: "Entretenimiento",
    puesto: "Artistas",
    vacaciones: "Según contrato",
    nominaNeta: 0,
    efectivoExtra: 0,
    salarioNeto: 0,
    jornadaContrato: "Por evento",
    horasSemanales: 0,
    diasLibres: 0,
    horarioSemanal: horario(["Según evento", "Según evento", "Según evento", "Según evento", "Según evento", "Según evento", "Según evento"]),
    observaciones: "Contratación por evento. Condiciones según acuerdo individual.",
    objetivos: [],
    estado: "borrador",
    updatedAt: "2025-01-10",
  },
];

// ─── Datos HABANA ─────────────────────────────────────────────

const PUESTOS_HABANA: PuestoSalarial[] = [
  {
    id: "hab-office",
    departamento: "Operaciones",
    puesto: "Office / Limpieza",
    vacaciones: "30 días naturales",
    nominaNeta: 1200,
    efectivoExtra: 0,
    salarioNeto: 1200,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["09:00 - 17:00", "09:00 - 17:00", "LIBRE", "09:00 - 17:00", "09:00 - 17:00", "09:00 - 17:00", "LIBRE"]),
    observaciones: "Turno de mañana estable.",
    objetivos: ["Cumplir check-list de limpieza diario"],
    estado: "activo",
    updatedAt: "2025-01-10",
  },
  {
    id: "hab-hostess",
    departamento: "Sala",
    puesto: "Hostess",
    vacaciones: "30 días naturales",
    nominaNeta: 1250,
    efectivoExtra: 100,
    salarioNeto: 1350,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["19:00 - 03:00", "19:00 - 03:00", "LIBRE", "19:00 - 03:00", "19:00 - 03:00", "19:00 - 04:00", "LIBRE"]),
    observaciones: "Recepción y gestión de reservas.",
    objetivos: ["Gestión de reservas sin errores"],
    estado: "activo",
    updatedAt: "2025-01-10",
  },
  {
    id: "hab-1jefe-sala",
    departamento: "Sala",
    puesto: "1º Jefe de Sala",
    vacaciones: "30 días naturales",
    nominaNeta: 1600,
    efectivoExtra: 250,
    salarioNeto: 1850,
    jornadaContrato: "Completa",
    horasSemanales: 45,
    diasLibres: 2,
    horarioSemanal: horario(["13:00 - 01:00", "13:00 - 01:00", "LIBRE", "13:00 - 01:00", "13:00 - 01:00", "13:00 - 02:00", "LIBRE"]),
    observaciones: "Responsable de sala y equipo.",
    objetivos: ["Supervisar servicio", "Formar equipo"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "hab-camarero",
    departamento: "Sala",
    puesto: "1º Camarero",
    vacaciones: "30 días naturales",
    nominaNeta: 1300,
    efectivoExtra: 100,
    salarioNeto: 1400,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["17:00 - 01:00", "17:00 - 01:00", "LIBRE", "17:00 - 01:00", "17:00 - 01:00", "17:00 - 02:00", "LIBRE"]),
    observaciones: "Camarero de referencia.",
    objetivos: ["Dominar carta", "Venta sugerida"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "hab-1jefe-cocina",
    departamento: "Cocina",
    puesto: "1º Jefe de Cocina",
    vacaciones: "30 días naturales",
    nominaNeta: 1600,
    efectivoExtra: 250,
    salarioNeto: 1850,
    jornadaContrato: "Completa",
    horasSemanales: 45,
    diasLibres: 2,
    horarioSemanal: horario(["10:00 - 23:00", "10:00 - 23:00", "LIBRE", "10:00 - 23:00", "10:00 - 23:00", "10:00 - 00:00", "LIBRE"]),
    observaciones: "Responsable de cocina. Escandallos y pedidos.",
    objetivos: ["Control de costes < 30%", "Fichas técnicas al 100%"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "hab-cocinero",
    departamento: "Cocina",
    puesto: "1º Cocinero",
    vacaciones: "30 días naturales",
    nominaNeta: 1300,
    efectivoExtra: 100,
    salarioNeto: 1400,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["11:00 - 21:00", "11:00 - 21:00", "LIBRE", "11:00 - 21:00", "11:00 - 21:00", "11:00 - 22:00", "LIBRE"]),
    observaciones: "Cocinero de partida.",
    objetivos: ["Dominar partidas", "Mantener limpieza"],
    estado: "activo",
    updatedAt: "2025-01-15",
  },
  {
    id: "hab-seguridad",
    departamento: "Operaciones",
    puesto: "Seguridad",
    vacaciones: "30 días naturales",
    nominaNeta: 1350,
    efectivoExtra: 0,
    salarioNeto: 1350,
    jornadaContrato: "Completa",
    horasSemanales: 40,
    diasLibres: 2,
    horarioSemanal: horario(["21:00 - 05:00", "21:00 - 05:00", "LIBRE", "21:00 - 05:00", "21:00 - 05:00", "21:00 - 06:00", "LIBRE"]),
    observaciones: "Control de acceso.",
    objetivos: ["Cumplir protocolo de seguridad"],
    estado: "activo",
    updatedAt: "2025-01-10",
  },
];

// ─── Exportación por empresa ──────────────────────────────────

export const SALARIOS_POR_EMPRESA: Record<string, SalariosEmpresa> = {
  bacanal: { puestos: PUESTOS_BACANAL, normas: NORMAS_BASE },
  habana: { puestos: PUESTOS_HABANA, normas: NORMAS_BASE },
};

export function getSalariosEmpresa(empresaId: string): SalariosEmpresa {
  return SALARIOS_POR_EMPRESA[empresaId] ?? { puestos: [], normas: NORMAS_BASE };
}

export const DEPARTAMENTOS_DISPONIBLES = [
  "Director",
  "Gestoría",
  "Contabilidad",
  "Calidad",
  "Marketing",
  "RR.HH",
  "Gerencia",
  "Logística",
  "Sala",
  "Cocina",
  "Operaciones",
  "Entretenimiento",
];
