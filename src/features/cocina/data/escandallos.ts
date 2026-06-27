// ─── Types ──────────────────────────────────────────────────────
export interface CategoriaEscandallo {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
}

export type EstadoEscandallo = "activa" | "borrador" | "archivada";

export const ESTADO_ESCANDALLO_LABELS: Record<EstadoEscandallo, string> = {
  activa: "Activa",
  borrador: "Borrador",
  archivada: "Archivada",
};

export const DEFAULT_ALERGENOS = [
  "Ninguno", "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes",
  "Soja", "Lácteos", "Frutos con cáscara", "Apio", "Mostaza", "Sésamo",
  "Sulfitos", "Altramuces", "Moluscos",
];

export const DEFAULT_RECOMENDACIONES = [
  "Ninguno", "Picante", "Para niños", "Veganos", "Platos Estrella",
  "Comer con las manos", "Comidas", "Cenas",
];

export const DEFAULT_PARTIDAS = [
  "Entrantes fríos/calientes", "Arroces", "Entrantes veganos",
  "Pescados principales", "Carnes principales", "Postres",
  "Menú infantil", "Pescados entrante", "Mariscos y pescados",
  "Platos veganos", "Carnes",
];

export const DEFAULT_MENAJE = [
  "Plato rectangular de pizarra", "Cazuela de barro individual",
  "Bowl de cerámica artesanal", "Fuente ovalada de cerámica blanca",
  "Plato llano de porcelana", "Plato hondo individual de porcelana",
  "Bandeja infantil de madera", "Paellera individual",
  "Tabla de madera de olivo", "Tabla de corte con canaleta",
  "Plato de postre con cuchara", "Cesta de mimbre con papel",
  "Bowl de bambú", "Aro de presentación en plato llano",
];

export interface ConfigEscandallos {
  alergenos: string[];
  partidas: string[];
  menaje: string[];
  recomendaciones: string[];
}


export interface IngredienteEscandallo {
  id: string;
  ingrediente: string;
  unidad: string;
  cantidad: number;
  // Vinculación opcional con un producto/elaboración de logística.
  // Se rellena al seleccionar del picker; permanece vacío si el
  // usuario escribe a mano.
  tipo?: "compra" | "elaboracion";
  productoId?: string;
  formato?: string;
  precio?: number;
  // % de merma (limpieza/cocción). Afecta al coste y se sincroniza a
  // producto_composicion.merma_pct al guardar.
  merma?: number;
  // Alérgenos hidratados desde productos.alergenos (vía JOIN).
  // Permite a la UI derivar los alérgenos del escandallo automáticamente
  // mostrando de qué ingrediente viene cada uno.
  alergenos?: string[];
}

export interface PasoElaboracion {
  id: string;
  titulo: string;
  instrucciones: string;
  // Data URL o URL pública del vídeo opcional del paso.
  // Pequeño (~140 px) para no saturar la vista.
  videoUrl?: string;
}

export interface DesgloseEconomico {
  id: string;
  ingrediente: string;
  cantidadUnidad: string;
  conversion: number;
  costeBruto: number;
  mermaPct: number;
  cantidadMerma: number;
  costeMerma: number;
  cantidadCosteoNeto: number;
  costeNeto: number;
}

export interface Escandallo {
  id: string;
  nombre: string;
  categoriaId: string;
  delicatessen: boolean;
  estado: EstadoEscandallo;
  fechaCreacion: string;
  fechaActualizacion: string;
  responsable: string;
  ingredientes: IngredienteEscandallo[];
  partida: string;
  elaboracion: string;            // Legacy: texto libre. Si hay `pasos`, no se muestra.
  pasos?: PasoElaboracion[];      // Elaboración estructurada por pasos.
  guarnicion: string;
  decoracion: string;
  menaje: string;
  presentacionMesa: string;
  presentacionFoto?: string;      // Foto opcional del emplatado (data-url o URL).
  alergenos: string[];
  recomendaciones: string[];
  pvp: number;
  costeTotal: number;
  desglose: DesgloseEconomico[];
  empresaId: string;
  // Producto de venta/elaboración asociado. Al guardar, la receta se
  // sincroniza a ese producto (producto_composicion). Vacío = no sincroniza.
  productoId?: string;
  foto?: string; // URL or data-url of main image
  shareToken?: string; // unique token for external sharing
  shareEnabled?: boolean; // whether share link is active
}

