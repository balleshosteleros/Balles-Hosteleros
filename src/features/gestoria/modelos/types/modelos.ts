/**
 * Tipos del submódulo MODELOS (AEAT).
 * Fuente: PRP-030 + orden anual AEAT ejercicio 2026 (régimen general).
 */

export type ModeloTipo =
  | "303"
  | "130"
  | "111"
  | "115"
  | "390"
  | "347"
  | "200"
  | "190"
  | "PYG"
  | "BALANCE"
  | "LIBRO_MAYOR";
export type ModeloPeriodo = "T1" | "T2" | "T3" | "T4" | "ANUAL";

/** Tipos que se generan/calculan dentro del software (tienen editor de casillas). */
export const TIPOS_CALCULABLES: ModeloTipo[] = ["303", "130", "111", "115", "390", "347"];
/** Tipos que solo son documento adjunto de la gestoría (sin editor). */
export const TIPOS_SOLO_DOCUMENTO: ModeloTipo[] = ["200", "190", "PYG", "BALANCE", "LIBRO_MAYOR"];

/** Etiqueta legible de cada tipo (los numéricos se muestran como "Modelo NNN"). */
export const MODELO_LABEL: Record<ModeloTipo, string> = {
  "303": "Modelo 303",
  "130": "Modelo 130",
  "111": "Modelo 111",
  "115": "Modelo 115",
  "390": "Modelo 390",
  "347": "Modelo 347",
  "200": "Modelo 200",
  "190": "Modelo 190",
  PYG: "Pérdidas y Ganancias",
  BALANCE: "Balance de Situación",
  LIBRO_MAYOR: "Libro Mayor",
};
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
  /**
   * Fecha en que se solicitó a la gestoría subir los documentos (null = no
   * solicitado). NO es una columna de `modelos_aeat`: se calcula al listar a
   * partir del token de subida activo del periodo (`gestoria_modelos_tokens`).
   */
  solicitud_gestoria_en?: string | null;
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
    T1: { mes: 4, dia: 20 },
    T2: { mes: 7, dia: 20 },
    T3: { mes: 10, dia: 20 },
    T4: { mes: 1, dia: 30 },
    ANUAL: null,
  },
  "130": {
    T1: { mes: 4, dia: 20 },
    T2: { mes: 7, dia: 20 },
    T3: { mes: 10, dia: 20 },
    T4: { mes: 1, dia: 30 },
    ANUAL: null,
  },
  "111": {
    T1: { mes: 4, dia: 20 },
    T2: { mes: 7, dia: 20 },
    T3: { mes: 10, dia: 20 },
    T4: { mes: 1, dia: 20 },
    ANUAL: null,
  },
  "115": {
    T1: { mes: 4, dia: 20 },
    T2: { mes: 7, dia: 20 },
    T3: { mes: 10, dia: 20 },
    T4: { mes: 1, dia: 20 },
    ANUAL: null,
  },
  "390": {
    T1: null,
    T2: null,
    T3: null,
    T4: null,
    ANUAL: { mes: 1, dia: 30 },
  },
  "347": {
    T1: null,
    T2: null,
    T3: null,
    T4: null,
    ANUAL: { mes: 2, dia: 28 },
  },
  // Modelo 200 (Impuesto de Sociedades): 25 de julio del año siguiente al ejercicio.
  "200": {
    T1: null,
    T2: null,
    T3: null,
    T4: null,
    ANUAL: { mes: 7, dia: 25 },
  },
  // Modelo 190 (resumen anual de retenciones IRPF): 31 de enero.
  "190": {
    T1: null,
    T2: null,
    T3: null,
    T4: null,
    ANUAL: { mes: 1, dia: 31 },
  },
  // Documentos contables (sin plazo AEAT propio): entran en el email anual junto al resto.
  PYG: { T1: null, T2: null, T3: null, T4: null, ANUAL: null },
  BALANCE: { T1: null, T2: null, T3: null, T4: null, ANUAL: null },
  LIBRO_MAYOR: { T1: null, T2: null, T3: null, T4: null, ANUAL: null },
};

export const MODELO_PERIODOS_VALIDOS: Record<ModeloTipo, ModeloPeriodo[]> = {
  "303": ["T1", "T2", "T3", "T4"],
  "130": ["T1", "T2", "T3", "T4"],
  "111": ["T1", "T2", "T3", "T4"],
  "115": ["T1", "T2", "T3", "T4"],
  "390": ["ANUAL"],
  "347": ["ANUAL"],
  "200": ["ANUAL"],
  "190": ["ANUAL"],
  PYG: ["ANUAL"],
  BALANCE: ["ANUAL"],
  LIBRO_MAYOR: ["ANUAL"],
};

