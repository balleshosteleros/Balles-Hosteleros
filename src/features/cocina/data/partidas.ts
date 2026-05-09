// ─── Types ──────────────────────────────────────────────────────

export type AreaPrincipal = "COCINA" | "BARRA";

export type EstadoPartida = "activa" | "inactiva" | "en_revision";

export const ESTADO_PARTIDA_LABELS: Record<EstadoPartida, string> = {
  activa: "Activa",
  inactiva: "Inactiva",
  en_revision: "En revisión",
};

export interface MisePlaceItem {
  id: string;
  nombre: string;
  grupo: string; // e.g. SECOS, SALSAS
}

export interface ProductoPartida {
  id: string;
  nombre: string;
  categoria: string;
  escandalloId?: string; // link to escandallos
}

export interface Partida {
  id: string;
  nombre: string;
  area: AreaPrincipal;
  estado: EstadoPartida;
  creador: string; // employee id
  fechaActualizacion: string;
  productos: ProductoPartida[];
  misEnPlace: MisePlaceItem[];
}

export interface ConfigPartidas {
  areas: string[];
  partidas: string[]; // names for quick reference
  categorias: string[];
  gruposMise: string[];
  estados: string[];
}

// ─── Default config ─────────────────────────────────────────────

const defaultConfig: ConfigPartidas = {
  areas: ["COCINA", "BARRA"],
  partidas: ["FRIO + POSTRES", "FUEGOS + HORNO", "PLANCHA + FREIDORA"],
  categorias: [
    "PARA EMPEZAR", "ARROCES", "PRA VEGANOS", "DE LA MAR",
    "DE LA TIERRA", "MOMENTOS DULCES", "PARA NIÑOS",
  ],
  gruposMise: ["SECOS", "SALSAS", "FRESCOS", "CONGELADOS"],
  estados: ["activa", "inactiva", "en_revision"],
};

// ─── HABANA data ────────────────────────────────────────────────

const habanaPartidas: Partida[] = [
  {
    id: "h-p1",
    nombre: "FRIO + POSTRES",
    area: "COCINA",
    estado: "activa",
    creador: "emp-h1",
    fechaActualizacion: "2026-04-01",
    productos: [
      { id: "hp1", nombre: "Ensaladilla rusa", categoria: "PARA EMPEZAR" },
      { id: "hp2", nombre: "Ensalada de burrata", categoria: "PARA EMPEZAR" },
      { id: "hp3", nombre: "Ensalada de tomate y ventresca", categoria: "PARA EMPEZAR" },
      { id: "hp4", nombre: "Ensalada César", categoria: "PARA EMPEZAR" },
      { id: "hp5", nombre: "Brioche de ternera", categoria: "DE LA TIERRA" },
      { id: "hp6", nombre: "Hummus con crudités", categoria: "PRA VEGANOS" },
      { id: "hp7", nombre: "Vieira flambeada con mayo kimchi", categoria: "DE LA MAR" },
      { id: "hp8", nombre: "Tiramisú casero", categoria: "MOMENTOS DULCES" },
      { id: "hp9", nombre: "Coulant de chocolate", categoria: "MOMENTOS DULCES" },
    ],
    misEnPlace: [
      { id: "hm1", nombre: "Polvo de aceituna negra", grupo: "SECOS" },
      { id: "hm2", nombre: "Tierra de galletas", grupo: "SECOS" },
      { id: "hm3", nombre: "Pan brioche racionado", grupo: "SECOS" },
      { id: "hm4", nombre: "Picatostes", grupo: "SECOS" },
      { id: "hm5", nombre: "Burrata", grupo: "FRESCOS" },
      { id: "hm6", nombre: "Huevas de tobiko", grupo: "FRESCOS" },
      { id: "hm7", nombre: "Cebollino picado", grupo: "FRESCOS" },
      { id: "hm8", nombre: "Tomate cherry", grupo: "FRESCOS" },
      { id: "hm9", nombre: "Cebolla encurtida", grupo: "FRESCOS" },
      { id: "hm10", nombre: "Rúcula y canónigos", grupo: "FRESCOS" },
      { id: "hm11", nombre: "Lechuga romana", grupo: "FRESCOS" },
      { id: "hm12", nombre: "Ventresca", grupo: "FRESCOS" },
      { id: "hm13", nombre: "Mayo de kimchi", grupo: "SALSAS" },
      { id: "hm14", nombre: "Aceite de albahaca", grupo: "SALSAS" },
      { id: "hm15", nombre: "Cacao en polvo", grupo: "SECOS" },
    ],
  },
  {
    id: "h-p2",
    nombre: "FUEGOS + HORNO",
    area: "COCINA",
    estado: "activa",
    creador: "emp-h2",
    fechaActualizacion: "2026-03-28",
    productos: [
      { id: "hp10", nombre: "Arroz meloso de bogavante", categoria: "ARROCES" },
      { id: "hp11", nombre: "Arroz negro con sepia", categoria: "ARROCES" },
      { id: "hp12", nombre: "Chuletón de vaca vieja", categoria: "DE LA TIERRA" },
      { id: "hp13", nombre: "Cordero al horno", categoria: "DE LA TIERRA" },
      { id: "hp14", nombre: "Lubina al horno", categoria: "DE LA MAR" },
    ],
    misEnPlace: [
      { id: "hm20", nombre: "Fumet de marisco", grupo: "SALSAS" },
      { id: "hm21", nombre: "Tinta de calamar", grupo: "SALSAS" },
      { id: "hm22", nombre: "Arroz bomba medido", grupo: "SECOS" },
      { id: "hm23", nombre: "Sofrito base", grupo: "SALSAS" },
      { id: "hm24", nombre: "Romero fresco", grupo: "FRESCOS" },
    ],
  },
  {
    id: "h-p3",
    nombre: "PLANCHA + FREIDORA",
    area: "COCINA",
    estado: "activa",
    creador: "emp-h1",
    fechaActualizacion: "2026-04-03",
    productos: [
      { id: "hp20", nombre: "Croquetas de jamón ibérico", categoria: "PARA EMPEZAR" },
      { id: "hp21", nombre: "Calamares a la andaluza", categoria: "DE LA MAR" },
      { id: "hp22", nombre: "Nuggets caseros", categoria: "PARA NIÑOS" },
      { id: "hp23", nombre: "Patatas bravas", categoria: "PARA EMPEZAR" },
    ],
    misEnPlace: [
      { id: "hm30", nombre: "Croquetas congeladas racionadas", grupo: "CONGELADOS" },
      { id: "hm31", nombre: "Calamares limpios racionados", grupo: "CONGELADOS" },
      { id: "hm32", nombre: "Salsa brava", grupo: "SALSAS" },
      { id: "hm33", nombre: "Alioli casero", grupo: "SALSAS" },
    ],
  },
];

