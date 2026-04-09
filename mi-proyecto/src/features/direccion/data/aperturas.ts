export interface DatosProyecto {
  nombre: string;
  ciudad: string;
  zona: string;
  poblacion: number;
  afluencia: string;
  tipoLocal: string;
  metrosCuadrados: number;
  plazas: number;
  ventasEstimadas: number;
  ticketMedio: number;
  clientesEstimados: number;
  estacionalidad: string;
  competencia: string;
  observaciones: string;
}

export interface CostePilar {
  fijo: number;
  variablePct: number;
}

export interface EstructuraCostes {
  generales: CostePilar;
  personal: CostePilar;
  producto: CostePilar;
  marketing: CostePilar;
}

export interface Escenario {
  nombre: string;
  factor: number;
}

/* ── Procedencia ── */
export type OrigenCapital = "Fondos propios" | "Banco" | "Efectivo" | "Préstamo" | "Socio" | "Cuenta común" | "Financiación externa" | "Otro";

export interface LineaProcedencia {
  id: string;
  fecha: string;
  origen: OrigenCapital;
  entidad: string;
  destino: string;
  baseImponible: number;
  ivaPct: number;
  total: number;
  medioPago: string;
}

/* ── Destino ── */
export type CategoriaDestino = "Maquinaria" | "Decoración" | "Menaje" | "Reformas" | "Mobiliario" | "Diseño" | "Marketing" | "Recibos" | "Servicios" | "Otros";

export interface LineaDestino {
  id: string;
  fecha: string;
  tipo: CategoriaDestino;
  traspaso: boolean;
  destino: string;
  pagadoCon: string;
  concepto: string;
  declarado: boolean;
  factura: boolean;
  baseImponible: number;
  ivaPct: number;
  total: number;
}

/* ── Amortización ── */
export type TipoAmortizacion = "Balance" | "IVA - Soportado" | "Amortización" | "Carga financiera";

export interface LineaAmortizacion {
  id: string;
  fecha: string;
  ano: number;
  trimestre: string;
  mes: string;
  tipo: TipoAmortizacion;
  baseImponible: number;
  ivaPct: number;
  intereses: number;
  total: number;
}

export interface EstudioApertura {
  id: string;
  datos: DatosProyecto;
  costes: EstructuraCostes;
  procedencia: LineaProcedencia[];
  destinos: LineaDestino[];
  amortizacion: LineaAmortizacion[];
  creado: string;
}

export const ESCENARIOS: Escenario[] = [
  { nombre: "Muy conservador", factor: 0.6 },
  { nombre: "Conservador", factor: 0.8 },
  { nombre: "Medio", factor: 1.0 },
  { nombre: "Optimista", factor: 1.2 },
  { nombre: "Muy optimista", factor: 1.4 },
];

export const ORIGENES_CAPITAL: OrigenCapital[] = ["Fondos propios", "Banco", "Efectivo", "Préstamo", "Socio", "Cuenta común", "Financiación externa", "Otro"];
export const CATEGORIAS_DESTINO: CategoriaDestino[] = ["Maquinaria", "Decoración", "Menaje", "Reformas", "Mobiliario", "Diseño", "Marketing", "Recibos", "Servicios", "Otros"];
export const TIPOS_AMORTIZACION: TipoAmortizacion[] = ["Balance", "IVA - Soportado", "Amortización", "Carga financiera"];
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const TRIMESTRES = ["1T", "2T", "3T", "4T"];

export function calcularEscenario(ventas: number, factor: number, costes: EstructuraCostes) {
  const facturacion = ventas * factor;
  const fijoTotal = costes.generales.fijo + costes.personal.fijo + costes.producto.fijo + costes.marketing.fijo;
  const varTotal = facturacion * (costes.generales.variablePct + costes.personal.variablePct + costes.producto.variablePct + costes.marketing.variablePct) / 100;
  const costeTotal = fijoTotal + varTotal;
  const beneficio = facturacion - costeTotal;
  const margen = facturacion > 0 ? (beneficio / facturacion) * 100 : 0;
  return { facturacion, fijoTotal, varTotal, costeTotal, beneficio, margen };
}

