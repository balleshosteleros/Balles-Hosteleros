export type InformeTipo =
  | "descuentos"
  | "cancelaciones"
  | "inventarios"
  | "menu_ingeniering";

export const INFORME_TIPOS: { value: InformeTipo; label: string }[] = [
  { value: "descuentos", label: "Descuentos" },
  { value: "cancelaciones", label: "Cancelaciones" },
  { value: "inventarios", label: "Inventarios" },
  { value: "menu_ingeniering", label: "Menu Ingenering" },
];

export interface InformeRow {
  id: string;
  tipo: InformeTipo;
  fecha: string;
  importe: number;
  observaciones: string | null;
  storage_path: string | null;
  file_name: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  registrado_por: string | null;
  url: string | null;
  created_at: string;
}
