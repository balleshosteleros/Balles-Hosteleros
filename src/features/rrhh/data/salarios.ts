// ─── Interfaces ───────────────────────────────────────────────

export interface HorarioDia {
  dia: string;
  turno: string; // e.g. "10:00 - 18:00" or "LIBRE"
}

/** Condiciones de un Nivel del puesto (plantilla reutilizable de salario+horario). */
export interface NivelSalarial {
  nivel: number;
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
}

export interface PuestoSalarial {
  id: string;
  departamento: string;
  departamentoId: string;
  puesto: string;
  /** Nivel cabecera (el más bajo, normalmente 1). */
  nivel: number;
  /** Nº de niveles del puesto (1..N). */
  nivelesCount: number;
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
  // Datos de gestoría (compartidos por el puesto, comunes a todos los niveles)
  convenioColectivo: string;
  tipoContratoDefecto: string;
  grupoCategoriaProf: string;
  epigrafeCotizacion: string;
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

// ─── Normas comunes ───────────────────────────────────────────
// Texto legal genérico (no es dato de cliente). Los salarios reales viven en
// la tabla `puesto_salarios` (ligada a puesto→departamento), vía
// `listSalariosEmpresa()` en rrhh/actions/salarios-actions.ts.

export const NORMAS_BASE: NormaSalarial[] = [
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
