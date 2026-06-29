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
  /** Precio de coste unitario (€), para valorar inventarios. */
  precioCoste?: number;
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

import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";

/**
 * Temporada activa para "hoy". PRP-069: el día se calcula en la zona horaria de
 * la empresa (`tz`), no en UTC del servidor. El llamador (server action) debe
 * resolver la zona con `getZonaHorariaEmpresa()` y pasarla aquí.
 */
export function getTemporadaActiva(temporadas: TemporadaStock[], tz: string): TemporadaStock | null {
  const hoy = hoyEnZona(tz);
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

// El stock y las temporadas reales se leen vía server actions
// (`listStock` / `listTemporadas`). Estos accesores quedan solo como
// compatibilidad de tipos y devuelven vacío (sin datos de demo).
export function getStockPorEmpresa(_empresaId: string): ProductoStock[] {
  return [];
}

export function getTemporadasPorEmpresa(_empresaId: string): TemporadaStock[] {
  return [];
}
