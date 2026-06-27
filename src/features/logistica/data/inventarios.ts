import { type ProductoStock } from "./stock";

// ─── Types ────────────────────────────────────────────────

export type EstadoInventario = "Borrador" | "Confirmado";

export interface LineaConteo {
  productoId: string;
  producto: string;
  unidad: string;
  cantidadReal: number;
}

export interface Conteo {
  id: string;
  nombre: string;
  lineas: LineaConteo[];
}

export interface PlantillaInventario {
  id: string;
  nombre: string;
  empresaId: string;
  productosIds: string[]; // products that must be counted
}

export interface TipoInventario {
  id: string;
  nombre: string;
  empresaId: string;
}

export interface Inventario {
  id: string;
  fecha: string;
  almacen: string; // "COCINA" | "BARRA"
  motivo: string;
  estado: EstadoInventario;
  usuario: string;
  conteos: Conteo[];
  /** true cuando las líneas ya se cargaron desde BD (lazy en el detalle). */
  conteosCargados?: boolean;
  empresaId: string;
  confirmadoAt?: string;
  confirmadoPor?: string;
  plantillaId?: string; // if created from a plantilla
  tipoId?: string;
}

export interface ResultadoLinea {
  productoId: string;
  producto: string;
  unidad: string;
  stockTeorico: number;
  costeTeorico: number;
  stockReal: number;
  costeReal: number;
  precioCoste: number;
  diferenciaCantidad: number;
  diferenciaCoste: number;
}

export const ALMACENES_INVENTARIO = ["Cocina", "Barra"];

// Precios de coste por producto (se poblará con datos reales desde Supabase)
export const PRECIOS_COSTE: Record<string, number> = {};

// ─── Default tipos ────────────────────────────────────────
// Los tipos son configuración estándar, no "datos" — se mantienen.

const defaultTipos = (empresaId: string): TipoInventario[] => [
  { id: `tipo-${empresaId}-1`, nombre: "Inventario inicial", empresaId },
  { id: `tipo-${empresaId}-2`, nombre: "Inventario semanal", empresaId },
  { id: `tipo-${empresaId}-3`, nombre: "Inventario mensual", empresaId },
  { id: `tipo-${empresaId}-4`, nombre: "Inventario de control", empresaId },
  { id: `tipo-${empresaId}-5`, nombre: "Inventario extraordinario", empresaId },
  { id: `tipo-${empresaId}-6`, nombre: "Inventario de cierre", empresaId },
];

export function getTiposPorEmpresa(empresaId: string): TipoInventario[] {
  return defaultTipos(empresaId);
}

// ─── Accessors ────────────────────────────────────────────
// Datos reales vendrán de Supabase en próxima iteración.
// Vacío hasta que se migren los inventarios reales desde la antigua plataforma.

export function getPlantillasPorEmpresa(_empresaId: string): PlantillaInventario[] {
  return [];
}

export function getInventariosPorEmpresa(_empresaId: string): Inventario[] {
  return [];
}

// ─── Validación de plantilla ──────────────────────────────

export function validarPlantillaCompleta(
  inventario: Inventario,
  plantilla: PlantillaInventario | undefined
): { completa: boolean; faltantes: string[] } {
  if (!plantilla) return { completa: true, faltantes: [] };

  const contados = new Set<string>();
  for (const conteo of inventario.conteos) {
    for (const linea of conteo.lineas) {
      contados.add(linea.productoId);
    }
  }

  const faltantes = plantilla.productosIds.filter((pid) => !contados.has(pid));
  return { completa: faltantes.length === 0, faltantes };
}

// ─── Cálculo de resultados ────────────────────────────────

export function calcularResultados(
  inventario: Inventario,
  stockProducts: ProductoStock[]
): ResultadoLinea[] {
  const realMap: Record<string, number> = {};
  for (const conteo of inventario.conteos) {
    for (const linea of conteo.lineas) {
      realMap[linea.productoId] = (realMap[linea.productoId] || 0) + linea.cantidadReal;
    }
  }

  const productIds = new Set([
    ...stockProducts.map((p) => p.id),
    ...Object.keys(realMap),
  ]);

  const resultados: ResultadoLinea[] = [];
  for (const pid of productIds) {
    const sp = stockProducts.find((p) => p.id === pid);
    if (!sp) continue;
    const precioCoste = sp.precioCoste ?? PRECIOS_COSTE[pid] ?? 0;
    const stockTeorico = sp.stockActual;
    const stockReal = realMap[pid] ?? stockTeorico;
    const diferenciaCantidad = stockReal - stockTeorico;
    resultados.push({
      productoId: pid,
      producto: sp.nombre,
      unidad: sp.unidad,
      stockTeorico,
      costeTeorico: Math.round(stockTeorico * precioCoste * 100) / 100,
      stockReal,
      costeReal: Math.round(stockReal * precioCoste * 100) / 100,
      precioCoste,
      diferenciaCantidad,
      diferenciaCoste: Math.round(diferenciaCantidad * precioCoste * 100) / 100,
    });
  }
  return resultados;
}
