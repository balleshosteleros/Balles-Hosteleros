/**
 * Formatea una vigencia (cualquier combinación de campos en la regla o en
 * VigenciaSpec) en texto humano sentence-case, lista para mostrar en chips o
 * badges. Sin emojis.
 */

import {
  type EmpresaReservasRegla,
  type VigenciaSource,
  type VigenciaSpec,
  type DiaIsoDow,
  DIA_ISO_DOW_LABELS,
  DIA_ISO_DOW_LABELS_CORTOS,
} from "../data/reglas";

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function fechaCorta(iso: string): string {
  // "2026-06-09" → "9 jun 2026"
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

function fechaCortaSinAno(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

function mismoAno(a: string, b: string): boolean {
  return a.slice(0, 4) === b.slice(0, 4);
}

/**
 * Devuelve la vigencia en humano. Sentence case.
 *   - "Todos los días"
 *   - "Todos los viernes"
 *   - "Hoy"
 *   - "Del 1 de junio al 30 de septiembre 2026"
 *   - "9 jun 2026"
 *   - "9 jun, 16 jun, 23 jun 2026"
 */
export function vigenciaEnHumano(input: VigenciaSource | VigenciaSpec): string {
  // Caso VigenciaSpec (intencional)
  if ("modo" in input) {
    switch (input.modo) {
      case "siempre":       return "Todos los días";
      case "todos_los_dias": return "Todos los días";
      case "hoy":           return "Hoy";
      case "todos_los_dia": {
        if (!input.diaSemana) return "Día sin definir";
        return `Todos los ${DIA_ISO_DOW_LABELS[input.diaSemana].toLowerCase()}`;
      }
      case "rango": {
        if (!input.fechaDesde || !input.fechaHasta) return "Rango sin definir";
        return formatearRango(input.fechaDesde, input.fechaHasta);
      }
      case "fechas": {
        if (!input.fechas || input.fechas.length === 0) return "Sin fechas";
        return formatearListaFechas(input.fechas);
      }
    }
  }

  // Caso EmpresaReservasRegla (persistida)
  if (input.fechasExtra && input.fechasExtra.length > 0) {
    return formatearListaFechas(input.fechasExtra);
  }
  if (input.fechaDesde && input.fechaHasta) {
    return formatearRango(input.fechaDesde, input.fechaHasta);
  }
  if (input.diasSemana && input.diasSemana.length > 0) {
    if (input.diasSemana.length === 7) return "Todos los días";
    if (input.diasSemana.length === 1) {
      const d = input.diasSemana[0] as DiaIsoDow;
      return `Todos los ${DIA_ISO_DOW_LABELS[d].toLowerCase()}`;
    }
    return `Días ${input.diasSemana
      .map((d) => DIA_ISO_DOW_LABELS_CORTOS[d as DiaIsoDow])
      .join(", ")}`;
  }
  return "Todos los días";
}

function formatearRango(desde: string, hasta: string): string {
  if (desde === hasta) return fechaCorta(desde);
  if (mismoAno(desde, hasta)) {
    return `Del ${fechaCortaSinAno(desde)} al ${fechaCorta(hasta)}`;
  }
  return `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

function formatearListaFechas(fechas: string[]): string {
  if (fechas.length === 1) return fechaCorta(fechas[0]);
  const ordenadas = [...fechas].sort();
  const ultimoAno = ordenadas[ordenadas.length - 1].slice(0, 4);
  const todosMismoAno = ordenadas.every((f) => f.startsWith(ultimoAno));
  if (todosMismoAno) {
    const cabeza = ordenadas.slice(0, -1).map(fechaCortaSinAno).join(", ");
    return `${cabeza} y ${fechaCorta(ordenadas[ordenadas.length - 1])}`;
  }
  return ordenadas.map(fechaCorta).join(", ");
}

/**
 * Resumen del turno + valor + vigencia, listo para una línea de lista.
 * Ej: "100 personas · Comida · Todos los viernes"
 */
export function reglaEnHumano(r: EmpresaReservasRegla, unidad = "personas"): string {
  const turnoLabel = r.turno === "AMBOS" ? "Comida y cena" : r.turno === "COMIDA" ? "Comida" : "Cena";
  return `${r.valor} ${unidad} · ${turnoLabel} · ${vigenciaEnHumano(r)}`;
}
