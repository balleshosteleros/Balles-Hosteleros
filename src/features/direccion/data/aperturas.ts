export interface DatosProyecto {
  nombre: string;
  ciudad: string;
  zona: string;
  poblacion: number;
  afluencia: string;
  tipoLocal: string;
  metrosCuadrados: number;
  ventasEstimadas: number;
  ticketMedio: number;
  clientesEstimados: number;
  estacionalidad: string;
  competencia: string;
  observaciones: string;
}

export interface PartidaCoste {
  id: string;
  nombre: string;
  fijo: number;
  variablePct: number;
}

export interface CostePilar {
  partidas: PartidaCoste[];
}

export interface EstructuraCostes {
  generales: CostePilar;
  personal: CostePilar;
  producto: CostePilar;
  marketing: CostePilar;
}

export type PilarKey = "generales" | "personal" | "producto" | "marketing";

/* ── Facturación: pilares con partidas (mismo patrón que Costes) ── */
export interface PartidaFacturacion {
  id: string;
  nombre: string;
  clientesEsperados: number;
  ticketMedio: number;
}

/** Alias retrocompatible: partida y "línea" son la misma forma. */
export type LineaFacturacion = PartidaFacturacion;

export interface FacturacionPilar {
  partidas: PartidaFacturacion[];
}

export interface EstructuraFacturacion {
  franjas: FacturacionPilar;
  acuerdos: FacturacionPilar;
  eventos: FacturacionPilar;
  tienda: FacturacionPilar;
}

export type FactPilarKey = "franjas" | "acuerdos" | "eventos" | "tienda";

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

export type EstadoViabilidad = "viable" | "no_viable";
export type EstadoActividad = "activo" | "no_activo";

/* ── Local: características físicas + ubicación + fotos ── */
export type CategoriaFotoLocal =
  | "fachada"
  | "interior"
  | "barra"
  | "terraza"
  | "cocina"
  | "aseos"
  | "almacen"
  | "parking"
  | "otras";

export interface FotoEstudio {
  id: string;
  path: string;          // path en el bucket
  url?: string;          // signed URL (rellenado en server)
  caption?: string;
}

export interface UbicacionLocal {
  direccion: string;
  ciudad: string;
  codigoPostal: string;
  pais: string;
  lat: number | null;
  lng: number | null;
  radioKm: number;
}

export interface CaracteristicasLocal {
  tipoEstablecimiento: string;       // ej: bajo comercial, esquina, planta calle
  metrosUtiles: number;
  metrosTerraza: number;
  plazasInterior: number;
  plazasTerraza: number;
  plantasLocal: number;
  banos: number;
  acceso: string;                    // descripción accesibilidad / accesos
  estadoLocal: string;               // ej: a reformar, llave en mano
  licenciaActividad: string;         // ej: bar-restaurante categoría 2
  salidaHumos: string;               // ej: sí, hasta cubierta / no
  alquilerMensual: number;
  traspaso: number;
  duracionContrato: string;
  observaciones: string;
}

export interface BloqueLocal {
  caracteristicas: CaracteristicasLocal;
  ubicacion: UbicacionLocal;
  fotos: Record<CategoriaFotoLocal, FotoEstudio[]>;
}

/* ── Imagen de marca ── */
export interface ColorPaleta { id: string; nombre: string; hex: string }

export interface ImagenMarcaEstudio {
  claim: string;             // tagline
  descripcion: string;       // descripción del concepto de marca
  publicoObjetivo: string;
  valores: string[];         // 3-6 valores
  tipografiaTitulares: string;
  tipografiaCuerpo: string;
  paleta: ColorPaleta[];     // 3-6 colores
  logoPath?: string;         // path en bucket
  logoUrl?: string;          // signed URL
}

/* ── Propuesta gastronómica ── */
export interface PlatoDestacado {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;         // ej: entrante, principal, postre, cóctel
  foto?: FotoEstudio;
}

