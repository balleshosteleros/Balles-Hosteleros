/** Periodos que ofrece el selector de la gráfica. */
export const RANGOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
  { dias: 365, label: "1 año" },
] as const;

/**
 * Resta días a una fecha ISO (aaaa-mm-dd) sobre el calendario, en UTC. Se
 * trabaja en UTC a propósito: la fecha de partida ya viene calculada en la zona
 * de la empresa, y volver a aplicar un huso aquí desplazaría el día en los
 * cambios de hora.
 */
export function restarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}
