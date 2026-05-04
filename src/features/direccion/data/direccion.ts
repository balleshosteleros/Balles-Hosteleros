export type AreaType = 'administrativa' | 'operativa';

// Normaliza valores antiguos (p. ej. 'externo' guardado en BD) al esquema actual
// de solo dos áreas. Cualquier valor desconocido cae en 'administrativa'.
export function normalizeArea(value: unknown): AreaType {
  return value === 'operativa' ? 'operativa' : 'administrativa';
}

// ── Paletas compartidas entre el editor (Dirección) y la vista del empleado.
// Cualquier cambio aquí se refleja en ambas vistas para mantenerlas idénticas.

export type DeptPalette = { bg: string; ring: string; shadow: string };

export const DEPT_COLORS: Record<string, DeptPalette> = {
  socios:        { bg: '#f59e0b', ring: '#fbbf24', shadow: 'rgba(245,158,11,0.35)' },
  direccion:     { bg: '#1e3a8a', ring: '#3b82f6', shadow: 'rgba(30,58,138,0.40)' },
  juridico:      { bg: '#4f46e5', ring: '#6366f1', shadow: 'rgba(79,70,229,0.35)' },
  gestoria:      { bg: '#0891b2', ring: '#06b6d4', shadow: 'rgba(8,145,178,0.35)' },
  contabilidad:  { bg: '#059669', ring: '#10b981', shadow: 'rgba(5,150,105,0.35)' },
  calidad:       { bg: '#0d9488', ring: '#14b8a6', shadow: 'rgba(13,148,136,0.35)' },
  marketing:     { bg: '#db2777', ring: '#ec4899', shadow: 'rgba(219,39,119,0.35)' },
  rrhh:          { bg: '#7c3aed', ring: '#8b5cf6', shadow: 'rgba(124,58,237,0.35)' },
  logistica:     { bg: '#ea580c', ring: '#f97316', shadow: 'rgba(234,88,12,0.35)' },
  gerencia:      { bg: '#e11d48', ring: '#f43f5e', shadow: 'rgba(225,29,72,0.35)' },
  seguridad:     { bg: '#334155', ring: '#475569', shadow: 'rgba(51,65,85,0.40)' },
  artistas:      { bg: '#9333ea', ring: '#a855f7', shadow: 'rgba(147,51,234,0.35)' },
  'jefe-sala':   { bg: '#0ea5e9', ring: '#38bdf8', shadow: 'rgba(14,165,233,0.35)' },
  '2jefe-sala':  { bg: '#38bdf8', ring: '#7dd3fc', shadow: 'rgba(56,189,248,0.35)' },
  hostess:       { bg: '#ec4899', ring: '#f472b6', shadow: 'rgba(236,72,153,0.35)' },
  camareros:     { bg: '#3b82f6', ring: '#60a5fa', shadow: 'rgba(59,130,246,0.35)' },
  cachimberos:   { bg: '#c026d3', ring: '#d946ef', shadow: 'rgba(192,38,211,0.35)' },
  'jefe-cocina': { bg: '#dc2626', ring: '#ef4444', shadow: 'rgba(220,38,38,0.35)' },
  '2jefe-cocina':{ bg: '#ef4444', ring: '#f87171', shadow: 'rgba(239,68,68,0.35)' },
  cocineros:     { bg: '#f97316', ring: '#fb923c', shadow: 'rgba(249,115,22,0.35)' },
  office:        { bg: '#78716c', ring: '#a8a29e', shadow: 'rgba(120,113,108,0.35)' },
  limpieza:      { bg: '#16a34a', ring: '#22c55e', shadow: 'rgba(22,163,74,0.35)' },
  mantenimiento: { bg: '#ca8a04', ring: '#eab308', shadow: 'rgba(202,138,4,0.35)' },
};

export const FALLBACK_BY_AREA: Record<AreaType, DeptPalette> = {
  administrativa: { bg: '#475569', ring: '#64748b', shadow: 'rgba(71,85,105,0.35)' },
  operativa:      { bg: '#71717a', ring: '#a1a1aa', shadow: 'rgba(113,113,122,0.35)' },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lighten(hex: string, amount = 0.25): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(rgb.r))}${toHex(mix(rgb.g))}${toHex(mix(rgb.b))}`;
}

export function paletteFromColor(bg: string): DeptPalette {
  const rgb = hexToRgb(bg);
  const shadow = rgb
    ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`
    : "rgba(0,0,0,0.25)";
  return { bg, ring: lighten(bg, 0.25), shadow };
}

