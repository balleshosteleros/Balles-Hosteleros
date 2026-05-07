/**
 * Tipos del submódulo Ventas (dashboard de ventas + Menu Engineering).
 * Se calculan en runtime a partir de pos_tickets COBRADOS + pos_ticket_lineas + productos.
 */

export type VentasPreset =
  | "hoy"
  | "ayer"
  | "ultimos7"
  | "ultimos30"
  | "mesActual"
  | "mesAnterior"
  | "anioActual"
  | "personalizado";

export type MenuClass = "ESTRELLA" | "CABALLO" | "ENIGMA" | "PERRO";

export interface VentasResumen {
  ingresos: number;
  tickets: number;
  comensales: number;
  ticketMedio: number;
  comensalMedio: number;
  costeTotal: number;
  margenTotal: number;
  margenPct: number;
}

export interface VentaDia {
  fecha: string;
  ingresos: number;
  tickets: number;
  comensales: number;
  ticketMedio: number;
}

export interface VentaProducto {
  productoId: string | null;
  nombre: string;
  categoria: string;
  familia: string | null;
  cantidad: number;
  ingresos: number;
  precioMedio: number;
  costeUnitario: number;
  margenUnitario: number;
  margenTotal: number;
  margenPct: number;
  popularidadPct: number;
  clasificacion: MenuClass;
}

export interface VentaCategoria {
  categoria: string;
  cantidad: number;
  ingresos: number;
  pct: number;
}

export interface VentaFamilia {
  familia: string;
  cantidad: number;
  ingresos: number;
  pct: number;
}

export interface VentasDashboard {
  rango: { from: string; to: string };
  resumen: VentasResumen;
  porDia: VentaDia[];
  porProducto: VentaProducto[];
  porCategoria: VentaCategoria[];
  porFamilia: VentaFamilia[];
}

export const MENU_CLASS_LABEL: Record<MenuClass, string> = {
  ESTRELLA: "Estrella",
  CABALLO: "Caballo de batalla",
  ENIGMA: "Enigma",
  PERRO: "Perro",
};

export const MENU_CLASS_HINT: Record<MenuClass, string> = {
  ESTRELLA: "Alta popularidad y alto margen. Mantener tal cual y darles visibilidad.",
  CABALLO: "Se vende mucho pero deja poco margen. Revisar coste, escandallo o subir precio.",
  ENIGMA: "Margen alto pero se vende poco. Reposicionar en carta, fotografiar o sugerir.",
  PERRO: "Baja popularidad y bajo margen. Candidatos a retirar o rediseñar.",
};
