/**
 * Clasificador del catálogo de Ágora → nuestro modelo (compra / venta / elaboración).
 *
 * LIBRERÍA PURA: sin BD, sin red, sin `use server`. Todo lo que entra viene por
 * parámetros y todo lo que sale es un objeto. Así se puede probar sin tocar prod.
 *
 * ─── POR QUÉ EXISTE (Iván 25-ago) ───────────────────────────────────────────
 * Ágora NO distingue compra / venta / elaboración: tiene "productos" con atributos
 * sueltos que se solapan. Traducirlos a nuestro modelo no es leer un dato, es
 * INTERPRETARLO, y equivocarse tiene coste (marcar como compra algo que era
 * elaboración lo deja sin escandallo y el coste sale mal para siempre).
 *
 * Por eso este módulo NO importa nada: sólo PROPONE, con el motivo escrito, para
 * que una persona apruebe. La decisión final siempre es del usuario.
 *
 * ─── TRES ERRORES DE LECTURA QUE ESTE MÓDULO CORRIGE ────────────────────────
 * Verificados contra la API de Ágora en vivo el 25-ago:
 *
 *  1. El precio de venta está en `Prices[].MainPrice` (lista `PriceListId: 1`),
 *     NO en `SalePrices[].Price`. Leyéndolo mal salían 0 productos con precio
 *     cuando Danza Macabra tiene 9,75 € — justo el precio de la carta.
 *
 *  2. `Addins` / `AskForAddins` NO significa "es una elaboración": en Ágora
 *     significa "al vender, pregunta por complementos" (un gin-tonic pregunta
 *     qué tónica). Usándolo como señal salían 249 "elaboraciones" en Bacanal.
 *
 *  3. El catálogo NO es único por empresa: las FAMILIAS separan local
 *     (HABANA / BACANAL / HABA-BACA). Sin filtrar por familia, importar los 639
 *     productos metía ~180 del otro local en cada empresa.
 *
 * ─── LO QUE NO SE LEE (límite explícito, visible en pantalla) ───────────────
 * Color de botón, tiempo de preparación, códigos de barras, orden de comanda.
 */

import type { AgoraProducto } from "@/features/logistica/types/importador-catalogo";

// ─── LOCAL AL QUE PERTENECE UN PRODUCTO (por familia) ────────────────────────

export type LocalAgora = "BACANAL" | "HABANA" | "AMBOS";

/**
 * Deduce a qué local pertenece un producto por el NOMBRE de su familia.
 * Es la señal que Ágora usa de facto: hay familias "HABANA", "BACANAL",
 * "HABA/BACA" y muchas con el local en el nombre ("RONES BACANAL").
 * Sin señal clara → AMBOS (se ofrece en las dos, que es el caso de la mayoría
 * de bebidas y limpieza).
 */
export function localDeFamilia(nombreFamilia: string | null | undefined): LocalAgora {
  const f = (nombreFamilia ?? "").toUpperCase().trim();
  if (!f) return "AMBOS";
  if (f === "HABANA") return "HABANA";
  if (f === "BACANAL") return "BACANAL";
  if (f === "HABA/BACA" || f === "BACA/MENU") return "AMBOS";
  // "RONES BACANAL", "MENUS BACANAL", "REFRESCOS BACANAL"…
  if (f.includes("BACANAL")) return "BACANAL";
  if (f.includes("HABANA")) return "HABANA";
  return "AMBOS";
}

// ─── LO QUE NO ES MERCANCÍA ─────────────────────────────────────────────────

/**
 * Familias que no son producto de restaurante. No entran al catálogo de
 * Logística (otra cosa es que interesen como ingreso, pero eso no es este módulo).
 */
const FAMILIAS_NO_MERCANCIA = new Set([
  "PROPINA",
  "PROMOCIONES",
  "ENTRADAS",
  "CONSUMOS",
]);

/**
 * Patrones de nombre que delatan un apunte del TPV, no un producto:
 *   - "Otros 10 %", "Productos varios 21%" → cajones contables de IVA
 *   - "Ud. Extra Vieira"                   → suplemento de línea, no mercancía
 *   - "Entrada Puerta", "Reservado…"       → aforo de discoteca
 *   - "Persona Faltante", "Señal Adelantada" → cargos de mesa / cobros a cuenta
 */