export function getDeptPalette(
  id: string,
  area: AreaType,
  customBg?: string,
): DeptPalette {
  if (customBg && hexToRgb(customBg)) return paletteFromColor(customBg);
  return DEPT_COLORS[id] ?? FALLBACK_BY_AREA[area] ?? FALLBACK_BY_AREA.administrativa;
}

// Paleta de colores preestablecidos para el selector de color.
export const DEPT_COLOR_SWATCHES: string[] = [
  "#1e3a8a", "#3b82f6", "#0ea5e9", "#06b6d4", "#0d9488",
  "#059669", "#16a34a", "#65a30d", "#ca8a04", "#f59e0b",
  "#ea580c", "#f97316", "#dc2626", "#e11d48", "#ec4899",
  "#db2777", "#c026d3", "#9333ea", "#7c3aed", "#6366f1",
  "#475569", "#334155", "#71717a", "#78716c", "#000000",
];

export type ZonePalette = { bg: string; border: string; label: string };

export const ZONE_COLORS: Record<AreaType, ZonePalette> = {
  administrativa: { bg: '#eef2ff', border: '#c7d2fe', label: '#4338ca' },
  operativa:      { bg: '#fff7ed', border: '#fed7aa', label: '#c2410c' },
};

export interface OrgNode {
  id: string;
  label: string;
  area: AreaType;
  x: number;
  y: number;
  descripcion?: string;
  color?: string;
}

export interface OrgEdge {
  id: string;
  source: string;
  target: string;
}

