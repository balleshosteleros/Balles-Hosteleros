import type { Plano } from "@/features/sala/planos/data/planos";

/**
 * Cascada de prioridad equivalente al resolver de reglas (PRP-050):
 *   1. plano con fecha en fechas_extra y que cubra el turno
 *   2. plano con [fecha_desde, fecha_hasta] que incluya la fecha y cubra turno
 *   3. plano con dias_semana que incluya el ISODOW del día y cubra turno
 *   4. plano principal (fallback)
 * Devuelve null si ninguno aplica.
 */
export function pickPlanoVigente(
  planos: Plano[],
  fechaISO: string,
  turno: "COMIDA" | "CENA",
): Plano | null {
  const cubre = (p: Plano) =>
    turno === "COMIDA" ? p.cubreComidas !== false : p.cubreCenas !== false;
  const isoDow = (() => {
    const d = new Date(fechaISO + "T00:00:00").getDay();
    return d === 0 ? 7 : d;
  })();
  const candidatos = planos.filter((p) => p.activo !== false && cubre(p));

  const conFechaExtra = candidatos.find((p) => p.fechasExtra && p.fechasExtra.includes(fechaISO));
  if (conFechaExtra) return conFechaExtra;

  const conRango = candidatos.find(
    (p) => p.fechaDesde && p.fechaHasta && fechaISO >= p.fechaDesde && fechaISO <= p.fechaHasta,
  );
  if (conRango) return conRango;

  const conDia = candidatos.find((p) => p.diasSemana && p.diasSemana.includes(isoDow));
  if (conDia) return conDia;

  return candidatos.find((p) => p.esPrincipal) ?? null;
}