// ─── Default categories ────────────────────────────────────────
export const DEFAULT_CATEGORIAS: CategoriaEscandallo[] = [
  { id: "cat-1", nombre: "PARA EMPEZAR", orden: 1, activa: true },
  { id: "cat-2", nombre: "ARROCES", orden: 2, activa: true },
  { id: "cat-3", nombre: "PRA VEGANOS", orden: 3, activa: true },
  { id: "cat-4", nombre: "DE LA MAR", orden: 4, activa: true },
  { id: "cat-5", nombre: "DE LA TIERRA", orden: 5, activa: true },
  { id: "cat-6", nombre: "MOMENTOS DULCES", orden: 6, activa: true },
  { id: "cat-7", nombre: "PARA NIÑOS", orden: 7, activa: true },
];

// ─── Helpers ───────────────────────────────────────────────────
export function calcularMargen(pvp: number, coste: number): number {
  if (pvp <= 0) return 0;
  return Math.round(((pvp - coste) / pvp) * 100);
}

function desglose(ingrediente: string, cu: string, conv: number, bruto: number, merma: number): DesgloseEconomico {
  const cantMerma = bruto * (merma / 100);
  const costeMerma = bruto * (merma / 100);
  const neto = bruto - cantMerma;
  const costeNeto = bruto - costeMerma;
  return {
    id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ingrediente, cantidadUnidad: cu, conversion: conv,
    costeBruto: bruto, mermaPct: merma, cantidadMerma: +cantMerma.toFixed(2),
    costeMerma: +costeMerma.toFixed(2), cantidadCosteoNeto: +neto.toFixed(2), costeNeto: +costeNeto.toFixed(2),
  };
}

