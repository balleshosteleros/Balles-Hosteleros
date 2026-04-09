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

export const ALMACENES_INVENTARIO = ["COCINA", "BARRA"];

// Precios de coste por producto (simulado)
export const PRECIOS_COSTE: Record<string, number> = {
  "st-h1": 18.50, "st-h2": 5.20, "st-h3": 14.00, "st-h4": 2.10,
  "st-h5": 8.50, "st-h6": 3.80, "st-h7": 4.20, "st-h8": 12.00,
  "st-h9": 9.50, "st-h10": 2.30, "st-h11": 1.80, "st-h12": 35.00,
  "st-b1": 22.00, "st-b2": 65.00, "st-b3": 35.00, "st-b4": 420.00,
  "st-b5": 45.00, "st-b6": 1800.00, "st-b7": 28.00, "st-b8": 120.00,
};

// ─── Default tipos ────────────────────────────────────────

const defaultTipos = (empresaId: string): TipoInventario[] => [
  { id: `tipo-${empresaId}-1`, nombre: "Inventario inicial", empresaId },
  { id: `tipo-${empresaId}-2`, nombre: "Inventario semanal", empresaId },
  { id: `tipo-${empresaId}-3`, nombre: "Inventario mensual", empresaId },
  { id: `tipo-${empresaId}-4`, nombre: "Inventario de control", empresaId },
  { id: `tipo-${empresaId}-5`, nombre: "Inventario extraordinario", empresaId },
  { id: `tipo-${empresaId}-6`, nombre: "Inventario de cierre", empresaId },
];

const ALL_TIPOS: Record<string, TipoInventario[]> = {
  habana: defaultTipos("habana"),
  bacanal: defaultTipos("bacanal"),
};

export function getTiposPorEmpresa(empresaId: string): TipoInventario[] {
  return structuredClone(ALL_TIPOS[empresaId] || defaultTipos(empresaId));
}

// ─── Plantillas ───────────────────────────────────────────

const ALL_PLANTILLAS: Record<string, PlantillaInventario[]> = {
  habana: [
    {
      id: "plt-h1",
      nombre: "Plantilla cocina completa",
      empresaId: "habana",
      productosIds: ["st-h1", "st-h2", "st-h3", "st-h8", "st-h9", "st-h10", "st-h11"],
    },
    {
      id: "plt-h2",
      nombre: "Plantilla barra completa",
      empresaId: "habana",
      productosIds: ["st-h4", "st-h5", "st-h12"],
    },
  ],
  bacanal: [
    {
      id: "plt-b1",
      nombre: "Plantilla general Bacanal",
      empresaId: "bacanal",
      productosIds: ["st-b1", "st-b2", "st-b3", "st-b5"],
    },
  ],
};

export function getPlantillasPorEmpresa(empresaId: string): PlantillaInventario[] {
  return structuredClone(ALL_PLANTILLAS[empresaId] || []);
}

// ─── Mock inventarios ─────────────────────────────────────

const inventariosHabana: Inventario[] = [
  {
    id: "inv-h1",
    fecha: "2026-03-10",
    almacen: "COCINA",
    motivo: "Inventario mensual",
    estado: "Confirmado",
    usuario: "Carlos López",
    confirmadoAt: "2026-03-10T18:30:00",
    confirmadoPor: "Carlos López",
    empresaId: "habana",
    tipoId: "tipo-habana-3",
    conteos: [
      {
        id: "cnt-h1-1",
        nombre: "Conteo almacén",
        lineas: [
          { productoId: "st-h1", producto: "Solomillo de ternera", unidad: "kg", cantidadReal: 19 },
          { productoId: "st-h2", producto: "Aceite de oliva virgen extra", unidad: "L", cantidadReal: 45 },
          { productoId: "st-h3", producto: "Langostinos congelados", unidad: "kg", cantidadReal: 6 },
          { productoId: "st-h8", producto: "Queso manchego curado", unidad: "kg", cantidadReal: 12 },
          { productoId: "st-h9", producto: "Merluza fresca", unidad: "kg", cantidadReal: 5 },
        ],
      },
    ],
  },
  {
    id: "inv-h2",
    fecha: "2026-03-28",
    almacen: "BARRA",
    motivo: "Control puntual",
    estado: "Borrador",
    usuario: "Ana Martín",
    empresaId: "habana",
    conteos: [
      {
        id: "cnt-h2-1",
        nombre: "Conteo cocina",
        lineas: [
          { productoId: "st-h1", producto: "Solomillo de ternera", unidad: "kg", cantidadReal: 20 },
          { productoId: "st-h10", producto: "Tomates rama", unidad: "kg", cantidadReal: 16 },
          { productoId: "st-h11", producto: "Pan de hogaza", unidad: "ud", cantidadReal: 10 },
        ],
      },
    ],
  },
];

const inventariosBacanal: Inventario[] = [
  {
    id: "inv-b1",
    fecha: "2026-03-12",
    almacen: "COCINA",
    motivo: "Inventario mensual",
    estado: "Confirmado",
    usuario: "Pedro Sánchez",
    confirmadoAt: "2026-03-12T20:00:00",
    confirmadoPor: "Pedro Sánchez",
    empresaId: "bacanal",
    tipoId: "tipo-bacanal-3",
    conteos: [
      {
        id: "cnt-b1-1",
        nombre: "Conteo general",
        lineas: [
          { productoId: "st-b1", producto: "Entrecot madurado", unidad: "kg", cantidadReal: 35 },
          { productoId: "st-b2", producto: "Foie mi-cuit", unidad: "kg", cantidadReal: 2 },
          { productoId: "st-b3", producto: "Champagne Moët", unidad: "bot", cantidadReal: 16 },
          { productoId: "st-b5", producto: "Langosta viva", unidad: "kg", cantidadReal: 8 },
        ],
      },
    ],
  },
];

const ALL_INVENTARIOS: Record<string, Inventario[]> = {
  habana: inventariosHabana,
  bacanal: inventariosBacanal,
};

export function getInventariosPorEmpresa(empresaId: string): Inventario[] {
  return structuredClone(ALL_INVENTARIOS[empresaId] || []);
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
    const precioCoste = PRECIOS_COSTE[pid] || 0;
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