export interface CategoriaVentaEstimada {
  id: string;
  nombre: string;     // ej: Bebidas, Entrantes, Postres, Carnes
  porcentaje: number; // 0..100 — la suma de todas las categorías no puede superar 100
}

export interface PropuestaGastronomica {
  concepto: string;          // ej: cocina mediterránea de mercado
  descripcion: string;
  estiloServicio: string;    // ej: a la carta + menú degustación
  rangoPrecioMedio: string;  // ej: 30-45€
  numeroPlatosCarta: number;
  cartaUrl: string;          // enlace a PDF / web
  platos: PlatoDestacado[];
  categoriasVenta?: CategoriaVentaEstimada[];
}

export interface EstudioApertura {
  id: string;
  datos: DatosProyecto;
  facturacion: EstructuraFacturacion;
  costes: EstructuraCostes;
  procedencia: LineaProcedencia[];
  destinos: LineaDestino[];
  amortizacion: LineaAmortizacion[];
  creado: string;
  imagen?: string;
  viabilidad: EstadoViabilidad;
  actividad: EstadoActividad;
  local: BloqueLocal;
  imagenMarca: ImagenMarcaEstudio;
  propuesta: PropuestaGastronomica;
  ocupacion: BloqueOcupacion;
}

/* ── Ocupación estimada (heatmap día × franja por escenario) ───────── */
export type FranjaHoraria = "desayuno" | "comida" | "cena";
export type DiaSemana =
  | "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export const FRANJAS_HORARIAS: { key: FranjaHoraria; label: string; horario: string }[] = [
  { key: "desayuno", label: "Desayuno", horario: "06:00–12:00" },
  { key: "comida",   label: "Comida",   horario: "12:00–18:00" },
  { key: "cena",     label: "Cena",     horario: "18:00–24:00" },
];

export const DIAS_SEMANA: { key: DiaSemana; label: string; corto: string }[] = [
  { key: "lunes",     label: "Lunes",     corto: "Lun" },
  { key: "martes",    label: "Martes",    corto: "Mar" },
  { key: "miercoles", label: "Miércoles", corto: "Mié" },
  { key: "jueves",    label: "Jueves",    corto: "Jue" },
  { key: "viernes",   label: "Viernes",   corto: "Vie" },
  { key: "sabado",    label: "Sábado",    corto: "Sáb" },
  { key: "domingo",   label: "Domingo",   corto: "Dom" },
];

export type MatrizOcupacion = Record<DiaSemana, Record<FranjaHoraria, number>>;

export interface EscenarioOcupacion {
  id: string;
  nombre: string;
  color: string;          // hsl/hex para el heatmap
  matriz: MatrizOcupacion;
}

export interface BloqueOcupacion {
  escenarios: EscenarioOcupacion[];
  escenarioActivoId?: string;
}

export const CATEGORIAS_FOTOS_LOCAL: { key: CategoriaFotoLocal; label: string }[] = [
  { key: "fachada",  label: "Fachada" },
  { key: "interior", label: "Interior" },
  { key: "barra",    label: "Barra" },
  { key: "terraza",  label: "Terraza" },
  { key: "cocina",   label: "Cocina" },
  { key: "aseos",    label: "Aseos" },
  { key: "almacen",  label: "Almacén" },
  { key: "parking",  label: "Parking" },
  { key: "otras",    label: "Otras" },
];

export function bloqueLocalInicial(): BloqueLocal {
  return {
    caracteristicas: {
      tipoEstablecimiento: "",
      metrosUtiles: 0,
      metrosTerraza: 0,
      plazasInterior: 0,
      plazasTerraza: 0,
      plantasLocal: 1,
      banos: 0,
      acceso: "",
      estadoLocal: "",
      licenciaActividad: "",
      salidaHumos: "",
      alquilerMensual: 0,
      traspaso: 0,
      duracionContrato: "",
      observaciones: "",
    },
    ubicacion: {
      direccion: "",
      ciudad: "",
      codigoPostal: "",
      pais: "España",
      lat: null,
      lng: null,
      radioKm: 1,
    },
    fotos: {
      fachada: [],
      interior: [],
      barra: [],
      terraza: [],
      cocina: [],
      aseos: [],
      almacen: [],
      parking: [],
      otras: [],
    },
  };
}