// ─── Sample data: HABANA ───────────────────────────────────────
const fichasHabana: Escandallo[] = [
  {
    id: "ft-h1", nombre: "Croquetas de Jamón Ibérico", categoriaId: "cat-1",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-01-10", fechaActualizacion: "2026-03-15",
    responsable: "Chef Carlos", empresaId: "habana",
    ingredientes: [
      { id: "i1", ingrediente: "Jamón ibérico", unidad: "g", cantidad: 200 },
      { id: "i2", ingrediente: "Harina", unidad: "g", cantidad: 80 },
      { id: "i3", ingrediente: "Leche entera", unidad: "ml", cantidad: 500 },
      { id: "i4", ingrediente: "Mantequilla", unidad: "g", cantidad: 60 },
      { id: "i5", ingrediente: "Huevo", unidad: "ud", cantidad: 2 },
      { id: "i6", ingrediente: "Pan rallado", unidad: "g", cantidad: 150 },
    ],
    partida: "Entrantes fríos/calientes",
    elaboracion: "Preparar bechamel espesa. Incorporar jamón picado muy fino. Enfriar en bandeja durante 4h mínimo. Formar croquetas, empanar en doble capa y freír a 180°C hasta dorar.",
    guarnicion: "Reducción de Pedro Ximénez",
    decoracion: "Virutas de jamón ibérico y cebollino fresco",
    menaje: "Plato rectangular de pizarra",
    presentacionMesa: "Servir caliente, 6 unidades por ración, en línea con salsa lateral",
    alergenos: ["Gluten", "Lácteos", "Huevos"],
    recomendaciones: ["Platos Estrella", "Comidas", "Cenas"],
    pvp: 14.50, costeTotal: 3.85,
    desglose: [
      desglose("Jamón ibérico", "200g", 1, 4.80, 5),
      desglose("Harina", "80g", 1, 0.12, 0),
      desglose("Leche entera", "500ml", 1, 0.45, 0),
      desglose("Mantequilla", "60g", 1, 0.54, 0),
    ],
  },
  {
    id: "ft-h2", nombre: "Arroz Meloso de Bogavante", categoriaId: "cat-2",
    delicatessen: true, estado: "activa", fechaCreacion: "2026-01-12", fechaActualizacion: "2026-04-01",
    responsable: "Chef Carlos", empresaId: "habana",
    ingredientes: [
      { id: "i10", ingrediente: "Bogavante", unidad: "g", cantidad: 400 },
      { id: "i11", ingrediente: "Arroz bomba", unidad: "g", cantidad: 200 },
      { id: "i12", ingrediente: "Fumet de marisco", unidad: "ml", cantidad: 600 },
      { id: "i13", ingrediente: "Tomate", unidad: "g", cantidad: 100 },
      { id: "i14", ingrediente: "Ajo", unidad: "ud", cantidad: 3 },
    ],
    partida: "Arroces",
    elaboracion: "Sofreír cabezas de bogavante para fumet. Hacer sofrito con ajo y tomate. Añadir arroz, nacar 2 min. Agregar fumet caliente progresivamente. Cocer 18 min. Colocar bogavante abierto encima los últimos 5 min.",
    guarnicion: "", decoracion: "Germinados y aceite de azafrán", menaje: "Cazuela de barro individual",
    presentacionMesa: "Servir en cazuela directamente del fuego con servilleta protectora",
    alergenos: ["Crustáceos", "Moluscos"],
    recomendaciones: ["Platos Estrella", "Comidas"],
    pvp: 28.00, costeTotal: 9.20,
    desglose: [
      desglose("Bogavante", "400g", 1, 12.00, 25),
      desglose("Arroz bomba", "200g", 1, 0.60, 0),
      desglose("Fumet", "600ml", 1, 1.80, 0),
    ],
  },
  {
    id: "ft-h3", nombre: "Bowl de Quinoa y Verduras", categoriaId: "cat-3",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-02-05", fechaActualizacion: "2026-03-28",
    responsable: "Chef Ana", empresaId: "habana",
    ingredientes: [
      { id: "i20", ingrediente: "Quinoa", unidad: "g", cantidad: 150 },
      { id: "i21", ingrediente: "Aguacate", unidad: "ud", cantidad: 1 },
      { id: "i22", ingrediente: "Tomate cherry", unidad: "g", cantidad: 80 },
      { id: "i23", ingrediente: "Edamame", unidad: "g", cantidad: 60 },
    ],
    partida: "Entrantes veganos",
    elaboracion: "Cocer quinoa 15 min. Enfriar. Montar bowl con quinoa base, aguacate laminado, tomates cherry, edamame y aliño de tahini-limón.",
    guarnicion: "Hummus casero", decoracion: "Semillas de sésamo y microgreens", menaje: "Bowl de cerámica artesanal",
    presentacionMesa: "Servir frío con cubiertos de madera",
    alergenos: ["Sésamo"],
    recomendaciones: ["Veganos", "Comidas"],
    pvp: 13.50, costeTotal: 3.10,
    desglose: [desglose("Quinoa", "150g", 1, 0.90, 0), desglose("Aguacate", "1ud", 1, 1.20, 10)],
  },
  {
    id: "ft-h4", nombre: "Lubina a la Sal", categoriaId: "cat-4",
    delicatessen: true, estado: "activa", fechaCreacion: "2026-01-20", fechaActualizacion: "2026-03-30",
    responsable: "Chef Carlos", empresaId: "habana",
    ingredientes: [
      { id: "i30", ingrediente: "Lubina fresca", unidad: "g", cantidad: 600 },
      { id: "i31", ingrediente: "Sal gruesa", unidad: "kg", cantidad: 2 },
      { id: "i32", ingrediente: "Clara de huevo", unidad: "ud", cantidad: 2 },
    ],
    partida: "Pescados principales",
    elaboracion: "Limpiar lubina sin escamar. Mezclar sal con claras. Cubrir lubina completamente con costra de sal. Hornear a 200°C durante 25 min. Romper costra en mesa.",
    guarnicion: "Patatas panaderas y verduras al vapor", decoracion: "Limón fresco y perejil", menaje: "Fuente ovalada de cerámica blanca",
    presentacionMesa: "Presentar entera en costra, romper delante del cliente",
    alergenos: ["Pescado", "Huevos"],
    recomendaciones: ["Platos Estrella", "Cenas"],
    pvp: 24.00, costeTotal: 7.50,
    desglose: [desglose("Lubina", "600g", 1, 9.00, 20), desglose("Sal gruesa", "2kg", 1, 0.80, 0)],
  },
  {
    id: "ft-h5", nombre: "Solomillo al Whisky", categoriaId: "cat-5",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-02-10", fechaActualizacion: "2026-04-02",
    responsable: "Chef Carlos", empresaId: "habana",
    ingredientes: [
      { id: "i40", ingrediente: "Solomillo de ternera", unidad: "g", cantidad: 250 },
      { id: "i41", ingrediente: "Whisky", unidad: "ml", cantidad: 50 },
      { id: "i42", ingrediente: "Nata", unidad: "ml", cantidad: 100 },
    ],
    partida: "Carnes principales",
    elaboracion: "Sellar solomillo a fuego fuerte. Flamear con whisky. Reservar. Hacer salsa con fondo de carne, nata y reducción de whisky. Napar.",
    guarnicion: "Patatas fritas caseras", decoracion: "Cebollino y pimienta rosa", menaje: "Plato llano de porcelana",
    presentacionMesa: "Cortar medallones delante del cliente, napar con salsa",
    alergenos: ["Lácteos"],
    recomendaciones: ["Cenas", "Platos Estrella"],
    pvp: 22.50, costeTotal: 6.80,
    desglose: [desglose("Solomillo", "250g", 1, 7.50, 12), desglose("Whisky", "50ml", 1, 1.20, 0)],
  },
  {
    id: "ft-h6", nombre: "Coulant de Chocolate", categoriaId: "cat-6",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-01-25", fechaActualizacion: "2026-03-20",
    responsable: "Chef Ana", empresaId: "habana",
    ingredientes: [
      { id: "i50", ingrediente: "Chocolate negro 70%", unidad: "g", cantidad: 150 },
      { id: "i51", ingrediente: "Mantequilla", unidad: "g", cantidad: 100 },
      { id: "i52", ingrediente: "Huevos", unidad: "ud", cantidad: 3 },
      { id: "i53", ingrediente: "Azúcar", unidad: "g", cantidad: 80 },
    ],
    partida: "Postres",
    elaboracion: "Fundir chocolate con mantequilla. Batir huevos con azúcar. Mezclar ambas preparaciones. Verter en moldes enmantecados. Hornear 12 min a 200°C.",
    guarnicion: "Helado de vainilla", decoracion: "Frutos rojos y menta fresca", menaje: "Plato hondo individual de porcelana",
    presentacionMesa: "Servir inmediatamente al sacar del horno, con helado al lado",
    alergenos: ["Gluten", "Lácteos", "Huevos"],
    recomendaciones: ["Platos Estrella", "Comidas", "Cenas"],
    pvp: 9.50, costeTotal: 2.40,
    desglose: [desglose("Chocolate 70%", "150g", 1, 2.10, 0), desglose("Mantequilla", "100g", 1, 0.90, 0)],
  },
  {
    id: "ft-h7", nombre: "Mini Hamburguesa con Patatas", categoriaId: "cat-7",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-02-20", fechaActualizacion: "2026-03-25",
    responsable: "Chef Ana", empresaId: "habana",
    ingredientes: [
      { id: "i60", ingrediente: "Carne picada ternera", unidad: "g", cantidad: 120 },
      { id: "i61", ingrediente: "Pan brioche mini", unidad: "ud", cantidad: 2 },
      { id: "i62", ingrediente: "Queso cheddar", unidad: "g", cantidad: 30 },
    ],
    partida: "Menú infantil",
    elaboracion: "Formar mini hamburguesas. Cocinar a la plancha. Montar con queso fundido en pan brioche tostado.",
    guarnicion: "Patatas fritas y ketchup casero", decoracion: "Banderita decorativa", menaje: "Bandeja infantil de madera",
    presentacionMesa: "Servir con pajita y jugo incluido",
    alergenos: ["Gluten", "Lácteos"],
    recomendaciones: ["Para niños", "Comidas"],
    pvp: 8.50, costeTotal: 2.10,
    desglose: [desglose("Carne picada", "120g", 1, 1.44, 5), desglose("Pan brioche", "2ud", 1, 0.60, 0)],
  },
  {
    id: "ft-h8", nombre: "Tataki de Atún Rojo", categoriaId: "cat-4",
    delicatessen: true, estado: "borrador", fechaCreacion: "2026-03-15", fechaActualizacion: "2026-04-03",
    responsable: "Chef Carlos", empresaId: "habana",
    ingredientes: [
      { id: "i70", ingrediente: "Atún rojo", unidad: "g", cantidad: 200 },
      { id: "i71", ingrediente: "Sésamo", unidad: "g", cantidad: 20 },
      { id: "i72", ingrediente: "Salsa ponzu", unidad: "ml", cantidad: 30 },
    ],
    partida: "Pescados entrante",
    elaboracion: "Sellar atún por todos los lados 10 seg cada cara. Enfriar en hielo. Cortar en láminas finas. Aliñar con ponzu y sésamo.",
    guarnicion: "Wakame y encurtidos", decoracion: "Flores comestibles", menaje: "Plato de pizarra rectangular",
    presentacionMesa: "Servir frío con palillos opcionales",
    alergenos: ["Pescado", "Sésamo", "Soja"],
    recomendaciones: ["Platos Estrella", "Cenas"],
    pvp: 18.00, costeTotal: 5.60,
    desglose: [desglose("Atún rojo", "200g", 1, 8.00, 15)],
  },
];

