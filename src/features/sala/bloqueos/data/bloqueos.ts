import type { ModoVigencia, TurnoRegla, VigenciaSpec } from "@/features/sala/reglas/data/reglas";

export interface ReservaBloqueo {
  id: string;
  empresaId: string;
  localId: string;
  modoVigencia: ModoVigencia;
  fechaDesde: string | null;
  fechaHasta: string | null;
  diasSemana: number[] | null;
  fechasExtra: string[] | null;
  turno: TurnoRegla;
  zonaIds: string[];
  mesaIds: string[];
  motivo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BloqueoInput {
  localId: string;
  vigencia: VigenciaSpec;
  turno: TurnoRegla;
  zonaIds: string[];
  mesaIds: string[];
  motivo?: string | null;
}

/** Devuelve true si la vigencia del bloqueo aplica al `fechaISO` indicado. */
export function vigenciaAplicaEnFecha(b: ReservaBloqueo, fechaISO: string): boolean {
  const isoDow = (() => {
    const d = new Date(fechaISO + "T00:00:00").getDay();
    return d === 0 ? 7 : d;
  })();
  switch (b.modoVigencia) {
    case "siempre":
      return true;
    case "hoy":
    case "fechas":
      return (b.fechasExtra ?? []).includes(fechaISO);
    case "todos_los_dia":
    case "todos_los_dias":
      return (b.diasSemana ?? []).includes(isoDow);
    case "rango":
      if (!b.fechaDesde || !b.fechaHasta) return false;
      return fechaISO >= b.fechaDesde && fechaISO <= b.fechaHasta;
    default:
      return false;
  }
}
