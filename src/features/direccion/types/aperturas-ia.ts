/**
 * Tipos del flujo "Rellenar con IA" para Aperturas (PRP-038).
 *
 * El borrador IA vive en cliente (useState). NO hay columna en BD.
 * Si en pruebas se ve que perder el draft al refrescar es bloqueante,
 * abrir PRP-039 con `ia_draft jsonb` en estudios_apertura.
 */
import type {
  DatosProyecto,
  BloqueLocal,
  ImagenMarcaEstudio,
  PropuestaGastronomica,
  BloqueOcupacion,
  EstructuraCostes,
  EstructuraFacturacion,
  LineaProcedencia,
  LineaDestino,
  LineaAmortizacion,
} from "@/features/direccion/data/aperturas";

/* Claves de bloque que aceptan relleno IA por pestaña. */
export type BloqueIAKey =
  | "datos"
  | "local"
  | "marca"
  | "gastronomia"
  | "ocupacion";

/* Bloques que SOLO se rellenan en modo "apertura completa" con opt-in
   (riesgo de alucinación financiera; el prompt los deja vacíos si no hay docs). */
export type BloqueIAFinancieroKey =
  | "costes"
  | "facturacion"
  | "procedencia"
  | "destinos"
  | "amortizacion";

export type BloqueIAAnyKey = BloqueIAKey | BloqueIAFinancieroKey;

/* Etiquetas legibles para UI / logs. */
export const BLOQUE_IA_LABELS: Record<BloqueIAAnyKey, string> = {
  datos: "Datos del proyecto",
  local: "Local",
  marca: "Imagen de marca",
  gastronomia: "Propuesta gastronómica",
  ocupacion: "Ocupación estimada",
  costes: "Costes",
  facturacion: "Facturación",
  procedencia: "Procedencia de la inversión",
  destinos: "Destino de la inversión",
  amortizacion: "Amortización",
};

/* Forma del draft devuelto por Gemini para cada bloque.
   Partial<> porque la IA puede dejar campos sin rellenar (null/0). */
export type DraftDatos = Partial<DatosProyecto>;
export type DraftLocal = {
  caracteristicas?: Partial<BloqueLocal["caracteristicas"]>;
  ubicacion?: Partial<BloqueLocal["ubicacion"]>;
};
export type DraftMarca = Partial<
  Omit<ImagenMarcaEstudio, "logoPath" | "logoUrl">
>;
export type DraftGastronomia = Partial<
  Omit<PropuestaGastronomica, "platos" | "categoriasVenta">
> & {
  platos?: Array<Omit<PropuestaGastronomica["platos"][number], "id" | "foto">>;
  categoriasVenta?: Array<
    Omit<NonNullable<PropuestaGastronomica["categoriasVenta"]>[number], "id">
  >;
};
export type DraftOcupacion = {
  escenarios?: Array<{
    nombre: string;
    matriz: Record<string, Record<string, number>>;
  }>;
};

/* Bloques financieros (opt-in, solo en modo "completa") */
export type DraftCostes = Partial<EstructuraCostes>;
export type DraftFacturacion = Partial<EstructuraFacturacion>;
export type DraftProcedencia = Array<Omit<LineaProcedencia, "id">>;
export type DraftDestinos = Array<Omit<LineaDestino, "id">>;
export type DraftAmortizacion = Array<Omit<LineaAmortizacion, "id">>;

/* Mapa exhaustivo bloque → forma del draft. */
export interface DraftIAEstudio {
  datos?: DraftDatos;
  local?: DraftLocal;
  marca?: DraftMarca;
  gastronomia?: DraftGastronomia;
  ocupacion?: DraftOcupacion;
  costes?: DraftCostes;
  facturacion?: DraftFacturacion;
  procedencia?: DraftProcedencia;
  destinos?: DraftDestinos;
  amortizacion?: DraftAmortizacion;
}

/* Estado en cliente del borrador IA por bloque (qué pesta\xC3\xB1as tienen propuesta pendiente). */
export type EstadoBorradorPorBloque = Partial<Record<BloqueIAAnyKey, true>>;

/* Input de las server actions IA.
 * `payloads` son archivos YA procesados por extraerDeArchivo() en cliente:
 * tabla (xlsx/csv) → server las serializa como texto al prompt;
 * binario (pdf/imagen) → server las pasa como attachments inline a Gemini. */
import type { PayloadExtraido } from "@/features/logistica/types/importador-ia";

export interface AnalizarRellenoIAInput {
  bloque: BloqueIAKey;
  prompt: string;
  payloads?: PayloadExtraido[];
}

export interface GenerarAperturaCompletaIAInput {
  prompt: string;
  payloads?: PayloadExtraido[];
  /** Si true, intenta rellenar costes/facturación (opt-in, default false en UI). */
  incluirCifrasFinancieras?: boolean;
}

/* Resultados que devuelven las server actions. */
export interface AnalizarRellenoIAResult {
  ok: boolean;
  draft?: DraftIAEstudio;
  tokens?: { input: number | null; output: number | null };
  modelo?: string;
  error?: string;
}

export interface GenerarAperturaCompletaIAResult {
  ok: boolean;
  drafts?: DraftIAEstudio;
  bloquesPropuestos?: BloqueIAAnyKey[];
  tokens?: { input: number | null; output: number | null };
  modelo?: string;
  error?: string;
}

/* Toda llamada IA registrada en ia_uso_log usa estos valores en `feature`. */
export const IA_FEATURE_RELLENO = "aperturas.relleno";
export const IA_FEATURE_COMPLETA = "aperturas.generacion_completa";
