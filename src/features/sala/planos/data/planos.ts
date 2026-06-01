/**
 * Tipos del módulo Planos de Mesas (PRP-048).
 *
 * Jerarquía: Local → (Salas, Zonas, Mesas) globales por local.
 * Los Planos son composiciones temporales que activan salas y posicionan mesas.
 */

export type TipoMesa = "BARRA" | "BAJA" | "MEDIA" | "ALTA";

export const TIPOS_MESA: TipoMesa[] = ["BARRA", "BAJA", "MEDIA", "ALTA"];

export const TIPO_MESA_LABELS: Record<TipoMesa, string> = {
  BARRA: "Barra",
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
};

/** Regex de validación de código de mesa: empieza por letra, hasta 6 chars alfanuméricos en mayúsculas. */
export const MESA_CODIGO_REGEX = /^[A-Z][A-Z0-9]{0,5}$/;

/**
 * Versión tolerante: acepta prefijos válidos durante el typing.
 * El error solo aparece cuando el campo pierde foco (onBlur).
 */
export const MESA_CODIGO_PREFIJO_REGEX = /^[A-Z]?[A-Z0-9]{0,5}$/;

/** Paleta de 10 colores pastel para zonas. */
export const COLORES_PASTEL_ZONAS = [
  "#FDE68A", // amarillo
  "#A7F3D0", // verde menta
  "#BFDBFE", // azul cielo
  "#FBCFE8", // rosa
  "#DDD6FE", // lavanda
  "#FED7AA", // melocotón
  "#A5F3FC", // cyan
  "#FECACA", // coral
  "#D9F99D", // lima
  "#E9D5FF", // morado claro
];

/** Paleta separada para marcas de combinaciones (no se solapa con zonas). */
export const COLORES_PASTEL_COMBINACIONES = [
  "#FB923C", // naranja
  "#22D3EE", // turquesa
  "#A78BFA", // violeta
  "#34D399", // esmeralda
  "#F472B6", // rosa fuerte
  "#FACC15", // amarillo dorado
  "#60A5FA", // azul
  "#F87171", // rojo coral
  "#4ADE80", // verde
  "#C084FC", // lila
];

export interface Sala {
  id: string;
  localId: string;
  nombre: string;
  orden: number;
  esPrincipal: boolean;
  createdAt: string;
}

export interface Zona {
  id: string;
  localId: string;
  salaId: string;
  nombre: string;
  colorPastel: string;
  visibleCliente: boolean;
  zonaPublicaId: string | null;
  ocultaTotal: boolean;
  orden: number;
  createdAt: string;
}

export type FormaMesa = "cuadrada" | "redonda" | "rectangular";

export const FORMAS_MESA: FormaMesa[] = ["cuadrada", "redonda", "rectangular"];

export const FORMA_MESA_LABELS: Record<FormaMesa, string> = {
  cuadrada: "Cuadrada",
  redonda: "Redonda",
  rectangular: "Rectangular",
};

export interface Mesa {
  id: string;
  localId: string;
  zonaId: string;
  codigo: string;
  capacidadMin: number;
  capacidadMax: number;
  tipo: TipoMesa;
  forma: FormaMesa;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Posición física de la mesa en el plano visual.
 * Vive directamente en `mesas.x/y/rotation` — el diseño es propiedad de la sala
 * (a través de la zona/mesa), no del plano. Un plano que use varias salas
 * combina los lienzos de cada sala usando estas mismas coordenadas.
 */
export interface MesaPosicion {
  mesaId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface TipoMesaConfig {
  id: string;
  localId: string;
  tipo: TipoMesa;
  visibleCliente: boolean;
  tipoPublico: TipoMesa | null;
  ocultaTotal: boolean;
}

export interface Plano {
  id: string;
  localId: string;
  nombre: string;
  esPrincipal: boolean;
  fechaDesde: string | null;
  fechaHasta: string | null;
  diasSemana: number[] | null;
  horaInicio: string | null;
  horaFin: string | null;
  cubreComidas: boolean;
  cubreCenas: boolean;
  fechasExtra: string[] | null;
  repetirAnual: boolean;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated usar `MesaPosicion`. Mantenido como alias para no romper imports. */
export type PlanoMesaPosicion = MesaPosicion;

export interface MesaCombinacion {
  id: string;
  localId: string;
  codigo: string;
  capacidadAuto: boolean;
  capacidadMin: number;
  capacidadMax: number;
  zonaId: string | null;
  tipo: TipoMesa | null;
  colorMarca: string;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MesaCombinacionComponente {
  combinacionId: string;
  mesaId: string;
  orden: number;
}

/** Local mínimo para selectores. */
export interface LocalMin {
  id: string;
  empresaId: string;
  nombre: string;
}

/** Decoración visual del editor de plano (no es una mesa). */
export type TipoDecoracion =
  | "maceta"
  | "planta_grande"
  | "pasillo"
  | "pared"
  | "puerta"
  | "escaleras"
  | "barra"
  | "columna"
  | "ventana"
  | "wc";

export const TIPOS_DECORACION: TipoDecoracion[] = [
  "maceta",
  "planta_grande",
  "pasillo",
  "pared",
  "puerta",
  "escaleras",
  "barra",
  "columna",
  "ventana",
  "wc",
];

export const TIPO_DECORACION_LABELS: Record<TipoDecoracion, string> = {
  maceta: "Maceta",
  planta_grande: "Planta grande",
  pasillo: "Pasillo",
  pared: "Pared",
  puerta: "Puerta",
  escaleras: "Escaleras",
  barra: "Barra",
  columna: "Columna",
  ventana: "Ventana",
  wc: "WC",
};

export interface SalaDecoracion {
  id: string;
  salaId: string;
  tipo: TipoDecoracion;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}
