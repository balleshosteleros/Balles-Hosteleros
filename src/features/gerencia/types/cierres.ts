// Constantes compartidas del submódulo Cierres (Gerencia).
// Vive fuera de los server actions ("use server" solo puede exportar funciones async).

// Tope de documentos adjuntos por cierre/ingreso.
export const MAX_DOCUMENTOS_CIERRE = 3;

// Días de retraso admitidos por defecto para apuntar en Cierres.
// 0 = sin bloqueo. Configurable por empresa en Cierres → Configuración.
export const DIAS_BLOQUEO_DEFAULT = 3;

// Tope duro del plazo: nadie puede configurar más de 3 días de retraso.
// Apuntar cierres muy antiguos altera el efectivo acumulado de hoy (el saldo
// se recalcula en cadena), así que la ventana se queda corta a propósito.
export const DIAS_BLOQUEO_MAX = 3;

// Fecha mínima (yyyy-MM-dd) que se puede apuntar según el plazo.
// `null` = sin límite (plazo desactivado, dias = 0).
export function fechaMinimaApunte(hoy: string, dias: number): string | null {
  if (!Number.isFinite(dias) || dias <= 0) return null;
  const t = Date.parse(`${hoy}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return new Date(t - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Tamaño máximo por documento: fuente única compartida (50 MB) en
// `@/shared/lib/documentos`. La subida es directa al bucket (URL firmada),
// así que no aplica el límite de 4.5 MB de las Server Actions.
export { MAX_DOCUMENTO_MB as MAX_TAMANO_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES as MAX_TAMANO_DOCUMENTO_BYTES } from "@/shared/lib/documentos";
