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

const bacanalConfig: ConfigPartidas = {
  areas: ["COCINA", "BARRA"],
  partidas: ["FRIO + POSTRES", "FUEGOS + HORNO", "PLANCHA + FREIDORA"],
  categorias: [
    "PARA EMPEZAR",
    "DE LA TIERRA",
    "PARA VEGANOS",
    "DE LA MAR",
    "ARROCES",
    "PARA NIÑOS",
    "MOMENTOS DULCES",
  ],
  gruposMise: ["SECOS", "SALSAS", "CALIENTE", "CONGELADOR"],
  estados: ["activa", "inactiva", "en_revision"],
};

const bacanalPartidas: Partida[] = [
  {
    id: "b-p1",
    nombre: "FRIO + POSTRES",
    area: "COCINA",
    estado: "activa",
    creador: "emp-b1",
    fechaActualizacion: "2026-05-27",
    productos: [
      // PARA EMPEZAR
      { id: "bp1", nombre: "Ensaladilla rusa", categoria: "PARA EMPEZAR" },
      { id: "bp2", nombre: "Ensalada de burrata", categoria: "PARA EMPEZAR" },
      { id: "bp3", nombre: "Ensalada de tomate y ventresca", categoria: "PARA EMPEZAR" },
      { id: "bp4", nombre: "Ensalada César", categoria: "PARA EMPEZAR" },
      // DE LA TIERRA
      { id: "bp5", nombre: "Brioche de ternera", categoria: "DE LA TIERRA" },
      // DE LA MAR
      { id: "bp6", nombre: "Vieira flambeada con mayo kimchi", categoria: "DE LA MAR" },
      // MOMENTOS DULCES
      { id: "bp7", nombre: "Tiramisú", categoria: "MOMENTOS DULCES" },
      { id: "bp8", nombre: "Coulant de chocolate con helado de vainilla", categoria: "MOMENTOS DULCES" },
      { id: "bp9", nombre: "Tarta de queso", categoria: "MOMENTOS DULCES" },
      { id: "bp10", nombre: "Torrija con helado de vainilla", categoria: "MOMENTOS DULCES" },
    ],
    misEnPlace: [
      // SECOS
      { id: "bm1", nombre: "Polvo de aceituna negra", grupo: "SECOS" },
      { id: "bm2", nombre: "Tierra de galletas", grupo: "SECOS" },
      { id: "bm3", nombre: "Pan brioche racionado", grupo: "SECOS" },
      { id: "bm4", nombre: "Burrata", grupo: "SECOS" },
      { id: "bm5", nombre: "Huevas de tobiko", grupo: "SECOS" },
      { id: "bm6", nombre: "Cebollino picado", grupo: "SECOS" },
      { id: "bm7", nombre: "Tomate cherry", grupo: "SECOS" },
      { id: "bm8", nombre: "Cebolla encurtida", grupo: "SECOS" },
      { id: "bm9", nombre: "Cacao en polvo", grupo: "SECOS" },
      { id: "bm10", nombre: "Rúcula y canónigos", grupo: "SECOS" },
      { id: "bm11", nombre: "Picatostes", grupo: "SECOS" },
      { id: "bm12", nombre: "Lechuga romana", grupo: "SECOS" },
      { id: "bm13", nombre: "Pani puri", grupo: "SECOS" },
      { id: "bm14", nombre: "Ventresca", grupo: "SECOS" },
      { id: "bm15", nombre: "Pollo para ensalada César", grupo: "SECOS" },
      // SALSAS
      { id: "bm16", nombre: "Mayo de kimchi", grupo: "SALSAS" },
      { id: "bm17", nombre: "Aceite de albahaca", grupo: "SALSAS" },
      { id: "bm18", nombre: "Mayo de trufa", grupo: "SALSAS" },
      { id: "bm19", nombre: "Salsa César", grupo: "SALSAS" },
      // CALIENTE
      { id: "bm20", nombre: "Ternera melosa para brioche", grupo: "CALIENTE" },
      // CONGELADOR
      { id: "bm21", nombre: "Helado de vainilla", grupo: "CONGELADOR" },
    ],
  },
  {
    id: "b-p2",
    nombre: "FUEGOS + HORNO",
    area: "COCINA",
    estado: "activa",
    creador: "emp-b2",
    fechaActualizacion: "2026-05-27",
    productos: [
      // PARA EMPEZAR
      { id: "bp20", nombre: "Pan diamante", categoria: "PARA EMPEZAR" },
      { id: "bp21", nombre: "Tortilla trufada con huevo a baja temperatura", categoria: "PARA EMPEZAR" },
      // DE LA TIERRA
      { id: "bp22", nombre: "Costillas a baja temperatura", categoria: "DE LA TIERRA" },
      { id: "bp23", nombre: "Gyozas de pollo al curry con perlas de arroz", categoria: "DE LA TIERRA" },
      // PARA VEGANOS
      { id: "bp24", nombre: "Gyozas vegetales", categoria: "PARA VEGANOS" },
      { id: "bp25", nombre: "Coliflor con barbacoa asiática y salsa ranchera", categoria: "PARA VEGANOS" },
      // DE LA MAR
      { id: "bp26", nombre: "Mejillones al curry rojo", categoria: "DE LA MAR" },
      // ARROCES
      { id: "bp27", nombre: "Arroz con pollo", categoria: "ARROCES" },
      { id: "bp28", nombre: "Arroz con marisco", categoria: "ARROCES" },
      { id: "bp29", nombre: "Arroz negro con calamares", categoria: "ARROCES" },
      { id: "bp30", nombre: "Falso risotto con setas", categoria: "ARROCES" },
    ],
    misEnPlace: [
      // SECOS
      { id: "bm30", nombre: "Cebollino picado", grupo: "SECOS" },
      { id: "bm31", nombre: "Huevo a baja temperatura", grupo: "SECOS" },
      { id: "bm32", nombre: "Papel de arroz", grupo: "SECOS" },
      { id: "bm33", nombre: "Sésamo negro", grupo: "SECOS" },
      // SALSAS
      { id: "bm34", nombre: "Curry rojo", grupo: "SALSAS" },
      { id: "bm35", nombre: "Salsa barbacoa", grupo: "SALSAS" },
      { id: "bm36", nombre: "Salsa de curry", grupo: "SALSAS" },
      { id: "bm37", nombre: "Salsa ranchera", grupo: "SALSAS" },
      // CALIENTE
      { id: "bm38", nombre: "Sifón espuma de yema", grupo: "CALIENTE" },
      { id: "bm39", nombre: "Patata pochada para tortilla", grupo: "CALIENTE" },
      // CONGELADOR
      { id: "bm40", nombre: "Gyozas de pollo", grupo: "CONGELADOR" },
      { id: "bm41", nombre: "Gyozas vegetales", grupo: "CONGELADOR" },
      { id: "bm42", nombre: "Caldo de marisco", grupo: "CONGELADOR" },
      { id: "bm43", nombre: "Caldo de pollo", grupo: "CONGELADOR" },
    ],
  },
  {
    id: "b-p3",
    nombre: "PLANCHA + FREIDORA",
    area: "COCINA",
    estado: "activa",
    creador: "emp-b1",
    fechaActualizacion: "2026-05-27",
    productos: [
      // PARA EMPEZAR
      { id: "bp40", nombre: "Croquetas de jamón", categoria: "PARA EMPEZAR" },
      { id: "bp41", nombre: "Croquetas de carabineros", categoria: "PARA EMPEZAR" },
      { id: "bp42", nombre: "Torreznos con guacamole y pico de gallo", categoria: "PARA EMPEZAR" },
      { id: "bp43", nombre: "Alitas de pollo glaseadas en bbq asiática y mayo de ají amarillo", categoria: "PARA EMPEZAR" },
      { id: "bp44", nombre: "Huevos rotos con jamón", categoria: "PARA EMPEZAR" },
      { id: "bp45", nombre: "Huevos rotos con setas", categoria: "PARA EMPEZAR" },
      // DE LA TIERRA
      { id: "bp46", nombre: "Burguer Balles Hosteleros", categoria: "DE LA TIERRA" },
      { id: "bp47", nombre: "Burguer Bacanal 2.0", categoria: "DE LA TIERRA" },
      { id: "bp48", nombre: "Entraña con chimichurri", categoria: "DE LA TIERRA" },
      { id: "bp49", nombre: "Lomo bajo de frisona", categoria: "DE LA TIERRA" },
      { id: "bp50", nombre: "Cachopo con jamón y queso curado", categoria: "DE LA TIERRA" },
      { id: "bp51", nombre: "Bao de oreja con salsa brava", categoria: "DE LA TIERRA" },
      // PARA VEGANOS
      { id: "bp52", nombre: "Alcachofa con emulsión de ají amarillo", categoria: "PARA VEGANOS" },
      // DE LA MAR
      { id: "bp53", nombre: "Cazón en adobo con base de lechuga y wakame", categoria: "DE LA MAR" },
      // PARA NIÑOS
      { id: "bp54", nombre: "Menú infantil fingers de pollo", categoria: "PARA NIÑOS" },
      { id: "bp55", nombre: "Menú infantil huevos con jamón", categoria: "PARA NIÑOS" },
    ],
    misEnPlace: [
      // SECOS
      { id: "bm50", nombre: "Pico de gallo", grupo: "SECOS" },
      { id: "bm51", nombre: "Polvo de cacahuete", grupo: "SECOS" },
      { id: "bm52", nombre: "Lima", grupo: "SECOS" },
      { id: "bm53", nombre: "Anacardo picado", grupo: "SECOS" },
      { id: "bm54", nombre: "Queso de cabra", grupo: "SECOS" },
      { id: "bm55", nombre: "Queso curado", grupo: "SECOS" },
      { id: "bm56", nombre: "Rúcula", grupo: "SECOS" },
      { id: "bm57", nombre: "Torreznos", grupo: "SECOS" },
      { id: "bm58", nombre: "Tomate cherry asado", grupo: "SECOS" },
      { id: "bm59", nombre: "Cilantro y hierbabuena picado", grupo: "SECOS" },
      // SALSAS
      { id: "bm60", nombre: "Salsa brava", grupo: "SALSAS" },
      { id: "bm61", nombre: "Chimichurri", grupo: "SALSAS" },
      { id: "bm62", nombre: "Mayo de trufa", grupo: "SALSAS" },
      { id: "bm63", nombre: "Mayo de chipotle", grupo: "SALSAS" },
      { id: "bm64", nombre: "Guacamole", grupo: "SALSAS" },
      { id: "bm65", nombre: "Emulsión de ají amarillo", grupo: "SALSAS" },
      // CONGELADOR
      { id: "bm66", nombre: "Pan bao", grupo: "CONGELADOR" },
    ],
  },
];

// ─── Data access ────────────────────────────────────────────────

const dataByEmpresa: Record<string, { partidas: Partida[]; config: ConfigPartidas }> = {
  habana: { partidas: habanaPartidas, config: { ...defaultConfig } },
  bacanal: { partidas: bacanalPartidas, config: bacanalConfig },
};

export function getPartidasByEmpresa(empresaId: string) {
  return dataByEmpresa[empresaId]?.partidas ?? [];
}

export function getConfigPartidas(empresaId: string): ConfigPartidas {
  return dataByEmpresa[empresaId]?.config ?? { ...defaultConfig };
}
