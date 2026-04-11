// ─── Types ────────────────────────────────────────────────

export interface ProductoStock {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stockMaximo: number;
  stockSeguridad: number;
  stockActual: number;
  ultimoInventario: number;
  ultimoInventarioFecha: string | null;
  empresaId: string;
}

export interface TemporadaStock {
  id: string;
  nombre: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;
  empresaId: string;
  /** Override de stock máximo y seguridad por producto id */
  overrides: Record<string, { stockMaximo: number; stockSeguridad: number }>;
}

export const CATEGORIAS_STOCK = [
  "Carnes", "Pescados", "Lácteos", "Bebidas", "Limpieza",
  "Frutas y Verduras", "Congelados", "Aceites y Condimentos", "Panadería", "Otros",
];

export const UNIDADES_STOCK = ["kg", "L", "ud", "bot", "caja", "pack"];

// ─── Helpers temporadas ───────────────────────────────────

export function getTemporadaActiva(temporadas: TemporadaStock[]): TemporadaStock | null {
  const hoy = new Date().toISOString().slice(0, 10);
  return temporadas.find((t) => t.fechaInicio <= hoy && t.fechaFin >= hoy) || null;
}

export function temporadasSolapan(
  nueva: { fechaInicio: string; fechaFin: string; id?: string },
  existentes: TemporadaStock[]
): boolean {
  return existentes.some((t) => {
    if (nueva.id && t.id === nueva.id) return false;
    return nueva.fechaInicio <= t.fechaFin && nueva.fechaFin >= t.fechaInicio;
  });
}

export function getStockConTemporada(
  producto: ProductoStock,
  temporadaActiva: TemporadaStock | null
): { stockMaximo: number; stockSeguridad: number; esTemporada: boolean } {
  if (temporadaActiva && temporadaActiva.overrides[producto.id]) {
    const ov = temporadaActiva.overrides[producto.id];
    return { stockMaximo: ov.stockMaximo, stockSeguridad: ov.stockSeguridad, esTemporada: true };
  }
  return { stockMaximo: producto.stockMaximo, stockSeguridad: producto.stockSeguridad, esTemporada: false };
}

// ─── Accessors ────────────────────────────────────────────
// Datos reales vendrán de Supabase en próxima iteración.
// Vacío hasta que se migren los stocks reales desde la antigua plataforma.

export function getStockPorEmpresa(_empresaId: string): ProductoStock[] {
  return [];
}

export function getTemporadasPorEmpresa(_empresaId: string): TemporadaStock[] {
  return [];
}