const PATRONES_NO_MERCANCIA: Array<{ re: RegExp; motivo: string }> = [
  { re: /^otros\s+[\d.,]+\s*%/i, motivo: "cajón contable de IVA, no un producto" },
  { re: /^productos?\s+varios/i, motivo: "cajón contable de IVA, no un producto" },
  { re: /^ud\.?\s*extra/i, motivo: "suplemento de línea del TPV, no mercancía" },
  { re: /^(entrada|reservado)\s/i, motivo: "aforo de discoteca, no mercancía" },
  { re: /^suplemento\s/i, motivo: "suplemento de venta, no mercancía" },
  { re: /^persona\s+faltante/i, motivo: "cargo de mesa, no un producto" },
  { re: /^se[ñn]al\s+adelantada/i, motivo: "cobro a cuenta, no un producto" },
  { re: /^(una\s+copa|botella)\s*(anticipada|puerta|premium|\d+)?$/i, motivo: "aforo de discoteca, no mercancía" },
  { re: /^copa\s+(anticipada|puerta)/i, motivo: "aforo de discoteca, no mercancía" },
];

/** ¿Este producto de Ágora es un apunte del TPV en vez de mercancía real? */
export function motivoNoMercancia(
  nombre: string,
  nombreFamilia: string | null | undefined,
): string | null {
  const fam = (nombreFamilia ?? "").toUpperCase().trim();
  if (FAMILIAS_NO_MERCANCIA.has(fam)) return `la familia "${nombreFamilia}" no es mercancía`;
  for (const { re, motivo } of PATRONES_NO_MERCANCIA) {
    if (re.test(nombre.trim())) return motivo;
  }
  return null;
}

// ─── PRECIO Y COSTE ─────────────────────────────────────────────────────────

/** Lista de precios "de carta". Ágora tiene varias (1, 8, 10, 13) con precios distintos. */
export const LISTA_PRECIO_CARTA = 1;

/**
 * Precio de venta de la lista de carta. Si el producto no está en esa lista,
 * devuelve null (NO cae a otra lista en silencio: un precio de otra tarifa
 * metido como si fuera el de carta es un error caro).
 */