// ─── Sample data: BACANAL ──────────────────────────────────────
const fichasBacanal: Escandallo[] = [
  {
    id: "ft-b1", nombre: "Tartar de Salmón", categoriaId: "cat-1",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-01-18", fechaActualizacion: "2026-03-20",
    responsable: "Chef Marcos", empresaId: "bacanal",
    ingredientes: [
      { id: "bi1", ingrediente: "Salmón fresco", unidad: "g", cantidad: 180 },
      { id: "bi2", ingrediente: "Aguacate", unidad: "ud", cantidad: 1 },
      { id: "bi3", ingrediente: "Cebolla roja", unidad: "g", cantidad: 30 },
      { id: "bi4", ingrediente: "Salsa soja", unidad: "ml", cantidad: 15 },
    ],
    partida: "Entrantes fríos",
    elaboracion: "Cortar salmón en dados de 1cm. Mezclar con cebolla roja picada, salsa soja y aceite de sésamo. Montar sobre base de aguacate.",
    guarnicion: "Tostadas de wonton", decoracion: "Huevas de salmón y cebollino", menaje: "Aro de presentación en plato llano",
    presentacionMesa: "Servir frío con tostadas al lado",
    alergenos: ["Pescado", "Soja", "Sésamo"],
    recomendaciones: ["Platos Estrella", "Cenas"],
    pvp: 16.00, costeTotal: 4.50,
    desglose: [desglose("Salmón", "180g", 1, 5.40, 8), desglose("Aguacate", "1ud", 1, 1.10, 10)],
  },
  {
    id: "ft-b2", nombre: "Paella de Verduras", categoriaId: "cat-2",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-02-01", fechaActualizacion: "2026-03-25",
    responsable: "Chef Marcos", empresaId: "bacanal",
    ingredientes: [
      { id: "bi10", ingrediente: "Arroz bomba", unidad: "g", cantidad: 200 },
      { id: "bi11", ingrediente: "Judías verdes", unidad: "g", cantidad: 80 },
      { id: "bi12", ingrediente: "Alcachofa", unidad: "ud", cantidad: 2 },
      { id: "bi13", ingrediente: "Azafrán", unidad: "g", cantidad: 0.5 },
    ],
    partida: "Arroces",
    elaboracion: "Sofreír verduras en paellera. Añadir tomate rallado y pimentón. Nacar arroz. Agregar caldo vegetal con azafrán. Cocer 20 min sin mover.",
    guarnicion: "Limón y alioli vegano", decoracion: "Romero fresco", menaje: "Paellera individual",
    presentacionMesa: "Servir en paellera sobre salvamanteles de esparto",
    alergenos: ["Ninguno"],
    recomendaciones: ["Veganos", "Comidas"],
    pvp: 15.00, costeTotal: 3.20,
    desglose: [desglose("Arroz bomba", "200g", 1, 0.60, 0), desglose("Verduras varias", "mix", 1, 2.40, 5)],
  },
  {
    id: "ft-b3", nombre: "Pad Thai Vegano", categoriaId: "cat-3",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-02-08", fechaActualizacion: "2026-04-01",
    responsable: "Chef Laura", empresaId: "bacanal",
    ingredientes: [
      { id: "bi20", ingrediente: "Noodles de arroz", unidad: "g", cantidad: 150 },
      { id: "bi21", ingrediente: "Tofu firme", unidad: "g", cantidad: 100 },
      { id: "bi22", ingrediente: "Brotes de soja", unidad: "g", cantidad: 60 },
      { id: "bi23", ingrediente: "Cacahuetes", unidad: "g", cantidad: 20 },
    ],
    partida: "Platos veganos",
    elaboracion: "Hidratar noodles. Saltear tofu en wok. Añadir verduras y noodles. Aliñar con salsa pad thai casera. Servir con cacahuetes.",
    guarnicion: "Lima y cilantro fresco", decoracion: "Cacahuetes tostados y chile", menaje: "Bowl de bambú",
    presentacionMesa: "Servir caliente con palillos y cuchara asiática",
    alergenos: ["Cacahuetes", "Soja"],
    recomendaciones: ["Veganos", "Cenas"],
    pvp: 14.00, costeTotal: 3.00,
    desglose: [desglose("Noodles", "150g", 1, 0.80, 0), desglose("Tofu", "100g", 1, 1.20, 0)],
  },
  {
    id: "ft-b4", nombre: "Pulpo a la Brasa", categoriaId: "cat-4",
    delicatessen: true, estado: "activa", fechaCreacion: "2026-01-22", fechaActualizacion: "2026-03-28",
    responsable: "Chef Marcos", empresaId: "bacanal",
    ingredientes: [
      { id: "bi30", ingrediente: "Pulpo cocido", unidad: "g", cantidad: 250 },
      { id: "bi31", ingrediente: "Patata cachelo", unidad: "g", cantidad: 150 },
      { id: "bi32", ingrediente: "Pimentón de la Vera", unidad: "g", cantidad: 5 },
    ],
    partida: "Mariscos y pescados",
    elaboracion: "Asar pulpo cocido en brasa a fuego vivo 3 min por lado. Servir sobre cama de patata cachelo con aceite de pimentón.",
    guarnicion: "Patatas cachelo", decoracion: "Pimentón ahumado y aceite de oliva virgen", menaje: "Tabla de madera de olivo",
    presentacionMesa: "Servir caliente con tenedor de madera",
    alergenos: ["Moluscos"],
    recomendaciones: ["Platos Estrella", "Cenas"],
    pvp: 21.00, costeTotal: 6.80,
    desglose: [desglose("Pulpo", "250g", 1, 7.50, 12), desglose("Patata", "150g", 1, 0.30, 5)],
  },
  {
    id: "ft-b5", nombre: "Entrecot a la Parrilla", categoriaId: "cat-5",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-02-15", fechaActualizacion: "2026-04-02",
    responsable: "Chef Marcos", empresaId: "bacanal",
    ingredientes: [
      { id: "bi40", ingrediente: "Entrecot de vaca madurada", unidad: "g", cantidad: 350 },
      { id: "bi41", ingrediente: "Sal Maldon", unidad: "g", cantidad: 5 },
      { id: "bi42", ingrediente: "Mantequilla de hierbas", unidad: "g", cantidad: 20 },
    ],
    partida: "Carnes",
    elaboracion: "Temperar carne 1h antes. Sellar en parrilla a máxima potencia. Cocinar al punto solicitado. Reposar 5 min. Coronar con mantequilla de hierbas.",
    guarnicion: "Verduras asadas de temporada", decoracion: "Escamas de sal y tomillo fresco", menaje: "Tabla de corte con canaleta",
    presentacionMesa: "Cortar delante del comensal, mostrar punto de cocción",
    alergenos: ["Lácteos"],
    recomendaciones: ["Cenas", "Platos Estrella"],
    pvp: 26.00, costeTotal: 8.50,
    desglose: [desglose("Entrecot madurado", "350g", 1, 10.50, 8)],
  },
  {
    id: "ft-b6", nombre: "Tarta de Queso Vasca", categoriaId: "cat-6",
    delicatessen: false, estado: "activa", fechaCreacion: "2026-01-30", fechaActualizacion: "2026-03-22",
    responsable: "Chef Laura", empresaId: "bacanal",
    ingredientes: [
      { id: "bi50", ingrediente: "Queso crema", unidad: "g", cantidad: 500 },
      { id: "bi51", ingrediente: "Nata para montar", unidad: "ml", cantidad: 200 },
      { id: "bi52", ingrediente: "Huevos", unidad: "ud", cantidad: 4 },
      { id: "bi53", ingrediente: "Azúcar", unidad: "g", cantidad: 200 },
    ],
    partida: "Postres",
    elaboracion: "Mezclar queso crema con azúcar. Añadir huevos uno a uno. Incorporar nata. Verter en molde con papel. Hornear 200°C 45 min hasta que quede temblorosa.",
    guarnicion: "Mermelada de frutos rojos", decoracion: "Polvo de oro comestible", menaje: "Plato de postre con cuchara",
    presentacionMesa: "Servir tibia con mermelada al lado",
    alergenos: ["Lácteos", "Huevos"],
    recomendaciones: ["Platos Estrella", "Comidas", "Cenas"],
    pvp: 8.50, costeTotal: 1.90,
    desglose: [desglose("Queso crema", "500g", 1, 2.50, 0), desglose("Huevos", "4ud", 1, 0.80, 0)],
  },
  {
    id: "ft-b7", nombre: "Nuggets de Pollo Caseros", categoriaId: "cat-7",
    delicatessen: false, estado: "borrador", fechaCreacion: "2026-03-01", fechaActualizacion: "2026-04-03",
    responsable: "Chef Laura", empresaId: "bacanal",
    ingredientes: [
      { id: "bi60", ingrediente: "Pechuga de pollo", unidad: "g", cantidad: 200 },
      { id: "bi61", ingrediente: "Corn flakes", unidad: "g", cantidad: 80 },
      { id: "bi62", ingrediente: "Huevo", unidad: "ud", cantidad: 1 },
    ],
    partida: "Menú infantil",
    elaboracion: "Cortar pollo en tiras. Empanar con corn flakes triturados. Freír u hornear a 200°C hasta dorar.",
    guarnicion: "Patatas gajo y ketchup casero", decoracion: "Bandera del restaurante", menaje: "Cesta de mimbre con papel",
    presentacionMesa: "Servir con zumo natural incluido",
    alergenos: ["Gluten", "Huevos"],
    recomendaciones: ["Para niños", "Comidas"],
    pvp: 7.50, costeTotal: 1.80,
    desglose: [desglose("Pechuga", "200g", 1, 1.60, 5), desglose("Corn flakes", "80g", 1, 0.40, 0)],
  },
];

