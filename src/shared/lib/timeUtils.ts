/**
 * Calculate human-readable elapsed time between two dates in Spanish.
 */
export function tiempoTranscurrido(desde: string, hasta: string): string {
  const d1 = new Date(desde);
  const d2 = new Date(hasta);
  const diffMs = d2.getTime() - d1.getTime();
  if (diffMs < 0) return "—";

  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (totalDays === 0) return "Hoy";
  if (totalDays === 1) return "1 día";

  const months = Math.floor(totalDays / 30);
  const weeks = Math.floor((totalDays % 30) / 7);
  const days = totalDays % 7;

  const parts: string[] = [];
  if (months > 0) parts.push(`${months} ${months === 1 ? "mes" : "meses"}`);
  if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? "semana" : "semanas"}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? "día" : "días"}`);

  return parts.join(" y ") || "Hoy";
}
