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

// ─── Mock data ────────────────────────────────────────────

const stockHabana: ProductoStock[] = [
  { id: "st-h1", nombre: "Solomillo de ternera", categoria: "Carnes", unidad: "kg", stockMaximo: 50, stockSeguridad: 15, stockActual: 22, ultimoInventario: -3, ultimoInventarioFecha: "2026-03-10", empresaId: "habana" },
  { id: "st-h2", nombre: "Aceite de oliva virgen extra", categoria: "Aceites y Condimentos", unidad: "L", stockMaximo: 100, stockSeguridad: 20, stockActual: 45, ultimoInventario: 0, ultimoInventarioFecha: "2026-03-10", empresaId: "habana" },
  { id: "st-h3", nombre: "Langostinos congelados", categoria: "Congelados", unidad: "kg", stockMaximo: 30, stockSeguridad: 8, stockActual: 5, ultimoInventario: -2, ultimoInventarioFecha: "2026-03-08", empresaId: "habana" },
  { id: "st-h4", nombre: "Cerveza artesana IPA", categoria: "Bebidas", unidad: "ud", stockMaximo: 200, stockSeguridad: 50, stockActual: 120, ultimoInventario: 5, ultimoInventarioFecha: "2026-03-12", empresaId: "habana" },
  { id: "st-h5", nombre: "Vino Ribera del Duero", categoria: "Bebidas", unidad: "bot", stockMaximo: 60, stockSeguridad: 12, stockActual: 24, ultimoInventario: 0, ultimoInventarioFecha: "2026-03-12", empresaId: "habana" },
  { id: "st-h6", nombre: "Lejía industrial 5L", categoria: "Limpieza", unidad: "ud", stockMaximo: 40, stockSeguridad: 10, stockActual: 8, ultimoInventario: -1, ultimoInventarioFecha: "2026-03-05", empresaId: "habana" },
  { id: "st-h7", nombre: "Jabón desengrasante", categoria: "Limpieza", unidad: "ud", stockMaximo: 30, stockSeguridad: 8, stockActual: 18, ultimoInventario: 2, ultimoInventarioFecha: "2026-03-05", empresaId: "habana" },
  { id: "st-h8", nombre: "Queso manchego curado", categoria: "Lácteos", unidad: "kg", stockMaximo: 20, stockSeguridad: 5, stockActual: 12, ultimoInventario: 0, ultimoInventarioFecha: "2026-03-10", empresaId: "habana" },
  { id: "st-h9", nombre: "Merluza fresca", categoria: "Pescados", unidad: "kg", stockMaximo: 40, stockSeguridad: 10, stockActual: 3, ultimoInventario: -5, ultimoInventarioFecha: "2026-02-28", empresaId: "habana" },
  { id: "st-h10", nombre: "Tomates rama", categoria: "Frutas y Verduras", unidad: "kg", stockMaximo: 25, stockSeguridad: 8, stockActual: 15, ultimoInventario: 1, ultimoInventarioFecha: "2026-03-14", empresaId: "habana" },
  { id: "st-h11", nombre: "Pan de hogaza", categoria: "Panadería", unidad: "ud", stockMaximo: 30, stockSeguridad: 10, stockActual: 10, ultimoInventario: 0, ultimoInventarioFecha: "2026-03-14", empresaId: "habana" },
  { id: "st-h12", nombre: "Champagne Moët", categoria: "Bebidas", unidad: "bot", stockMaximo: 24, stockSeguridad: 6, stockActual: 4, ultimoInventario: -2, ultimoInventarioFecha: "2026-03-01", empresaId: "habana" },
];

