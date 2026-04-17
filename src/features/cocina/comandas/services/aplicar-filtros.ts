import type { ComandaAgrupada, FiltrosComandas } from "../types";

/**
 * Filtra la lista de comandas por destino y partida.
 * Las líneas que no cumplen se excluyen; si una comanda queda sin líneas, se descarta.
 */
export function aplicarFiltros(
  comandas: ComandaAgrupada[],
  filtros: FiltrosComandas,
): ComandaAgrupada[] {
  const result: ComandaAgrupada[] = [];
  for (const c of comandas) {
    const lineasFiltradas = c.lineas.filter((l) => {
      if (filtros.destino !== "TODOS" && l.destino !== filtros.destino) return false;
      if (filtros.partidaId && l.partidaId !== filtros.partidaId) return false;
      return true;
    });
    if (lineasFiltradas.length === 0) continue;
    result.push({
      ...c,
      lineas: lineasFiltradas,
      total: lineasFiltradas.length,
      listos: lineasFiltradas.filter((l) => l.estadoCocina === "LISTO").length,
    });
  }
  return result;
}