export function imagenMarcaInicial(): ImagenMarcaEstudio {
  return {
    claim: "",
    descripcion: "",
    publicoObjetivo: "",
    valores: [],
    tipografiaTitulares: "",
    tipografiaCuerpo: "",
    paleta: [],
  };
}

export function propuestaGastronomicaInicial(): PropuestaGastronomica {
  return {
    concepto: "",
    descripcion: "",
    estiloServicio: "",
    rangoPrecioMedio: "",
    numeroPlatosCarta: 0,
    cartaUrl: "",
    platos: [],
    categoriasVenta: [],
  };
}

export function matrizOcupacionVacia(): MatrizOcupacion {
  const dias = DIAS_SEMANA.map((d) => d.key);
  const franjas = FRANJAS_HORARIAS.map((f) => f.key);
  return Object.fromEntries(
    dias.map((d) => [
      d,
      Object.fromEntries(franjas.map((f) => [f, 0])) as Record<FranjaHoraria, number>,
    ]),
  ) as MatrizOcupacion;
}

export function bloqueOcupacionInicial(): BloqueOcupacion {
  return {
    escenarios: [
      { id: "esc-conservador", nombre: "Conservador", color: "hsl(220 70% 55%)", matriz: matrizOcupacionVacia() },
      { id: "esc-realista",    nombre: "Realista",    color: "hsl(150 60% 45%)", matriz: matrizOcupacionVacia() },
      { id: "esc-optimista",   nombre: "Optimista",   color: "hsl(40 90% 55%)",  matriz: matrizOcupacionVacia() },
    ],
    escenarioActivoId: "esc-realista",
  };
}

/* Garantiza que la matriz tenga TODOS los días y franjas (rellena los que falten con 0). */
export function normalizeMatrizOcupacion(input: unknown): MatrizOcupacion {
  const base = matrizOcupacionVacia();
  if (!input || typeof input !== "object") return base;
  const m = input as Record<string, Record<string, unknown>>;
  for (const dia of DIAS_SEMANA.map((d) => d.key)) {
    const fila = m[dia];
    if (!fila || typeof fila !== "object") continue;
    for (const f of FRANJAS_HORARIAS.map((x) => x.key)) {
      const v = Number(fila[f]);
      if (Number.isFinite(v)) base[dia][f] = Math.max(0, Math.min(100, v));
    }
  }
  return base;
}

export function normalizeBloqueOcupacion(input: unknown): BloqueOcupacion {
  if (!input || typeof input !== "object") return bloqueOcupacionInicial();
  const raw = input as { escenarios?: unknown; escenarioActivoId?: unknown };
  const escenarios = Array.isArray(raw.escenarios) ? raw.escenarios : [];
  if (escenarios.length === 0) return bloqueOcupacionInicial();
  const norm: EscenarioOcupacion[] = escenarios
    .map((e) => {
      if (!e || typeof e !== "object") return null;
      const r = e as Partial<EscenarioOcupacion>;
      return {
        id: typeof r.id === "string" && r.id ? r.id : `esc-${Math.random().toString(36).slice(2, 8)}`,
        nombre: typeof r.nombre === "string" ? r.nombre : "Escenario",
        color: typeof r.color === "string" && r.color ? r.color : "hsl(220 70% 55%)",
        matriz: normalizeMatrizOcupacion(r.matriz),
      } satisfies EscenarioOcupacion;
    })
    .filter((x): x is EscenarioOcupacion => x !== null);
  if (norm.length === 0) return bloqueOcupacionInicial();
  const activo = typeof raw.escenarioActivoId === "string" ? raw.escenarioActivoId : undefined;
  return { escenarios: norm, escenarioActivoId: activo && norm.some((e) => e.id === activo) ? activo : norm[0].id };
}