export type GrupoModelo = "TRIMESTRALES" | "ANUALES";

/** Un modelo es trimestral si tiene algún periodo T válido; si solo aplica ANUAL, es anual. */
export function grupoDeModelo(tipo: ModeloTipo): GrupoModelo {
  return MODELO_PERIODOS_VALIDOS[tipo].includes("ANUAL") &&
    !MODELO_PERIODOS_VALIDOS[tipo].some((p) => p !== "ANUAL")
    ? "ANUALES"
    : "TRIMESTRALES";
}

/**
 * Combos por defecto que se aseguran al abrir un ejercicio.
 * Trimestrales: 303/130/111/115 × T1-T4. Anuales: 390/347/200/190/PYG/BALANCE/LIBRO_MAYOR.
 * PYG/BALANCE/LIBRO_MAYOR aparecen SIEMPRE como hueco anual aunque no haya PDF (PRP-072).
 */
export const COMBOS_MODELOS_DEFAULT: Array<{ tipo: ModeloTipo; periodo: ModeloPeriodo }> = [
  ...(["303", "130", "111", "115"] as ModeloTipo[]).flatMap((tipo) =>
    (["T1", "T2", "T3", "T4"] as ModeloPeriodo[]).map((periodo) => ({ tipo, periodo })),
  ),
  ...(["390", "347", "200", "190", "PYG", "BALANCE", "LIBRO_MAYOR"] as ModeloTipo[]).map(
    (tipo) => ({ tipo, periodo: "ANUAL" as ModeloPeriodo }),
  ),
];

export const UMBRAL_MODELO_347 = 3005.06;
export const RETENCION_PROFESIONALES_PCT = 15;
export const RETENCION_PROFESIONALES_REDUCIDA_PCT = 7;
export const RETENCION_ALQUILERES_PCT = 19;

/**
 * Fecha límite de presentación de un modelo/periodo (o null si no aplica).
 * El plazo de T4 y ANUAL cae en el año siguiente al ejercicio.
 */
export function fechaLimitePresentacion(
  tipo: ModeloTipo,
  periodo: ModeloPeriodo,
  ejercicio: number,
): Date | null {
  const plazo = PLAZOS_PRESENTACION[tipo][periodo];
  if (!plazo) return null;
  const añoPlazo = periodo === "T4" || periodo === "ANUAL" ? ejercicio + 1 : ejercicio;
  return new Date(añoPlazo, plazo.mes - 1, plazo.dia);
}

/**
 * Fecha límite del GRUPO para un periodo dado (la más temprana entre los tipos
 * del grupo que tengan plazo). Sirve para disparar el email a la gestoría.
 */
export function fechaLimiteGrupo(
  grupo: GrupoModelo,
  periodo: ModeloPeriodo,
  ejercicio: number,
): Date | null {
  const tipos = (Object.keys(MODELO_PERIODOS_VALIDOS) as ModeloTipo[]).filter(
    (t) => grupoDeModelo(t) === grupo && MODELO_PERIODOS_VALIDOS[t].includes(periodo),
  );
  const fechas = tipos
    .map((t) => fechaLimitePresentacion(t, periodo, ejercicio))
    .filter((d): d is Date => d !== null);
  if (fechas.length === 0) return null;
  return new Date(Math.min(...fechas.map((d) => d.getTime())));
}

/**
 * Ventana OFICIAL de presentación AEAT (régimen general) de un modelo/periodo:
 * fecha desde la que se PUEDE presentar (inicio) hasta la fecha límite (fin).
 *
 * Inicio oficial de cada ventana:
 *  · Trimestrales (303/111/130/115): el día 1 del mes siguiente al fin del
 *    trimestre (T1→1 abr, T2→1 jul, T3→1 oct, T4→1 ene del año siguiente).
 *  · 390 (resumen IVA) y 190 (resumen retenciones): del 1 al 30/31 de enero.
 *  · 347: del 1 al 28 de febrero.
 *  · 200 (Sociedades): del 1 al 25 de julio (los 25 primeros días naturales).
 *  · Documentos contables (PYG/BALANCE/LIBRO_MAYOR): sin ventana oficial AEAT.
 */