export function precioDeCarta(p: AgoraProducto): number | null {
  const linea = (p.Prices ?? []).find((x) => x.PriceListId === LISTA_PRECIO_CARTA);
  const valor = linea?.MainPrice;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/** Coste del almacén de esta empresa; si no hay, el coste general del producto. */
export function costeDeAlmacen(p: AgoraProducto, warehouseId: number): number | null {
  const porAlmacen = (p.CostPrices ?? []).find((x) => x.WarehouseId === warehouseId);
  const valor = porAlmacen?.CostPrice ?? p.CostPrice;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * Umbral por encima del cual un coste unitario se marca en rojo para revisión.
 * En Ágora hay costes corruptos reales: `Carrillera Ternera` a 4.149,90 € y
 * cócteles a 57-70 € (están dados de alta como si fueran la botella entera).
 */
export const COSTE_SOSPECHOSO_DESDE = 50;

// ─── DECISIÓN PROPUESTA ─────────────────────────────────────────────────────

/**
 * Qué proponemos hacer con cada producto de Ágora que no tenemos.
 * `vincular` es clave: el producto YA existe creado a mano y sólo le falta el
 * `agora_id`. Crear otro generaría el duplicado que justamente queremos evitar.
 */
export type DecisionImportacion =
  | "venta"
  | "compra"
  | "elaboracion"
  | "vincular"
  | "revisar"
  | "descartar";

export interface PropuestaProducto {
  agoraId: string;
  nombre: string;
  familia: string;
  local: LocalAgora;
  precioVenta: number | null;
  coste: number | null;
  stockAgora: number | null;
  vendidoPorPeso: boolean;
  /** Qué proponemos hacer, ya marcado en la UI. El usuario puede cambiarlo. */
  decision: DecisionImportacion;
  /** Por qué lo proponemos, en cristiano. Se muestra en la fila. */
  motivo: string;
  /** Producto nuestro con el que casa por nombre (para `vincular`). */
  existente: { id: string; nombre: string; tipo: string } | null;
  /**
   * Ficha de compra con la que enlazar por escandallo 1:1 (regla de bebidas de
   * Iván). Sólo se rellena en productos de venta cuya pareja de compra existe.
   */
  parejaCompra: { id: string; nombre: string } | null;
  /** Avisos en ámbar/rojo: coste fuera de rango, stock en decimales, sin precio. */
  avisos: string[];
}

export interface ProductoNuestro {
  id: string;
  nombre: string;
  tipo: string;
  agoraId: string | null;
}

/** Normaliza para comparar nombres: sin mayúsculas, acentos ni signos. */
export function normalizarNombre(s: string): string {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca la ficha de COMPRA que corresponde a una bebida/cóctel de venta.
 *
 * No basta con el nombre exacto: en el catálogo real la ficha de compra suele
 * llevar el prefijo del preparado del proveedor — el cóctel "Danza Macabra" se
 * compra como "Prebeach Danza Macabra". Sin esta tolerancia el enlace no se
 * propone y la bebida entra en almacén sin salir nunca.
 *
 * Sólo acepta que el nombre de venta esté CONTENIDO en el de compra (por
 * palabras completas), nunca al revés: "Cola" no debe casar con "Coca Cola".
 * Si hay varias candidatas se coge la más corta (la más parecida) y si empatan
 * no se propone ninguna, para no adivinar.
 */
function buscarParejaCompra(
  clave: string,
  comprasPorNombre: Map<string, ProductoNuestro>,
): ProductoNuestro | null {
  const exacta = comprasPorNombre.get(clave);
  if (exacta) return exacta;
  if (clave.length < 4) return null; // nombres muy cortos: demasiado riesgo

  const candidatas: ProductoNuestro[] = [];
  for (const [nombreCompra, producto] of comprasPorNombre) {
    if (nombreCompra === clave) continue;
    // Palabras completas: " danza macabra " dentro de " prebeach danza macabra ".
    if (` ${nombreCompra} `.includes(` ${clave} `)) candidatas.push(producto);
  }
  if (candidatas.length === 0) return null;

  candidatas.sort((a, b) => a.nombre.length - b.nombre.length);
  if (
    candidatas.length > 1 &&
    candidatas[0].nombre.length === candidatas[1].nombre.length
  ) {
    return null; // empate: que lo decida una persona
  }
  return candidatas[0];
}

/**
 * Clasifica UN producto de Ágora que no existe en nuestro catálogo por `agora_id`.
 *
 * Orden de las reglas (importa: la primera que casa manda):
 *   1. ¿Es un apunte del TPV (IVA, aforo, suplemento)?      → descartar
 *   2. ¿Existe ya con ese nombre creado a mano?             → vincular
 *   3. ¿Tiene precio de carta y es vendible?                → venta
 *   4. ¿Es vendible pero SIN precio?                        → revisar
 *   5. Resto                                                → compra
 */
export function clasificarProducto(
  p: AgoraProducto,
  opts: {
    nombreFamilia: string | null;
    warehouseId: number;
    /** Nuestro catálogo indexado por nombre normalizado. */
    porNombre: Map<string, ProductoNuestro>;
    /** Fichas de COMPRA por nombre normalizado (para la regla de bebidas). */
    comprasPorNombre: Map<string, ProductoNuestro>;
  },
): PropuestaProducto {
  const { nombreFamilia, warehouseId, porNombre, comprasPorNombre } = opts;

  const nombre = (p.Name ?? "").trim();
  const familia = nombreFamilia ?? "(sin familia)";
  const precioVenta = precioDeCarta(p);
  const coste = costeDeAlmacen(p, warehouseId);
  const stockAgora = typeof p.__stock === "number" ? p.__stock : null;
  const clave = normalizarNombre(nombre);
  const existente = porNombre.get(clave) ?? null;
  const avisos: string[] = [];

  // Avisos de dato sucio — nunca se importan en silencio.
  if (coste != null && coste > COSTE_SOSPECHOSO_DESDE) {
    avisos.push(`Coste de ${coste.toFixed(2)} € — revísalo, parece el de la caja/botella entera`);
  }
  if (stockAgora != null && stockAgora !== 0 && !Number.isInteger(stockAgora)) {
    avisos.push(`Stock en decimales (${stockAgora}) — en Ágora está dado de alta como fracción de botella`);
  }
  if (stockAgora != null && stockAgora < 0) {
    avisos.push(`Stock negativo en Ágora (${stockAgora})`);
  }

  // 1. Apunte del TPV, no mercancía.
  const noMercancia = motivoNoMercancia(nombre, nombreFamilia);
  if (noMercancia) {
    return {
      agoraId: String(p.Id), nombre, familia, local: localDeFamilia(nombreFamilia),
      precioVenta, coste, stockAgora, vendidoPorPeso: !!p.IsSoldByWeight,
      decision: "descartar", motivo: noMercancia, existente, parejaCompra: null, avisos,
    };
  }

  // 2. Ya existe creado a mano → vincular, NUNCA crear otro.
  if (existente) {
    return {
      agoraId: String(p.Id), nombre, familia, local: localDeFamilia(nombreFamilia),
      precioVenta, coste, stockAgora, vendidoPorPeso: !!p.IsSoldByWeight,
      decision: "vincular",
      motivo: `ya existe como "${existente.nombre}" (${existente.tipo}) — se enlaza, no se duplica`,
      existente,
      parejaCompra: null,
      avisos,
    };
  }

  // 3-5. Compra / venta / revisar.
  const vendible = !!p.SaleableAsMain;
  let decision: DecisionImportacion;
  let motivo: string;

  if (precioVenta != null && precioVenta > 0 && vendible) {
    decision = "venta";
    motivo = `se vende a ${precioVenta.toFixed(2)} €`;
  } else if (vendible) {
    decision = "revisar";
    motivo = "vendible en el TPV pero sin precio en la lista de carta";
    avisos.push("Sin precio de venta: ponle precio antes de importarlo como venta");
  } else {
    decision = "compra";
    motivo = "sin precio de venta — entra como producto de compra";
  }

  // Regla de bebidas (Iván 25-ago): una bebida vive dos veces (ficha de compra
  // = la botella que entra por albarán; ficha de venta = la consumición que se
  // cobra) y ambas van ENLAZADAS por escandallo 1:1. Si vamos a crear la de
  // venta y su pareja de compra ya existe, se propone el enlace.
  const parejaCompra = decision === "venta" ? buscarParejaCompra(clave, comprasPorNombre) : null;
  if (parejaCompra) {
    avisos.push(
      `Se enlazará con la ficha de compra "${parejaCompra.nombre}". Revisa la cantidad: ` +
        `1 = una unidad entera; para copas de una botella es una fracción (p. ej. 0,071)`,
    );
  }

  return {
    agoraId: String(p.Id), nombre, familia, local: localDeFamilia(nombreFamilia),
    precioVenta, coste, stockAgora, vendidoPorPeso: !!p.IsSoldByWeight,
    decision, motivo, existente: null,
    parejaCompra: parejaCompra ? { id: parejaCompra.id, nombre: parejaCompra.nombre } : null,
    avisos,
  };
}

/**
 * Clasifica el catálogo entero para UNA empresa.
 * Descarta de entrada los productos del otro local (por familia) — sin esto,
 * importar los 639 metería ~180 productos ajenos en cada empresa.
 */
export function clasificarCatalogo(opts: {
  productos: AgoraProducto[];
  familiasPorId: Map<string, string>;
  empresa: "BACANAL" | "HABANA";
  warehouseId: number;
  nuestros: ProductoNuestro[];
}): { propuestas: PropuestaProducto[]; omitidosOtroLocal: number } {
  const { productos, familiasPorId, empresa, warehouseId, nuestros } = opts;

  const yaTenemos = new Set(
    nuestros.filter((n) => n.agoraId).map((n) => String(n.agoraId)),
  );
  const porNombre = new Map<string, ProductoNuestro>();
  const comprasPorNombre = new Map<string, ProductoNuestro>();
  for (const n of nuestros) {
    const k = normalizarNombre(n.nombre);
    if (!porNombre.has(k)) porNombre.set(k, n);
    if (n.tipo === "compra" && !comprasPorNombre.has(k)) comprasPorNombre.set(k, n);
  }

  const propuestas: PropuestaProducto[] = [];
  let omitidosOtroLocal = 0;

  for (const p of productos) {
    if (p.DeletionDate) continue;              // borrado en Ágora
    if (yaTenemos.has(String(p.Id))) continue; // ya lo tenemos vinculado

    const familia = familiasPorId.get(String(p.FamilyId)) ?? null;
    const local = localDeFamilia(familia);
    if (local !== "AMBOS" && local !== empresa) {
      omitidosOtroLocal++;
      continue;
    }

    propuestas.push(
      clasificarProducto(p, { nombreFamilia: familia, warehouseId, porNombre, comprasPorNombre }),
    );
  }

  return { propuestas, omitidosOtroLocal };
}

// ─── RESUMEN PARA LA CABECERA ───────────────────────────────────────────────

export interface ResumenPropuestas {
  total: number;
  porDecision: Record<DecisionImportacion, number>;
  conAvisos: number;
  /** Altas reales = todo menos lo que se descarta y lo que sólo se vincula. */
  altasReales: number;
}

export function resumirPropuestas(props: PropuestaProducto[]): ResumenPropuestas {
  const porDecision: Record<DecisionImportacion, number> = {
    venta: 0, compra: 0, elaboracion: 0, vincular: 0, revisar: 0, descartar: 0,
  };
  let conAvisos = 0;
  for (const p of props) {
    porDecision[p.decision]++;
    if (p.avisos.length > 0) conAvisos++;
  }
  return {
    total: props.length,
    porDecision,
    conAvisos,
    altasReales: porDecision.venta + porDecision.compra + porDecision.elaboracion,
  };
}
