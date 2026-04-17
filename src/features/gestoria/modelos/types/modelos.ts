/**
 * Tipos del submódulo MODELOS (AEAT).
 * Fuente: PRP-030 + orden anual AEAT ejercicio 2026 (régimen general).
 */

export type ModeloTipo = "303" | "130" | "111" | "115" | "390" | "347";
export type ModeloPeriodo = "Q1" | "Q2" | "Q3" | "Q4" | "ANUAL";
export type ModeloEstado = "BORRADOR" | "REVISADO" | "PRESENTADO";
export type TipoAporte = "base" | "iva" | "retencion" | "cuota";
export type OrigenAsignacion = "ia" | "manual" | "regla";

export type CasillaValor = number;
export type CasillasMap = Record<string, CasillaValor>;

export interface ModeloAeat {
  id: string;
  empresa_id: string;
  tipo: ModeloTipo;
  periodo: ModeloPeriodo;
  ejercicio: number;
  estado: ModeloEstado;
  casillas: CasillasMap;
  snapshot_empresa: SnapshotEmpresa | null;
  fecha_presentacion: string | null;
  hash_snapshot: string | null;
  pdf_url: string | null;
  fichero_aeat_url: string | null;
  ia_corrida_en: string | null;
  ia_tokens_input: number | null;
  ia_tokens_output: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AsignacionModelo {
  id: string;
  modelo_id: string;
  factura_id: string;
  casilla: string;
  importe: number;
  tipo_aporte: TipoAporte;
  origen: OrigenAsignacion;
  confianza_ia: number | null;
  explicacion_ia: string | null;
  creada_por: string | null;
  created_at: string;
}

export interface ReglaCategorizacionIA {
  id: string;
  empresa_id: string;
  patron: {
    contacto_id?: string;
    concepto_contiene?: string;
    tipo_iva?: number;
    tipo_factura?: "COMPRA" | "VENTA";
  };
  modelo_tipo: ModeloTipo;
  casilla: string;
  activa: boolean;
  veces_aplicada: number;
  created_at: string;
}

export interface SnapshotEmpresa {
  razon_social: string;
  nif: string;
  direccion?: string;
  epigrafe_iae?: string;
  logo_url?: string;
  capturado_en: string;
}

export interface Epigrafe {
  codigo: string;
  etiqueta: string;
  descripcion: string;
  casillaBase?: string;
  casillaCuota?: string;
  casillaRetencion?: string;
  aplicaA: ("COMPRA" | "VENTA")[];
  tipoIva?: number | "cualquiera";
  palabrasClave?: string[];
}

export interface FacturaParaModelo {
  id: string;
  tipo: "COMPRA" | "VENTA";
  tipo_factura: string;
  contacto_id: string | null;
  contacto_nombre?: string;
  contacto_documento?: string;
  contacto_tipo?: "EMPRESA" | "AUTONOMO" | "PARTICULAR";
  fecha_emision: string;
  base_imponible: number;
  iva_pct: number;
  iva_importe: number;
  iva_deducible_pct: number;
  total: number;
  concepto: string;
  numero_factura: string;
}

export interface ResultadoCategorizacionIA {
  factura_id: string;
  casilla: string;
  tipo_aporte: TipoAporte;
  importe: number;
  confianza: number;
  explicacion: string;
}

export const PLAZOS_PRESENTACION: Record<
  ModeloTipo,
  Record<ModeloPeriodo, { mes: number; dia: number } | null>
> = {
  "303": {
    Q1: { mes: 4, dia: 20 },
    Q2: { mes: 7, dia: 20 },
    Q3: { mes: 10, dia: 20 },
    Q4: { mes: 1, dia: 30 },
    ANUAL: null,
  },
  "130": {
    Q1: { mes: 4, dia: 20 },
    Q2: { mes: 7, dia: 20 },
    Q3: { mes: 10, dia: 20 },
    Q4: { mes: 1, dia: 30 },
    ANUAL: null,
  },
  "111": {
    Q1: { mes: 4, dia: 20 },
    Q2: { mes: 7, dia: 20 },
    Q3: { mes: 10, dia: 20 },
    Q4: { mes: 1, dia: 20 },
    ANUAL: null,
  },
  "115": {
    Q1: { mes: 4, dia: 20 },
    Q2: { mes: 7, dia: 20 },
    Q3: { mes: 10, dia: 20 },
    Q4: { mes: 1, dia: 20 },
    ANUAL: null,
  },
  "390": {
    Q1: null,
    Q2: null,
    Q3: null,
    Q4: null,
    ANUAL: { mes: 1, dia: 30 },
  },
  "347": {
    Q1: null,
    Q2: null,
    Q3: null,
    Q4: null,
    ANUAL: { mes: 2, dia: 28 },
  },
};

export const MODELO_PERIODOS_VALIDOS: Record<ModeloTipo, ModeloPeriodo[]> = {
  "303": ["Q1", "Q2", "Q3", "Q4"],
  "130": ["Q1", "Q2", "Q3", "Q4"],
  "111": ["Q1", "Q2", "Q3", "Q4"],
  "115": ["Q1", "Q2", "Q3", "Q4"],
  "390": ["ANUAL"],
  "347": ["ANUAL"],
};

export const UMBRAL_MODELO_347 = 3005.06;
export const RETENCION_PROFESIONALES_PCT = 15;
export const RETENCION_PROFESIONALES_REDUCIDA_PCT = 7;
export const RETENCION_ALQUILERES_PCT = 19;

export function periodoALabel(periodo: ModeloPeriodo, ejercicio: number): string {
  if (periodo === "ANUAL") return `${ejercicio}`;
  return `${ejercicio}-${periodo}`;
}

export function periodoARangoFechas(
  periodo: ModeloPeriodo,
  ejercicio: number,
): { inicio: string; fin: string } {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const rangos: Record<ModeloPeriodo, [number, number, number, number]> = {
    Q1: [1, 1, 3, 31],
    Q2: [4, 1, 6, 30],
    Q3: [7, 1, 9, 30],
    Q4: [10, 1, 12, 31],
    ANUAL: [1, 1, 12, 31],
  };
  const [m1, d1, m2, d2] = rangos[periodo];
  return {
    inicio: `${ejercicio}-${pad(m1)}-${pad(d1)}`,
    fin: `${ejercicio}-${pad(m2)}-${pad(d2)}`,
  };
}