// ─── Public API ────────────────────────────────────────────────
const allFichas: Record<string, Escandallo[]> = {
  habana: fichasHabana,
  bacanal: fichasBacanal,
};

const allCategorias: Record<string, CategoriaEscandallo[]> = {
  habana: DEFAULT_CATEGORIAS.map((c) => ({ ...c })),
  bacanal: DEFAULT_CATEGORIAS.map((c) => ({ ...c })),
};

const allConfigs: Record<string, ConfigEscandallos> = {
  habana: { alergenos: [...DEFAULT_ALERGENOS], partidas: [...DEFAULT_PARTIDAS], menaje: [...DEFAULT_MENAJE], recomendaciones: [...DEFAULT_RECOMENDACIONES] },
  bacanal: { alergenos: [...DEFAULT_ALERGENOS], partidas: [...DEFAULT_PARTIDAS], menaje: [...DEFAULT_MENAJE], recomendaciones: [...DEFAULT_RECOMENDACIONES] },
};

export function getEscandallosPorEmpresa(empresaId: string): Escandallo[] {
  return allFichas[empresaId] ?? [];
}

export function getCategoriasPorEmpresa(empresaId: string): CategoriaEscandallo[] {
  return allCategorias[empresaId] ?? DEFAULT_CATEGORIAS.map((c) => ({ ...c }));
}

