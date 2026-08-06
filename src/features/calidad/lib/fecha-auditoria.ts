/**
 * `auditoria_envios.fecha` es una columna `date` (día natural, sin instante ni
 * zona). NO se formatea con `formatFechaEnZona`: esa utilidad convierte un
 * instante UTC a la zona de la empresa, y aplicada a "2026-04-26" —que JS
 * interpreta como medianoche UTC— desplazaría el día en cualquier zona por
 * detrás de UTC. Aquí se parte el texto tal cual, que es lo que se registró.
 */
export function formatFechaAuditoria(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  if (!anio || !mes || !dia) return "";
  return `${dia}/${mes}/${anio}`;
}
