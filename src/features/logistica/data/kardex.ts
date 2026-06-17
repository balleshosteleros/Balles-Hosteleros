// PRP-057: tipos y etiquetas del kardex de stock (fuente única).
// Capitalización sentence case (memoria feedback_capitalizacion_textos_ui).

export type TipoMovimiento = "entrada" | "salida";
export type DocumentoTipo = "albaran" | "pos_ticket" | "inventario" | "merma" | "ajuste";

export interface StockMovimiento {
  id: string;
  empresa_id: string;
  producto_id: string;
  fecha: string;
  tipo: TipoMovimiento;
  cantidad: number;
  signo: 1 | -1;
  saldo_resultante: number;
  referencia: string | null;
  documento_tipo: DocumentoTipo;
  documento_id: string | null;
  origen_linea_id: string | null;
  motivo: string | null;
  created_at: string;
  created_by: string | null;
}

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  entrada: "Entrada",
  salida: "Salida",
};

export const DOCUMENTO_TIPO_LABEL: Record<DocumentoTipo, string> = {
  albaran: "Compra",
  pos_ticket: "Venta",
  inventario: "Inventario",
  merma: "Merma",
  ajuste: "Ajuste",
};

export function signoDeTipo(tipo: TipoMovimiento): 1 | -1 {
  return tipo === "entrada" ? 1 : -1;
}
