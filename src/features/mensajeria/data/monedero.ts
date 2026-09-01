/**
 * Monedero de mensajería: tipos y formato del dinero.
 *
 * Todo el dinero viaja en CÉNTIMOS enteros. Los decimales en coma flotante
 * pierden precisión al sumarlos muchas veces, y un saldo que no cuadra al
 * céntimo es un saldo que nadie se cree.
 */

/** Canales de salida. El correo no entra aquí: es gratis y no consume saldo. */
export type CanalMensajeria = "WHATSAPP" | "SMS";

export type TipoMovimiento =
  /** El restaurante mete dinero. */
  | "RECARGA"
  /** Un mensaje enviado. */
  | "CONSUMO"
  /** Un envío que falló y se reintegra. */
  | "DEVOLUCION"
  /** Corrección manual desde admin, siempre con motivo. */
  | "AJUSTE";

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  RECARGA: "Recarga",
  CONSUMO: "Consumo",
  DEVOLUCION: "Devolución",
  AJUSTE: "Ajuste",
};

/** Estado del monedero de una empresa. */
export interface MonederoSaldo {
  saldoCents: number;
  /** Mensajes que aún caben con el saldo actual, por canal. */
  whatsappRestantes: number;
  smsRestantes: number;
}

/** Una línea del extracto. */
export interface MonederoMovimiento {
  id: string;
  tipo: TipoMovimiento;
  /** Positivo suma, negativo resta. */
  importeCents: number;
  saldoDespuesCents: number;
  concepto: string;
  /** Quién lo hizo. Null si fue el sistema (un envío automático). */
  usuarioNombre: string | null;
  creadoAt: string;
}

/** Precio de venta vigente por canal. */
export interface TarifasMensajeria {
  whatsappCents: number;
  smsCents: number;
}

/**
 * Saldo por debajo del cual se avisa al restaurante. En céntimos: 5 €.
 *
 * No es un número redondo por capricho — es aproximadamente lo que cuesta un
 * servicio de avisos, así que da margen para recargar sin quedarse cortado a
 * media noche.
 */
export const UMBRAL_SALDO_BAJO_CENTS = 500;

/**
 * Importes de recarga ofrecidos. Se muestran como botones para que recargar
 * sea un toque y no un formulario.
 */
export const IMPORTES_RECARGA_CENTS = [1000, 2000, 5000, 10000];

/**
 * Céntimos → "12,50 €". Coma decimal, que es como se escribe en español.
 */
export function formatearImporte(cents: number): string {
  return `${(cents / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/**
 * Cuántos mensajes caben con este saldo. Se redondea hacia abajo: prometer un
 * mensaje que no se puede pagar es peor que quedarse corto.
 */
export function mensajesRestantes(saldoCents: number, precioCents: number): number {
  if (precioCents <= 0) return 0;
  return Math.floor(saldoCents / precioCents);
}
