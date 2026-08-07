/** Espejo de las tablas `qr_codigos` y `qr_destinos_historico`. */

export type EstadoQr = "ACTIVO" | "INACTIVO";

export interface CodigoQr {
  id: string;
  empresa_id: string;
  /** El código que viaja dentro del QR impreso. Único en todo el sistema. */
  codigo: string;
  nombre: string;
  descripcion: string | null;
  /** A dónde redirige ahora. Cambiarlo no invalida el papel impreso. */
  destino: string;
  estado: EstadoQr;
  escaneos: number;
  ultimo_escaneo_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DestinoHistorico {
  id: string;
  qr_id: string;
  destino: string;
  created_at: string;
}