/* Promedio (0..100) de toda la matriz — útil para KPI resumido. */
export function ocupacionMedia(matriz: MatrizOcupacion): number {
  let suma = 0;
  let n = 0;
  for (const dia of DIAS_SEMANA.map((d) => d.key)) {
    for (const f of FRANJAS_HORARIAS.map((x) => x.key)) {
      suma += matriz[dia][f] || 0;
      n += 1;
    }
  }
  return n === 0 ? 0 : suma / n;
}

export const ESCENARIOS: Escenario[] = [
  { nombre: "Muy conservador", factor: 0.6 },
  { nombre: "Conservador", factor: 0.8 },
  { nombre: "Estimado", factor: 1.0 },
  { nombre: "Optimista", factor: 1.2 },
  { nombre: "Muy optimista", factor: 1.4 },
];

export const ORIGENES_CAPITAL: OrigenCapital[] = ["Fondos propios", "Banco", "Efectivo", "Préstamo", "Socio", "Cuenta común", "Financiación externa", "Otro"];
export const CATEGORIAS_DESTINO: CategoriaDestino[] = ["Maquinaria", "Decoración", "Menaje", "Reformas", "Mobiliario", "Diseño", "Marketing", "Recibos", "Servicios", "Otros"];
export const TIPOS_AMORTIZACION: TipoAmortizacion[] = ["Balance", "IVA - Soportado", "Amortización", "Carga financiera"];
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const TRIMESTRES = ["1T", "2T", "3T", "4T"];

export function pilarFijo(pilar: CostePilar): number {
  return pilar.partidas.reduce((s, p) => s + (p.fijo || 0), 0);
}

export function pilarVariablePct(pilar: CostePilar): number {
  return pilar.partidas.reduce((s, p) => s + (p.variablePct || 0), 0);
}

export function calcularEscenario(ventas: number, factor: number, costes: EstructuraCostes) {
  const facturacion = ventas * factor;
  const pilares: CostePilar[] = [costes.generales, costes.personal, costes.producto, costes.marketing];
  const fijoTotal = pilares.reduce((s, p) => s + pilarFijo(p), 0);
  const variablePctTotal = pilares.reduce((s, p) => s + pilarVariablePct(p), 0);
  const varTotal = facturacion * variablePctTotal / 100;
  const costeTotal = fijoTotal + varTotal;
  const beneficio = facturacion - costeTotal;
  const margen = facturacion > 0 ? (beneficio / facturacion) * 100 : 0;
  return { facturacion, fijoTotal, varTotal, costeTotal, beneficio, margen };
}

export function calcularPilar(facturacion: number, pilar: CostePilar) {
  return pilarFijo(pilar) + facturacion * pilarVariablePct(pilar) / 100;
}

