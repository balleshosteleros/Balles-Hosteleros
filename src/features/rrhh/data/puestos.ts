import type { ModoPago } from "@/features/rrhh/lib/coste-hora";
// ─── Interfaces ───────────────────────────────────────────────

export interface HorarioDia {
  dia: string;
  turno: string; // e.g. "10:00 - 18:00" or "LIBRE"
}

/** Condiciones de un Nivel del puesto (plantilla reutilizable de salario+horario). */
export interface NivelSalarial {
  nivel: number;
  vacaciones: string;
  /**
   * Cómo se le paga: sueldo fijo al mes, o por hora trabajada.
   * Cambia lo que significa `salarioBruto`.
   */
  modoPago: ModoPago;
  /**
   * Salario BRUTO: cifra principal del puesto.
   * En modo MENSUAL es el sueldo del mes; en modo HORAS, el precio de una hora.
   */
  salarioBruto: number;
  // Neto (interno): se conserva por compatibilidad con contratación/gestoría.
  nominaNeta: number;
  efectivoExtra: number;
  salarioNeto: number;
  /**
   * Lo que la empresa paga a la Seguridad Social POR este trabajador, encima del
   * bruto: 32,15% en hostelería con contrato indefinido (23,60 contingencias
   * comunes + 5,50 desempleo + 0,75 MEI + 0,80 IT + 0,70 IMS + 0,60 FP +
   * 0,20 FOGASA), verificado contra las nóminas reales.
   */
  ssEmpresa: number;
  /** Lo que cuesta el puesto de verdad: bruto + cotización de la empresa. */
  costeEmpresa: number;
  /** Retención de IRPF del puesto, en tanto por ciento (2 = 2%). */
  irpfPct: number;
  /** Euros de IRPF retenidos al mes. */
  irpfImporte: number;
  /** Cotización a cargo del trabajador: 6,50% del bruto. */
  ssTrabajador: number;
  jornadaContrato: string;
  horasSemanales: number;
  diasLibres: number;
  /**
   * Lo que cuesta una hora de este puesto. Se copia al empleado al contratarlo y
   * es lo que usan los ratios de coste de personal. A 0 se calcula solo:
   * bruto x 12 / (52 x horas de la semana).
   */
  costeHora: number;
  /**
   * A cuánto se paga una hora extra en este puesto. Las horas extras que se
   * hacen cada mes no son del puesto (van en la nómina), pero su precio sí.
   * Quien cobra POR HORA la tiene al mismo precio que su hora normal.
   */
  precioHoraExtra: number;
  horarioSemanal: HorarioDia[];
  observaciones: string;
  estado: "activo" | "borrador" | "inactivo";
}

export interface PuestoSalarial {
  id: string;
  departamento: string;
  departamentoId: string;
  /** Local (centro de trabajo) al que pertenece el puesto. */
  localId: string | null;
  /** Nombre del local, para pintarlo sin volver a consultar. */
  localNombre: string | null;
  puesto: string;
  /** Nivel cabecera (el más bajo, normalmente 1). */
  nivel: number;
  /** Nº de niveles del puesto (1..N). */
  nivelesCount: number;
  vacaciones: string;
  /** Salario BRUTO mensual: cifra principal del puesto. */
  salarioBruto: number;
  /** Cotización a cargo de la empresa por este puesto (32,15% del bruto). */
  ssEmpresa: number;
  /** Coste real del puesto: bruto + cotización de la empresa. */
  costeEmpresa: number;
  /** Retención de IRPF del puesto, en tanto por ciento. */
  irpfPct: number;
  irpfImporte: number;
  ssTrabajador: number;
  // Neto (interno): se conserva por compatibilidad con contratación/gestoría.
  nominaNeta: number;
  efectivoExtra: number;
  salarioNeto: number;
  jornadaContrato: string;
  horasSemanales: number;
  diasLibres: number;
  horarioSemanal: HorarioDia[];
  observaciones: string;
  estado: "activo" | "borrador" | "inactivo";
  updatedAt: string;
  /** El puesto ya tiene un cronograma operativo vinculado (uno por puesto). */
  tieneCronograma: boolean;
  // Datos de gestoría (compartidos por el puesto, comunes a todos los niveles)
  convenioColectivo: string;
  tipoContratoDefecto: string;
  // Departamento que valida las solicitudes de quien ocupe el puesto. Puede
  // aprobarlas cualquier empleado activo cuyo rol dé acceso a ese departamento.
  // Se hereda al empleado al contratar. `null` = sin definir.
  validadorDepartamentoId: string | null;
  /** Nombre para pintar el valor actual del selector sin re-fetch. */
  validadorDepartamentoNombre: string | null;
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
// `listPuestosEmpresa()` en rrhh/actions/puestos-actions.ts.

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