export function getConfigEscandallosPorEmpresa(empresaId: string): ConfigEscandallos {
  return allConfigs[empresaId] ?? {
    alergenos: [...DEFAULT_ALERGENOS],
    partidas: [...DEFAULT_PARTIDAS],
    menaje: [...DEFAULT_MENAJE],
    recomendaciones: [...DEFAULT_RECOMENDACIONES],
  };
}

export function crearEscandalloVacio(empresaId: string, categoriaId: string): Escandallo {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    id: `ft-${Date.now()}`,
    nombre: "",
    categoriaId,
    delicatessen: false,
    estado: "borrador",
    fechaCreacion: hoy,
    fechaActualizacion: hoy,
    responsable: "",
    ingredientes: [],
    partida: "",
    elaboracion: "",
    guarnicion: "",
    decoracion: "",
    menaje: "",
    presentacionMesa: "",
    alergenos: [],
    recomendaciones: [],
    pvp: 0,
    costeTotal: 0,
    desglose: [],
    empresaId,
    productoId: undefined,
    foto: undefined,
    shareToken: undefined,
    shareEnabled: false,
  };
}

// ─── Share helpers ─────────────────────────────────────────────
export function generateShareToken(): string {
  return `ft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Global store for shared escandallos (simulated)
const sharedFichas: Record<string, { escandallo: Escandallo; categoriaNombre: string }> = {};

export function registerSharedEscandallo(escandallo: Escandallo, categoriaNombre: string) {
  if (escandallo.shareToken) {
    sharedFichas[escandallo.shareToken] = { escandallo, categoriaNombre };
  }
}

export function getSharedEscandallo(token: string): { escandallo: Escandallo; categoriaNombre: string } | null {
  return sharedFichas[token] ?? null;
}

export function unregisterSharedEscandallo(token: string) {
  delete sharedFichas[token];
}