export interface AreaZone {
  id: string;
  label: string;
  area: 'administrativa' | 'operativa';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrgChart {
  nodes: OrgNode[];
  edges: OrgEdge[];
  zones: AreaZone[];
}

const habanaChart: OrgChart = {
  nodes: [
    // Área Administrativa
    { id: 'socios', label: 'SOCIOS', area: 'administrativa', x: 560, y: -60 },
    { id: 'direccion', label: 'DIRECCIÓN', area: 'administrativa', x: 560, y: 80 },
    { id: 'juridico', label: 'JURÍDICO', area: 'administrativa', x: 60, y: 200 },
    { id: 'gestoria', label: 'GESTORÍA', area: 'administrativa', x: 200, y: 200 },
    { id: 'contabilidad', label: 'CONTABILIDAD', area: 'administrativa', x: 350, y: 200 },
    { id: 'calidad', label: 'CALIDAD', area: 'administrativa', x: 500, y: 200 },
    { id: 'marketing', label: 'MARKETING', area: 'administrativa', x: 640, y: 200 },
    { id: 'rrhh', label: 'RR.HH', area: 'administrativa', x: 780, y: 200 },
    { id: 'logistica', label: 'LOGÍSTICA', area: 'administrativa', x: 920, y: 200 },
    { id: 'gerencia', label: 'GERENCIA', area: 'administrativa', x: 1060, y: 200 },
    // Área Operativa
    { id: 'seguridad', label: 'SEGURIDAD', area: 'operativa', x: 100, y: 400 },
    { id: 'artistas', label: 'ARTISTAS', area: 'operativa', x: 280, y: 400 },
    { id: 'jefe-sala', label: 'JEFE DE SALA', area: 'operativa', x: 480, y: 400 },
    { id: 'jefe-cocina', label: 'JEFE DE COCINA', area: 'operativa', x: 820, y: 400 },
    { id: 'limpieza', label: 'LIMPIEZA', area: 'operativa', x: 1020, y: 400 },
    { id: 'mantenimiento', label: 'MANTENIMIENTO', area: 'operativa', x: 1180, y: 400 },
    { id: '2jefe-sala', label: '2º JEFE DE SALA', area: 'operativa', x: 400, y: 520 },
    { id: 'hostess', label: 'HOSTESS', area: 'operativa', x: 580, y: 520 },
    { id: 'camareros', label: 'CAMAREROS', area: 'operativa', x: 320, y: 630 },
    { id: 'cachimberos', label: 'CACHIMBEROS', area: 'operativa', x: 500, y: 630 },
    { id: '2jefe-cocina', label: '2º JEFE DE COCINA', area: 'operativa', x: 760, y: 520 },
    { id: 'cocineros', label: 'COCINEROS', area: 'operativa', x: 760, y: 630 },
    { id: 'office', label: 'OFFICE', area: 'operativa', x: 930, y: 630 },
  ],
  edges: [
    { id: 'e1', source: 'socios', target: 'direccion' },
    { id: 'e2', source: 'direccion', target: 'juridico' },
    { id: 'e3', source: 'direccion', target: 'gestoria' },
    { id: 'e4', source: 'direccion', target: 'contabilidad' },
    { id: 'e5', source: 'direccion', target: 'calidad' },
    { id: 'e6', source: 'direccion', target: 'marketing' },
    { id: 'e7', source: 'direccion', target: 'rrhh' },
    { id: 'e8', source: 'direccion', target: 'gerencia' },
    { id: 'e9', source: 'direccion', target: 'logistica' },
    { id: 'e10', source: 'gerencia', target: 'seguridad' },
    { id: 'e11', source: 'gerencia', target: 'artistas' },
    { id: 'e12', source: 'gerencia', target: 'jefe-sala' },
    { id: 'e13', source: 'gerencia', target: 'jefe-cocina' },
    { id: 'e14', source: 'gerencia', target: 'limpieza' },
    { id: 'e15', source: 'gerencia', target: 'mantenimiento' },
    { id: 'e16', source: 'jefe-sala', target: '2jefe-sala' },
    { id: 'e17', source: 'jefe-sala', target: 'hostess' },
    { id: 'e18', source: '2jefe-sala', target: 'camareros' },
    { id: 'e19', source: '2jefe-sala', target: 'cachimberos' },
    { id: 'e20', source: 'jefe-cocina', target: '2jefe-cocina' },
    { id: 'e21', source: '2jefe-cocina', target: 'cocineros' },
    { id: 'e22', source: '2jefe-cocina', target: 'office' },
  ],
  zones: [
    { id: 'zone-admin', label: 'Área Administrativa', area: 'administrativa', x: -10, y: -90, width: 1250, height: 370 },
    { id: 'zone-oper', label: 'Área Operativa', area: 'operativa', x: 30, y: 340, width: 1280, height: 370 },
  ],
};

const bacanalChart: OrgChart = {
  nodes: [
    { id: 'socios', label: 'SOCIOS', area: 'administrativa', x: 460, y: -60 },
    { id: 'direccion', label: 'DIRECCIÓN', area: 'administrativa', x: 460, y: 80 },
    { id: 'contabilidad', label: 'CONTABILIDAD', area: 'administrativa', x: 180, y: 200 },
    { id: 'marketing', label: 'MARKETING', area: 'administrativa', x: 360, y: 200 },
    { id: 'rrhh', label: 'RR.HH', area: 'administrativa', x: 540, y: 200 },
    { id: 'gerencia', label: 'GERENCIA', area: 'administrativa', x: 720, y: 200 },
    { id: 'jefe-sala', label: 'JEFE DE SALA', area: 'operativa', x: 400, y: 400 },
    { id: 'jefe-cocina', label: 'JEFE DE COCINA', area: 'operativa', x: 700, y: 400 },
    { id: 'camareros', label: 'CAMAREROS', area: 'operativa', x: 320, y: 520 },
    { id: 'hostess', label: 'HOSTESS', area: 'operativa', x: 500, y: 520 },
    { id: 'cocineros', label: 'COCINEROS', area: 'operativa', x: 700, y: 520 },
  ],
  edges: [
    { id: 'e1', source: 'socios', target: 'direccion' },
    { id: 'e2', source: 'direccion', target: 'contabilidad' },
    { id: 'e3', source: 'direccion', target: 'marketing' },
    { id: 'e4', source: 'direccion', target: 'rrhh' },
    { id: 'e5', source: 'direccion', target: 'gerencia' },
    { id: 'e6', source: 'gerencia', target: 'jefe-sala' },
    { id: 'e7', source: 'gerencia', target: 'jefe-cocina' },
    { id: 'e8', source: 'jefe-sala', target: 'camareros' },
    { id: 'e9', source: 'jefe-sala', target: 'hostess' },
    { id: 'e10', source: 'jefe-cocina', target: 'cocineros' },
  ],
  zones: [
    { id: 'zone-admin', label: 'Área Administrativa', area: 'administrativa', x: 110, y: -90, width: 700, height: 370 },
    { id: 'zone-oper', label: 'Área Operativa', area: 'operativa', x: 250, y: 340, width: 530, height: 260 },
  ],
};

export const orgChartsPorEmpresa: Record<string, OrgChart> = {
  habana: habanaChart,
  bacanal: bacanalChart,
};