export function calcularPilar(facturacion: number, pilar: CostePilar) {
  return pilar.fijo + facturacion * pilar.variablePct / 100;
}

function uid() { return `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const SAMPLE_PROCEDENCIA: LineaProcedencia[] = [
  { id: uid(), fecha: "2026-03-25", origen: "Fondos propios", entidad: "HABANA", destino: "Apertura", baseImponible: 0, ivaPct: 0, total: 18004, medioPago: "Efectivo" },
  { id: uid(), fecha: "2026-03-25", origen: "Fondos propios", entidad: "HABANA", destino: "Apertura", baseImponible: 0, ivaPct: 0, total: 41568.28, medioPago: "Efectivo" },
  { id: uid(), fecha: "2026-04-12", origen: "Banco", entidad: "HABANA", destino: "Apertura", baseImponible: 0, ivaPct: 0, total: 10000, medioPago: "Banco" },
  { id: uid(), fecha: "2026-04-19", origen: "Banco", entidad: "HABANA", destino: "Apertura", baseImponible: 0, ivaPct: 0, total: 15000, medioPago: "Banco" },
  { id: uid(), fecha: "2026-05-09", origen: "Banco", entidad: "HABANA", destino: "Apertura", baseImponible: 0, ivaPct: 0, total: 5000, medioPago: "Banco" },
];

const SAMPLE_DESTINOS: LineaDestino[] = [
  { id: uid(), fecha: "2026-02-22", tipo: "Maquinaria", traspaso: true, destino: "Frío Comercial", pagadoCon: "César", concepto: "Pago maquinaria cocina", declarado: true, factura: true, baseImponible: 6984.30, ivaPct: 21, total: 8450.8 },
  { id: uid(), fecha: "2026-02-22", tipo: "Maquinaria", traspaso: true, destino: "TPV", pagadoCon: "Fondos externos", concepto: "Maquinaria TPV Agora", declarado: true, factura: true, baseImponible: 1263, ivaPct: 21, total: 1528.23 },
  { id: uid(), fecha: "2026-03-01", tipo: "Decoración", traspaso: true, destino: "Otros", pagadoCon: "Iván", concepto: "Árbol", declarado: true, factura: true, baseImponible: 1669.50, ivaPct: 21, total: 2020.1 },
  { id: uid(), fecha: "2026-03-11", tipo: "Menaje", traspaso: true, destino: "Frío Comercial", pagadoCon: "César", concepto: "Platos comida", declarado: true, factura: true, baseImponible: 1162.28, ivaPct: 21, total: 1406.36 },
  { id: uid(), fecha: "2026-03-12", tipo: "Reformas", traspaso: true, destino: "Bricomart", pagadoCon: "César", concepto: "Azulejos suelo", declarado: true, factura: true, baseImponible: 4109.78, ivaPct: 21, total: 4972.83 },
  { id: uid(), fecha: "2026-03-14", tipo: "Diseño", traspaso: true, destino: "Cristina", pagadoCon: "César", concepto: "Diseño Bacanal", declarado: true, factura: true, baseImponible: 3000, ivaPct: 21, total: 3630 },
  { id: uid(), fecha: "2026-03-17", tipo: "Mobiliario", traspaso: true, destino: "GS Group", pagadoCon: "Iván", concepto: "Pago sofás 50%", declarado: true, factura: true, baseImponible: 7890.35, ivaPct: 21, total: 9547.32 },
  { id: uid(), fecha: "2026-03-28", tipo: "Mobiliario", traspaso: true, destino: "Frío Comercial", pagadoCon: "Cuenta común", concepto: "Mobiliario terraza", declarado: true, factura: true, baseImponible: 3828, ivaPct: 21, total: 4631.88 },
];

const SAMPLE_AMORTIZACION: LineaAmortizacion[] = [
  { id: uid(), fecha: "2026-07-25", ano: 2026, trimestre: "2T", mes: "Julio", tipo: "Balance", baseImponible: 0, ivaPct: 0, intereses: 0, total: 0 },
  { id: uid(), fecha: "2026-07-25", ano: 2026, trimestre: "2T", mes: "Julio", tipo: "IVA - Soportado", baseImponible: 0, ivaPct: 0, intereses: 0, total: 0 },
  { id: uid(), fecha: "2026-10-25", ano: 2026, trimestre: "3T", mes: "Octubre", tipo: "Balance", baseImponible: 0, ivaPct: 0, intereses: 0, total: 0 },
  { id: uid(), fecha: "2026-10-25", ano: 2026, trimestre: "3T", mes: "Octubre", tipo: "IVA - Soportado", baseImponible: 0, ivaPct: 0, intereses: 0, total: 0 },
  { id: uid(), fecha: "2027-05-31", ano: 2027, trimestre: "1T", mes: "Mayo", tipo: "Balance", baseImponible: 0, ivaPct: 0, intereses: 0, total: 0 },
  { id: uid(), fecha: "2027-05-31", ano: 2027, trimestre: "1T", mes: "Mayo", tipo: "IVA - Soportado", baseImponible: 0, ivaPct: 0, intereses: 0, total: 11.09 },
  { id: uid(), fecha: "2027-07-31", ano: 2027, trimestre: "2T", mes: "Julio", tipo: "Balance", baseImponible: 0, ivaPct: 0, intereses: 0, total: 0 },
  { id: uid(), fecha: "2027-07-31", ano: 2027, trimestre: "2T", mes: "Julio", tipo: "IVA - Soportado", baseImponible: 0, ivaPct: 0, intereses: 0, total: 331.34 },
];

export const SAMPLE_ESTUDIOS: EstudioApertura[] = [
  {
    id: "ap1",
    datos: {
      nombre: "Nuevo local Centro Histórico",
      ciudad: "Sevilla",
      zona: "Casco Antiguo",
      poblacion: 690000,
      afluencia: "Alta — zona turística",
      tipoLocal: "Restaurante casual",
      metrosCuadrados: 180,
      plazas: 60,
      ventasEstimadas: 45000,
      ticketMedio: 22,
      clientesEstimados: 2045,
      estacionalidad: "Pico en primavera y otoño",
      competencia: "3 restaurantes similares en 200m",
      observaciones: "Local en esquina con terraza amplia",
    },
    costes: {
      generales: { fijo: 4500, variablePct: 3 },
      personal: { fijo: 14000, variablePct: 5 },
      producto: { fijo: 1000, variablePct: 28 },
      marketing: { fijo: 800, variablePct: 2 },
    },
    procedencia: SAMPLE_PROCEDENCIA,
    destinos: SAMPLE_DESTINOS,
    amortizacion: SAMPLE_AMORTIZACION,
    creado: "2026-03-15",
  },
  {
    id: "ap2",
    datos: {
      nombre: "Expansión Zona Norte",
      ciudad: "Madrid",
      zona: "Las Tablas",
      poblacion: 3300000,
      afluencia: "Media-alta — zona residencial nueva",
      tipoLocal: "Gastrobar",
      metrosCuadrados: 120,
      plazas: 40,
      ventasEstimadas: 35000,
      ticketMedio: 18,
      clientesEstimados: 1944,
      estacionalidad: "Estable todo el año",
      competencia: "Poca competencia directa",
      observaciones: "Centro comercial cercano",
    },
    costes: {
      generales: { fijo: 3800, variablePct: 3 },
      personal: { fijo: 11000, variablePct: 5 },
      producto: { fijo: 800, variablePct: 30 },
      marketing: { fijo: 600, variablePct: 2 },
    },
    procedencia: [],
    destinos: [],
    amortizacion: [],
    creado: "2026-04-01",
  },
];