// ─── BACANAL data ───────────────────────────────────────────────

const bacanalPartidas: Partida[] = [
  {
    id: "b-p1",
    nombre: "FRIO + POSTRES",
    area: "COCINA",
    estado: "activa",
    creador: "emp-b1",
    fechaActualizacion: "2026-03-30",
    productos: [
      { id: "bp1", nombre: "Tartar de atún rojo", categoria: "PARA EMPEZAR" },
      { id: "bp2", nombre: "Carpaccio de pulpo", categoria: "DE LA MAR" },
      { id: "bp3", nombre: "Poke bowl vegano", categoria: "PRA VEGANOS" },
      { id: "bp4", nombre: "Cheesecake de frutos rojos", categoria: "MOMENTOS DULCES" },
    ],
    misEnPlace: [
      { id: "bm1", nombre: "Atún rojo cortado en dados", grupo: "FRESCOS" },
      { id: "bm2", nombre: "Pulpo cocido laminado", grupo: "FRESCOS" },
      { id: "bm3", nombre: "Aguacate maduro", grupo: "FRESCOS" },
      { id: "bm4", nombre: "Salsa ponzu", grupo: "SALSAS" },
      { id: "bm5", nombre: "Sésamo tostado", grupo: "SECOS" },
    ],
  },
  {
    id: "b-p2",
    nombre: "FUEGOS + HORNO",
    area: "COCINA",
    estado: "activa",
    creador: "emp-b2",
    fechaActualizacion: "2026-04-02",
    productos: [
      { id: "bp10", nombre: "Paella de verduras", categoria: "ARROCES" },
      { id: "bp11", nombre: "Secreto ibérico a la brasa", categoria: "DE LA TIERRA" },
      { id: "bp12", nombre: "Berenjena asada con miso", categoria: "PRA VEGANOS" },
    ],
    misEnPlace: [
      { id: "bm10", nombre: "Caldo de verduras", grupo: "SALSAS" },
      { id: "bm11", nombre: "Pasta de miso", grupo: "SALSAS" },
      { id: "bm12", nombre: "Arroz calasparra medido", grupo: "SECOS" },
    ],
  },
  {
    id: "b-p3",
    nombre: "PLANCHA + FREIDORA",
    area: "COCINA",
    estado: "en_revision",
    creador: "emp-b1",
    fechaActualizacion: "2026-03-25",
    productos: [
      { id: "bp20", nombre: "Tempura de verduras", categoria: "PRA VEGANOS" },
      { id: "bp21", nombre: "Gambas al ajillo", categoria: "DE LA MAR" },
      { id: "bp22", nombre: "Mini hamburguesas", categoria: "PARA NIÑOS" },
    ],
    misEnPlace: [
      { id: "bm20", nombre: "Masa tempura preparada", grupo: "FRESCOS" },
      { id: "bm21", nombre: "Gambas peladas", grupo: "CONGELADOS" },
      { id: "bm22", nombre: "Ajo laminado", grupo: "FRESCOS" },
    ],
  },
];

// ─── Data access ────────────────────────────────────────────────

const dataByEmpresa: Record<string, { partidas: Partida[]; config: ConfigPartidas }> = {
  habana: { partidas: habanaPartidas, config: { ...defaultConfig } },
  bacanal: { partidas: bacanalPartidas, config: { ...defaultConfig } },
};

export function getPartidasByEmpresa(empresaId: string) {
  return dataByEmpresa[empresaId]?.partidas ?? [];
}

export function getConfigPartidas(empresaId: string): ConfigPartidas {
  return dataByEmpresa[empresaId]?.config ?? { ...defaultConfig };
}
