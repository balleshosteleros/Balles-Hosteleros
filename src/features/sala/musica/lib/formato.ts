/** Formatos compartidos por las pantallas de música. */

/** Segundos → "m:ss". Devuelve "" si no se pudo leer la duración del archivo. */
export function formatearDuracion(seg: number): string {
  if (!seg || seg <= 0) return "";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
