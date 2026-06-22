// Auditorías de departamento (Dirección) — fuente única de tipos, etiquetas y
// colores. Lo consumen tanto las server actions como la UI. Los valores de
// texto deben coincidir con los CHECK de la migración
// 20260622180000_direccion_auditorias.sql.

export type AuditoriaEstado = "borrador" | "cerrada";
export type AuditoriaValoracion = "bien" | "regular" | "atencion";

export type PuntoTipo = "incidencia" | "notificacion" | "problematica" | "mejora";
export type PuntoSeveridad = "baja" | "media" | "alta";
export type PuntoEstado = "abierto" | "en_curso" | "resuelto";

export interface AuditoriaPunto {
  id: string;
  auditoria_id: string;
  tipo: PuntoTipo;
  titulo: string;
  descripcion: string;
  severidad: PuntoSeveridad;
  estado: PuntoEstado;
  responsable: string;
  orden: number;
}

export interface Auditoria {
  id: string;
  departamento_id: string;
  departamento_nombre: string;
  periodo: string; // 'YYYY-MM'
  valoracion: AuditoriaValoracion | null;
  fecha_reunion: string | null; // 'YYYY-MM-DD'
  notas_reunion: string;
  estado: AuditoriaEstado;
  // Resumen de puntos (lo calcula la action para la lista).
  total_puntos: number;
  puntos_abiertos: number;
}

// ─── Valoración global del mes ───────────────────────────────────────────────
export const VALORACION_META: Record<
  AuditoriaValoracion,
  { label: string; dot: string; badge: string }
> = {
  bien:     { label: "Bien",     dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  regular:  { label: "Regular",  dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200" },
  atencion: { label: "Atención", dot: "bg-rose-500",    badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const VALORACION_OPCIONES: AuditoriaValoracion[] = ["bien", "regular", "atencion"];

// ─── Tipos de punto ──────────────────────────────────────────────────────────
export const TIPO_META: Record<
  PuntoTipo,
  { label: string; plural: string; badge: string; bar: string }
> = {
  incidencia:   { label: "Incidencia",   plural: "Incidencias",   badge: "bg-rose-50 text-rose-700 border-rose-200",       bar: "bg-rose-400" },
  notificacion: { label: "Notificación", plural: "Notificaciones", badge: "bg-sky-50 text-sky-700 border-sky-200",          bar: "bg-sky-400" },
  problematica: { label: "Problemática", plural: "Problemáticas",  badge: "bg-amber-50 text-amber-700 border-amber-200",    bar: "bg-amber-400" },
  mejora:       { label: "Mejora",       plural: "Mejoras",        badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-400" },
};

export const TIPO_OPCIONES: PuntoTipo[] = ["incidencia", "notificacion", "problematica", "mejora"];

export const SEVERIDAD_META: Record<PuntoSeveridad, { label: string; badge: string }> = {
  baja:  { label: "Baja",  badge: "bg-slate-50 text-slate-600 border-slate-200" },
  media: { label: "Media", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  alta:  { label: "Alta",  badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const PUNTO_ESTADO_META: Record<PuntoEstado, { label: string; badge: string }> = {
  abierto:  { label: "Abierto",  badge: "bg-rose-50 text-rose-700 border-rose-200" },
  en_curso: { label: "En curso", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  resuelto: { label: "Resuelto", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** 'YYYY-MM' → 'Junio 2026'. */
export function periodoLabel(periodo: string): string {
  const [anio, mes] = periodo.split("-");
  const idx = Number(mes) - 1;
  if (idx < 0 || idx > 11) return periodo;
  return `${MESES[idx]} ${anio}`;
}
