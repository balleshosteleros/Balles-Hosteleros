// Tipos del módulo Calidad → Cuestionarios (modelo BD).
// Estructura interna de bloques/preguntas/opciones se reutiliza desde data/cuestionarios.ts
// (mock legacy) porque el editor existente ya trabaja contra esa forma — viven ahora en JSONB.

import type {
  BloqueCuestionario,
  CategoriaCuestionario,
} from "@/features/calidad/data/cuestionarios";

export type EstadoCampana = "activa" | "cerrada" | "archivada";
export type EstadoReunion = "pendiente" | "realizada" | "cancelada" | "no_aplica";
export type EstadoPunto = "pendiente" | "en_curso" | "cerrado";
export type PeriodoSemestre = `${number}-S1` | `${number}-S2`;

export interface PlantillaCuestionario {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaCuestionario;
  duracionMinutos: number;
  intentosMax: number;
  notaCorte: number;
  mostrarResultados: boolean;
  aleatorizarPreguntas: boolean;
  mensajeInicial: string;
  mensajeAprobado: string;
  mensajeNoAprobado: string;
  bloques: BloqueCuestionario[];
  archivada: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampanaResumen {
  id: string;
  empresaId: string;
  plantillaId: string;
  plantillaNombre: string;
  periodo: string;
  periodoInicio: string;
  periodoFin: string;
  estado: EstadoCampana;
  createdAt: string;
  totalEnvios: number;
  envioRespondidos: number;
  envioReunionesHechas: number;
}

export interface EnvioFila {
  id: string;
  campanaId: string;
  empleadoId: string;
  empleadoNombre: string;
  empleadoPuesto: string | null;
  respondido: boolean;
  respondidoAt: string | null;
  reunionEstado: EstadoReunion;
  reunionFecha: string | null;
  reunionNotas: string | null;
  puntos: { id: string; texto: string; estado: EstadoPunto }[];
}

export interface EnvioCompleto extends EnvioFila {
  respuestas: Record<string, string | string[]> | null;
  puntuacion: number | null;
  notaSobre: number | null;
  aprobado: boolean | null;
}

export interface PuntoTimeline {
  id: string;
  envioId: string;
  empleadoId: string;
  empleadoNombre: string;
  texto: string;
  estado: EstadoPunto;
  createdAt: string;
  cerradoAt: string | null;
  campanaId: string;
  campanaPeriodo: string;
}

export interface CampanaDetalle {
  campana: CampanaResumen;
  envios: EnvioFila[];
}

// Helper: dado un año y semestre, calcular periodoInicio/Fin
export function rangoSemestre(periodo: string): { inicio: string; fin: string } {
  const [yearStr, semestre] = periodo.split("-");
  const year = Number(yearStr);
  if (semestre === "S1") {
    return { inicio: `${year}-01-01`, fin: `${year}-06-30` };
  }
  return { inicio: `${year}-07-01`, fin: `${year}-12-31` };
}

export function periodoActual(): string {
  const now = new Date();
  const year = now.getFullYear();
  const semestre = now.getMonth() < 6 ? "S1" : "S2";
  return `${year}-${semestre}`;
}

export function listadoPeriodos(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const periodos: string[] = [];
  for (let y = year + 1; y >= year - 2; y--) {
    periodos.push(`${y}-S2`);
    periodos.push(`${y}-S1`);
  }
  return periodos;
}