const stockBacanal: ProductoStock[] = [
  { id: "st-b1", nombre: "Entrecot madurado", categoria: "Carnes", unidad: "kg", stockMaximo: 60, stockSeguridad: 20, stockActual: 35, ultimoInventario: 0, ultimoInventarioFecha: "2026-03-12", empresaId: "bacanal" },
  { id: "st-b2", nombre: "Foie mi-cuit", categoria: "Carnes", unidad: "kg", stockMaximo: 15, stockSeguridad: 3, stockActual: 2, ultimoInventario: -1, ultimoInventarioFecha: "2026-03-12", empresaId: "bacanal" },
  { id: "st-b3", nombre: "Champagne Moët", categoria: "Bebidas", unidad: "bot", stockMaximo: 36, stockSeguridad: 8, stockActual: 14, ultimoInventario: 2, ultimoInventarioFecha: "2026-03-10", empresaId: "bacanal" },
  { id: "st-b4", nombre: "Trufa negra", categoria: "Otros", unidad: "kg", stockMaximo: 5, stockSeguridad: 1, stockActual: 0.5, ultimoInventario: -0.3, ultimoInventarioFecha: "2026-03-08", empresaId: "bacanal" },
  { id: "st-b5", nombre: "Langosta viva", categoria: "Pescados", unidad: "kg", stockMaximo: 20, stockSeguridad: 5, stockActual: 8, ultimoInventario: 0, ultimoInventarioFecha: "2026-03-14", empresaId: "bacanal" },
  { id: "st-b6", nombre: "Caviar Beluga", categoria: "Otros", unidad: "kg", stockMaximo: 2, stockSeguridad: 0.5, stockActual: 0.3, ultimoInventario: -0.1, ultimoInventarioFecha: "2026-03-06", empresaId: "bacanal" },
  { id: "st-b7", nombre: "Aceite de trufa", categoria: "Aceites y Condimentos", unidad: "L", stockMaximo: 10, stockSeguridad: 2, stockActual: 6, ultimoInventario: 1, ultimoInventarioFecha: "2026-03-10", empresaId: "bacanal" },
  { id: "st-b8", nombre: "Vino Vega Sicilia", categoria: "Bebidas", unidad: "bot", stockMaximo: 12, stockSeguridad: 3, stockActual: 5, ultimoInventario: 0, ultimoInventarioFecha: "2026-03-12", empresaId: "bacanal" },
];

const ALL_STOCK: Record<string, ProductoStock[]> = {
  habana: stockHabana,
  bacanal: stockBacanal,
};

export function getStockPorEmpresa(empresaId: string): ProductoStock[] {
  return structuredClone(ALL_STOCK[empresaId] || []);
}

// ─── Temporadas mock ──────────────────────────────────────

const temporadasHabana: TemporadaStock[] = [
  {
    id: "temp-h1",
    nombre: "Verano",
    fechaInicio: "2026-06-01",
    fechaFin: "2026-08-31",
    empresaId: "habana",
    overrides: {
      "st-h3": { stockMaximo: 50, stockSeguridad: 15 },
      "st-h4": { stockMaximo: 300, stockSeguridad: 80 },
      "st-h10": { stockMaximo: 40, stockSeguridad: 15 },
    },
  },
  {
    id: "temp-h2",
    nombre: "Navidad",
    fechaInicio: "2026-12-15",
    fechaFin: "2027-01-06",
    empresaId: "habana",
    overrides: {
      "st-h1": { stockMaximo: 80, stockSeguridad: 25 },
      "st-h12": { stockMaximo: 48, stockSeguridad: 12 },
    },
  },
];

const temporadasBacanal: TemporadaStock[] = [
  {
    id: "temp-b1",
    nombre: "Temporada Alta",
    fechaInicio: "2026-06-15",
    fechaFin: "2026-09-15",
    empresaId: "bacanal",
    overrides: {
      "st-b1": { stockMaximo: 90, stockSeguridad: 30 },
      "st-b3": { stockMaximo: 60, stockSeguridad: 15 },
    },
  },
];

const ALL_TEMPORADAS: Record<string, TemporadaStock[]> = {
  habana: temporadasHabana,
  bacanal: temporadasBacanal,
};

export function getTemporadasPorEmpresa(empresaId: string): TemporadaStock[] {
  return structuredClone(ALL_TEMPORADAS[empresaId] || []);
}
