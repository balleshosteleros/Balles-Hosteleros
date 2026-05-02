export type ToquePeriodo = "dia" | "semana" | "mes" | "trimestre" | "ano" | "historico";

export type CanjeEstado = "pendiente" | "aprobada" | "rechazada" | "disfrutada" | "anulada";

export type ReglaPeriodicidad = "diario" | "semanal" | "trimestral";

export type MovimientoOrigen = "regla" | "bonus_periodo" | "manual" | "canje" | "ajuste";

export type RecompensaTipo =
  | "hora_libre"
  | "dia_vacaciones"
  | "fin_semana"
  | "semana_vacaciones"
  | "regalo_anual_descriptivo"
  | "custom";

export interface Regla {
  id: string;
  empresaId: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  toques: number;
  periodicidad: ReglaPeriodicidad;
  activa: boolean;
}

export interface Nivel {
  id: string;
  empresaId: string;
  orden: number;
  nombre: string;
  toquesMin: number;
  badgeColor: string;
  badgeIcon: string | null;
}

export interface Recompensa {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string;
  costeToques: number;
  tipo: RecompensaTipo;
  activa: boolean;
  orden: number;
}

export interface Movimiento {
  id: string;
  empresaId: string;
  userId: string;
  empleadoNombre: string;
  toques: number;
  origen: MovimientoOrigen;
  reglaId: string | null;
  recompensaId: string | null;
  canjeId: string | null;
  periodo: Exclude<ToquePeriodo, "historico"> | null;
  fecha: string;
  motivo: string;
  contexto: Record<string, unknown>;
  otorgadoPor: string | null;
  createdAt: string;
}

export interface Canje {
  id: string;
  empresaId: string;
  userId: string;
  empleadoNombre: string;
  recompensaId: string;
  recompensaNombre: string;
  costeToques: number;
  estado: CanjeEstado;
  solicitadoAt: string;
  resueltoAt: string | null;
  resueltoPor: string | null;
  fechaDisfrute: string | null;
  notasSolicitud: string;
  notasRevision: string;
}

export interface Ganador {
  id: string;
  empresaId: string;
  periodo: Exclude<ToquePeriodo, "historico">;
  periodoInicio: string;
  periodoFin: string;
  userId: string;
  empleadoNombre: string;
  totalToques: number;
  bonusOtorgado: number;
  titulo: string | null;
  createdAt: string;
}

/**
 * Balance del usuario.
 * - acumulados: SOLO suma positivos. Dicta el nivel (no decrementa al canjear).
 * - canjeables: suma TODOS los movimientos (incluye negativos por canje aprobado). Saldo vivo.
 */
export interface Balance {
  empresaId: string;
  userId: string;
  toquesAcumulados: number;
  toquesCanjeables: number;
  ultimoMovimientoAt: string | null;
}

export interface RankingRow {
  userId: string;
  empleadoNombre: string;
  total: number;
  posicion: number;
  nivel: Nivel | null;
  avatarUrl: string | null;
  departamento: string | null;
}

export interface NivelProgreso {
  actual: Nivel | null;
  siguiente: Nivel | null;
  toquesActuales: number;
  toquesParaSiguiente: number;
  progresoPct: number;
}

export const PERIODO_LABEL: Record<ToquePeriodo, string> = {
  dia: "Hoy",
  semana: "Semana",
  mes: "Mes",
  trimestre: "Trimestre",
  ano: "Año",
  historico: "Histórico",
};

export const CANJE_ESTADO_LABEL: Record<CanjeEstado, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  disfrutada: "Disfrutada",
  anulada: "Anulada",
};

export const CANJE_ESTADO_COLOR: Record<CanjeEstado, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  aprobada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rechazada: "bg-rose-100 text-rose-800 border-rose-200",
  disfrutada: "bg-blue-100 text-blue-800 border-blue-200",
  anulada: "bg-slate-100 text-slate-700 border-slate-200",
};

export const ORIGEN_LABEL: Record<MovimientoOrigen, string> = {
  regla: "Regla automática",
  bonus_periodo: "Bonus periodo",
  manual: "Otorgado manual",
  canje: "Canje",
  ajuste: "Ajuste",
};

export const PERIODO_TITULO: Record<Exclude<ToquePeriodo, "historico" | "dia" | "semana">, string> = {
  mes: "Empleado del Mes",
  trimestre: "Empleado del Trimestre",
  ano: "Empleado del Año",
};

export const BONUS_PERIODO_TOQUES: Record<Exclude<ToquePeriodo, "historico">, number> = {
  dia: 5,
  semana: 15,
  mes: 50,
  trimestre: 150,
  ano: 500,
};