const INICIO_VENTANA: Record<ModeloPeriodo, { mes: number; dia: number } | null> = {
  T1: { mes: 4, dia: 1 },
  T2: { mes: 7, dia: 1 },
  T3: { mes: 10, dia: 1 },
  T4: { mes: 1, dia: 1 }, // año siguiente
  ANUAL: { mes: 1, dia: 1 }, // año siguiente (390/190); 347 y 200 se ajustan abajo
};

/**
 * Devuelve la ventana [inicio, fin] de presentación de un modelo/periodo para un
 * ejercicio, o null si el modelo no tiene ventana oficial (docs contables).
 */
export function ventanaPresentacion(
  tipo: ModeloTipo,
  periodo: ModeloPeriodo,
  ejercicio: number,
): { inicio: Date; fin: Date } | null {
  const fin = fechaLimitePresentacion(tipo, periodo, ejercicio);
  if (!fin) return null;
  const añoSiguiente = periodo === "T4" || periodo === "ANUAL";
  const añoVentana = añoSiguiente ? ejercicio + 1 : ejercicio;

  let ini = INICIO_VENTANA[periodo];
  // Ajustes de inicio para los anuales que no empiezan el 1 de enero.
  if (periodo === "ANUAL") {
    if (tipo === "347") ini = { mes: 2, dia: 1 }; // febrero
    else if (tipo === "200") ini = { mes: 7, dia: 1 }; // julio
    else ini = { mes: 1, dia: 1 }; // 390/190: enero
  }
  if (!ini) return null;
  const inicio = new Date(añoVentana, ini.mes - 1, ini.dia);
  return { inicio, fin };
}

/**
 * Estado VISUAL derivado de un modelo (lo que se pinta en la tarjeta).
 * Combina el estado persistido (PRESENTADO / solicitud a gestoría) con la
 * posición de HOY respecto a la ventana oficial de presentación.
 *
 * Prioridad:
 *  1. PRESENTADO  — ya presentado (verde, cerrado).
 *  2. SOLICITADO  — se ha pedido a la gestoría que suba los documentos (info).
 *  3. FUERA_PLAZO — pasó la fecha límite sin presentar (rojo).
 *  4. EN_PLAZO    — hoy está dentro de la ventana de presentación (ámbar).
 *  5. SIN_ABRIR   — aún no ha llegado el día en que se puede presentar (gris).
 *
 * Los modelos sin ventana oficial (docs contables) nunca están "en plazo":
 * caen a SIN_ABRIR salvo que estén presentados o solicitados.
 */
export type EstadoVisualModelo =
  | "PRESENTADO"
  | "SOLICITADO"
  | "FUERA_PLAZO"
  | "EN_PLAZO"
  | "SIN_ABRIR";

export const ESTADO_VISUAL_LABEL: Record<EstadoVisualModelo, string> = {
  PRESENTADO: "Presentado",
  SOLICITADO: "Solicitado a gestoría",
  FUERA_PLAZO: "Fuera de plazo",
  EN_PLAZO: "En plazo",
  SIN_ABRIR: "Sin abrir plazo",
};

export function estadoVisualModelo(
  modelo: Pick<
    ModeloAeat,
    "tipo" | "periodo" | "ejercicio" | "estado" | "solicitud_gestoria_en"
  >,
  hoy: Date = new Date(),
): EstadoVisualModelo {
  if (modelo.estado === "PRESENTADO") return "PRESENTADO";
  if (modelo.solicitud_gestoria_en) return "SOLICITADO";

  const ventana = ventanaPresentacion(modelo.tipo, modelo.periodo, modelo.ejercicio);
  if (!ventana) return "SIN_ABRIR";

  const t = hoy.getTime();
  if (t > ventana.fin.getTime()) return "FUERA_PLAZO";
  if (t >= ventana.inicio.getTime()) return "EN_PLAZO";
  return "SIN_ABRIR";
}

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
    T1: [1, 1, 3, 31],
    T2: [4, 1, 6, 30],
    T3: [7, 1, 9, 30],
    T4: [10, 1, 12, 31],
    ANUAL: [1, 1, 12, 31],
  };
  const [m1, d1, m2, d2] = rangos[periodo];
  return {
    inicio: `${ejercicio}-${pad(m1)}-${pad(d1)}`,
    fin: `${ejercicio}-${pad(m2)}-${pad(d2)}`,
  };
}