function uid() { return `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export function nuevaPartida(nombre = "Nueva partida"): PartidaCoste {
  return { id: uid(), nombre, fijo: 0, variablePct: 0 };
}

export const FACT_PILAR_KEYS: FactPilarKey[] = ["franjas", "acuerdos", "eventos", "tienda"];
export const FACT_PILAR_NAMES: Record<FactPilarKey, string> = {
  franjas: "Franjas horarias",
  acuerdos: "Acuerdos con marcas",
  eventos: "Eventos privados",
  tienda: "Tienda",
};

/** Devuelve todas las partidas de todos los pilares en una lista plana. */
export function lineasPlanas(f: EstructuraFacturacion): PartidaFacturacion[] {
  return FACT_PILAR_KEYS.flatMap((k) => f[k].partidas);
}

export function pilarFactClientes(p: FacturacionPilar): number {
  return p.partidas.reduce((s, l) => s + (l.clientesEsperados || 0), 0);
}

export function pilarFactTotal(p: FacturacionPilar): number {
  return p.partidas.reduce((s, l) => s + (l.clientesEsperados || 0) * (l.ticketMedio || 0), 0);
}

export function pilarFactTicketPonderado(p: FacturacionPilar): number {
  const cl = pilarFactClientes(p);
  return cl > 0 ? pilarFactTotal(p) / cl : 0;
}

export function totalFacturacion(f: EstructuraFacturacion): number {
  return lineasPlanas(f).reduce((s, l) => s + (l.clientesEsperados || 0) * (l.ticketMedio || 0), 0);
}

export function totalClientes(f: EstructuraFacturacion): number {
  return lineasPlanas(f).reduce((s, l) => s + (l.clientesEsperados || 0), 0);
}

export function ticketMedioPonderado(f: EstructuraFacturacion): number {
  const clientes = totalClientes(f);
  return clientes > 0 ? totalFacturacion(f) / clientes : 0;
}

export function nuevaPartidaFacturacion(nombre = "Nueva partida"): PartidaFacturacion {
  return { id: uid(), nombre, clientesEsperados: 0, ticketMedio: 0 };
}

/** Alias retrocompatible. */
export const nuevaLineaFacturacion = nuevaPartidaFacturacion;

type LineaFacturacionPlantilla = Omit<PartidaFacturacion, "id">;

const PLANTILLAS_FACTURACION: Record<FactPilarKey, LineaFacturacionPlantilla[]> = {
  franjas: [
    { nombre: "Desayuno", clientesEsperados: 0, ticketMedio: 0 },
    { nombre: "Comida",   clientesEsperados: 0, ticketMedio: 0 },
    { nombre: "Cena",     clientesEsperados: 0, ticketMedio: 0 },
  ],
  acuerdos: [
    { nombre: "Acuerdos con marcas", clientesEsperados: 0, ticketMedio: 0 },
  ],
  eventos: [
    { nombre: "Eventos privados", clientesEsperados: 0, ticketMedio: 0 },
  ],
  tienda: [
    { nombre: "Venta de productos", clientesEsperados: 0, ticketMedio: 0 },
  ],
};

export function plantillaPartidasFacturacion(pilar: FactPilarKey): PartidaFacturacion[] {
  return PLANTILLAS_FACTURACION[pilar].map((l) => ({ id: uid(), ...l }));
}

export function crearFacturacionInicial(): EstructuraFacturacion {
  return {
    franjas:  { partidas: plantillaPartidasFacturacion("franjas") },
    acuerdos: { partidas: plantillaPartidasFacturacion("acuerdos") },
    eventos:  { partidas: plantillaPartidasFacturacion("eventos") },
    tienda:   { partidas: plantillaPartidasFacturacion("tienda") },
  };
}

function partidasFactDesde(plantilla: LineaFacturacionPlantilla[]): PartidaFacturacion[] {
  return plantilla.map((l) => ({ id: uid(), ...l }));
}

/**
 * Migra cualquier shape persistido al nuevo formato.
 * Acepta: nuevo shape (pilares), shape legacy `{ lineas: [...] }` y null/undefined.
 */
export function normalizeFacturacion(input: unknown): EstructuraFacturacion {
  if (!input || typeof input !== "object") return crearFacturacionInicial();
  const obj = input as Record<string, unknown>;

  const tienePilares =
    obj.franjas || obj.acuerdos || obj.eventos || obj.tienda;

  if (tienePilares) {
    const base = crearFacturacionInicial();
    const fix = (raw: unknown, fallback: FacturacionPilar): FacturacionPilar => {
      if (!raw || typeof raw !== "object") return fallback;
      const partidas = (raw as { partidas?: unknown }).partidas;
      if (!Array.isArray(partidas)) return fallback;
      return {
        partidas: partidas.map((p) => {
          const part = p as Partial<PartidaFacturacion>;
          return {
            id: part.id ?? uid(),
            nombre: part.nombre ?? "",
            clientesEsperados: Number(part.clientesEsperados) || 0,
            ticketMedio: Number(part.ticketMedio) || 0,
          };
        }),
      };
    };
    return {
      franjas:  fix(obj.franjas,  base.franjas),
      acuerdos: fix(obj.acuerdos, { partidas: [] }),
      eventos:  fix(obj.eventos,  { partidas: [] }),
      tienda:   fix(obj.tienda,   { partidas: [] }),
    };
  }

  // Legacy: { lineas: [...] } → todas a "franjas"
  if (Array.isArray(obj.lineas)) {
    const partidas = (obj.lineas as Partial<PartidaFacturacion>[]).map((p) => ({
      id: p.id ?? uid(),
      nombre: p.nombre ?? "",
      clientesEsperados: Number(p.clientesEsperados) || 0,
      ticketMedio: Number(p.ticketMedio) || 0,
    }));
    return {
      franjas:  { partidas },
      acuerdos: { partidas: [] },
      eventos:  { partidas: [] },
      tienda:   { partidas: [] },
    };
  }

  return crearFacturacionInicial();
}

type PartidaPlantilla = Omit<PartidaCoste, "id">;

const PLANTILLAS_PARTIDAS: Record<PilarKey, PartidaPlantilla[]> = {
  generales: [
    { nombre: "Alquiler del local", fijo: 0, variablePct: 0 },
    { nombre: "Suministros (luz, agua, gas)", fijo: 0, variablePct: 1 },
    { nombre: "Internet y telefonía", fijo: 0, variablePct: 0 },
    { nombre: "Seguros", fijo: 0, variablePct: 0 },
    { nombre: "Asesoría / gestoría", fijo: 0, variablePct: 0 },
    { nombre: "Limpieza y consumibles", fijo: 0, variablePct: 1 },
    { nombre: "Mantenimiento e instalaciones", fijo: 0, variablePct: 1 },
  ],
  personal: [
    { nombre: "Jefe de cocina", fijo: 0, variablePct: 0 },
    { nombre: "Equipo de cocina", fijo: 0, variablePct: 1 },
    { nombre: "Equipo de sala", fijo: 0, variablePct: 2 },
    { nombre: "Seguridad social", fijo: 0, variablePct: 1 },
    { nombre: "Formación", fijo: 0, variablePct: 0 },
    { nombre: "Uniformes y EPI", fijo: 0, variablePct: 1 },
  ],
  producto: [
    { nombre: "Materia prima cocina", fijo: 0, variablePct: 18 },
    { nombre: "Bebidas (vinos y cervezas)", fijo: 0, variablePct: 6 },
    { nombre: "Refrescos y aguas", fijo: 0, variablePct: 2 },
    { nombre: "Postres y panadería", fijo: 0, variablePct: 1 },
    { nombre: "Mermas y desperdicios", fijo: 0, variablePct: 1 },
  ],
  marketing: [
    { nombre: "Community manager / RRSS", fijo: 0, variablePct: 0 },
    { nombre: "Publicidad online (Ads)", fijo: 0, variablePct: 1 },
    { nombre: "Diseño y creatividades", fijo: 0, variablePct: 0 },
    { nombre: "Cartelería y menús impresos", fijo: 0, variablePct: 0 },
    { nombre: "Promociones y eventos", fijo: 0, variablePct: 1 },
  ],
};

export function plantillaPartidas(pilar: PilarKey): PartidaCoste[] {
  return PLANTILLAS_PARTIDAS[pilar].map((p) => ({ id: uid(), ...p }));
}

export function crearCostesIniciales(): EstructuraCostes {
  return {
    generales: { partidas: plantillaPartidas("generales") },
    personal: { partidas: plantillaPartidas("personal") },
    producto: { partidas: plantillaPartidas("producto") },
    marketing: { partidas: plantillaPartidas("marketing") },
  };
}

function partidasDesde(plantilla: PartidaPlantilla[]): PartidaCoste[] {
  return plantilla.map((p) => ({ id: uid(), ...p }));
}

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
      ventasEstimadas: 45000,
      ticketMedio: 22,
      clientesEstimados: 2045,
      estacionalidad: "Pico en primavera y otoño",
      competencia: "3 restaurantes similares en 200m",
      observaciones: "Local en esquina con terraza amplia",
    },
    facturacion: {
      franjas: {
        partidas: partidasFactDesde([
          { nombre: "Desayuno", clientesEsperados: 200, ticketMedio: 8 },
          { nombre: "Comida",   clientesEsperados: 950, ticketMedio: 24 },
          { nombre: "Cena",     clientesEsperados: 600, ticketMedio: 26 },
        ]),
      },
      acuerdos: { partidas: partidasFactDesde([{ nombre: "Acuerdos con marcas", clientesEsperados: 0, ticketMedio: 0 }]) },
      eventos:  { partidas: partidasFactDesde([{ nombre: "Eventos privados", clientesEsperados: 25, ticketMedio: 80 }]) },
      tienda:   { partidas: partidasFactDesde([{ nombre: "Tienda / Take-away", clientesEsperados: 120, ticketMedio: 16 }]) },
    },
    costes: {
      generales: {
        partidas: partidasDesde([
          { nombre: "Alquiler del local", fijo: 2800, variablePct: 0 },
          { nombre: "Suministros (luz, agua, gas)", fijo: 700, variablePct: 1 },
          { nombre: "Internet y telefonía", fijo: 80, variablePct: 0 },
          { nombre: "Seguros", fijo: 250, variablePct: 0 },
          { nombre: "Asesoría / gestoría", fijo: 220, variablePct: 0 },
          { nombre: "Limpieza y consumibles", fijo: 250, variablePct: 1 },
          { nombre: "Mantenimiento e instalaciones", fijo: 200, variablePct: 1 },
        ]),
      },
      personal: {
        partidas: partidasDesde([
          { nombre: "Jefe de cocina", fijo: 2800, variablePct: 0 },
          { nombre: "Equipo de cocina", fijo: 4500, variablePct: 1 },
          { nombre: "Equipo de sala", fijo: 3500, variablePct: 2 },
          { nombre: "Seguridad social", fijo: 2800, variablePct: 1 },
          { nombre: "Formación", fijo: 200, variablePct: 0 },
          { nombre: "Uniformes y EPI", fijo: 200, variablePct: 1 },
        ]),
      },
      producto: {
        partidas: partidasDesde([
          { nombre: "Materia prima cocina", fijo: 600, variablePct: 18 },
          { nombre: "Bebidas (vinos y cervezas)", fijo: 200, variablePct: 6 },
          { nombre: "Refrescos y aguas", fijo: 100, variablePct: 2 },
          { nombre: "Postres y panadería", fijo: 50, variablePct: 1 },
          { nombre: "Mermas y desperdicios", fijo: 50, variablePct: 1 },
        ]),
      },
      marketing: {
        partidas: partidasDesde([
          { nombre: "Community manager / RRSS", fijo: 350, variablePct: 0 },
          { nombre: "Publicidad online (Ads)", fijo: 200, variablePct: 1 },
          { nombre: "Diseño y creatividades", fijo: 100, variablePct: 0 },
          { nombre: "Cartelería y menús impresos", fijo: 100, variablePct: 0 },
          { nombre: "Promociones y eventos", fijo: 50, variablePct: 1 },
        ]),
      },
    },
    procedencia: SAMPLE_PROCEDENCIA,
    destinos: SAMPLE_DESTINOS,
    amortizacion: SAMPLE_AMORTIZACION,
    creado: "2026-03-15",
    viabilidad: "viable",
    actividad: "no_activo",
    local: bloqueLocalInicial(),
    imagenMarca: imagenMarcaInicial(),
    propuesta: propuestaGastronomicaInicial(),
    ocupacion: bloqueOcupacionInicial(),
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
      ventasEstimadas: 35000,
      ticketMedio: 18,
      clientesEstimados: 1944,
      estacionalidad: "Estable todo el año",
      competencia: "Poca competencia directa",
      observaciones: "Centro comercial cercano",
    },
    facturacion: {
      franjas: {
        partidas: partidasFactDesde([
          { nombre: "Desayuno", clientesEsperados: 0,    ticketMedio: 0  },
          { nombre: "Comida",   clientesEsperados: 1100, ticketMedio: 17 },
          { nombre: "Cena",     clientesEsperados: 500,  ticketMedio: 19 },
        ]),
      },
      acuerdos: { partidas: partidasFactDesde([{ nombre: "Acuerdos con marcas", clientesEsperados: 0, ticketMedio: 0 }]) },
      eventos:  { partidas: partidasFactDesde([{ nombre: "Eventos privados", clientesEsperados: 24, ticketMedio: 60 }]) },
      tienda:   { partidas: partidasFactDesde([{ nombre: "Tienda / Take-away", clientesEsperados: 150, ticketMedio: 15 }]) },
    },
    costes: {
      generales: {
        partidas: partidasDesde([
          { nombre: "Alquiler del local", fijo: 2400, variablePct: 0 },
          { nombre: "Suministros (luz, agua, gas)", fijo: 600, variablePct: 1 },
          { nombre: "Internet y telefonía", fijo: 70, variablePct: 0 },
          { nombre: "Seguros", fijo: 200, variablePct: 0 },
          { nombre: "Asesoría / gestoría", fijo: 200, variablePct: 0 },
          { nombre: "Limpieza y consumibles", fijo: 180, variablePct: 1 },
          { nombre: "Mantenimiento e instalaciones", fijo: 150, variablePct: 1 },
        ]),
      },
      personal: {
        partidas: partidasDesde([
          { nombre: "Jefe de cocina", fijo: 2500, variablePct: 0 },
          { nombre: "Equipo de cocina", fijo: 3500, variablePct: 1 },
          { nombre: "Equipo de sala", fijo: 2700, variablePct: 2 },
          { nombre: "Seguridad social", fijo: 2000, variablePct: 1 },
          { nombre: "Formación", fijo: 150, variablePct: 0 },
          { nombre: "Uniformes y EPI", fijo: 150, variablePct: 1 },
        ]),
      },
      producto: {
        partidas: partidasDesde([
          { nombre: "Materia prima cocina", fijo: 500, variablePct: 19 },
          { nombre: "Bebidas (vinos y cervezas)", fijo: 150, variablePct: 7 },
          { nombre: "Refrescos y aguas", fijo: 80, variablePct: 2 },
          { nombre: "Postres y panadería", fijo: 40, variablePct: 1 },
          { nombre: "Mermas y desperdicios", fijo: 30, variablePct: 1 },
        ]),
      },
      marketing: {
        partidas: partidasDesde([
          { nombre: "Community manager / RRSS", fijo: 300, variablePct: 0 },
          { nombre: "Publicidad online (Ads)", fijo: 150, variablePct: 1 },
          { nombre: "Diseño y creatividades", fijo: 50, variablePct: 0 },
          { nombre: "Cartelería y menús impresos", fijo: 50, variablePct: 0 },
          { nombre: "Promociones y eventos", fijo: 50, variablePct: 1 },
        ]),
      },
    },
    procedencia: [],
    destinos: [],
    amortizacion: [],
    creado: "2026-04-01",
    viabilidad: "viable",
    actividad: "no_activo",
    local: bloqueLocalInicial(),
    imagenMarca: imagenMarcaInicial(),
    propuesta: propuestaGastronomicaInicial(),
    ocupacion: bloqueOcupacionInicial(),
  },
];
